# How to Setup Email Sender - Step by Step Guide

## 📍 Where to Add Email Credentials

You need to create a `.env` file in the `backend` folder and add your email credentials there.

## Step 1: Create `.env` File

1. Go to the `backend` folder: `D:\Consultare_Projects\Leave_Management\backend`
2. Create a new file named `.env` (just `.env` - no extension)
3. If you already have a `.env` file, open it

## Step 2: Add Email Configuration

Add these lines to your `backend/.env` file:

```env
# Email Configuration (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password-here
EMAIL_FROM=your-email@gmail.com
EMAIL_FROM_NAME=Consultare Leave Management
```

## Step 3: Replace with Your Actual Credentials

Replace these values:
- `your-email@gmail.com` → Your actual Gmail address
- `your-app-password-here` → Your Gmail App Password (see below)

## Step 4: Get Gmail App Password

**Important**: You CANNOT use your regular Gmail password. You need an App Password.

### For Gmail:
1. Go to: https://myaccount.google.com/
2. Click on **Security** (left sidebar)
3. Enable **2-Step Verification** (if not already enabled)
4. Go to: https://myaccount.google.com/apppasswords
5. Select:
   - **App**: Mail
   - **Device**: Other (Custom name)
   - **Name**: Leave Management System
6. Click **Generate**
7. Copy the 16-character password (it looks like: `abcd efgh ijkl mnop`)
8. Use this password as `SMTP_PASS` in your `.env` file (remove spaces)

### Example `.env` file:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=consultare.hr@gmail.com
SMTP_PASS=abcdefghijklmnop
EMAIL_FROM=consultare.hr@gmail.com
EMAIL_FROM_NAME=Consultare Leave Management
```

## Step 5: Restart Backend Server

After adding credentials:
1. Stop your backend server (Ctrl+C)
2. Start it again: `npm run dev` or `npm start`
3. The email service will now use your credentials

## How It Works

1. **When you apply for leave**:
   - System reads `SMTP_USER` and `SMTP_PASS` from `.env`
   - Connects to Gmail SMTP server
   - Sends email to HODs/Admins

2. **When leave is approved/rejected**:
   - System sends email to the applicant
   - Uses the same sender email (`EMAIL_FROM`)

3. **If credentials are missing**:
   - Emails are logged to console only (for testing)
   - No actual emails are sent

## Testing

After setup, test by:
1. Apply for a leave
2. Check the backend console - you should see: `✅ Email sent successfully`
3. Check the recipient's email inbox

## Troubleshooting

- **"Authentication failed"**: Check your App Password is correct
- **"Connection timeout"**: Check `SMTP_HOST` and `SMTP_PORT`
- **No emails sent**: Check console logs for errors
- **Emails in spam**: Check spam folder, or configure SPF/DKIM records

## File Location

Your `.env` file should be at:
```
D:\Consultare_Projects\Leave_Management\backend\.env
```

## Security Note

⚠️ **Never commit `.env` file to Git** - it contains sensitive passwords!









