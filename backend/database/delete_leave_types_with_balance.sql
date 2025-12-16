-- =====================================================
-- Delete Leave Types: Annual Leave, Bereavement Leave, Paternity Leave
-- This script deletes leave_balance records first, then deletes the leave types
-- =====================================================

BEGIN;

-- Step 1: Show what will be deleted (for verification)
SELECT 
    'BEFORE DELETION - leave_balance' as status,
    leave_type,
    COUNT(*) as record_count
FROM leave_balance
WHERE leave_type IN ('Annual Leave', 'Bereavement Leave', 'Paternity Leave')
GROUP BY leave_type;

SELECT 
    'BEFORE DELETION - leave_types' as status,
    name as leave_type,
    id,
    max_days
FROM leave_types
WHERE name IN ('Annual Leave', 'Bereavement Leave', 'Paternity Leave');

-- Step 2: Delete leave_balance records for these leave types
DELETE FROM leave_balance 
WHERE leave_type IN ('Annual Leave', 'Bereavement Leave', 'Paternity Leave');

-- Step 3: Verify leave_balance deletion
SELECT 
    'AFTER DELETION - leave_balance' as status,
    leave_type,
    COUNT(*) as remaining_count
FROM leave_balance
WHERE leave_type IN ('Annual Leave', 'Bereavement Leave', 'Paternity Leave')
GROUP BY leave_type;

-- Step 4: Delete the leave types
DELETE FROM leave_types 
WHERE name IN ('Annual Leave', 'Bereavement Leave', 'Paternity Leave');

-- Step 5: Verify leave types deletion
SELECT 
    'AFTER DELETION - leave_types' as status,
    name as leave_type,
    COUNT(*) as remaining_count
FROM leave_types
WHERE name IN ('Annual Leave', 'Bereavement Leave', 'Paternity Leave')
GROUP BY name;

COMMIT;

-- Step 6: Show remaining leave types
SELECT 
    'REMAINING LEAVE TYPES' as status,
    name,
    max_days,
    is_active
FROM leave_types
ORDER BY name;

