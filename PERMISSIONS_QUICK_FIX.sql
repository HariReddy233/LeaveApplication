-- ============================================
-- Quick Fix Script - Run this first
-- ============================================
-- This script will diagnose and fix the issue

-- Step 1: Check what exists
DO $$
BEGIN
    RAISE NOTICE '=== Diagnosing Permissions System ===';
    
    -- Check permissions table
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'permissions') THEN
        RAISE NOTICE '✓ Permissions table exists';
        
        -- Check if it has permission_id
        IF EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = 'permissions' AND column_name = 'permission_id'
        ) THEN
            RAISE NOTICE '✓ Permissions table has permission_id column';
        ELSE
            RAISE NOTICE '✗ Permissions table missing permission_id column';
        END IF;
    ELSE
        RAISE NOTICE '✗ Permissions table does NOT exist';
    END IF;
    
    -- Check user_permissions table
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_permissions') THEN
        RAISE NOTICE '✓ User_permissions table exists';
        
        -- Check if it has permission_id
        IF EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = 'user_permissions' AND column_name = 'permission_id'
        ) THEN
            RAISE NOTICE '✓ User_permissions table has permission_id column';
        ELSE
            RAISE NOTICE '✗ User_permissions table missing permission_id column - will need to drop and recreate';
        END IF;
    ELSE
        RAISE NOTICE '✓ User_permissions table does NOT exist (will be created)';
    END IF;
END $$;

-- Step 2: Drop user_permissions if it has wrong structure
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_permissions') THEN
        -- Check if permission_id column exists
        IF NOT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = 'user_permissions' 
            AND column_name = 'permission_id'
        ) THEN
            -- Drop all constraints first
            ALTER TABLE user_permissions DROP CONSTRAINT IF EXISTS fk_user_permissions_permission;
            ALTER TABLE user_permissions DROP CONSTRAINT IF EXISTS fk_user_permissions_user;
            ALTER TABLE user_permissions DROP CONSTRAINT IF EXISTS fk_user_permissions_granted_by;
            ALTER TABLE user_permissions DROP CONSTRAINT IF EXISTS uq_user_permission;
            ALTER TABLE user_permissions DROP CONSTRAINT IF EXISTS user_permissions_pkey;
            
            -- Drop the table
            DROP TABLE user_permissions CASCADE;
            RAISE NOTICE 'Dropped user_permissions table (wrong structure)';
        END IF;
    END IF;
END $$;

-- Step 3: Ensure permissions table exists first
CREATE TABLE IF NOT EXISTS permissions (
    permission_id SERIAL PRIMARY KEY,
    permission_key VARCHAR(100) UNIQUE NOT NULL,
    permission_name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50) DEFAULT 'general',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Step 4: Create indexes for permissions
CREATE INDEX IF NOT EXISTS idx_permissions_key ON permissions(permission_key);
CREATE INDEX IF NOT EXISTS idx_permissions_category ON permissions(category);
CREATE INDEX IF NOT EXISTS idx_permissions_active ON permissions(is_active);

-- Step 5: Now create user_permissions (permissions table must exist first)
CREATE TABLE IF NOT EXISTS user_permissions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    permission_id INTEGER NOT NULL,
    granted BOOLEAN DEFAULT TRUE,
    granted_by INTEGER,
    granted_at TIMESTAMP DEFAULT NOW(),
    revoked_at TIMESTAMP,
    CONSTRAINT fk_user_permissions_user
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_user_permissions_permission
        FOREIGN KEY (permission_id) REFERENCES permissions(permission_id) ON DELETE CASCADE,
    CONSTRAINT fk_user_permissions_granted_by
        FOREIGN KEY (granted_by) REFERENCES users(user_id) ON DELETE SET NULL,
    CONSTRAINT uq_user_permission UNIQUE (user_id, permission_id)
);

-- Step 6: Create indexes
CREATE INDEX IF NOT EXISTS idx_user_permissions_user ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_permission ON user_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_granted ON user_permissions(granted);

-- Step 7: Insert default permissions
INSERT INTO permissions (permission_key, permission_name, description, category) VALUES
('employee.create', 'Create Employee', 'Create new employee records', 'employee'),
('employee.edit', 'Edit Employee', 'Edit existing employee records', 'employee'),
('employee.delete', 'Delete Employee', 'Delete employee records', 'employee'),
('employee.view', 'View Employees', 'View employee list and details', 'employee'),

('leave.apply', 'Apply Leave', 'Submit leave applications', 'leave'),
('leave.edit', 'Edit Leave', 'Edit own leave applications', 'leave'),
('leave.delete', 'Delete Leave', 'Delete own leave applications', 'leave'),
('leave.view_own', 'View Own Leaves', 'View own leave applications', 'leave'),
('leave.view_all', 'View All Leaves', 'View all leave applications', 'leave'),
('leave.approve', 'Approve Leave', 'Approve leave applications', 'leave'),
('leave.reject', 'Reject Leave', 'Reject leave applications', 'leave'),

('authorization.create', 'Create Authorization', 'Create authorization requests', 'authorization'),
('authorization.view_own', 'View Own Authorizations', 'View own authorization requests', 'authorization'),
('authorization.view_all', 'View All Authorizations', 'View all authorization requests', 'authorization'),
('authorization.approve', 'Approve Authorization', 'Approve authorization requests', 'authorization'),

('department.create', 'Create Department', 'Create new departments', 'department'),
('department.edit', 'Edit Department', 'Edit existing departments', 'department'),
('department.delete', 'Delete Department', 'Delete departments', 'department'),
('department.view', 'View Departments', 'View department list', 'department'),

('leavetype.create', 'Create Leave Type', 'Create new leave types', 'leavetype'),
('leavetype.edit', 'Edit Leave Type', 'Edit existing leave types', 'leavetype'),
('leavetype.delete', 'Delete Leave Type', 'Delete leave types', 'leavetype'),
('leavetype.view', 'View Leave Types', 'View leave type list', 'leavetype'),

('calendar.view', 'View Calendar', 'View leave calendar', 'calendar'),
('calendar.block', 'Block Calendar Dates', 'Block dates on calendar', 'calendar'),

('settings.view', 'View Settings', 'View system settings', 'settings'),
('settings.edit', 'Edit Settings', 'Edit system settings', 'settings'),

('permissions.manage', 'Manage Permissions', 'Assign and revoke user permissions', 'permissions'),
('permissions.view', 'View Permissions', 'View user permissions', 'permissions'),

('reports.view', 'View Reports', 'View system reports', 'reports'),
('reports.export', 'Export Data', 'Export data to files', 'reports'),

('dashboard.view', 'View Dashboard', 'Access dashboard', 'dashboard')
ON CONFLICT (permission_key) DO NOTHING;

-- Step 8: Create view
CREATE OR REPLACE VIEW user_permissions_view AS
SELECT
    up.id,
    up.user_id,
    u.email,
    u.first_name,
    u.last_name,
    COALESCE(u.first_name || ' ' || u.last_name, u.first_name, u.last_name, u.email) as full_name,
    u.role,
    p.permission_id,
    p.permission_key,
    p.permission_name,
    p.description,
    p.category,
    up.granted,
    up.granted_at,
    up.revoked_at
FROM user_permissions up
JOIN users u ON u.user_id = up.user_id
JOIN permissions p ON p.permission_id = up.permission_id
WHERE up.granted = TRUE AND p.is_active = TRUE;

-- Step 9: Success message
DO $$
BEGIN
    RAISE NOTICE '=== Permissions System Setup Complete ===';
    RAISE NOTICE 'Run this to verify: SELECT COUNT(*) FROM permissions;';
END $$;



