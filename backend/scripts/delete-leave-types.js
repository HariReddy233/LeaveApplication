/**
 * Script to delete leave types: Annual Leave, Bereavement Leave, Paternity Leave
 * This script deletes leave_balance records first, then deletes the leave types
 */

import database from '../src/config/database.js';

const leaveTypesToDelete = ['Annual Leave', 'Bereavement Leave', 'Paternity Leave'];

async function deleteLeaveTypes() {
  try {
    console.log('🗑️  Starting deletion of leave types...\n');
    
    // Step 1: Show what will be deleted
    console.log('📊 Checking leave_balance records...');
    const balanceCheck = await database.query(
      `SELECT leave_type, COUNT(*) as count 
       FROM leave_balance 
       WHERE leave_type = ANY($1::text[])
       GROUP BY leave_type`,
      [leaveTypesToDelete]
    );
    
    if (balanceCheck.rows.length > 0) {
      console.log('Found leave_balance records:');
      balanceCheck.rows.forEach(row => {
        console.log(`   - ${row.leave_type}: ${row.count} records`);
      });
    } else {
      console.log('   No leave_balance records found for these leave types.');
    }
    
    console.log('\n📊 Checking leave_types...');
    const typesCheck = await database.query(
      `SELECT name, id, max_days 
       FROM leave_types 
       WHERE name = ANY($1::text[])`,
      [leaveTypesToDelete]
    );
    
    if (typesCheck.rows.length > 0) {
      console.log('Found leave types:');
      typesCheck.rows.forEach(row => {
        console.log(`   - ${row.name} (ID: ${row.id}, Max Days: ${row.max_days || 'N/A'})`);
      });
    } else {
      console.log('   No leave types found.');
    }
    
    // Step 2: Delete leave_balance records
    console.log('\n🗑️  Deleting leave_balance records...');
    const balanceDelete = await database.query(
      `DELETE FROM leave_balance 
       WHERE leave_type = ANY($1::text[])`,
      [leaveTypesToDelete]
    );
    console.log(`✅ Deleted ${balanceDelete.rowCount} leave_balance record(s)`);
    
    // Step 3: Delete leave types
    console.log('\n🗑️  Deleting leave types...');
    const typesDelete = await database.query(
      `DELETE FROM leave_types 
       WHERE name = ANY($1::text[])`,
      [leaveTypesToDelete]
    );
    console.log(`✅ Deleted ${typesDelete.rowCount} leave type(s)`);
    
    // Step 4: Verify deletion
    console.log('\n✅ Verification:');
    const verifyBalance = await database.query(
      `SELECT COUNT(*) as count 
       FROM leave_balance 
       WHERE leave_type = ANY($1::text[])`,
      [leaveTypesToDelete]
    );
    console.log(`   Leave balance records remaining: ${verifyBalance.rows[0].count}`);
    
    const verifyTypes = await database.query(
      `SELECT COUNT(*) as count 
       FROM leave_types 
       WHERE name = ANY($1::text[])`,
      [leaveTypesToDelete]
    );
    console.log(`   Leave types remaining: ${verifyTypes.rows[0].count}`);
    
    // Step 5: Show remaining leave types
    console.log('\n📋 Remaining leave types:');
    const remaining = await database.query(
      `SELECT name, max_days, is_active 
       FROM leave_types 
       ORDER BY name`
    );
    remaining.rows.forEach(row => {
      console.log(`   - ${row.name} (Max Days: ${row.max_days || 'N/A'}, Active: ${row.is_active})`);
    });
    
    console.log('\n✅ SUCCESS: Leave types and their balance records have been deleted!');
    
  } catch (error) {
    console.error('❌ Error deleting leave types:', error);
    throw error;
  } finally {
    await database.end();
  }
}

// Run the script
deleteLeaveTypes()
  .then(() => {
    console.log('\n✨ Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error);
    process.exit(1);
  });





