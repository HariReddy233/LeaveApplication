-- ============================================
-- Dynamic Permissions System - PostgreSQL (Fixed Version)
-- ============================================
-- This script safely handles existing tables and creates the permissions system

-- ============================================
-- Step 1: Create Permissions Table (if not exists)
-- ============================================
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

-- Create indexes for permissions table
CREATE INDEX IF NOT EXISTS idx_permissions_key ON permissions(permission_key);
CREATE INDEX IF NOT EXISTS idx_permissions_category ON permissions(category);
CREATE INDEX IF NOT EXISTS idx_permissions_active ON permissions(is_active);

-- ============================================
-- Step 2: Handle User Permissions Table
-- ============================================
-- Check if user_permissions table exists and has correct structure
DO $$
BEGIN
    -- Check if table exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_permissions') THEN
        -- Check if permission_id column exists
        IF NOT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = 'user_permissions' AND column_name = 'permission_id'
        ) THEN
            -- Table exists but doesn't have permission_id - drop and recreate
            DROP TABLE IF EXISTS user_permissions CASCADE;
            RAISE NOTICE 'Dropped existing user_permissions table to recreate with correct structure';
        END IF;
    END IF;
END $$;

-- Create user_permissions table (will be created if it doesn't exist or was dropped)
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

-- Create indexes for user_permissions table
CREATE INDEX IF NOT EXISTS idx_user_permissions_user ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_permission ON user_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_granted ON user_permissions(granted);

-- ============================================
-- Step 3: Insert Default Permissions
-- ============================================
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

-- ============================================
-- Step 4: Create View for User Permissions
-- ============================================
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

-- ============================================
-- Step 5: Verify Installation
-- ============================================
DO $$
DECLARE
    perm_count INTEGER;
    table_exists BOOLEAN;
BEGIN
    -- Check permissions table
    SELECT COUNT(*) INTO perm_count FROM permissions;
    RAISE NOTICE 'Permissions table created with % permissions', perm_count;
    
    -- Check user_permissions table
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'user_permissions'
    ) INTO table_exists;
    
    IF table_exists THEN
        RAISE NOTICE 'User permissions table created successfully';
    ELSE
        RAISE EXCEPTION 'User permissions table was not created';
    END IF;
    
    RAISE NOTICE 'Permissions system installed successfully!';
END $$;

-- ============================================
-- End of Script
-- ============================================



