# SQL Scripts to Run

## 1. Create Departments Table (REQUIRED for Department Creation)

**File:** `backend/database/create_departments_table.sql`

**Why:** Currently, departments are not being saved to the database. This script creates a `departments` table so that when you create a department, it's actually saved in the database.

**Run this FIRST** before creating departments.

## 2. Remove Leave Types (As Requested)

**File:** `backend/database/REMOVE_LEAVE_TYPES_SCRIPT.sql`

**Why:** You requested to **remove "Bereavement Leave" and "Paternity Leave"** from your database.

## What the Script Does

1. **Removes Leave Types:**
   - Deletes "Bereavement Leave" (5 days)
   - Deletes "Paternity Leave" (7 days)
   - Keeps "Earned Leave" (10 days) and all other leave types

2. **Preserves Data:**
   - Converts existing leave applications from removed types to "Earned Leave"
   - Merges leave balances into "Earned Leave" for each employee
   - Ensures no data is lost

3. **Updates Settings:**
   - Sets "Earned Leave" max_days to 10

## Why It's Needed

- **You requested it:** You asked to remove these leave types
- **Database cleanup:** Removes unwanted leave types from the system
- **Data integrity:** Safely migrates existing data to "Earned Leave"
- **UI consistency:** The frontend will only show leave types that exist in the database

## How to Run

```sql
-- Option 1: Using psql command line
psql -h YOUR_HOST -p YOUR_PORT -U YOUR_USER -d YOUR_DATABASE -f backend/database/REMOVE_LEAVE_TYPES_SCRIPT.sql

-- Option 2: Copy and paste the SQL into your database tool (pgAdmin, DBeaver, etc.)
-- Open the file: backend/database/REMOVE_LEAVE_TYPES_SCRIPT.sql
-- Copy all SQL commands
-- Paste and execute in your database tool
```

## After Running

- The leave types list will only show remaining types
- All existing leave applications will be converted to "Earned Leave"
- Leave balances will be merged correctly
- The system will work with only the leave types you want

**Note:** This is a one-time operation. Once run, the leave types are permanently removed from your database.

