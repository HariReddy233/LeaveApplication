import database from '../config/database.js';

async function fixEmployeeLocations() {
  try {
    console.log('🔧 Fixing employee locations...\n');

    // Update employees with "IT" location to "India" (default for India team)
    const result = await database.query(`
      UPDATE employees 
      SET location = 'India'
      WHERE location = 'IT' OR location IS NULL
      RETURNING employee_id, user_id, location
    `);

    console.log(`✅ Updated ${result.rows.length} employees to India location\n`);

    // Assign India calendar to all India employees
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

    console.log('✅ Assigned India calendar to India team employees\n');

    // Show final locations
    const locations = await database.query(`
      SELECT location, COUNT(*) as count
      FROM employees
      GROUP BY location
      ORDER BY location
    `);

    console.log('📊 Final Employee Locations:');
    locations.rows.forEach(loc => {
      console.log(`   - ${loc.location}: ${loc.count} employees`);
    });

    // Show calendar assignments
    const assignments = await database.query(`
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

    console.log('\n📅 Calendar Assignments:');
    assignments.rows.forEach(cal => {
      console.log(`   - ${cal.location}: ${cal.calendar_name} (${cal.employee_count} employees)`);
    });

    console.log('\n✅ Employee locations fixed!\n');

    await database.end();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error fixing locations:');
    console.error('   Message:', error.message);
    await database.end();
    process.exit(1);
  }
}

fixEmployeeLocations();














