import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const databasesToTry = ['leave_management', 'VacationManagement', 'postgres'];

async function checkDatabase(dbName, password) {
  const pool = new Pool({
    host: process.env.DB_HOST || '50.116.57.115',
    port: parseInt(process.env.DB_PORT) || 5434,
    database: dbName,
    user: process.env.DB_USER || 'admin',
    password: password,
    ssl: {
      rejectUnauthorized: false
    },
    connectionTimeoutMillis: 5000
  });

  try {
    const result = await pool.query('SELECT NOW() as current_time, current_database()');
    console.log(`✅ SUCCESS!`);
    console.log(`   Database: ${result.rows[0].current_database}`);
    console.log(`   Password: ${password}`);
    await pool.end();
    return { success: true, database: dbName, password };
  } catch (error) {
    await pool.end();
    return { success: false, error: error.message };
  }
}

async function findCorrectConfig() {
  const passwords = ['Consultare@#890', 'Consultare@890'];
  
  console.log('Checking database and password combinations...\n');
  
  for (const password of passwords) {
    console.log(`\nTrying password: ${password}`);
    for (const dbName of databasesToTry) {
      console.log(`  Checking database: ${dbName}...`);
      const result = await checkDatabase(dbName, password);
      if (result.success) {
        console.log(`\n✅ FOUND CORRECT CONFIGURATION:`);
        console.log(`   DB_NAME=${result.database}`);
        console.log(`   DB_PASSWORD=${result.password}`);
        process.exit(0);
      } else {
        if (result.error.includes('does not exist')) {
          console.log(`     ⚠️  Database doesn't exist`);
        } else if (result.error.includes('authentication')) {
          console.log(`     ❌ Password incorrect`);
        } else {
          console.log(`     ❌ ${result.error}`);
        }
      }
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }
  
  console.log('\n❌ Could not find working configuration.');
  console.log('Please verify:');
  console.log('  1. Database name (leave_management or VacationManagement)');
  console.log('  2. Database password');
  process.exit(1);
}

findCorrectConfig();

