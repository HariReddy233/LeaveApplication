import cron from 'node-cron';
import database from '../config/database.js';
import { sendFullApprovalEmails } from '../services/Leave/LeaveNotificationService.js';

const updateLeaveBalanceForFinalApproval = async (client, leave) => {
  const year = new Date(leave.start_date).getFullYear();

  const leaveTypeResult = await client.query(
    `SELECT max_days FROM leave_types WHERE name = $1 AND is_active = true LIMIT 1`,
    [leave.leave_type]
  );

  const defaultBalance = leaveTypeResult.rows[0]?.max_days || 0;

  await client.query(
    `INSERT INTO leave_balance (employee_id, leave_type, total_balance, used_balance, remaining_balance, year)
     VALUES ($1, $2, $4, 0, $4, $3)
     ON CONFLICT (employee_id, leave_type, year)
     DO UPDATE SET
       total_balance = COALESCE(leave_balance.total_balance, EXCLUDED.total_balance),
       updated_at = NOW()`,
    [leave.employee_id, leave.leave_type, year, defaultBalance]
  );

  await client.query(
    `UPDATE leave_balance
     SET used_balance = used_balance + $4,
         remaining_balance = GREATEST(0, total_balance - (used_balance + $4)),
         updated_at = NOW()
     WHERE employee_id = $1
       AND leave_type = $2
       AND year = $3`,
    [leave.employee_id, leave.leave_type, year, leave.number_of_days]
  );
};

const autoApproveExpiredLeaves = async () => {
  const client = await database.connect();
  const finalizedIds = [];

  try {
    await client.query('BEGIN');

    const candidates = await client.query(
      `SELECT id
       FROM leave_applications
       WHERE hod_status = 'Approved'
         AND admin_status = 'Pending'
         AND admin_deadline IS NOT NULL
         AND admin_deadline < NOW()
         AND COALESCE(auto_approved_by_system, FALSE) = FALSE
       ORDER BY admin_deadline ASC
       FOR UPDATE SKIP LOCKED`
    );

    for (const row of candidates.rows) {
      const leaveId = row.id;

      const currentLeaveResult = await client.query(
        `SELECT *
         FROM leave_applications
         WHERE id = $1
           AND hod_status = 'Approved'
           AND admin_status = 'Pending'
           AND COALESCE(auto_approved_by_system, FALSE) = FALSE
         FOR UPDATE`,
        [leaveId]
      );

      if (currentLeaveResult.rows.length === 0) {
        continue;
      }

      const leave = currentLeaveResult.rows[0];

      const updateResult = await client.query(
        `UPDATE leave_applications
         SET admin_status = 'Approved',
             admin_remark = 'Auto-approved by system after 24 hours without admin action',
             admin_approved_at = NOW(),
             status = 'Approved',
             auto_approved_by_system = TRUE,
             updated_at = NOW()
         WHERE id = $1
           AND admin_status = 'Pending'
           AND COALESCE(auto_approved_by_system, FALSE) = FALSE
         RETURNING id`,
        [leaveId]
      );

      if (updateResult.rows.length === 0) {
        continue;
      }

      if ((leave.status || '').toLowerCase() !== 'approved') {
        await updateLeaveBalanceForFinalApproval(client, leave);
      }

      finalizedIds.push(leaveId);
      console.log(`Auto-approved leave ${leaveId} after admin deadline`);
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Auto-approve cron failed:', error.message);
  } finally {
    client.release();
  }

  for (const leaveId of finalizedIds) {
    try {
      await sendFullApprovalEmails(leaveId);
    } catch (error) {
      console.error(`Failed final notifications for auto-approved leave ${leaveId}:`, error.message);
    }
  }
};

export const startAutoApproveJob = () => {
  const task = cron.schedule(
    '*/5 * * * *',
    async () => {
      await autoApproveExpiredLeaves();
    },
    { timezone: 'Asia/Kolkata' }
  );

  console.log('Auto-approve job started (every 5 minutes)');
  return task;
};