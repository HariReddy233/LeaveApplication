import database from '../../config/database.js';
import { getDefaultFrom, getEmailTransporter, isEmailConfigured } from '../../config/email.js';
import {
  leaveFullyApprovedAdmin,
  leaveFullyApprovedEmployee,
  leaveFullyApprovedHOD,
  leaveRejectedEmployee,
} from '../../templates/emailTemplates.js';

const getLeaveContext = async (leaveId) => {
  const leaveResult = await database.query(
    `SELECT la.*, e.user_id as employee_user_id,
            COALESCE(e.team, u.department) as employee_team,
            u.email as employee_email, u.first_name as employee_first_name, u.last_name as employee_last_name,
            COALESCE(NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''), u.first_name, u.last_name, u.email) as employee_name
     FROM leave_applications la
     JOIN employees e ON la.employee_id = e.employee_id
     JOIN users u ON e.user_id = u.user_id
     WHERE la.id = $1`,
    [leaveId]
  );

  if (leaveResult.rows.length === 0) {
    return null;
  }

  const leave = leaveResult.rows[0];

  const hodResult = await database.query(
    `SELECT u.user_id, u.email, u.first_name, u.last_name,
            COALESCE(NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''), u.first_name, u.last_name, u.email) as full_name
     FROM employees e
     JOIN users u ON e.user_id = u.user_id
     WHERE e.employee_id = $1
     LIMIT 1`,
    [leave.approved_by_hod || 0]
  );

  const adminsResult = await database.query(
    `SELECT user_id, email, first_name, last_name,
            COALESCE(NULLIF(TRIM(first_name || ' ' || last_name), ''), first_name, last_name, email) as full_name
     FROM users
     WHERE LOWER(TRIM(role)) = 'admin' AND (status = 'Active' OR status IS NULL)`
  );

  let teamMembersResult = { rows: [] };
  if (leave.employee_team) {
    teamMembersResult = await database.query(
      `SELECT DISTINCT u.user_id, u.email, u.first_name, u.last_name,
              COALESCE(NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''), u.first_name, u.last_name, u.email) as full_name
       FROM employees e
       JOIN users u ON e.user_id = u.user_id
       WHERE COALESCE(e.team, u.department) = $1
         AND e.user_id != $2
         AND (u.status = 'Active' OR u.status IS NULL)`,
      [leave.employee_team, leave.employee_user_id]
    );
  }

  return {
    leave,
    employee: {
      email: leave.employee_email,
      first_name: leave.employee_first_name,
      last_name: leave.employee_last_name,
      full_name: leave.employee_name,
    },
    hod: hodResult.rows[0] || null,
    admins: adminsResult.rows,
    teamMembers: teamMembersResult.rows,
  };
};

export const sendFullApprovalEmails = async (leaveId) => {
  try {
    if (!isEmailConfigured()) {
      console.warn(`Email not configured; skipping final approval notifications for leave ${leaveId}`);
      return;
    }

    const context = await getLeaveContext(leaveId);
    if (!context) {
      console.warn(`Leave context not found; skipping final approval notifications for leave ${leaveId}`);
      return;
    }

    const { leave, employee, hod, admins, teamMembers } = context;
    const transporter = getEmailTransporter();
    const fromAddress = getDefaultFrom();
    const notifiedEmails = new Set();

    try {
      const employeeMail = await leaveFullyApprovedEmployee(employee, leave, fromAddress);
      await transporter.sendMail(employeeMail);
      if (employee?.email) notifiedEmails.add(String(employee.email).toLowerCase().trim());
    } catch (error) {
      console.error(`Failed to send final approval email to employee for leave ${leaveId}:`, error.message);
    }

    if (hod?.email) {
      try {
        const hodMail = leaveFullyApprovedHOD(hod, employee, leave, fromAddress);
        await transporter.sendMail(hodMail);
        notifiedEmails.add(String(hod.email).toLowerCase().trim());
      } catch (error) {
        console.error(`Failed to send final approval email to HOD for leave ${leaveId}:`, error.message);
      }
    }

    for (const admin of admins) {
      if (!admin?.email) continue;
      const normalizedAdminEmail = String(admin.email).toLowerCase().trim();
      if (notifiedEmails.has(normalizedAdminEmail)) continue;
      try {
        const adminMail = leaveFullyApprovedAdmin(admin, employee, leave, Boolean(leave.auto_approved_by_system), fromAddress);
        await transporter.sendMail(adminMail);
        notifiedEmails.add(normalizedAdminEmail);
      } catch (error) {
        console.error(`Failed to send final approval email to admin ${admin.email} for leave ${leaveId}:`, error.message);
      }
    }

    for (const teamMember of teamMembers) {
      if (!teamMember?.email) continue;
      const normalizedTeamEmail = String(teamMember.email).toLowerCase().trim();
      if (notifiedEmails.has(normalizedTeamEmail)) continue;
      try {
        const teamMail = leaveFullyApprovedAdmin(teamMember, employee, leave, Boolean(leave.auto_approved_by_system), fromAddress);
        await transporter.sendMail(teamMail);
        notifiedEmails.add(normalizedTeamEmail);
      } catch (error) {
        console.error(`Failed to send final approval email to team member ${teamMember.email} for leave ${leaveId}:`, error.message);
      }
    }
  } catch (error) {
    console.error(`Unexpected failure in sendFullApprovalEmails for leave ${leaveId}:`, error.message);
  }
};

export const sendRejectedEmployeeEmail = async (leaveId, rejectedBy, reason) => {
  try {
    if (!isEmailConfigured()) {
      console.warn(`Email not configured; skipping rejection notification for leave ${leaveId}`);
      return;
    }

    const context = await getLeaveContext(leaveId);
    if (!context) {
      console.warn(`Leave context not found; skipping rejection notification for leave ${leaveId}`);
      return;
    }

    const transporter = getEmailTransporter();
    const fromAddress = getDefaultFrom();
    const { leave, employee } = context;

    try {
      const rejectionMail = leaveRejectedEmployee(employee, leave, rejectedBy, reason, fromAddress);
      await transporter.sendMail(rejectionMail);
    } catch (error) {
      console.error(`Failed to send rejection email to employee for leave ${leaveId}:`, error.message);
    }
  } catch (error) {
    console.error(`Unexpected failure in sendRejectedEmployeeEmail for leave ${leaveId}:`, error.message);
  }
};