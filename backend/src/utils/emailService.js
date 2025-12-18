//Internal Lib Import
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Create reusable transporter
let transporter = null;

const getTransporter = () => {
  if (!transporter) {
    const smtpConfig = {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true' || false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    };
    
    transporter = nodemailer.createTransport(smtpConfig);
    
    // Verify connection (async, non-blocking)
    transporter.verify((error) => {
      if (error) {
        console.error('SMTP Connection Error:', error.message);
      }
    });
  }
  return transporter;
};

/**
 * Send Leave Application Email to Approver (HOD/Admin)
 */
export const sendLeaveApplicationEmail = async ({
  to,
  approver_name,
  employee_email,
  employee_name,
  leave_type,
  start_date,
  end_date,
  number_of_days,
  reason,
  hod_status = null,
  hod_name = null,
  approveToken = null,
  rejectToken = null,
  baseUrl = null
}) => {
  try {
    // Check if email is configured
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.error('❌ EMAIL CONFIGURATION ERROR: SMTP_USER or SMTP_PASS missing in .env file');
      console.error('❌ Email will not be sent. Please configure SMTP settings in .env file');
      throw new Error('Email not configured: SMTP_USER or SMTP_PASS missing');
    }

    if (!to) {
      console.error('❌ EMAIL ERROR: Recipient email is missing');
      throw new Error('Recipient email is missing');
    }

    const mailTransporter = getTransporter();

    // Format dates
    const startDate = new Date(start_date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const endDate = new Date(end_date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'Consultare Leave Management'}" <${process.env.EMAIL_FROM || process.env.SMTP_USER}>`,
      to: to,
      subject: `New Leave Application Pending Approval - ${employee_name}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
              line-height: 1.6; 
              color: #1f2937; 
              background-color: #f3f4f6; 
              padding: 20px;
            }
            .email-wrapper { 
              max-width: 600px; 
              margin: 0 auto; 
              background: #ffffff;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .content { 
              padding: 20px 24px; 
              background: #ffffff;
            }
            .greeting {
              font-size: 14px;
              color: #374151;
              margin-bottom: 12px;
            }
            .intro-text {
              font-size: 13px;
              color: #6b7280;
              margin-bottom: 16px;
              line-height: 1.5;
            }
            .info-card { 
              background: #f9fafb; 
              padding: 12px 16px; 
              border-radius: 6px; 
              margin: 12px 0; 
              border-left: 3px solid #4f46e5;
            }
            .info-card-title {
              font-size: 12px;
              font-weight: 600;
              color: #4f46e5;
              text-transform: uppercase;
              letter-spacing: 0.3px;
              margin-bottom: 10px;
              display: flex;
              align-items: center;
              gap: 6px;
            }
            .info-row {
              display: flex;
              padding: 8px 0;
              border-bottom: 1px solid #e5e7eb;
            }
            .info-row:last-child {
              border-bottom: none;
            }
            .info-label {
              font-weight: 600;
              color: #374151;
              min-width: 120px;
              font-size: 12px;
            }
            .info-value {
              color: #6b7280;
              font-size: 12px;
              flex: 1;
            }
            .reason-box {
              background: #ffffff;
              padding: 10px 12px;
              border-radius: 4px;
              margin-top: 8px;
              border: 1px solid #e5e7eb;
            }
            .reason-text {
              color: #374151;
              font-size: 12px;
              line-height: 1.5;
              white-space: pre-wrap;
            }
            .action-note {
              background: #eff6ff;
              border: 1px solid #bfdbfe;
              border-radius: 6px;
              padding: 12px;
              margin: 16px 0;
              text-align: center;
            }
            .action-note-text {
              color: #1e40af;
              font-size: 12px;
              font-weight: 500;
            }
            .footer { 
              text-align: center; 
              padding: 24px; 
              background: #f9fafb;
              border-top: 1px solid #e5e7eb;
            }
            .footer-text {
              color: #9ca3af; 
              font-size: 12px; 
              line-height: 1.6;
            }
            .footer-text a {
              color: #4f46e5;
              text-decoration: none;
            }
            @media only screen and (max-width: 600px) {
              body { padding: 10px; }
              .content { padding: 24px 16px; }
              .info-row { flex-direction: column; gap: 4px; }
              .info-label { min-width: auto; }
            }
          </style>
        </head>
        <body>
          <div class="email-wrapper">
            <div class="content">
              <div class="greeting">Dear ${approver_name || 'Approver'},</div>
              
              ${hod_status && hod_name ? `
              <div class="status-notice" style="background: ${hod_status === 'Approved' ? '#ecfdf5' : '#fef2f2'}; border-left: 3px solid ${hod_status === 'Approved' ? '#10b981' : '#ef4444'}; padding: 12px; border-radius: 6px; margin-bottom: 16px;">
                <p style="font-size: 13px; color: #374151; margin: 0;">
                  <strong>HOD Status:</strong> <span style="color: ${hod_status === 'Approved' ? '#059669' : '#dc2626'}; font-weight: 600;">${hod_status}</span> by <strong>${hod_name}</strong>
                </p>
                <p style="font-size: 12px; color: #6b7280; margin: 4px 0 0 0;">
                  ${hod_status === 'Approved' ? 'Waiting for your approval/rejection.' : 'HOD has rejected this leave application.'}
                </p>
              </div>
              ` : ''}
              
              <p class="intro-text">
                ${hod_status && hod_name ? 
                  `A leave application has been ${hod_status.toLowerCase()} by HOD (${hod_name}) and ${hod_status === 'Approved' ? 'is waiting for your review and approval' : 'requires your attention'}.` :
                  'A new leave application has been submitted and requires your review and approval.'
                } 
                Please review the details below and take appropriate action.
              </p>
              
              <div class="info-card">
                <div class="info-card-title">
                  <span>👤</span>
                  <span>Employee Information</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Name:</span>
                  <span class="info-value">${employee_name || 'N/A'}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Email:</span>
                  <span class="info-value">${employee_email || 'N/A'}</span>
                </div>
              </div>
              
              <div class="info-card">
                <div class="info-card-title">
                  <span>📅</span>
                  <span>Leave Details</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Leave Type:</span>
                  <span class="info-value">${leave_type || 'N/A'}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Start Date:</span>
                  <span class="info-value">${startDate}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">End Date:</span>
                  <span class="info-value">${endDate}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Duration:</span>
                  <span class="info-value">${number_of_days || 'N/A'} day${number_of_days !== 1 ? 's' : ''}</span>
                </div>
                ${reason ? `
                <div class="reason-box">
                  <div style="font-weight: 600; color: #374151; margin-bottom: 6px; font-size: 12px;">Reason:</div>
                  <div class="reason-text">${reason}</div>
                </div>
                ` : ''}
              </div>
              
              ${approveToken && rejectToken ? `
              <div class="action-buttons" style="margin: 24px 0; text-align: center;">
                <a href="${baseUrl || 'http://localhost:3000'}/api/leave/email-approve?token=${approveToken}" 
                   style="display: inline-block; background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 0 8px; font-size: 14px;">
                  ✅ Approve
                </a>
                <a href="${baseUrl || 'http://localhost:3000'}/api/leave/email-reject?token=${rejectToken}" 
                   style="display: inline-block; background-color: #ef4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 0 8px; font-size: 14px;">
                  ❌ Reject
                </a>
              </div>
              <div class="action-note" style="background: #fef3c7; border: 1px solid #fbbf24; border-radius: 6px; padding: 12px; margin: 16px 0; text-align: center;">
                <p class="action-note-text" style="color: #92400e; font-size: 12px; font-weight: 500;">
                  ⚡ You can approve or reject this leave request directly from this email, or log in to the Leave Management Portal for more details.
                </p>
              </div>
              ` : `
              <div class="action-note">
                <p class="action-note-text">
                  ⚡ Please log in to the Leave Management Portal to review and approve this application.
                </p>
              </div>
              `}
            </div>
            <div class="footer">
              <p class="footer-text">
                This is an automated notification from the Consultare Leave Management System.<br>
                Please do not reply to this email.
              </p>
              <p class="footer-text" style="margin-top: 12px; color: #d1d5db;">
                &copy; ${new Date().getFullYear()} Consultare. All rights reserved.
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `New Leave Application Pending Approval

Dear ${approver_name || 'Approver'},

${hod_status && hod_name ? 
  `A leave application has been ${hod_status.toLowerCase()} by HOD (${hod_name}) and ${hod_status === 'Approved' ? 'is waiting for your review and approval' : 'requires your attention'}.\n\n` :
  'A new leave application requires your approval.\n\n'
}${hod_status && hod_name ? `HOD Status: ${hod_status} by ${hod_name}\n\n` : ''}

Employee: ${employee_name || 'N/A'}
Email: ${employee_email || 'N/A'}
Leave Type: ${leave_type || 'N/A'}
Start Date: ${startDate}
End Date: ${endDate}
Number of Days: ${number_of_days || 'N/A'}
${reason ? `Reason: ${reason}` : ''}

Please log in to the Leave Management Portal to review and approve this application.

This is an automated email. Please do not reply.
© ${new Date().getFullYear()} Consultare Leave Management System`
    };

    const info = await mailTransporter.sendMail(mailOptions);
    return info;
  } catch (error) {
    console.error('❌ Failed to send leave application email:', error.message);
    console.error('Error details:', error);
    throw error;
  }
};

/**
 * Send Leave Approval/Rejection Email to Employee
 */
export const sendLeaveApprovalEmail = async ({
  employee_email,
  employee_name,
  leave_type,
  start_date,
  end_date,
  number_of_days,
  status,
  remark
}, approverName = 'Admin') => {
  try {
    // Check if email is configured
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.warn('⚠️ Email not configured. SMTP_USER or SMTP_PASS missing in .env file');
      return;
    }

    if (!employee_email) {
      console.warn('⚠️ Cannot send email: employee email is missing');
      return;
    }

    const mailTransporter = getTransporter();

    // Format dates
    const startDate = new Date(start_date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const endDate = new Date(end_date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const isApproved = status?.toLowerCase() === 'approved';
    const statusColor = isApproved ? '#10b981' : '#ef4444';
    const statusText = isApproved ? 'APPROVED' : 'REJECTED';

    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'Consultare Leave Management'}" <${process.env.EMAIL_FROM || process.env.SMTP_USER}>`,
      to: employee_email,
      subject: `Leave Application ${statusText} - ${leave_type}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
              line-height: 1.6; 
              color: #1f2937; 
              background-color: #f3f4f6; 
              padding: 20px;
            }
            .email-wrapper { 
              max-width: 600px; 
              margin: 0 auto; 
              background: #ffffff;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .content { 
              padding: 20px 24px; 
              background: #ffffff;
            }
            .greeting {
              font-size: 14px;
              color: #374151;
              margin-bottom: 12px;
            }
            .status-section {
              text-align: center;
              margin: 16px 0 20px 0;
            }
            .status-badge { 
              display: inline-block; 
              padding: 8px 16px; 
              border-radius: 6px; 
              color: white; 
              font-weight: 600; 
              font-size: 14px;
              background: ${statusColor}; 
              margin: 8px 0;
              letter-spacing: 0.3px;
              box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            }
            .approver-info {
              color: #6b7280;
              font-size: 12px;
              margin-top: 6px;
            }
            .info-card { 
              background: #f9fafb; 
              padding: 12px 16px; 
              border-radius: 6px; 
              margin: 12px 0; 
              border-left: 3px solid ${statusColor};
            }
            .info-card-title {
              font-size: 12px;
              font-weight: 600;
              color: ${statusColor};
              text-transform: uppercase;
              letter-spacing: 0.3px;
              margin-bottom: 10px;
              display: flex;
              align-items: center;
              gap: 6px;
            }
            .info-row {
              display: flex;
              padding: 8px 0;
              border-bottom: 1px solid #e5e7eb;
            }
            .info-row:last-child {
              border-bottom: none;
            }
            .info-label {
              font-weight: 600;
              color: #374151;
              min-width: 120px;
              font-size: 12px;
            }
            .info-value {
              color: #6b7280;
              font-size: 12px;
              flex: 1;
            }
            .remark-box {
              background: #ffffff;
              padding: 10px 12px;
              border-radius: 4px;
              margin-top: 8px;
              border: 1px solid #e5e7eb;
            }
            .remark-text {
              color: #374151;
              font-size: 12px;
              line-height: 1.5;
              white-space: pre-wrap;
            }
            .success-message {
              background: ${isApproved ? '#ecfdf5' : '#fef2f2'};
              border: 1px solid ${isApproved ? '#a7f3d0' : '#fecaca'};
              border-radius: 6px;
              padding: 12px;
              margin: 16px 0;
              text-align: center;
            }
            .success-message-text {
              color: ${isApproved ? '#065f46' : '#991b1b'};
              font-size: 12px;
              font-weight: 500;
            }
            .footer { 
              text-align: center; 
              padding: 16px; 
              background: #f9fafb;
              border-top: 1px solid #e5e7eb;
            }
            .footer-text {
              color: #9ca3af; 
              font-size: 11px; 
              line-height: 1.5;
            }
            .footer-text a {
              color: #4f46e5;
              text-decoration: none;
            }
            @media only screen and (max-width: 600px) {
              body { padding: 10px; }
              .content { padding: 24px 16px; }
              .info-row { flex-direction: column; gap: 4px; }
              .info-label { min-width: auto; }
            }
          </style>
        </head>
        <body>
          <div class="email-wrapper">
            <div class="content">
              <div class="greeting">Dear ${employee_name || 'Employee'},</div>
              
              <div class="status-section">
                <div class="status-badge">${statusText}</div>
                <div class="approver-info">Approved by: ${approverName}</div>
              </div>
              
              <div class="info-card">
                <div class="info-card-title">
                  <span>📅</span>
                  <span>Leave Details</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Leave Type:</span>
                  <span class="info-value">${leave_type || 'N/A'}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Start Date:</span>
                  <span class="info-value">${startDate}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">End Date:</span>
                  <span class="info-value">${endDate}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Duration:</span>
                  <span class="info-value">${number_of_days || 'N/A'} day${number_of_days !== 1 ? 's' : ''}</span>
                </div>
                ${remark ? `
                <div class="remark-box">
                  <div style="font-weight: 600; color: #374151; margin-bottom: 8px; font-size: 13px;">Remarks:</div>
                  <div class="remark-text">${remark}</div>
                </div>
                ` : ''}
              </div>
              
              <div class="success-message">
                <p class="success-message-text">
                  ${isApproved ? '🎉 Your leave request has been approved. Enjoy your time off!' : 'ℹ️ Your leave request has been rejected. Please contact your manager for more details.'}
                </p>
              </div>
              
              <p style="color: #6b7280; font-size: 14px; margin-top: 24px; text-align: center;">
                Please log in to the Leave Management Portal to view more details.
              </p>
            </div>
            <div class="footer">
              <p class="footer-text">
                This is an automated notification from the Consultare Leave Management System.<br>
                Please do not reply to this email.
              </p>
              <p class="footer-text" style="margin-top: 12px; color: #d1d5db;">
                &copy; ${new Date().getFullYear()} Consultare. All rights reserved.
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `Leave Application ${statusText}

Dear ${employee_name || 'Employee'},

Your leave application has been ${statusText} by ${approverName}.

Leave Type: ${leave_type || 'N/A'}
Start Date: ${startDate}
End Date: ${endDate}
Number of Days: ${number_of_days || 'N/A'}
${remark ? `Remarks: ${remark}` : ''}

Please log in to the Leave Management Portal to view more details.

Thank you for using our Leave Management System.

This is an automated email. Please do not reply.
© ${new Date().getFullYear()} Consultare Leave Management System`
    };

    const info = await mailTransporter.sendMail(mailOptions);
    console.log(`✅ Leave ${statusText.toLowerCase()} email sent to ${employee_email} - Message ID: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error(`❌ Failed to send leave ${status?.toLowerCase()} email:`, error.message);
    console.error('Error details:', error);
    throw error;
  }
};

/**
 * Send Informational Leave Notification to Other Users (Not the Applicant)
 * This is for awareness only - not an action email
 */
export const sendLeaveInfoNotificationEmail = async ({
  to,
  recipient_name,
  employee_name,
  leave_type,
  start_date,
  end_date,
  number_of_days,
  approver_name
}) => {
  try {
    // Check if email is configured
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.warn('⚠️ Email not configured. SMTP_USER or SMTP_PASS missing in .env file');
      return;
    }

    if (!to) {
      console.warn('⚠️ Cannot send email: recipient email is missing');
      return;
    }

    const mailTransporter = getTransporter();

    // Format dates
    const startDate = new Date(start_date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const endDate = new Date(end_date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'Consultare Leave Management'}" <${process.env.EMAIL_FROM || process.env.SMTP_USER}>`,
      to: to,
      subject: `Leave Notification: ${employee_name} will be on leave`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
              line-height: 1.6; 
              color: #1f2937; 
              background-color: #f3f4f6; 
              padding: 20px;
            }
            .email-wrapper { 
              max-width: 600px; 
              margin: 0 auto; 
              background: #ffffff;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .content { 
              padding: 20px 24px; 
              background: #ffffff;
            }
            .greeting {
              font-size: 14px;
              color: #374151;
              margin-bottom: 12px;
            }
            .info-badge {
              display: inline-block;
              padding: 8px 16px;
              border-radius: 6px;
              color: white;
              font-weight: 600;
              font-size: 14px;
              background: #3b82f6;
              margin: 8px 0;
              letter-spacing: 0.3px;
            }
            .info-card { 
              background: #f0f9ff; 
              padding: 12px 16px; 
              border-radius: 6px; 
              margin: 12px 0; 
              border-left: 3px solid #3b82f6;
            }
            .info-row {
              display: flex;
              padding: 8px 0;
              border-bottom: 1px solid #e5e7eb;
            }
            .info-row:last-child {
              border-bottom: none;
            }
            .info-label {
              font-weight: 600;
              color: #374151;
              min-width: 120px;
              font-size: 12px;
            }
            .info-value {
              color: #6b7280;
              font-size: 12px;
              flex: 1;
            }
            .footer { 
              text-align: center; 
              padding: 16px; 
              background: #f9fafb;
              border-top: 1px solid #e5e7eb;
            }
            .footer-text {
              color: #9ca3af; 
              font-size: 11px; 
            }
          </style>
        </head>
        <body>
          <div class="email-wrapper">
            <div class="content">
              <div class="greeting">Dear ${recipient_name || 'Team Member'},</div>
              
              <div style="text-align: center; margin: 16px 0;">
                <div class="info-badge">📢 Leave Notification</div>
              </div>
              
              <p style="color: #374151; font-size: 14px; margin: 16px 0;">
                This is to inform you that <strong>${employee_name}</strong>'s leave has been approved and they will not be available during this period.
              </p>
              
              <div class="info-card">
                <div style="font-weight: 600; color: #1e40af; margin-bottom: 10px; font-size: 13px;">
                  📅 Leave Details
                </div>
                <div class="info-row">
                  <span class="info-label">Employee:</span>
                  <span class="info-value">${employee_name}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Leave Type:</span>
                  <span class="info-value">${leave_type || 'N/A'}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Start Date:</span>
                  <span class="info-value">${startDate}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">End Date:</span>
                  <span class="info-value">${endDate}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Duration:</span>
                  <span class="info-value">${number_of_days || 'N/A'} day${number_of_days !== 1 ? 's' : ''}</span>
                </div>
                ${approver_name ? `
                <div class="info-row">
                  <span class="info-label">Approved by:</span>
                  <span class="info-value">${approver_name}</span>
                </div>
                ` : ''}
              </div>
              
              <p style="color: #6b7280; font-size: 13px; margin-top: 20px; font-style: italic;">
                This is an informational notification for your awareness. No action is required.
              </p>
            </div>
            <div class="footer">
              <p class="footer-text">
                This is an automated notification from the Consultare Leave Management System.<br>
                Please do not reply to this email.
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `Leave Notification

Dear ${recipient_name || 'Team Member'},

This is to inform you that ${employee_name}'s leave has been approved and they will not be available during this period.

Employee: ${employee_name}
Leave Type: ${leave_type || 'N/A'}
Start Date: ${startDate}
End Date: ${endDate}
Number of Days: ${number_of_days || 'N/A'}
${approver_name ? `Approved by: ${approver_name}` : ''}

This is an informational notification for your awareness. No action is required.

© ${new Date().getFullYear()} Consultare Leave Management System`
    };

    const info = await mailTransporter.sendMail(mailOptions);
    console.log(`✅ Leave info notification sent to ${to} - Message ID: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error(`❌ Failed to send leave info notification email:`, error.message);
    throw error;
  }
};

/**
 * Send Password Reset OTP Email
 */
export const sendPasswordResetOTPEmail = async ({
  to,
  user_name,
  otp
}) => {
  try {
    // Check if email is configured
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.warn('⚠️ Email not configured. SMTP_USER or SMTP_PASS missing in .env file');
      return;
    }

    if (!to) {
      console.warn('⚠️ Cannot send email: recipient email is missing');
      return;
    }

    const mailTransporter = getTransporter();

    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'Consultare Leave Management'}" <${process.env.EMAIL_FROM || process.env.SMTP_USER}>`,
      to: to,
      subject: `Password Reset OTP - Consultare Leave Management`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
              line-height: 1.6; 
              color: #1f2937; 
              background-color: #f3f4f6; 
              padding: 20px;
            }
            .email-wrapper { 
              max-width: 600px; 
              margin: 0 auto; 
              background: #ffffff;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .content { 
              padding: 20px 24px; 
              background: #ffffff;
            }
            .greeting {
              font-size: 14px;
              color: #374151;
              margin-bottom: 12px;
            }
            .otp-box {
              background: #eff6ff;
              border: 2px solid #3b82f6;
              border-radius: 8px;
              padding: 20px;
              margin: 20px 0;
              text-align: center;
            }
            .otp-code {
              font-size: 32px;
              font-weight: 700;
              color: #1e40af;
              letter-spacing: 8px;
              font-family: 'Courier New', monospace;
            }
            .warning {
              background: #fef3c7;
              border-left: 3px solid #f59e0b;
              padding: 12px;
              border-radius: 6px;
              margin: 16px 0;
            }
            .warning-text {
              color: #92400e;
              font-size: 12px;
              font-weight: 500;
            }
            .footer { 
              text-align: center; 
              padding: 24px; 
              background: #f9fafb;
              border-top: 1px solid #e5e7eb;
            }
            .footer-text {
              color: #9ca3af; 
              font-size: 12px; 
              line-height: 1.6;
            }
          </style>
        </head>
        <body>
          <div class="email-wrapper">
            <div class="content">
              <div class="greeting">Dear ${user_name || 'User'},</div>
              
              <p style="color: #374151; font-size: 14px; margin-bottom: 16px;">
                You have requested to reset your password. Please use the OTP below to complete the password reset process.
              </p>
              
              <div class="otp-box">
                <p style="color: #6b7280; font-size: 12px; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px;">Your OTP Code</p>
                <div class="otp-code">${otp}</div>
                <p style="color: #6b7280; font-size: 11px; margin-top: 8px;">Valid for 2 minutes only</p>
              </div>
              
              <div class="warning">
                <p class="warning-text">
                  ⚠️ For security reasons, this OTP will expire in 2 minutes. Do not share this code with anyone.
                </p>
              </div>
              
              <p style="color: #6b7280; font-size: 13px; margin-top: 20px;">
                If you did not request this password reset, please ignore this email or contact support if you have concerns.
              </p>
            </div>
            <div class="footer">
              <p class="footer-text">
                This is an automated notification from the Consultare Leave Management System.<br>
                Please do not reply to this email.
              </p>
              <p class="footer-text" style="margin-top: 12px; color: #d1d5db;">
                &copy; ${new Date().getFullYear()} Consultare. All rights reserved.
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `Password Reset OTP

Dear ${user_name || 'User'},

You have requested to reset your password. Please use the OTP below:

${otp}

This OTP is valid for 2 minutes only.

If you did not request this password reset, please ignore this email.

© ${new Date().getFullYear()} Consultare Leave Management System`
    };

    const info = await mailTransporter.sendMail(mailOptions);
    console.log(`✅ Password reset OTP email sent to ${to} - Message ID: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error(`❌ Failed to send password reset OTP email:`, error.message);
    throw error;
  }
};

export default {
  sendLeaveApplicationEmail,
  sendLeaveApprovalEmail,
  sendPasswordResetOTPEmail
};
