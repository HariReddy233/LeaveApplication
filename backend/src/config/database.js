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
  idleTimeoutMillis: 600000, // Close idle clients after 10 minutes (increased from 30 seconds)
  connectionTimeoutMillis: 60000, // Wait 60 seconds before timing out when connecting
  statement_timeout: 0, // Disable statement timeout (0 = no timeout)
  query_timeout: 0, // Disable query timeout (0 = no timeout)
  keepAlive: true,
  keepAliveInitialDelayMillis: 0, // Start keepalive immediately
  // Additional connection pool settings
  min: 2, // Minimum number of clients in the pool
  allowExitOnIdle: false // Don't exit when pool is idle
});

pool.on('error', (err, client) => {
  console.error('❌ Unexpected error on idle client', err);
  console.error('Error details:', {
    message: err.message,
    code: err.code,
    severity: err.severity
  });
  // Don't exit the process, just log the error
  // The pool will handle reconnection automatically
});

// Handle connection events for better monitoring
pool.on('connect', (client) => {
  console.log('✅ New database client connected');
});

pool.on('acquire', (client) => {
  console.log('📌 Client acquired from pool');
});

pool.on('remove', (client) => {
  console.log('🗑️ Client removed from pool');
});

// Periodic connection health check to prevent idle disconnections
setInterval(async () => {
  try {
    await pool.query('SELECT 1');
    console.log('💓 Database connection health check: OK');
  } catch (error) {
    console.error('❌ Database health check failed:', error.message);
  }
}, 30000); // Check every 30 seconds

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

