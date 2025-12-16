# How to Get Gmail App Password

## Step 1: From the 2-Step Verification Page

Since you're already on the 2-Step Verification page, you need to go to **App Passwords**.

## Step 2: Navigate to App Passwords

**Option A: Direct Link**
- Go directly to: https://myaccount.google.com/apppasswords
- Or search for "App passwords" in Google Account settings

**Option B: From Current Page**
1. Look for a link or section that says "App passwords" or "App-specific passwords"
2. It might be in the left sidebar or at the bottom of the page
3. Click on it

## Step 3: Generate App Password

Once you're on the App Passwords page:

1. **Select app**: Choose "Mail"
2. **Select device**: Choose "Other (Custom name)"
3. **Enter name**: Type "Leave Management System"
4. Click **"Generate"** button

## Step 4: Copy the Password

- Google will show you a 16-character password
- It will look like: `abcd efgh ijkl mnop` (with spaces)
- **Copy the entire password**
- **Remove all spaces** when adding to .env file

## Step 5: Update .env File

1. Open `backend/.env` file
2. Find the line: `SMTP_PASS=etjujdhoixwwhwh`
3. Replace with your new password (no spaces)
4. Example: If Google shows `etju jdhq oixw whwh`, use `etjujdhoixwwhwh`

## Step 6: Test

Run the test script:
```bash
cd backend
node test-email.js
```

You should see: `✅ Test email sent successfully!`

## Quick Link

**Direct link to App Passwords:**
https://myaccount.google.com/apppasswords





