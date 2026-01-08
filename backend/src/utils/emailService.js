//Internal Lib Import
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import { getHRPortalUrl } from './approvalToken.js';

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
  approvalToken = null,
  baseUrl = null
}) => {
  try {
    // Debug logging
    console.log(`📧 Preparing email to ${to}`);
    console.log(`📧 Approval token provided: ${approvalToken ? 'YES (' + approvalToken.substring(0, 10) + '...)' : 'NO'}`);
    console.log(`📧 Base URL: ${baseUrl || 'NOT PROVIDED'}`);
    
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
              
              ${approvalToken ? `
              <div class="action-buttons" style="margin: 24px 0; text-align: center;">
                <a href="${baseUrl || 'http://localhost:3001'}/api/v1/Leave/email-action?token=${approvalToken}&action=approve" 
                   style="display: inline-block; background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 0 8px; font-size: 14px;">
                  ✅ Approve
                </a>
                <a href="${baseUrl || 'http://localhost:3001'}/api/v1/Leave/email-action?token=${approvalToken}&action=reject" 
                   style="display: inline-block; background-color: #ef4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 0 8px; font-size: 14px;">
                  ❌ Reject
                </a>
              </div>
              <div class="action-note" style="background: #fef3c7; border: 1px solid #fbbf24; border-radius: 6px; padding: 12px; margin: 16px 0; text-align: center;">
                <p class="action-note-text" style="color: #92400e; font-size: 12px; font-weight: 500;">
                  ⚡ You can approve or reject this leave request directly from this email. This link can only be used once. You can also log in to the HR Portal for more details.
                </p>
              </div>
              ` : `
              <div class="action-note">
                <p class="action-note-text">
                  ⚡ Please log in to the HR Portal to review and approve this application.
                </p>
              </div>
              `}
            </div>
            <div class="footer">
              <p class="footer-text">
                This is an automated notification from the Consultare Leave Management System.<br>
                Please do not reply to this email.
              </p>
              <p class="footer-text" style="margin-top: 12px;">
                <a href="${getHRPortalUrl()}" style="color: #4f46e5; text-decoration: none; font-weight: 600;">View in HR Portal</a> | 
                <a href="${getHRPortalUrl()}" style="color: #4f46e5; text-decoration: none;">${getHRPortalUrl()}</a>
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

Please log in to the HR Portal to review and approve this application.

HR Portal: ${getHRPortalUrl()}

This is an automated email. Please do not reply.
© ${new Date().getFullYear()} Consultare Leave Management System`
    };

    // Debug: Verify buttons are in HTML
    if (approvalToken) {
      const htmlIncludesButtons = mailOptions.html.includes('action-buttons') && 
                                  mailOptions.html.includes('email-action?token=') &&
                                  mailOptions.html.includes('action=approve');
      console.log(`✅ EMAIL DEBUG: Approval token provided: ${approvalToken.substring(0, 10)}...`);
      console.log(`✅ EMAIL DEBUG: HTML includes buttons: ${htmlIncludesButtons ? 'YES ✅' : 'NO ❌'}`);
      if (!htmlIncludesButtons) {
        console.error('❌ EMAIL DEBUG ERROR: Buttons not found in HTML even though token is provided!');
        console.error('❌ HTML snippet (first 500 chars):', mailOptions.html.substring(0, 500));
      } else {
        console.log(`✅ EMAIL DEBUG: Button URLs will use baseUrl: ${baseUrl || 'http://localhost:3001'}`);
      }
    } else {
      console.warn(`⚠️ EMAIL DEBUG: No approval token provided, buttons will NOT be included in email to ${to}`);
    }
    
    const info = await mailTransporter.sendMail(mailOptions);
    console.log(`✅ Leave application email sent to ${to} - Message ID: ${info.messageId}`);
    console.log(`✅ Email includes approval buttons: ${approvalToken ? 'YES' : 'NO'}`);
    if (approvalToken && baseUrl) {
      const approveUrl = `${baseUrl}/api/v1/Leave/email-action?token=${approvalToken.substring(0, 10)}...&action=approve`;
      console.log(`✅ Approval button URL: ${approveUrl}`);
    }
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
                Please log in to the HR Portal to view more details.
              </p>
            </div>
            <div class="footer">
              <p class="footer-text">
                This is an automated notification from the Consultare Leave Management System.<br>
                Please do not reply to this email.
              </p>
              <p class="footer-text" style="margin-top: 12px;">
                <a href="${getHRPortalUrl()}" style="color: #4f46e5; text-decoration: none; font-weight: 600;">View in HR Portal</a> | 
                <a href="${getHRPortalUrl()}" style="color: #4f46e5; text-decoration: none;">${getHRPortalUrl()}</a>
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

Please log in to the HR Portal to view more details.

HR Portal: ${getHRPortalUrl()}

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
              <p class="footer-text" style="margin-top: 12px;">
                <a href="${getHRPortalUrl()}" style="color: #4f46e5; text-decoration: none; font-weight: 600;">View in HR Portal</a> | 
                <a href="${getHRPortalUrl()}" style="color: #4f46e5; text-decoration: none;">${getHRPortalUrl()}</a>
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

HR Portal: ${getHRPortalUrl()}

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
              <p class="footer-text" style="margin-top: 12px;">
                <a href="${getHRPortalUrl()}" style="color: #4f46e5; text-decoration: none; font-weight: 600;">View in HR Portal</a> | 
                <a href="${getHRPortalUrl()}" style="color: #4f46e5; text-decoration: none;">${getHRPortalUrl()}</a>
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

HR Portal: ${getHRPortalUrl()}

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

/**
 * Send Holiday Reminder Email
 */
export const sendHolidayReminderEmail = async ({
  to,
  recipient_name,
  holiday_name,
  holiday_date,
  days_until,
  notification_type,
  hrPortalUrl
}) => {
  try {
    const mailTransporter = getTransporter();
    if (!mailTransporter) {
      throw new Error('Email transporter not configured');
    }

    const holidayDateObj = new Date(holiday_date);
    const formattedDate = holidayDateObj.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    let subject = '';
    let messageText = '';
    let titleText = '';

    if (notification_type === '2_days_before') {
      subject = `Upcoming Holiday: ${holiday_name} in 2 Days`;
      titleText = 'Upcoming Holiday';
      messageText = `This is a reminder that ${holiday_name} is coming up in 2 days (${formattedDate}).`;
    } else if (notification_type === '1_day_before') {
      subject = `Reminder: Holiday Tomorrow - ${holiday_name}`;
      titleText = 'Holiday Tomorrow';
      messageText = `This is a reminder that tomorrow (${formattedDate}) is ${holiday_name}.`;
    } else if (notification_type === 'on_day') {
      subject = `Today is a Holiday: ${holiday_name}`;
      titleText = 'Holiday Today';
      messageText = `Today (${formattedDate}) is ${holiday_name}. Enjoy your holiday!`;
    }

    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'Consultare Leave Management'}" <${process.env.SMTP_USER}>`,
      to: to,
      subject: subject,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject}</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f6f8fb;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); padding: 32px;">
              <div style="text-align: center; margin-bottom: 24px;">
                <h1 style="color: #10b981; font-size: 28px; margin: 0;">🎉 ${titleText}</h1>
              </div>
              
              <div style="margin-bottom: 24px;">
                <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
                  Dear ${recipient_name || 'Team Member'},
                </p>
                <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
                  ${messageText}
                </p>
              </div>

              <div style="background: #f0fdf4; border-left: 4px solid #10b981; padding: 16px; margin: 24px 0; border-radius: 4px;">
                <p style="color: #166534; font-size: 16px; font-weight: 600; margin: 0 0 8px 0;">
                  ${holiday_name}
                </p>
                <p style="color: #166534; font-size: 14px; margin: 0;">
                  ${formattedDate}
                </p>
              </div>

              <div style="text-align: center; margin: 32px 0;">
                <a href="${hrPortalUrl || 'https://hrportal.consultare.io/'}" 
                   style="display: inline-block; padding: 12px 24px; background: #4f46e5; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">
                  View in HR Portal
                </a>
              </div>

              <div style="border-top: 1px solid #e5e7eb; padding-top: 24px; margin-top: 32px;">
                <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
                  This is an automated notification from the Consultare Leave Management System.<br>
                  <a href="${hrPortalUrl || 'https://hrportal.consultare.io/'}" style="color: #4f46e5; text-decoration: none;">${hrPortalUrl || 'https://hrportal.consultare.io/'}</a>
                </p>
                <p style="color: #d1d5db; font-size: 12px; text-align: center; margin-top: 12px;">
                  &copy; ${new Date().getFullYear()} Consultare. All rights reserved.
                </p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `${subject}

Dear ${recipient_name || 'Team Member'},

${messageText}

Holiday: ${holiday_name}
Date: ${formattedDate}

HR Portal: ${hrPortalUrl || 'https://hrportal.consultare.io/'}

© ${new Date().getFullYear()} Consultare Leave Management System`
    };

    const info = await mailTransporter.sendMail(mailOptions);
    console.log(`✅ Holiday reminder email sent to ${to} - Message ID: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error(`❌ Failed to send holiday reminder email:`, error.message);
    throw error;
  }
};

/**
 * Send Comp-Off Application Email to Approver (HOD/Admin)
 * Comp-Off specific email template
 */
export const sendCompOffApplicationEmail = async ({
  to,
  approver_name,
  employee_email,
  employee_name,
  start_date,
  end_date,
  number_of_days,
  reason,
  hod_status = null,
  hod_name = null,
  approvalToken = null,
  baseUrl = null
}) => {
  try {
    // Check if email is configured
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.error('❌ EMAIL CONFIGURATION ERROR: SMTP_USER or SMTP_PASS missing in .env file');
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
      subject: `Compensatory Off Application Pending Approval - ${employee_name}`,
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
            .comp-off-badge {
              display: inline-block;
              padding: 8px 16px;
              border-radius: 6px;
              color: white;
              font-weight: 600;
              font-size: 14px;
              background: #f59e0b;
              margin: 8px 0;
              letter-spacing: 0.3px;
            }
            .info-card { 
              background: #fffbeb; 
              padding: 12px 16px; 
              border-radius: 6px; 
              margin: 12px 0; 
              border-left: 3px solid #f59e0b;
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
              min-width: 140px;
              font-size: 12px;
            }
            .info-value {
              color: #6b7280;
              font-size: 12px;
              flex: 1;
            }
            .note-box {
              background: #fef3c7;
              border: 1px solid #fbbf24;
              border-radius: 6px;
              padding: 12px;
              margin: 16px 0;
            }
            .note-text {
              color: #92400e;
              font-size: 12px;
              line-height: 1.5;
            }
          </style>
        </head>
        <body>
          <div class="email-wrapper">
            <div class="content">
              <div class="comp-off-badge">COMPENSATORY OFF</div>
              <div style="font-size: 14px; color: #374151; margin-bottom: 12px;">Dear ${approver_name || 'Approver'},</div>
              
              ${hod_status && hod_name ? `
              <div style="background: ${hod_status === 'Approved' ? '#ecfdf5' : '#fef2f2'}; border-left: 3px solid ${hod_status === 'Approved' ? '#10b981' : '#ef4444'}; padding: 12px; border-radius: 6px; margin-bottom: 16px;">
                <p style="font-size: 13px; color: #374151; margin: 0;">
                  <strong>HOD Status:</strong> <span style="color: ${hod_status === 'Approved' ? '#059669' : '#dc2626'}; font-weight: 600;">${hod_status}</span> by <strong>${hod_name}</strong>
                </p>
              </div>
              ` : ''}
              
              <p style="color: #374151; font-size: 13px; margin-bottom: 16px;">
                A <strong>Compensatory Off</strong> application has been submitted and requires your review and approval.
              </p>
              
              <div class="info-card">
                <div style="font-weight: 600; color: #92400e; margin-bottom: 10px; font-size: 13px;">
                  👤 Employee Information
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
                <div style="font-weight: 600; color: #92400e; margin-bottom: 10px; font-size: 13px;">
                  📅 Comp-Off Details
                </div>
                <div class="info-row">
                  <span class="info-label">Date(s) Worked:</span>
                  <span class="info-value">${startDate} ${startDate !== endDate ? 'to ' + endDate : ''}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Comp-Off Days:</span>
                  <span class="info-value">${number_of_days || 'N/A'} day${number_of_days !== 1 ? 's' : ''} (non-working days)</span>
                </div>
                ${reason ? `
                <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #e5e7eb;">
                  <div style="font-weight: 600; color: #374151; margin-bottom: 6px; font-size: 12px;">Reason:</div>
                  <div style="color: #6b7280; font-size: 12px; line-height: 1.5;">${reason}</div>
                </div>
                ` : ''}
              </div>
              
              <div class="note-box">
                <p class="note-text">
                  <strong>Note:</strong> Comp-Off is granted for working on non-working days (weekends or organization holidays). 
                  Upon approval, the employee's leave balance will be increased accordingly.
                </p>
              </div>
              
              ${approvalToken ? `
              <div style="margin: 24px 0; text-align: center;">
                <a href="${baseUrl || 'http://localhost:3001'}/api/v1/Leave/email-action?token=${approvalToken}&action=approve" 
                   style="display: inline-block; background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 0 8px; font-size: 14px;">
                  ✅ Approve
                </a>
                <a href="${baseUrl || 'http://localhost:3001'}/api/v1/Leave/email-action?token=${approvalToken}&action=reject" 
                   style="display: inline-block; background-color: #ef4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 0 8px; font-size: 14px;">
                  ❌ Reject
                </a>
              </div>
              ` : `
              <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 12px; margin: 16px 0; text-align: center;">
                <p style="color: #1e40af; font-size: 12px; font-weight: 500;">
                  ⚡ Please log in to the HR Portal to review and approve this Comp-Off application.
                </p>
              </div>
              `}
            </div>
            <div style="text-align: center; padding: 24px; background: #f9fafb; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 12px; line-height: 1.6;">
                This is an automated notification from the Consultare Leave Management System.<br>
                Please do not reply to this email.
              </p>
              <p style="margin-top: 12px;">
                <a href="${getHRPortalUrl()}" style="color: #4f46e5; text-decoration: none; font-weight: 600;">View in HR Portal</a>
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `Compensatory Off Application Pending Approval

Dear ${approver_name || 'Approver'},

A Compensatory Off application has been submitted and requires your review and approval.

Employee: ${employee_name || 'N/A'}
Email: ${employee_email || 'N/A'}
Date(s) Worked: ${startDate} ${startDate !== endDate ? 'to ' + endDate : ''}
Comp-Off Days: ${number_of_days || 'N/A'} days (non-working days)
${reason ? `Reason: ${reason}` : ''}

Note: Comp-Off is granted for working on non-working days. Upon approval, the employee's leave balance will be increased accordingly.

Please log in to the HR Portal to review and approve this application.

HR Portal: ${getHRPortalUrl()}

This is an automated email. Please do not reply.
© ${new Date().getFullYear()} Consultare Leave Management System`
    };

    const info = await mailTransporter.sendMail(mailOptions);
    console.log(`✅ Comp-Off application email sent to ${to} - Message ID: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error('❌ Failed to send Comp-Off application email:', error.message);
    throw error;
  }
};

/**
 * Send Comp-Off Approval Email to Employee
 * Comp-Off specific approval email template
 */
export const sendCompOffApprovalEmail = async ({
  employee_email,
  employee_name,
  start_date,
  end_date,
  number_of_days,
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

    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'Consultare Leave Management'}" <${process.env.EMAIL_FROM || process.env.SMTP_USER}>`,
      to: employee_email,
      subject: `Compensatory Off Approved - ${number_of_days} Day${number_of_days !== 1 ? 's' : ''}`,
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
            .success-badge {
              display: inline-block;
              padding: 8px 16px;
              border-radius: 6px;
              color: white;
              font-weight: 600;
              font-size: 14px;
              background: #10b981;
              margin: 8px 0;
              letter-spacing: 0.3px;
            }
            .info-card { 
              background: #f0fdf4; 
              padding: 12px 16px; 
              border-radius: 6px; 
              margin: 12px 0; 
              border-left: 3px solid #10b981;
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
              min-width: 140px;
              font-size: 12px;
            }
            .info-value {
              color: #6b7280;
              font-size: 12px;
              flex: 1;
            }
            .balance-notice {
              background: #dbeafe;
              border: 1px solid #3b82f6;
              border-radius: 6px;
              padding: 12px;
              margin: 16px 0;
            }
            .balance-text {
              color: #1e40af;
              font-size: 12px;
              line-height: 1.5;
            }
          </style>
        </head>
        <body>
          <div class="email-wrapper">
            <div class="content">
              <div class="success-badge">COMPENSATORY OFF APPROVED</div>
              <div style="font-size: 14px; color: #374151; margin-bottom: 12px;">Dear ${employee_name || 'Employee'},</div>
              
              <p style="color: #374151; font-size: 14px; margin-bottom: 16px;">
                Your <strong>Compensatory Off</strong> application has been <strong style="color: #10b981;">approved</strong> by <strong>${approverName}</strong>.
              </p>
              
              <div class="info-card">
                <div style="font-weight: 600; color: #059669; margin-bottom: 10px; font-size: 13px;">
                  📅 Comp-Off Details
                </div>
                <div class="info-row">
                  <span class="info-label">Date(s) Worked:</span>
                  <span class="info-value">${startDate} ${startDate !== endDate ? 'to ' + endDate : ''}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Comp-Off Days:</span>
                  <span class="info-value">${number_of_days || 'N/A'} day${number_of_days !== 1 ? 's' : ''}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Approved by:</span>
                  <span class="info-value">${approverName}</span>
                </div>
                ${remark ? `
                <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #e5e7eb;">
                  <div style="font-weight: 600; color: #374151; margin-bottom: 6px; font-size: 12px;">Remarks:</div>
                  <div style="color: #6b7280; font-size: 12px; line-height: 1.5;">${remark}</div>
                </div>
                ` : ''}
              </div>
              
              <div class="balance-notice">
                <p class="balance-text">
                  <strong>✅ Balance Updated:</strong> Your leave balance has been increased by <strong>${number_of_days} day${number_of_days !== 1 ? 's' : ''}</strong> 
                  (Casual Leave for India / PTO for USA) as compensation for working on non-working days.
                </p>
              </div>
              
              <p style="color: #6b7280; font-size: 13px; margin-top: 20px; text-align: center;">
                Please log in to the HR Portal to view your updated leave balance.
              </p>
            </div>
            <div style="text-align: center; padding: 24px; background: #f9fafb; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 12px; line-height: 1.6;">
                This is an automated notification from the Consultare Leave Management System.<br>
                Please do not reply to this email.
              </p>
              <p style="margin-top: 12px;">
                <a href="${getHRPortalUrl()}" style="color: #4f46e5; text-decoration: none; font-weight: 600;">View in HR Portal</a>
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `Compensatory Off Approved

Dear ${employee_name || 'Employee'},

Your Compensatory Off application has been approved by ${approverName}.

Date(s) Worked: ${startDate} ${startDate !== endDate ? 'to ' + endDate : ''}
Comp-Off Days: ${number_of_days || 'N/A'} days
Approved by: ${approverName}
${remark ? `Remarks: ${remark}` : ''}

Balance Updated: Your leave balance has been increased by ${number_of_days} day${number_of_days !== 1 ? 's' : ''} (Casual Leave for India / PTO for USA).

Please log in to the HR Portal to view your updated leave balance.

HR Portal: ${getHRPortalUrl()}

Thank you for using our Leave Management System.

This is an automated email. Please do not reply.
© ${new Date().getFullYear()} Consultare Leave Management System`
    };

    const info = await mailTransporter.sendMail(mailOptions);
    console.log(`✅ Comp-Off approval email sent to ${employee_email} - Message ID: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error(`❌ Failed to send Comp-Off approval email:`, error.message);
    throw error;
  }
};

/**
 * Send Comp-Off Rejection Email to Employee
 * Comp-Off specific rejection email template
 */
export const sendCompOffRejectionEmail = async ({
  employee_email,
  employee_name,
  start_date,
  end_date,
  number_of_days,
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

    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'Consultare Leave Management'}" <${process.env.EMAIL_FROM || process.env.SMTP_USER}>`,
      to: employee_email,
      subject: `Compensatory Off Rejected`,
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
            .rejection-badge {
              display: inline-block;
              padding: 8px 16px;
              border-radius: 6px;
              color: white;
              font-weight: 600;
              font-size: 14px;
              background: #ef4444;
              margin: 8px 0;
              letter-spacing: 0.3px;
            }
            .info-card { 
              background: #fef2f2; 
              padding: 12px 16px; 
              border-radius: 6px; 
              margin: 12px 0; 
              border-left: 3px solid #ef4444;
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
              min-width: 140px;
              font-size: 12px;
            }
            .info-value {
              color: #6b7280;
              font-size: 12px;
              flex: 1;
            }
          </style>
        </head>
        <body>
          <div class="email-wrapper">
            <div class="content">
              <div class="rejection-badge">COMPENSATORY OFF REJECTED</div>
              <div style="font-size: 14px; color: #374151; margin-bottom: 12px;">Dear ${employee_name || 'Employee'},</div>
              
              <p style="color: #374151; font-size: 14px; margin-bottom: 16px;">
                Unfortunately, your <strong>Compensatory Off</strong> application has been <strong style="color: #ef4444;">rejected</strong> by <strong>${approverName}</strong>.
              </p>
              
              <div class="info-card">
                <div style="font-weight: 600; color: #dc2626; margin-bottom: 10px; font-size: 13px;">
                  📅 Comp-Off Details
                </div>
                <div class="info-row">
                  <span class="info-label">Date(s) Worked:</span>
                  <span class="info-value">${startDate} ${startDate !== endDate ? 'to ' + endDate : ''}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Comp-Off Days:</span>
                  <span class="info-value">${number_of_days || 'N/A'} day${number_of_days !== 1 ? 's' : ''}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Rejected by:</span>
                  <span class="info-value">${approverName}</span>
                </div>
                ${remark ? `
                <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #e5e7eb;">
                  <div style="font-weight: 600; color: #374151; margin-bottom: 6px; font-size: 12px;">Remarks:</div>
                  <div style="color: #6b7280; font-size: 12px; line-height: 1.5;">${remark}</div>
                </div>
                ` : ''}
              </div>
              
              <p style="color: #6b7280; font-size: 13px; margin-top: 20px;">
                Please contact your manager or HR for more details about this rejection.
              </p>
            </div>
            <div style="text-align: center; padding: 24px; background: #f9fafb; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 12px; line-height: 1.6;">
                This is an automated notification from the Consultare Leave Management System.<br>
                Please do not reply to this email.
              </p>
              <p style="margin-top: 12px;">
                <a href="${getHRPortalUrl()}" style="color: #4f46e5; text-decoration: none; font-weight: 600;">View in HR Portal</a>
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `Compensatory Off Rejected

Dear ${employee_name || 'Employee'},

Unfortunately, your Compensatory Off application has been rejected by ${approverName}.

Date(s) Worked: ${startDate} ${startDate !== endDate ? 'to ' + endDate : ''}
Comp-Off Days: ${number_of_days || 'N/A'} days
Rejected by: ${approverName}
${remark ? `Remarks: ${remark}` : ''}

Please contact your manager or HR for more details about this rejection.

HR Portal: ${getHRPortalUrl()}

This is an automated email. Please do not reply.
© ${new Date().getFullYear()} Consultare Leave Management System`
    };

    const info = await mailTransporter.sendMail(mailOptions);
    console.log(`✅ Comp-Off rejection email sent to ${employee_email} - Message ID: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error(`❌ Failed to send Comp-Off rejection email:`, error.message);
    throw error;
  }
};

export default {
  sendLeaveApplicationEmail,
  sendLeaveApprovalEmail,
  sendPasswordResetOTPEmail,
  sendHolidayReminderEmail,
  sendCompOffApplicationEmail,
  sendCompOffApprovalEmail,
  sendCompOffRejectionEmail
};
