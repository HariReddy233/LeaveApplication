import database from '../config/database.js';

async function executeSeedData() {
  try {
    console.log('🚀 Starting database seed data execution...\n');

    // 1. Insert Leave Types
    console.log('📝 Creating Leave Types...');
    await database.query(`
      INSERT INTO leave_types (name, code, max_days, carry_forward, description, is_active) VALUES
      ('Sick Leave', 'SL', 12, false, 'Leave for medical reasons', true),
      ('Casual Leave', 'CL', 12, false, 'Casual leave for personal reasons', true),
      ('Annual Leave', 'AL', 15, true, 'Annual vacation leave', true),
      ('Earned Leave', 'EL', 30, true, 'Earned leave that can be carried forward', true),
      ('Compensatory Off', 'CO', NULL, false, 'Compensatory leave for working on holidays', true),
      ('Maternity Leave', 'ML', 90, false, 'Maternity leave for female employees', true),
      ('Paternity Leave', 'PL', 7, false, 'Paternity leave for male employees', true),
      ('Bereavement Leave', 'BL', 5, false, 'Leave for family bereavement', true)
      ON CONFLICT DO NOTHING
    `);
    console.log('✅ Leave Types created\n');

    // 2. Insert Roles
    console.log('📝 Creating Roles...');
    await database.query(`
      INSERT INTO roles (role_name, description, permissions, is_active) VALUES
      ('Employee', 'Regular employee who can apply for leaves', '{"apply_leave": true, "view_own_leaves": true, "view_balance": true}'::jsonb, true),
      ('Manager', 'Manager who can approve team member leaves', '{"apply_leave": true, "view_own_leaves": true, "view_balance": true, "approve_leaves": true, "view_team_leaves": true}'::jsonb, true),
      ('HOD', 'Head of Department with department-wide approval', '{"apply_leave": true, "view_own_leaves": true, "view_balance": true, "approve_leaves": true, "view_team_leaves": true, "view_department_leaves": true}'::jsonb, true),
      ('Admin', 'System administrator with full access', '{"apply_leave": true, "view_own_leaves": true, "view_balance": true, "approve_leaves": true, "view_team_leaves": true, "view_department_leaves": true, "manage_employees": true, "manage_settings": true, "manage_calendars": true, "view_all_leaves": true}'::jsonb, true)
      ON CONFLICT (role_name) DO NOTHING
    `);
    console.log('✅ Roles created\n');

    // 3. Insert System Settings
    console.log('📝 Creating System Settings...');
    await database.query(`
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
      ON CONFLICT (setting_key) DO NOTHING
    `);
    console.log('✅ System Settings created\n');

    // 4. Create Employee Records
    console.log('📝 Creating Employee Records...');
    await database.query(`
      INSERT INTO employees (user_id, employee_code, location, team, created_at)
      SELECT 
        user_id,
        'EMP' || LPAD(user_id::text, 4, '0') as employee_code,
        CASE 
          WHEN department ILIKE '%US%' OR department ILIKE '%Miami%' OR email ILIKE '%@consultare.us%' THEN 'US Miami'
          WHEN department ILIKE '%India%' OR department ILIKE '%IN%' OR email ILIKE '%@consultare.in%' THEN 'India'
          ELSE COALESCE(department, 'India')
        END as location,
        COALESCE(department, 'IT') as team,
        COALESCE(date_of_joining, NOW()) as created_at
      FROM users
      WHERE user_id NOT IN (SELECT user_id FROM employees WHERE user_id IS NOT NULL)
      ON CONFLICT DO NOTHING
    `);
    const employeesResult = await database.query('SELECT COUNT(*) as count FROM employees');
    console.log(`✅ Employee Records created: ${employeesResult.rows[0].count} employees\n`);

    // 5. Initialize Leave Balance
    console.log('📝 Initializing Leave Balance...');
    await database.query(`
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
      ON CONFLICT DO NOTHING
    `);
    const balanceResult = await database.query('SELECT COUNT(*) as count FROM leave_balance');
    console.log(`✅ Leave Balance initialized: ${balanceResult.rows[0].count} records\n`);

    // 6. Create Calendar Templates
    console.log('📝 Creating Calendar Templates...');
    
    // India Calendar
    await database.query(`
      INSERT INTO calendar_templates (name, geography, country, holiday_dates, is_active) VALUES
      ('India Holidays 2025', 'Asia', 'India', ARRAY[
        '2025-01-26'::date,
        '2025-03-29'::date,
        '2025-04-14'::date,
        '2025-04-17'::date,
        '2025-05-01'::date,
        '2025-08-15'::date,
        '2025-08-26'::date,
        '2025-10-02'::date,
        '2025-10-12'::date,
        '2025-10-31'::date,
        '2025-11-01'::date,
        '2025-12-25'::date
      ], true)
      ON CONFLICT DO NOTHING
    `);

    // US Miami Calendar
    await database.query(`
      INSERT INTO calendar_templates (name, geography, country, holiday_dates, is_active) VALUES
      ('US Miami Holidays 2025', 'North America', 'United States', ARRAY[
        '2025-01-01'::date,
        '2025-01-20'::date,
        '2025-02-17'::date,
        '2025-05-26'::date,
        '2025-07-04'::date,
        '2025-09-01'::date,
        '2025-10-13'::date,
        '2025-11-11'::date,
        '2025-11-27'::date,
        '2025-12-25'::date
      ], true)
      ON CONFLICT DO NOTHING
    `);
    const calendarsResult = await database.query('SELECT COUNT(*) as count FROM calendar_templates');
    console.log(`✅ Calendar Templates created: ${calendarsResult.rows[0].count} calendars\n`);

    // 7. Assign Calendars to Employees
    console.log('📝 Assigning Calendars to Employees...');
    
    // India Team
    await database.query(`
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
      ON CONFLICT DO NOTHING
    `);

    // US Miami Team
    await database.query(`
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
      ON CONFLICT DO NOTHING
    `);
    const assignmentsResult = await database.query('SELECT COUNT(*) as count FROM employee_calendar_assignments');
    console.log(`✅ Calendar Assignments: ${assignmentsResult.rows[0].count} assignments\n`);

    // 8. Create Shift Management
    console.log('📝 Creating Shift Management...');
    await database.query(`
      INSERT INTO shift_management (shift_name, start_time, end_time, break_duration, is_active) VALUES
      ('Morning Shift', '09:00:00', '18:00:00', 60, true),
      ('Evening Shift', '14:00:00', '23:00:00', 60, true),
      ('Night Shift', '22:00:00', '06:00:00', 60, true),
      ('Flexible Hours', '10:00:00', '19:00:00', 60, true)
      ON CONFLICT DO NOTHING
    `);
    console.log('✅ Shift Management created\n');

    // 9. Create Approval Workflows
    console.log('📝 Creating Approval Workflows...');
    await database.query(`
      INSERT INTO approval_workflow (template_name, stage_order, approver_role, is_required) VALUES
      ('Standard Approval', 1, 'Manager', true),
      ('Standard Approval', 2, 'HOD', false),
      ('Manager Only', 1, 'Manager', true),
      ('HOD Only', 1, 'HOD', true),
      ('Admin Only', 1, 'Admin', true)
      ON CONFLICT DO NOTHING
    `);
    console.log('✅ Approval Workflows created\n');

    // Summary
    console.log('='.repeat(60));
    console.log('✅ DATABASE SEED DATA EXECUTION COMPLETE!');
    console.log('='.repeat(60));
    console.log('\n📊 Summary:');
    
    const summary = await database.query(`
      SELECT 
        (SELECT COUNT(*) FROM leave_types) as leave_types,
        (SELECT COUNT(*) FROM roles) as roles,
        (SELECT COUNT(*) FROM system_settings) as settings,
        (SELECT COUNT(*) FROM employees) as employees,
        (SELECT COUNT(*) FROM leave_balance) as leave_balance,
        (SELECT COUNT(*) FROM calendar_templates) as calendars,
        (SELECT COUNT(*) FROM employee_calendar_assignments) as calendar_assignments,
        (SELECT COUNT(*) FROM shift_management) as shifts,
        (SELECT COUNT(*) FROM approval_workflow) as workflows
    `);
    
    const s = summary.rows[0];
    console.log(`   ✅ Leave Types: ${s.leave_types}`);
    console.log(`   ✅ Roles: ${s.roles}`);
    console.log(`   ✅ System Settings: ${s.settings}`);
    console.log(`   ✅ Employees: ${s.employees}`);
    console.log(`   ✅ Leave Balance Records: ${s.leave_balance}`);
    console.log(`   ✅ Calendar Templates: ${s.calendars}`);
    console.log(`   ✅ Calendar Assignments: ${s.calendar_assignments}`);
    console.log(`   ✅ Shifts: ${s.shifts}`);
    console.log(`   ✅ Approval Workflows: ${s.workflows}`);

    // Show employee locations
    const locations = await database.query(`
      SELECT location, COUNT(*) as count
      FROM employees
      GROUP BY location
      ORDER BY location
    `);
    
    if (locations.rows.length > 0) {
      console.log('\n👥 Employee Locations:');
      locations.rows.forEach(loc => {
        console.log(`   - ${loc.location || 'Not Set'}: ${loc.count} employees`);
      });
    }

    console.log('\n🎉 All seed data has been successfully created!');
    console.log('\n📋 Next Steps:');
    console.log('   1. Test login: hreddy@consultare.net / password');
    console.log('   2. Verify dashboard loads');
    console.log('   3. Check leave balances');
    console.log('   4. Test calendar view\n');

    await database.end();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error executing seed data:');
    console.error('   Message:', error.message);
    console.error('   Code:', error.code);
    console.error('   Detail:', error.detail);
    
    await database.end();
    process.exit(1);
  }
}

executeSeedData();











