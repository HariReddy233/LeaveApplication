import database from '../config/database.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function setupDatabase() {
  try {
    console.log('🚀 Starting database setup...\n');

    // Read seed data SQL file
    const seedDataPath = join(__dirname, '../../database/seed_data.sql');
    const seedDataSQL = readFileSync(seedDataPath, 'utf-8');

    console.log('📝 Executing seed data script...\n');

    // Split SQL into individual statements
    const statements = seedDataSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('='));

    let successCount = 0;
    let errorCount = 0;

    for (const statement of statements) {
      if (statement.length < 10) continue; // Skip very short statements
      
      try {
        await database.query(statement);
        successCount++;
      } catch (error) {
        // Ignore constraint errors (data might already exist)
        if (error.code === '23505' || error.message.includes('already exists') || error.message.includes('duplicate')) {
          // This is okay - data already exists
          successCount++;
        } else {
          console.error(`⚠️  Error executing statement: ${error.message}`);
          errorCount++;
        }
      }
    }

    console.log(`\n✅ Executed ${successCount} statements successfully`);
    if (errorCount > 0) {
      console.log(`⚠️  ${errorCount} statements had errors (may be expected if data exists)`);
    }

    // Verify data was created
    console.log('\n📊 Verifying data...\n');

    // Check leave types
    const leaveTypes = await database.query('SELECT COUNT(*) as count FROM leave_types');
    console.log(`✅ Leave Types: ${leaveTypes.rows[0].count} types`);

    // Check roles
    const roles = await database.query('SELECT COUNT(*) as count FROM roles');
    console.log(`✅ Roles: ${roles.rows[0].count} roles`);

    // Check system settings
    const settings = await database.query('SELECT COUNT(*) as count FROM system_settings');
    console.log(`✅ System Settings: ${settings.rows[0].count} settings`);

    // Check employees
    const employees = await database.query('SELECT COUNT(*) as count FROM employees');
    console.log(`✅ Employees: ${employees.rows[0].count} employees`);

    // Check leave balance
    const leaveBalance = await database.query('SELECT COUNT(*) as count FROM leave_balance');
    console.log(`✅ Leave Balance Records: ${leaveBalance.rows[0].count} records`);

    // Check calendar templates
    const calendars = await database.query('SELECT name, geography, country FROM calendar_templates');
    console.log(`✅ Calendar Templates: ${calendars.rows.length} calendars`);
    calendars.rows.forEach(cal => {
      console.log(`   - ${cal.name} (${cal.geography}, ${cal.country})`);
    });

    // Check calendar assignments
    const assignments = await database.query(`
      SELECT COUNT(*) as count 
      FROM employee_calendar_assignments
    `);
    console.log(`✅ Calendar Assignments: ${assignments.rows[0].count} assignments`);

    // Check shifts
    const shifts = await database.query('SELECT COUNT(*) as count FROM shift_management');
    console.log(`✅ Shift Management: ${shifts.rows[0].count} shifts`);

    // Check approval workflows
    const workflows = await database.query('SELECT COUNT(*) as count FROM approval_workflow');
    console.log(`✅ Approval Workflows: ${workflows.rows[0].count} templates`);

    // Show employee locations
    console.log('\n👥 Employee Locations:');
    const locations = await database.query(`
      SELECT e.location, COUNT(*) as count
      FROM employees e
      GROUP BY e.location
      ORDER BY e.location
    `);
    locations.rows.forEach(loc => {
      console.log(`   - ${loc.location || 'Not Set'}: ${loc.count} employees`);
    });

    // Show calendar assignments by location
    console.log('\n📅 Calendar Assignments by Location:');
    const calAssignments = await database.query(`
      SELECT 
        e.location,
        ct.name as calendar_name,
        COUNT(*) as employee_count
      FROM employees e
      JOIN employee_calendar_assignments eca ON e.employee_id = eca.employee_id
      JOIN calendar_templates ct ON eca.calendar_template_id = ct.id
      GROUP BY e.location, ct.name
      ORDER BY e.location, ct.name
    `);
    
    if (calAssignments.rows.length > 0) {
      calAssignments.rows.forEach(cal => {
        console.log(`   - ${cal.location}: ${cal.calendar_name} (${cal.employee_count} employees)`);
      });
    } else {
      console.log('   ⚠️  No calendar assignments found. Run assignment queries.');
    }

    console.log('\n' + '='.repeat(50));
    console.log('✅ DATABASE SETUP COMPLETE!');
    console.log('='.repeat(50));
    console.log('\n📋 Next Steps:');
    console.log('   1. Test login with: hreddy@consultare.net / password');
    console.log('   2. Verify dashboard loads correctly');
    console.log('   3. Check employee records and leave balances');
    console.log('   4. Test calendar view with location-based holidays\n');

    await database.end();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Database setup failed:');
    console.error('   Error:', error.message);
    console.error('   Code:', error.code);
    
    if (error.code === '28P01') {
      console.error('\n⚠️  Database authentication failed!');
      console.error('   Check your database password in .env file');
    } else if (error.code === '42P01') {
      console.error('\n⚠️  Table does not exist!');
      console.error('   Please run create_tables.sql first');
    }
    
    await database.end();
    process.exit(1);
  }
}

setupDatabase();








