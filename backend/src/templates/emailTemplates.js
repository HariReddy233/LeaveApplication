import { generateLeaveICS } from '../services/icsCalendarService.js';

const fmt = (dateValue) => new Date(dateValue).toLocaleDateString('en-IN', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: 'short',
  day: '2-digit',
});

const fullName = (user) => {
  if (!user) return 'User';
  if (user.full_name) return user.full_name;
  const first = user.first_name || '';
  const last = user.last_name || '';
  return `${first} ${last}`.trim() || user.email || 'User';
};

const autoApproveNote = (leaveDetails) => leaveDetails.auto_approved_by_system
  ? '<p><strong>Note:</strong> This leave was auto-approved as no admin action was taken within 24 hours.</p>'
  : '';

const leaveSummary = (leaveDetails) => `
  <table cellpadding="6" cellspacing="0" border="0">
    <tr><td><strong>Leave Type:</strong></td><td>${leaveDetails.leave_type}</td></tr>
    <tr><td><strong>From:</strong></td><td>${fmt(leaveDetails.start_date)}</td></tr>
    <tr><td><strong>To:</strong></td><td>${fmt(leaveDetails.end_date)}</td></tr>
    <tr><td><strong>Days:</strong></td><td>${leaveDetails.number_of_days}</td></tr>
    <tr><td><strong>Status:</strong></td><td>${leaveDetails.status}</td></tr>
  </table>
`;

const extractEmailAddress = (value) => {
  if (!value) return null;
  const match = String(value).match(/<([^>]+)>/);
  if (match?.[1]) {
    return match[1].trim();
  }
  return String(value).trim();
};

export const leaveFullyApprovedEmployee = async (employee, leaveDetails, fromAddress) => {
  const organizerEmail =
    process.env.EMAIL_ORGANIZER ||
    process.env.EMAIL_USER ||
    process.env.SMTP_USER ||
    extractEmailAddress(fromAddress) ||
    'noreply@localhost';

  const icsContent = generateLeaveICS({
    employeeName: fullName(employee),
    employeeEmail: employee.email,
    leaveType: leaveDetails.leave_type,
    startDate: leaveDetails.start_date,
    endDate: leaveDetails.end_date,
    approvedOn: new Date(),
    organizerEmail,
  });

  return {
    from: fromAddress,
    to: employee.email,
    subject: `Leave Approved: ${leaveDetails.leave_type} (${fmt(leaveDetails.start_date)} to ${fmt(leaveDetails.end_date)})`,
    html: `
      <h2>Your Leave Has Been Approved</h2>
      <p>Dear ${fullName(employee)},</p>
      <p>Your leave request has been fully approved.</p>
      ${leaveSummary(leaveDetails)}
      ${autoApproveNote(leaveDetails)}
      <p>A calendar invite is attached. Click <strong>Accept</strong> in Outlook/Calendar to add the leave days.</p>
      <p>Regards,<br/>Leave Management System</p>
    `,
    alternatives: [
      {
        contentType: 'text/calendar; charset=utf-8; method=REQUEST',
        content: icsContent,
      },
    ],
    attachments: [
      {
        filename: `leave-${leaveDetails.start_date}-to-${leaveDetails.end_date}.ics`,
        content: icsContent,
        contentType: 'text/calendar; charset=utf-8; method=REQUEST',
        contentDisposition: 'attachment',
      },
    ],
  };
};

export const leaveFullyApprovedHOD = (hod, employee, leaveDetails, fromAddress) => {
  const organizerEmail =
    process.env.EMAIL_ORGANIZER ||
    process.env.EMAIL_USER ||
    process.env.SMTP_USER ||
    extractEmailAddress(fromAddress) ||
    'noreply@localhost';

  const icsContent = generateLeaveICS({
    employeeName: fullName(employee),
    employeeEmail: employee.email,
    leaveType: leaveDetails.leave_type,
    startDate: leaveDetails.start_date,
    endDate: leaveDetails.end_date,
    approvedOn: new Date(),
    organizerEmail,
  });

  return {
    from: fromAddress,
    to: hod.email,
    subject: `Leave Fully Approved: ${fullName(employee)} (${leaveDetails.leave_type})`,
    html: `
      <h2>Leave Fully Approved</h2>
      <p>Dear ${fullName(hod)},</p>
      <p>The leave request from ${fullName(employee)} is now fully approved.</p>
      ${leaveSummary(leaveDetails)}
      ${autoApproveNote(leaveDetails)}
      <p>A calendar invite is attached. Click <strong>Accept</strong> in Outlook/Calendar to add the leave days.</p>
      <p>Regards,<br/>Leave Management System</p>
    `,
    alternatives: [
      {
        contentType: 'text/calendar; charset=utf-8; method=REQUEST',
        content: icsContent,
      },
    ],
    attachments: [
      {
        filename: `leave-${leaveDetails.start_date}-to-${leaveDetails.end_date}.ics`,
        content: icsContent,
        contentType: 'text/calendar; charset=utf-8; method=REQUEST',
        contentDisposition: 'attachment',
      },
    ],
  };
};

export const leaveFullyApprovedAdmin = (admin, employee, leaveDetails, autoApproved, fromAddress) => {
  const organizerEmail =
    process.env.EMAIL_ORGANIZER ||
    process.env.EMAIL_USER ||
    process.env.SMTP_USER ||
    extractEmailAddress(fromAddress) ||
    'noreply@localhost';

  const icsContent = generateLeaveICS({
    employeeName: fullName(employee),
    employeeEmail: employee.email,
    leaveType: leaveDetails.leave_type,
    startDate: leaveDetails.start_date,
    endDate: leaveDetails.end_date,
    approvedOn: new Date(),
    organizerEmail,
  });

  return {
    from: fromAddress,
    to: admin.email,
    subject: `Leave Fully Approved: ${fullName(employee)} (${leaveDetails.leave_type})`,
    html: `
      <h2>Leave Fully Approved</h2>
      <p>Dear ${fullName(admin)},</p>
      <p>The leave request from ${fullName(employee)} is now fully approved.</p>
      ${leaveSummary(leaveDetails)}
      ${autoApproved ? '<p><strong>Note:</strong> This leave was auto-approved as no admin action was taken within 24 hours.</p>' : ''}
      <p>A calendar invite is attached. Click <strong>Accept</strong> in Outlook/Calendar to add the leave days.</p>
      <p>Regards,<br/>Leave Management System</p>
    `,
    alternatives: [
      {
        contentType: 'text/calendar; charset=utf-8; method=REQUEST',
        content: icsContent,
      },
    ],
    attachments: [
      {
        filename: `leave-${leaveDetails.start_date}-to-${leaveDetails.end_date}.ics`,
        content: icsContent,
        contentType: 'text/calendar; charset=utf-8; method=REQUEST',
        contentDisposition: 'attachment',
      },
    ],
  };
};

export const leaveRejectedEmployee = (employee, leaveDetails, rejectedBy, reason, fromAddress) => ({
  from: fromAddress,
  to: employee.email,
  subject: `Leave Rejected: ${leaveDetails.leave_type} (${fmt(leaveDetails.start_date)} to ${fmt(leaveDetails.end_date)})`,
  html: `
    <h2>Your Leave Was Rejected</h2>
    <p>Dear ${fullName(employee)},</p>
    <p>Your leave request was rejected.</p>
    ${leaveSummary(leaveDetails)}
    <p><strong>Rejected By:</strong> ${rejectedBy || 'Approver'}</p>
    <p><strong>Reason:</strong> ${reason || 'No reason provided'}</p>
    <p>Regards,<br/>Leave Management System</p>
  `,
});