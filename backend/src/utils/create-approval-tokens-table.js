// Standalone script to create approval_tokens table
import database from '../config/database.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function createApprovalTokensTable() {
  try {
    console.log('🚀 Creating approval_tokens table...');
    
    const sqlPath = join(__dirname, '../../database/create_approval_tokens_table.sql');
    const sql = readFileSync(sqlPath, 'utf-8');
    
    await database.query(sql);
    console.log('✅ approval_tokens table created successfully!');

    // Verify table creation
    const checkTable = await database.query(`
      SELECT EXISTS (
        SELECT FROM pg_tables
        WHERE schemaname = 'public' AND tablename = 'approval_tokens'
      );
    `);
    
    if (checkTable.rows[0].exists) {
      console.log('✅ Table verification: approval_tokens exists');
      
      // Check indexes
      const checkIndexes = await database.query(`
        SELECT indexname FROM pg_indexes 
        WHERE tablename = 'approval_tokens';
      `);
      console.log(`✅ Created ${checkIndexes.rows.length} indexes`);
    } else {
      console.error('❌ Table verification: approval_tokens does NOT exist');
    }

    await database.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating approval_tokens table:', error.message);
    console.error('Full error:', error);
    await database.end();
    process.exit(1);
  }
}

createApprovalTokensTable();

