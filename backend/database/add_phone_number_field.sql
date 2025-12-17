-- =====================================================
-- Add Phone Number Field to Users Table
-- =====================================================
-- This script adds a phone_number column to the users table
-- Phone number will be used for country/locale detection (future enhancement)

-- Add phone_number field to users table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'phone_number'
    ) THEN
        ALTER TABLE users ADD COLUMN phone_number VARCHAR(20);
        RAISE NOTICE 'Added phone_number column to users table';
    ELSE
        RAISE NOTICE 'phone_number column already exists in users table';
    END IF;
END $$;

-- Create index for phone_number (optional, for faster lookups)
CREATE INDEX IF NOT EXISTS idx_users_phone_number ON users(phone_number) WHERE phone_number IS NOT NULL;

-- =====================================================
-- Summary
-- =====================================================
-- This script adds:
-- 1. phone_number VARCHAR(20) column to users table
-- 2. Index on phone_number for faster queries

