-- =====================================================
-- Migrate Existing Departments to departments Table
-- =====================================================
-- This script migrates all existing departments (teams) 
-- from the employees table to the new departments table
-- =====================================================

BEGIN;

-- Step 1: Insert all distinct teams from employees table into departments table
-- Only insert if they don't already exist (to avoid duplicates)
INSERT INTO departments (name, description, location, is_active)
SELECT DISTINCT
    e.team as name,
    e.team || ' Department' as description,
    e.location,
    true as is_active
FROM employees e
WHERE e.team IS NOT NULL 
  AND e.team != ''
  AND NOT EXISTS (
      SELECT 1 FROM departments d WHERE d.name = e.team
  )
ON CONFLICT (name) DO NOTHING;

-- Step 2: If there are departments with same name but different locations,
-- update the location to the most common one
UPDATE departments d
SET location = (
    SELECT location
    FROM employees e
    WHERE e.team = d.name
      AND e.location IS NOT NULL
    GROUP BY location
    ORDER BY COUNT(*) DESC
    LIMIT 1
)
WHERE d.location IS NULL
  AND EXISTS (
      SELECT 1 FROM employees e 
      WHERE e.team = d.name AND e.location IS NOT NULL
  );

-- Step 3: Update description if it's just the default
UPDATE departments d
SET description = d.name || ' Department'
WHERE d.description IS NULL OR d.description = '';

COMMIT;

-- Verify the migration
SELECT 
    'Total departments migrated' as info,
    COUNT(*) as count
FROM departments;

-- Show all departments
SELECT 
    id,
    name,
    description,
    location,
    is_active,
    created_at
FROM departments
ORDER BY name;

-- Show employee count per department
SELECT 
    d.name as department_name,
    COUNT(e.employee_id) as employee_count
FROM departments d
LEFT JOIN employees e ON e.team = d.name
GROUP BY d.id, d.name
ORDER BY d.name;





