import database from '../config/database.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function createOTPTable() {
  try {
    console.log('🚀 Creating password_reset_otp table...\n');

    // Read SQL file
    const sqlPath = join(__dirname, '../../database/create_otp_table.sql');
    const sql = readFileSync(sqlPath, 'utf-8');

    // Execute SQL
    await database.query(sql);

    console.log('✅ password_reset_otp table created successfully!\n');

    // Verify table exists
    const result = await database.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'password_reset_otp'
      );
    `);

    if (result.rows[0].exists) {
      console.log('✅ Table verification: password_reset_otp exists\n');
    }

    await database.end();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error creating OTP table:');
    console.error('   Message:', error.message);
    console.error('   Code:', error.code);
    console.error('   Detail:', error.detail);
    
    await database.end();
    process.exit(1);
  }
}

createOTPTable();

