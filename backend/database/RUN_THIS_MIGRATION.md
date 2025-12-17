# Database Migration for HOD Assignment

## ✅ Required Field

You need to add **`manager_id`** column to the **`employees`** table.

## 🚀 How to Run the Migration

### Option 1: Run the Migration Script (Recommended)

Run this SQL script in your PostgreSQL database:

**File**: `backend/database/add_manager_id_field.sql`

This script will:
- ✅ Check if `manager_id` column already exists
- ✅ Add it if it doesn't exist (safe to run multiple times)
- ✅ Create an index for better performance
- ✅ **Won't modify or delete any existing data**

### Option 2: Run SQL Directly

If you prefer to run SQL directly, execute this:

```sql
-- Add manager_id column to employees table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'employees' 
        AND column_name = 'manager_id'
    ) THEN
        ALTER TABLE employees 
        ADD COLUMN manager_id INTEGER REFERENCES employees(employee_id);
        
        CREATE INDEX IF NOT EXISTS idx_employees_manager ON employees(manager_id);
        
        RAISE NOTICE '✅ Successfully added manager_id column';
    ELSE
        RAISE NOTICE 'ℹ️ manager_id column already exists';
    END IF;
END $$;
```

## 📋 What This Field Does

- **Field Name**: `manager_id`
- **Type**: `INTEGER` (references `employees.employee_id`)
- **Nullable**: YES (allows NULL values)
- **Purpose**: Stores the HOD's `employee_id` for each employee
- **Example**: If Lakshmi is assigned to Wendy, Lakshmi's `manager_id` = Wendy's `employee_id`

## ✅ Verify It Worked

After running the migration, verify with:

```sql
-- Check if column exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'employees' 
AND column_name = 'manager_id';
```

You should see:
- `column_name`: manager_id
- `data_type`: integer
- `is_nullable`: YES

## 🔒 Safety

- ✅ **Safe for existing data** - All existing employees will have `manager_id = NULL`
- ✅ **No data loss** - Nothing will be deleted or modified
- ✅ **Idempotent** - Safe to run multiple times (won't create duplicates)

## 📝 Notes

- If `manager_id` already exists, the script will just skip it
- The field is NULLABLE, so employees without HODs will have `NULL`
- The foreign key ensures data integrity (can only reference valid employee_ids)



