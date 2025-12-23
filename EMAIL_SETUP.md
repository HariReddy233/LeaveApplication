# Email Configuration Setup Guide

## Overview
The Leave Management System sends email notifications for:
- **Leave Applications**: When an employee/HOD applies for leave, approvers receive notifications with one-click approve/reject buttons
- **Leave Approvals/Rejections**: When HOD/Admin approves or rejects a leave, the applicant receives a notification
- **Email Approval**: Approvers can approve/reject leave requests directly from email links (one token per request, single-use)

## Quick Setup

### Step 1: Configure Email Credentials

Add the following environment variables to your `backend/.env` file:

```env
# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=your-email@gmail.com
EMAIL_FROM_NAME=Consultare Leave Management

# Base URL for email approval links
FRONTEND_URL=http://localhost:3000
# For production: FRONTEND_URL=https://your-domain.com
```

### Step 2: Gmail App Password Setup

**Important**: You CANNOT use your regular Gmail password. You need an App Password.

1. Go to: https://myaccount.google.com/
2. Click on **Security** (left sidebar)
3. Enable **2-Step Verification** (if not already enabled)
4. Go to: https://myaccount.google.com/apppasswords
5. Select:
   - **App**: Mail
   - **Device**: Other (Custom name)
   - **Name**: Leave Management System
6. Click **Generate**
7. Copy the 16-character password (remove spaces)
8. Use this password as `SMTP_PASS` in your `.env` file

### Step 3: Database Setup for Email Approval

The `approval_tokens` table should already exist. If not, run:

```sql
CREATE TABLE IF NOT EXISTS approval_tokens (
  id SERIAL PRIMARY KEY,
  leave_id INTEGER NOT NULL REFERENCES leave_applications(id) ON DELETE CASCADE,
  approver_email VARCHAR(255) NOT NULL,
  approver_role VARCHAR(50) NOT NULL,
  token VARCHAR(255) UNIQUE NOT NULL,
  action_type VARCHAR(50),
  used BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Step 4: Restart Backend Server

After adding credentials:
1. Stop your backend server (Ctrl+C)
2. Start it again: `npm run dev` or `npm start`

## Email Flow

### When Employee Applies for Leave:
1. Email sent to **assigned HOD** (if exists)
2. Email sent to **all Admins**
3. Each email contains one token that works for both approve and reject actions

### When HOD Applies for Leave:
1. Email sent to **all Admins** only

### When Leave is Approved/Rejected:
1. Email sent to the **applicant** with approval/rejection status
2. Only sent when final status changes (not when still pending)

## Email Approval System

### How It Works:
- **One Token Per Request**: Each leave request generates a single token for each approver
- **Action Parameter**: The same token is used with `?action=approve` or `?action=reject` query parameter
- **One-Time Use**: Token can only be used once. After first click, subsequent clicks are ignored
- **No UI Navigation**: Clicking approve/reject updates status in background, shows confirmation page only

### Email Links Format:
```
/api/Leave/email-action?token=xxx&action=approve
/api/Leave/email-action?token=xxx&action=reject
```

## Other Email Providers

### Outlook/Hotmail
```env
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_SECURE=false
```

### Yahoo
```env
SMTP_HOST=smtp.mail.yahoo.com
SMTP_PORT=587
SMTP_SECURE=false
```

### Custom SMTP Server
```env
SMTP_HOST=your-smtp-server.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-username
SMTP_PASS=your-password
```

## Testing

After configuration, test by:
1. Applying for a leave as an employee
2. Check console logs for email sending status
3. Check approver email inboxes for approval buttons
4. Click approve/reject button from email
5. Verify status updates in portal (without navigation)
6. Try clicking the same link again (should show "already used" message)

## Troubleshooting

- **Emails not sending**: Check SMTP credentials in `.env` file
- **Authentication failed**: Verify email and App Password are correct
- **Connection timeout**: Check `SMTP_HOST` and `SMTP_PORT` settings
- **Email links not working**: Verify `FRONTEND_URL` is set correctly
- **Token already used**: This is expected - tokens are one-time use only
- **Check console logs**: Email sending errors are logged to console

## Security Notes

⚠️ **Never commit `.env` file to Git** - it contains sensitive passwords!

The email approval system uses secure, one-time-use tokens that expire after 7 days.

## File Location

Your `.env` file should be at:
```
backend/.env
```
