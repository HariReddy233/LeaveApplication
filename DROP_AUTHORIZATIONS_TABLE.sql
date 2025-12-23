-- =====================================================
-- DROP AUTHORIZATIONS TABLE
-- =====================================================
-- This script removes the authorization requests functionality
-- by dropping the authorizations table and related objects.
-- 
-- WARNING: This will permanently delete all authorization request data!
-- Make sure you have a backup if needed.
-- =====================================================

-- Drop the authorizations table (CASCADE will also drop any dependent objects)
DROP TABLE IF EXISTS authorizations CASCADE;

-- Verify the table has been dropped
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'authorizations'
    ) THEN
        RAISE NOTICE 'WARNING: authorizations table still exists!';
    ELSE
        RAISE NOTICE 'SUCCESS: authorizations table has been dropped.';
    END IF;
END $$;

-- =====================================================
-- Script completed
-- =====================================================



