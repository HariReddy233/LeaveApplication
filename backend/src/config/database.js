import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// PostgreSQL connection configuration
const pool = new Pool({
  host: process.env.DB_HOST || '50.116.57.115',
  port: parseInt(process.env.DB_PORT) || 5434,
  database: process.env.DB_NAME || 'VacationManagement',
  user: process.env.DB_USER || 'admin',
  password: process.env.DB_PASSWORD || 'Consultare@#890',
  ssl: {
    rejectUnauthorized: false
  },
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 30000, // Wait 30 seconds before timing out when connecting
  statement_timeout: 30000, // Maximum time a query can run (30 seconds)
  query_timeout: 30000, // Maximum time to wait for a query to complete
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000 // Wait 10 seconds before sending keepalive
});

pool.on('error', (err, client) => {
  console.error('❌ Unexpected error on idle client', err);
  // Don't exit the process, just log the error
  // The pool will handle reconnection automatically
});

// Handle connection events for debugging (commented out to reduce log noise)
// Uncomment these if you need to debug connection issues
// pool.on('connect', (client) => {
//   console.log('✅ New database client connected');
// });

// pool.on('acquire', (client) => {
//   console.log('📌 Client acquired from pool');
// });

// pool.on('remove', (client) => {
//   console.log('🗑️ Client removed from pool');
// });

// Test connection on startup
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Database connection test failed:', err.message);
  } else {
    console.log('✅ Database connection successful');
  }
});

export default pool;

