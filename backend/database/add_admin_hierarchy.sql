-- Add admin_id to employees table for Admin → HOD → Employee hierarchy
-- This allows assignment of HODs under specific Admins
-- and Employees under specific HODs

DO $$
BEGIN
    -- Add admin_id column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'employees' AND column_name = 'admin_id'
    ) THEN
        ALTER TABLE employees ADD COLUMN admin_id INTEGER REFERENCES employees(employee_id);
        RAISE NOTICE 'Added admin_id column to employees table';
    ELSE
        RAISE NOTICE 'admin_id column already exists in employees table';
    END IF;
END $$;

-- Create index for admin_id
CREATE INDEX IF NOT EXISTS idx_employees_admin ON employees(admin_id);

-- =====================================================
-- Summary
-- =====================================================
-- This script adds:
-- 1. admin_id column to employees table (for Admin → HOD assignment)
-- 2. Index on admin_id for faster queries
-- 
-- Hierarchy Structure:
-- - Admin: admin_id = NULL (top level)
-- - HOD: admin_id = Admin's employee_id
-- - Employee: manager_id = HOD's employee_id, admin_id = Admin's employee_id (via HOD)

