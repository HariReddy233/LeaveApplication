# Email Configuration Setup

## Overview
The Leave Management System sends email notifications for:
- **Leave Applications**: When an employee/HOD applies for leave, approvers receive notifications
- **Leave Approvals/Rejections**: When HOD/Admin approves or rejects a leave, the applicant receives a notification

## Email Setup Instructions

### Step 1: Install Nodemailer (Already Done)
```bash
npm install nodemailer
```

### Step 2: Configure Email Credentials

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
```

### Step 3: Gmail Setup (If using Gmail)

1. **Enable 2-Factor Authentication** on your Gmail account
2. **Generate an App Password**:
   - Go to: https://myaccount.google.com/apppasswords
   - Select "Mail" and "Other (Custom name)"
   - Enter "Leave Management System"
   - Copy the generated 16-character password
   - Use this password as `SMTP_PASS` in your `.env` file

### Step 4: Other Email Providers

#### Outlook/Hotmail
```env
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_SECURE=false
```

#### Yahoo
```env
SMTP_HOST=smtp.mail.yahoo.com
SMTP_PORT=587
SMTP_SECURE=false
```

#### Custom SMTP Server
```env
SMTP_HOST=your-smtp-server.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-username
SMTP_PASS=your-password
```

## Email Flow

### When Employee Applies for Leave:
1. Email sent to **all HODs** (in same department)
2. Email sent to **all Admins**

### When HOD Applies for Leave:
1. Email sent to **all Admins** only

### When Leave is Approved/Rejected:
1. Email sent to the **applicant** with approval/rejection status
2. Only sent when final status changes (not when still pending)

## Testing

After configuration, test by:
1. Applying for a leave as an employee
2. Check console logs for email sending status
3. Check approver email inboxes
4. Approve/reject the leave
5. Check applicant email inbox

## Troubleshooting

- **Emails not sending**: Check SMTP credentials in `.env` file
- **Authentication failed**: Verify email and password are correct
- **Connection timeout**: Check SMTP_HOST and SMTP_PORT settings
- **Check console logs**: Email sending errors are logged to console

## Note

If email credentials are not configured, emails will be logged to console only (for development/testing).











