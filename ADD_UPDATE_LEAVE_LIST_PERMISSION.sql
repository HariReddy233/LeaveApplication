-- ============================================
-- Add "Update Leave List" Permission
-- ============================================
-- This script adds the "Update Leave List" permission to the permissions table
-- Safe to run multiple times (uses ON CONFLICT DO NOTHING)

INSERT INTO permissions (permission_key, permission_name, description, category, is_active)
VALUES (
  'leave.update_list',
  'Update Leave List',
  'Allow user to update organization leave dates and blocked dates',
  'leave',
  TRUE
)
ON CONFLICT (permission_key) DO UPDATE SET
  permission_name = EXCLUDED.permission_name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- Verify the permission was added
SELECT 
  permission_id,
  permission_key,
  permission_name,
  description,
  category,
  is_active
FROM permissions
WHERE permission_key = 'leave.update_list';









