-- =====================================================
-- Leave Management System - Database Tables
-- =====================================================
-- NOTE: Skip 'users' table - you already have it!
-- =====================================================

-- 1. employees - Employee Details
CREATE TABLE IF NOT EXISTS employees (
    employee_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    employee_code VARCHAR(50) UNIQUE,
    location VARCHAR(100),
    team VARCHAR(100),
    manager_id INTEGER REFERENCES employees(employee_id),
    reporting_manager VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employees_user ON employees(user_id);
CREATE INDEX IF NOT EXISTS idx_employees_manager ON employees(manager_id);
CREATE INDEX IF NOT EXISTS idx_employees_location ON employees(location);
CREATE INDEX IF NOT EXISTS idx_employees_team ON employees(team);

-- 2. leave_types - Leave Type Master
CREATE TABLE IF NOT EXISTS leave_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) UNIQUE,
    max_days INTEGER,
    carry_forward BOOLEAN DEFAULT false,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 3. leave_applications - Leave Requests
CREATE TABLE IF NOT EXISTS leave_applications (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(employee_id),
    leave_type VARCHAR(100) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    number_of_days INTEGER NOT NULL,
    reason TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    applied_date TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leave_applications_employee ON leave_applications(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_applications_status ON leave_applications(status);
CREATE INDEX IF NOT EXISTS idx_leave_applications_dates ON leave_applications(start_date, end_date);

-- 4. leave_balance - Leave Balance Tracking
CREATE TABLE IF NOT EXISTS leave_balance (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(employee_id),
    leave_type VARCHAR(100) NOT NULL,
    total_balance INTEGER DEFAULT 0,
    used_balance INTEGER DEFAULT 0,
    remaining_balance INTEGER GENERATED ALWAYS AS (total_balance - used_balance) STORED,
    carry_forward INTEGER DEFAULT 0,
    year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM NOW()),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(employee_id, leave_type, year)
);

CREATE INDEX IF NOT EXISTS idx_leave_balance_employee ON leave_balance(employee_id);

-- 5. approval_workflow - Multi-Level Approval Configuration
CREATE TABLE IF NOT EXISTS approval_workflow (
    id SERIAL PRIMARY KEY,
    template_name VARCHAR(255) NOT NULL,
    stage_order INTEGER NOT NULL,
    approver_role VARCHAR(50) NOT NULL,
    is_required BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approval_workflow_template ON approval_workflow(template_name);

-- 6. leave_approvals - Approval Records
CREATE TABLE IF NOT EXISTS leave_approvals (
    id SERIAL PRIMARY KEY,
    leave_application_id INTEGER NOT NULL REFERENCES leave_applications(id),
    approver_id INTEGER NOT NULL REFERENCES employees(employee_id),
    stage_order INTEGER NOT NULL,
    status VARCHAR(50),
    comments TEXT,
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leave_approvals_leave ON leave_approvals(leave_application_id);
CREATE INDEX IF NOT EXISTS idx_leave_approvals_approver ON leave_approvals(approver_id);
CREATE INDEX IF NOT EXISTS idx_leave_approvals_status ON leave_approvals(status);

-- 7. calendar_templates - Holiday Calendar Templates
CREATE TABLE IF NOT EXISTS calendar_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    geography VARCHAR(100),
    country VARCHAR(100),
    holiday_dates DATE[],
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 8. employee_calendar_assignments - Calendar Assignment
CREATE TABLE IF NOT EXISTS employee_calendar_assignments (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(employee_id),
    calendar_template_id INTEGER REFERENCES calendar_templates(id),
    year INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calendar_assignments_employee ON employee_calendar_assignments(employee_id);
CREATE INDEX IF NOT EXISTS idx_calendar_assignments_calendar ON employee_calendar_assignments(calendar_template_id);

-- 9. blocked_calendar_dates - Blocked Dates
CREATE TABLE IF NOT EXISTS blocked_calendar_dates (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(employee_id),
    blocked_date DATE NOT NULL,
    reason TEXT,
    blocked_by INTEGER REFERENCES employees(employee_id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(employee_id, blocked_date)
);

CREATE INDEX IF NOT EXISTS idx_blocked_dates_employee ON blocked_calendar_dates(employee_id);

-- 10. email_notifications - Email Notification Log
CREATE TABLE IF NOT EXISTS email_notifications (
    id SERIAL PRIMARY KEY,
    recipient_email VARCHAR(255) NOT NULL,
    recipient_name VARCHAR(255),
    subject VARCHAR(500) NOT NULL,
    email_body TEXT NOT NULL,
    notification_type VARCHAR(100),
    related_leave_id INTEGER REFERENCES leave_applications(id),
    status VARCHAR(50),
    sent_at TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_notifications_status ON email_notifications(status);
CREATE INDEX IF NOT EXISTS idx_email_notifications_type ON email_notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_email_notifications_leave ON email_notifications(related_leave_id);

-- 11. roles - Role Definitions
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    role_name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    permissions JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 12. user_permissions - User-Specific Permissions
CREATE TABLE IF NOT EXISTS user_permissions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id),
    permission_name VARCHAR(100) NOT NULL,
    is_granted BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, permission_name)
);

CREATE INDEX IF NOT EXISTS idx_user_permissions_user ON user_permissions(user_id);

-- 13. shift_management - Shift Settings
CREATE TABLE IF NOT EXISTS shift_management (
    id SERIAL PRIMARY KEY,
    shift_name VARCHAR(100) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    break_duration INTEGER,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 14. employee_shifts - Employee Shift Assignments
CREATE TABLE IF NOT EXISTS employee_shifts (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(employee_id),
    shift_id INTEGER NOT NULL REFERENCES shift_management(id),
    effective_from DATE NOT NULL,
    effective_to DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employee_shifts_employee ON employee_shifts(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_shifts_shift ON employee_shifts(shift_id);

-- 15. system_settings - System Configuration
CREATE TABLE IF NOT EXISTS system_settings (
    id SERIAL PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    setting_type VARCHAR(50),
    description TEXT,
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(setting_key);

-- =====================================================
-- Summary: 15 tables created (users table already exists)
-- =====================================================

