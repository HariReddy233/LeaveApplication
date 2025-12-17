-- =====================================================
-- Calendar Management Scripts
-- =====================================================
-- Use these scripts to manage calendars for India and US Miami teams
-- =====================================================

-- 1. View All Calendar Templates
SELECT id, name, geography, country, 
       array_length(holiday_dates, 1) as total_holidays,
       is_active, created_at
FROM calendar_templates
ORDER BY geography, name;

-- 2. View Calendar Assignments by Location
SELECT 
    e.employee_id,
    u.first_name || ' ' || u.last_name as employee_name,
    u.email,
    e.location,
    ct.name as calendar_name,
    ct.geography,
    eca.year
FROM employees e
JOIN users u ON e.user_id = u.user_id
LEFT JOIN employee_calendar_assignments eca ON e.employee_id = eca.employee_id
LEFT JOIN calendar_templates ct ON eca.calendar_template_id = ct.id
ORDER BY e.location, u.first_name;

-- 3. Assign India Calendar to All India Team Members
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

-- 4. Assign US Miami Calendar to All US Miami Team Members
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

-- 5. Update Employee Location (and auto-assign calendar)
-- Example: Change employee location to US Miami
UPDATE employees 
SET location = 'US Miami'
WHERE employee_id = ?; -- Replace ? with actual employee_id

-- Then assign US Miami calendar
INSERT INTO employee_calendar_assignments (employee_id, calendar_template_id, year)
SELECT 
    e.employee_id,
    ct.id,
    EXTRACT(YEAR FROM NOW())
FROM employees e
CROSS JOIN calendar_templates ct
WHERE e.employee_id = ? -- Replace ? with actual employee_id
AND ct.name = 'US Miami Holidays 2025'
AND NOT EXISTS (
    SELECT 1 FROM employee_calendar_assignments eca 
    WHERE eca.employee_id = e.employee_id 
    AND eca.year = EXTRACT(YEAR FROM NOW())
)
ON CONFLICT DO NOTHING;

-- 6. View Holidays for Specific Employee
SELECT 
    u.first_name || ' ' || u.last_name as employee_name,
    e.location,
    ct.name as calendar_name,
    unnest(ct.holiday_dates) as holiday_date
FROM employees e
JOIN users u ON e.user_id = u.user_id
JOIN employee_calendar_assignments eca ON e.employee_id = eca.employee_id
JOIN calendar_templates ct ON eca.calendar_template_id = ct.id
WHERE u.email = 'hreddy@consultare.net' -- Replace with actual email
AND eca.year = EXTRACT(YEAR FROM NOW())
ORDER BY holiday_date;

-- 7. Add Custom Holiday to India Calendar
UPDATE calendar_templates
SET holiday_dates = array_append(holiday_dates, '2025-12-31'::date)
WHERE name = 'India Holidays 2025';

-- 8. Add Custom Holiday to US Miami Calendar
UPDATE calendar_templates
SET holiday_dates = array_append(holiday_dates, '2025-12-31'::date)
WHERE name = 'US Miami Holidays 2025';

-- 9. Remove Holiday from Calendar
UPDATE calendar_templates
SET holiday_dates = array_remove(holiday_dates, '2025-12-31'::date)
WHERE name = 'India Holidays 2025';

-- 10. Create New Calendar for Different Location
INSERT INTO calendar_templates (name, geography, country, holiday_dates, is_active) VALUES
('UK London Holidays 2025', 'Europe', 'United Kingdom', ARRAY[
    '2025-01-01'::date, -- New Year's Day
    '2025-04-18'::date, -- Good Friday
    '2025-04-21'::date, -- Easter Monday
    '2025-05-05'::date, -- Early May Bank Holiday
    '2025-05-26'::date, -- Spring Bank Holiday
    '2025-08-25'::date, -- Summer Bank Holiday
    '2025-12-25'::date, -- Christmas
    '2025-12-26'::date  -- Boxing Day
], true);

-- =====================================================
-- Quick Commands:
-- =====================================================
-- View all calendars: Run query #1
-- View assignments: Run query #2
-- Assign India calendar: Run query #3
-- Assign US Miami calendar: Run query #4
-- View employee holidays: Run query #6
-- =====================================================










