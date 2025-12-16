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
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

export default pool;

