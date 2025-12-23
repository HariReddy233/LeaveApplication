-- ============================================
-- Dynamic Permissions System - Database Schema
-- ============================================
-- This script creates the tables needed for dynamic permission management
-- Run this script on your PostgreSQL database

-- ============================================
-- 1. Permissions Table
-- ============================================
-- Stores all available permissions in the system
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

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_permissions_key ON permissions(permission_key);
CREATE INDEX IF NOT EXISTS idx_permissions_category ON permissions(category);
CREATE INDEX IF NOT EXISTS idx_permissions_active ON permissions(is_active);

-- ============================================
-- 2. User Permissions Mapping Table
-- ============================================
-- Maps users to their assigned permissions
CREATE TABLE IF NOT EXISTS user_permissions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    permission_id INTEGER NOT NULL,
    granted BOOLEAN DEFAULT TRUE,
    granted_by INTEGER,
    granted_at TIMESTAMP DEFAULT NOW(),
    revoked_at TIMESTAMP,
    FOREIGN KEY (permission_id) REFERENCES permissions(permission_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (granted_by) REFERENCES users(user_id) ON DELETE SET NULL,
    UNIQUE(user_id, permission_id)
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_permissions_user ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_permission ON user_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_granted ON user_permissions(granted);

-- ============================================
-- 3. Insert Default Permissions
-- ============================================
-- These are the core permissions for the Leave Management System

INSERT INTO permissions (permission_key, permission_name, description, category) VALUES
-- Employee Management
('employee.create', 'Create Employee', 'Create new employee records', 'employee'),
('employee.edit', 'Edit Employee', 'Edit existing employee records', 'employee'),
('employee.delete', 'Delete Employee', 'Delete employee records', 'employee'),
('employee.view', 'View Employees', 'View employee list and details', 'employee'),

-- Leave Management
('leave.apply', 'Apply Leave', 'Submit leave applications', 'leave'),
('leave.edit', 'Edit Leave', 'Edit own leave applications', 'leave'),
('leave.delete', 'Delete Leave', 'Delete own leave applications', 'leave'),
('leave.view_own', 'View Own Leaves', 'View own leave applications', 'leave'),
('leave.view_all', 'View All Leaves', 'View all leave applications', 'leave'),
('leave.approve', 'Approve Leave', 'Approve leave applications', 'leave'),
('leave.reject', 'Reject Leave', 'Reject leave applications', 'leave'),

-- Authorization Management
('authorization.create', 'Create Authorization', 'Create authorization requests', 'authorization'),
('authorization.view_own', 'View Own Authorizations', 'View own authorization requests', 'authorization'),
('authorization.view_all', 'View All Authorizations', 'View all authorization requests', 'authorization'),
('authorization.approve', 'Approve Authorization', 'Approve authorization requests', 'authorization'),

-- Department Management
('department.create', 'Create Department', 'Create new departments', 'department'),
('department.edit', 'Edit Department', 'Edit existing departments', 'department'),
('department.delete', 'Delete Department', 'Delete departments', 'department'),
('department.view', 'View Departments', 'View department list', 'department'),

-- Leave Type Management
('leavetype.create', 'Create Leave Type', 'Create new leave types', 'leavetype'),
('leavetype.edit', 'Edit Leave Type', 'Edit existing leave types', 'leavetype'),
('leavetype.delete', 'Delete Leave Type', 'Delete leave types', 'leavetype'),
('leavetype.view', 'View Leave Types', 'View leave type list', 'leavetype'),

-- Calendar Management
('calendar.view', 'View Calendar', 'View leave calendar', 'calendar'),
('calendar.block', 'Block Calendar Dates', 'Block dates on calendar', 'calendar'),

-- Settings & Configuration
('settings.view', 'View Settings', 'View system settings', 'settings'),
('settings.edit', 'Edit Settings', 'Edit system settings', 'settings'),

-- Permissions Management (Admin only)
('permissions.manage', 'Manage Permissions', 'Assign and revoke user permissions', 'permissions'),
('permissions.view', 'View Permissions', 'View user permissions', 'permissions'),

-- Reports & Export
('reports.view', 'View Reports', 'View system reports', 'reports'),
('reports.export', 'Export Data', 'Export data to files', 'reports'),

-- Dashboard
('dashboard.view', 'View Dashboard', 'Access dashboard', 'dashboard')
ON CONFLICT (permission_key) DO NOTHING;

-- ============================================
-- 4. Grant Default Permissions to Admin Role
-- ============================================
-- Automatically grant all permissions to users with 'admin' role
-- This can be done via a trigger or application logic

-- Function to grant all permissions to admin users
CREATE OR REPLACE FUNCTION grant_admin_permissions()
RETURNS TRIGGER AS $$
BEGIN
    -- When a user is created/updated with admin role, grant all permissions
    IF NEW.role = 'admin' OR NEW.role = 'Admin' THEN
        INSERT INTO user_permissions (user_id, permission_id, granted)
        SELECT NEW.user_id, permission_id, TRUE
        FROM permissions
        WHERE is_active = TRUE
        ON CONFLICT (user_id, permission_id) DO UPDATE
        SET granted = TRUE, revoked_at = NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-grant permissions to admin users
-- Note: This is optional - you can also handle this in application code
-- DROP TRIGGER IF EXISTS trigger_grant_admin_permissions ON users;
-- CREATE TRIGGER trigger_grant_admin_permissions
--     AFTER INSERT OR UPDATE ON users
--     FOR EACH ROW
--     WHEN (NEW.role = 'admin' OR NEW.role = 'Admin')
--     EXECUTE FUNCTION grant_admin_permissions();

-- ============================================
-- 5. Helper Views (Optional but useful)
-- ============================================
-- View to get user permissions with details
CREATE OR REPLACE VIEW user_permissions_view AS
SELECT 
    up.id,
    up.user_id,
    u.email,
    u.first_name,
    u.last_name,
    u.role,
    p.permission_id,
    p.permission_key,
    p.permission_name,
    p.category,
    up.granted,
    up.granted_at,
    up.revoked_at
FROM user_permissions up
JOIN users u ON up.user_id = u.user_id
JOIN permissions p ON up.permission_id = p.permission_id
WHERE up.granted = TRUE;

-- ============================================
-- 6. Comments for Documentation
-- ============================================
COMMENT ON TABLE permissions IS 'Stores all available permissions in the system';
COMMENT ON TABLE user_permissions IS 'Maps users to their assigned permissions';
COMMENT ON COLUMN user_permissions.granted IS 'TRUE if permission is granted, FALSE if revoked';
COMMENT ON COLUMN user_permissions.revoked_at IS 'Timestamp when permission was revoked (if applicable)';

-- ============================================
-- End of Schema
-- ============================================



