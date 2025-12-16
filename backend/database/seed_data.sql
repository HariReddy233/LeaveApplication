-- =====================================================
-- Leave Management System - Seed Data
-- =====================================================
-- This script populates initial data needed for the system
-- =====================================================

-- 1. Insert Leave Types
INSERT INTO leave_types (name, code, max_days, carry_forward, description, is_active) VALUES
('Sick Leave', 'SL', 12, false, 'Leave for medical reasons', true),
('Casual Leave', 'CL', 12, false, 'Casual leave for personal reasons', true),
('Annual Leave', 'AL', 15, true, 'Annual vacation leave', true),
('Earned Leave', 'EL', 30, true, 'Earned leave that can be carried forward', true),
('Compensatory Off', 'CO', NULL, false, 'Compensatory leave for working on holidays', true),
('Maternity Leave', 'ML', 90, false, 'Maternity leave for female employees', true),
('Paternity Leave', 'PL', 7, false, 'Paternity leave for male employees', true),
('Bereavement Leave', 'BL', 5, false, 'Leave for family bereavement', true)
ON CONFLICT DO NOTHING;

-- 2. Insert Roles
INSERT INTO roles (role_name, description, permissions, is_active) VALUES
('Employee', 'Regular employee who can apply for leaves', '{"apply_leave": true, "view_own_leaves": true, "view_balance": true}'::jsonb, true),
('Manager', 'Manager who can approve team member leaves', '{"apply_leave": true, "view_own_leaves": true, "view_balance": true, "approve_leaves": true, "view_team_leaves": true}'::jsonb, true),
('HOD', 'Head of Department with department-wide approval', '{"apply_leave": true, "view_own_leaves": true, "view_balance": true, "approve_leaves": true, "view_team_leaves": true, "view_department_leaves": true}'::jsonb, true),
('Admin', 'System administrator with full access', '{"apply_leave": true, "view_own_leaves": true, "view_balance": true, "approve_leaves": true, "view_team_leaves": true, "view_department_leaves": true, "manage_employees": true, "manage_settings": true, "manage_calendars": true, "view_all_leaves": true}'::jsonb, true)
ON CONFLICT (role_name) DO NOTHING;

-- 3. Insert System Settings
INSERT INTO system_settings (setting_key, setting_value, setting_type, description) VALUES
('email_enabled', 'true', 'boolean', 'Enable/disable email notifications'),
('email_smtp_host', 'smtp.gmail.com', 'string', 'SMTP server host'),
('email_smtp_port', '587', 'number', 'SMTP server port'),
('email_from_address', 'noreply@consultare.net', 'string', 'Default sender email address'),
('email_from_name', 'Consultare Leave Management', 'string', 'Default sender name'),
('max_leave_days_per_application', '30', 'number', 'Maximum days allowed per leave application'),
('leave_application_advance_days', '7', 'number', 'Minimum days in advance to apply for leave'),
('auto_approve_leave_days', '2', 'number', 'Auto-approve leaves up to this many days'),
('leave_reminder_days_before', '1', 'number', 'Send reminder email this many days before leave starts'),
('company_name', 'Consultare', 'string', 'Company name'),
('leave_year_start_month', '1', 'number', 'Month when leave year starts (1-12)'),
('leave_year_start_day', '1', 'number', 'Day when leave year starts (1-31)')
ON CONFLICT (setting_key) DO NOTHING;

-- 4. Create Employee Records for Existing Users
-- This links existing users to employee records
-- Automatically assigns location and calendar based on department/email
INSERT INTO employees (user_id, employee_code, location, team, created_at)
SELECT 
    user_id,
    'EMP' || LPAD(user_id::text, 4, '0') as employee_code,
    CASE 
        WHEN department ILIKE '%US%' OR department ILIKE '%Miami%' OR email ILIKE '%@consultare.us%' THEN 'US Miami'
        WHEN department ILIKE '%India%' OR department ILIKE '%IN%' OR email ILIKE '%@consultare.in%' THEN 'India'
        ELSE COALESCE(department, 'India') -- Default to India
    END as location,
    COALESCE(department, 'IT') as team,
    COALESCE(date_of_joining, NOW()) as created_at
FROM users
WHERE user_id NOT IN (SELECT user_id FROM employees WHERE user_id IS NOT NULL)
ON CONFLICT DO NOTHING;

-- 4a. Assign Calendar Templates to Employees Based on Location
-- India Team gets India calendar
INSERT INTO employee_calendar_assignments (employee_id, calendar_template_id, year)
SELECT 
    e.employee_id,
    ct.id as calendar_template_id,
    EXTRACT(YEAR FROM NOW()) as year
FROM employees e
CROSS JOIN calendar_templates ct
WHERE ct.name = 'India Holidays 2025'
AND e.location = 'India'
AND NOT EXISTS (
    SELECT 1 FROM employee_calendar_assignments eca 
    WHERE eca.employee_id = e.employee_id 
    AND eca.year = EXTRACT(YEAR FROM NOW())
)
ON CONFLICT DO NOTHING;

-- US Miami Team gets US Miami calendar
INSERT INTO employee_calendar_assignments (employee_id, calendar_template_id, year)
SELECT 
    e.employee_id,
    ct.id as calendar_template_id,
    EXTRACT(YEAR FROM NOW()) as year
FROM employees e
CROSS JOIN calendar_templates ct
WHERE ct.name = 'US Miami Holidays 2025'
AND e.location = 'US Miami'
AND NOT EXISTS (
    SELECT 1 FROM employee_calendar_assignments eca 
    WHERE eca.employee_id = e.employee_id 
    AND eca.year = EXTRACT(YEAR FROM NOW())
)
ON CONFLICT DO NOTHING;

-- 5. Initialize Leave Balance for Existing Employees (for current year)
-- This sets initial leave balance for all employees
INSERT INTO leave_balance (employee_id, leave_type, total_balance, used_balance, year)
SELECT 
    e.employee_id,
    lt.name as leave_type,
    CASE 
        WHEN lt.code = 'SL' THEN 12
        WHEN lt.code = 'CL' THEN 12
        WHEN lt.code = 'AL' THEN 15
        WHEN lt.code = 'EL' THEN 30
        ELSE COALESCE(lt.max_days, 0)
    END as total_balance,
    0 as used_balance,
    EXTRACT(YEAR FROM NOW()) as year
FROM employees e
CROSS JOIN leave_types lt
WHERE lt.is_active = true
AND NOT EXISTS (
    SELECT 1 FROM leave_balance lb 
    WHERE lb.employee_id = e.employee_id 
    AND lb.leave_type = lt.name 
    AND lb.year = EXTRACT(YEAR FROM NOW())
)
ON CONFLICT DO NOTHING;

-- 6. Create Calendar Templates for India and US Miami Teams
-- India Holidays 2025
INSERT INTO calendar_templates (name, geography, country, holiday_dates, is_active) VALUES
('India Holidays 2025', 'Asia', 'India', ARRAY[
    '2025-01-26'::date, -- Republic Day
    '2025-03-29'::date, -- Holi
    '2025-04-14'::date, -- Ambedkar Jayanti
    '2025-04-17'::date, -- Ram Navami
    '2025-05-01'::date, -- Labour Day
    '2025-08-15'::date, -- Independence Day
    '2025-08-26'::date, -- Janmashtami
    '2025-10-02'::date, -- Gandhi Jayanti
    '2025-10-12'::date, -- Dussehra
    '2025-10-31'::date, -- Diwali
    '2025-11-01'::date, -- Diwali
    '2025-12-25'::date  -- Christmas
], true)
ON CONFLICT DO NOTHING;

-- US Miami Holidays 2025
INSERT INTO calendar_templates (name, geography, country, holiday_dates, is_active) VALUES
('US Miami Holidays 2025', 'North America', 'United States', ARRAY[
    '2025-01-01'::date, -- New Year's Day
    '2025-01-20'::date, -- Martin Luther King Jr. Day
    '2025-02-17'::date, -- Presidents' Day
    '2025-05-26'::date, -- Memorial Day
    '2025-07-04'::date, -- Independence Day
    '2025-09-01'::date, -- Labor Day
    '2025-10-13'::date, -- Columbus Day
    '2025-11-11'::date, -- Veterans Day
    '2025-11-27'::date, -- Thanksgiving
    '2025-12-25'::date  -- Christmas
], true)
ON CONFLICT DO NOTHING;

-- 7. Create Sample Shift Management
INSERT INTO shift_management (shift_name, start_time, end_time, break_duration, is_active) VALUES
('Morning Shift', '09:00:00', '18:00:00', 60, true),
('Evening Shift', '14:00:00', '23:00:00', 60, true),
('Night Shift', '22:00:00', '06:00:00', 60, true),
('Flexible Hours', '10:00:00', '19:00:00', 60, true)
ON CONFLICT DO NOTHING;

-- 8. Create Default Approval Workflow Template
INSERT INTO approval_workflow (template_name, stage_order, approver_role, is_required) VALUES
('Standard Approval', 1, 'Manager', true),
('Standard Approval', 2, 'HOD', false),
('Manager Only', 1, 'Manager', true),
('HOD Only', 1, 'HOD', true),
('Admin Only', 1, 'Admin', true)
ON CONFLICT DO NOTHING;

-- =====================================================
-- Seed Data Summary:
-- ✅ Leave Types: 8 types
-- ✅ Roles: 4 roles (Employee, Manager, HOD, Admin)
-- ✅ System Settings: 12 settings
-- ✅ Employee Records: Created for existing users (with location-based assignment)
-- ✅ Leave Balance: Initialized for all employees
-- ✅ Calendar Templates: 
--    - India Holidays 2025 (for India team)
--    - US Miami Holidays 2025 (for US Miami team)
-- ✅ Calendar Assignments: Automatically assigned based on employee location
-- ✅ Shift Management: 4 shifts
-- ✅ Approval Workflows: 5 templates
-- =====================================================

