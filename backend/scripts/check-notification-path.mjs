import dotenv from 'dotenv';
import database from '../src/config/database.js';
import { sendFullApprovalEmails } from '../src/services/Leave/LeaveNotificationService.js';

dotenv.config();

const showSchema = async () => {
  const schema = await database.query(
    `SELECT column_name, data_type, is_generated, generation_expression
     FROM information_schema.columns
     WHERE table_name = 'leave_balance'
       AND column_name IN ('total_balance', 'used_balance', 'remaining_balance')
     ORDER BY ordinal_position`
  );
  console.log('leave_balance schema:', schema.rows);
};

const testNotifications = async () => {
  const leaveRes = await database.query(
    `SELECT id, status, hod_status, admin_status, employee_id, leave_type, start_date, end_date
     FROM leave_applications
     WHERE status = 'Approved'
     ORDER BY updated_at DESC
     LIMIT 1`
  );

  if (!leaveRes.rows.length) {
    console.log('No approved leave found to test notifications.');
    return;
  }

  const leave = leaveRes.rows[0];
  console.log('Testing sendFullApprovalEmails for leave:', leave);

  await sendFullApprovalEmails(leave.id);
  console.log('sendFullApprovalEmails() completed without throwing.');
};

try {
  await showSchema();
  await testNotifications();
} catch (error) {
  console.error('Diagnostic failed:', error.message);
  console.error(error);
  process.exitCode = 1;
} finally {
  await database.end().catch(() => {});
}
