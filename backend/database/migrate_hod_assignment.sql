-- =====================================================
-- Migration Script for HOD Assignment Feature
-- =====================================================
-- This script adds any missing fields needed for HOD assignment
-- Run this script if you're getting errors about missing columns
-- =====================================================

-- 1. Check and add manager_id to employees table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'employees' AND column_name = 'manager_id'
    ) THEN
        ALTER TABLE employees 
        ADD COLUMN manager_id INTEGER REFERENCES employees(employee_id);
        
        CREATE INDEX IF NOT EXISTS idx_employees_manager ON employees(manager_id);
        
        RAISE NOTICE 'Added manager_id column to employees table';
    ELSE
        RAISE NOTICE 'manager_id column already exists in employees table';
    END IF;
END $$;

-- 2. Check and add first_name and last_name to users table if they don't exist
-- (These are used for displaying HOD names)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'first_name'
    ) THEN
        ALTER TABLE users ADD COLUMN first_name VARCHAR(255);
        RAISE NOTICE 'Added first_name column to users table';
    ELSE
        RAISE NOTICE 'first_name column already exists in users table';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'last_name'
    ) THEN
        ALTER TABLE users ADD COLUMN last_name VARCHAR(255);
        RAISE NOTICE 'Added last_name column to users table';
    ELSE
        RAISE NOTICE 'last_name column already exists in users table';
    END IF;
END $$;

-- 3. Check and add missing fields to employees table if they don't exist
DO $$
BEGIN
    -- Add email field if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'employees' AND column_name = 'email'
    ) THEN
        ALTER TABLE employees ADD COLUMN email VARCHAR(255);
        RAISE NOTICE 'Added email column to employees table';
    ELSE
        RAISE NOTICE 'email column already exists in employees table';
    END IF;
    
    -- Add full_name field if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'employees' AND column_name = 'full_name'
    ) THEN
        ALTER TABLE employees ADD COLUMN full_name VARCHAR(255);
        RAISE NOTICE 'Added full_name column to employees table';
    ELSE
        RAISE NOTICE 'full_name column already exists in employees table';
    END IF;
    
    -- Add role field if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'employees' AND column_name = 'role'
    ) THEN
        ALTER TABLE employees ADD COLUMN role VARCHAR(50);
        RAISE NOTICE 'Added role column to employees table';
    ELSE
        RAISE NOTICE 'role column already exists in employees table';
    END IF;
    
    -- Add designation field if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'employees' AND column_name = 'designation'
    ) THEN
        ALTER TABLE employees ADD COLUMN designation VARCHAR(255);
        RAISE NOTICE 'Added designation column to employees table';
    ELSE
        RAISE NOTICE 'designation column already exists in employees table';
    END IF;
END $$;

-- 4. Add UNIQUE constraint on employees.user_id if it doesn't exist
-- (This is needed for ON CONFLICT (user_id) to work)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'employees' 
        AND constraint_type = 'UNIQUE' 
        AND constraint_name LIKE '%user_id%'
    ) THEN
        -- Try to add unique constraint
        BEGIN
            ALTER TABLE employees ADD CONSTRAINT employees_user_id_unique UNIQUE (user_id);
            RAISE NOTICE 'Added UNIQUE constraint on employees.user_id';
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Could not add UNIQUE constraint on employees.user_id (may already exist or have duplicates): %', SQLERRM;
        END;
    ELSE
        RAISE NOTICE 'UNIQUE constraint on employees.user_id already exists';
    END IF;
END $$;

-- 5. Add department field to users table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'department'
    ) THEN
        ALTER TABLE users ADD COLUMN department VARCHAR(255);
        RAISE NOTICE 'Added department column to users table';
    ELSE
        RAISE NOTICE 'department column already exists in users table';
    END IF;
END $$;

-- 6. Add designation field to users table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'designation'
    ) THEN
        ALTER TABLE users ADD COLUMN designation VARCHAR(255);
        RAISE NOTICE 'Added designation column to users table';
    ELSE
        RAISE NOTICE 'designation column already exists in users table';
    END IF;
END $$;

-- =====================================================
-- Summary
-- =====================================================
-- This script will:
-- 1. Add manager_id to employees (if missing) - REQUIRED for HOD assignment
-- 2. Add first_name/last_name to users (optional, for better name display)
-- 3. Add email/full_name/role/designation to employees (if missing)
-- 4. Add UNIQUE constraint on employees.user_id (for ON CONFLICT to work)
-- 5. Add department/designation to users (if missing)
-- =====================================================

