-- =====================================================
-- Add manager_id field to employees table for HOD assignment
-- =====================================================
-- This script adds the manager_id column if it doesn't exist
-- manager_id stores the HOD's employee_id (self-referencing foreign key)
-- 
-- ✅ SAFE FOR EXISTING DATA:
-- - Field is NULLABLE (allows NULL values)
-- - Existing employees will have manager_id = NULL (no HOD assigned)
-- - No existing data will be modified or deleted
-- - All existing functionality will continue to work
-- - Only new HOD assignments will populate this field
-- =====================================================

-- Check if manager_id column exists, if not, add it
DO $$
BEGIN
    -- Check if the column already exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'employees' 
        AND column_name = 'manager_id'
    ) THEN
        -- Add the manager_id column (NULLABLE - safe for existing data)
        -- Existing rows will have NULL, which is fine - they just won't have a HOD assigned yet
        ALTER TABLE employees 
        ADD COLUMN manager_id INTEGER REFERENCES employees(employee_id);
        
        -- Add index for better query performance
        CREATE INDEX IF NOT EXISTS idx_employees_manager ON employees(manager_id);
        
        RAISE NOTICE '✅ Successfully added manager_id column to employees table';
        RAISE NOTICE '✅ Added index on manager_id for better performance';
    ELSE
        RAISE NOTICE 'ℹ️ manager_id column already exists in employees table';
    END IF;
END $$;

-- Verify the column was added
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'employees' 
AND column_name = 'manager_id';

-- Show the foreign key constraint
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'employees'
    AND kcu.column_name = 'manager_id';

