# Email Approval Setup Guide

## Step 1: Create Database Table

Run the migration to create the `approval_tokens` table:

### Option A: Using the Node.js script (Recommended)
```bash
cd backend
node src/utils/create-approval-tokens-table.js
```

### Option B: Using PostgreSQL directly
```bash
# Connect to your database and run:
psql -h YOUR_HOST -p YOUR_PORT -U YOUR_USER -d YOUR_DATABASE -f backend/database/create_approval_tokens_table.sql
```

### Option C: Using pgAdmin or any SQL client
1. Open your SQL client
2. Connect to your database
3. Execute the contents of `backend/database/create_approval_tokens_table.sql`

## Step 2: Configure Base URL in .env

Add one of these environment variables to your `backend/.env` file:

```env
# Option 1: Use FRONTEND_URL (recommended)
FRONTEND_URL=http://localhost:3000

# Option 2: Use BASE_URL (alternative)
BASE_URL=http://localhost:3000

# For production, use your actual domain:
# FRONTEND_URL=https://your-domain.com
# or
# BASE_URL=https://your-domain.com
```

**Important Notes:**
- If neither `FRONTEND_URL` nor `BASE_URL` is set, it defaults to `http://localhost:3000`
- For production, make sure to set the correct production URL
- The URL should be accessible from where users will click the email links
- Do NOT include a trailing slash (e.g., use `https://example.com` not `https://example.com/`)

## Step 3: Verify Setup

After completing both steps:

1. **Test the database table:**
   ```sql
   SELECT * FROM approval_tokens LIMIT 1;
   ```
   (Should return empty result or no error)

2. **Test email approval:**
   - Apply for a leave as an employee
   - Check the email sent to HOD/Admin
   - Verify the email contains Approve/Reject buttons
   - Click one of the buttons to test

## Troubleshooting

### Table already exists error
If you get "relation already exists", the table is already created. You can skip Step 1.

### Email links not working
- Check that `FRONTEND_URL` or `BASE_URL` is set correctly in `.env`
- Verify the URL is accessible (not blocked by firewall)
- Check backend logs for errors when clicking email links

### Tokens not generating
- Verify the `approval_tokens` table exists
- Check database connection
- Review backend logs for errors





