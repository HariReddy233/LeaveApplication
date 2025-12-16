import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import database from './config/database.js';

// Import routes
import routes from './routes/index.js';

// Import error handlers
import { DefaultErrorHandler, NotFoundError } from './helper/ErrorHandler.js';

// Note: Using PostgreSQL for authentication

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Test database connection
database.query('SELECT NOW() as current_time, current_database()', (err, res) => {
  if (err) {
    console.error('❌ Database connection error:', err.message);
    console.error('');
    console.error('PostgreSQL Connection Details:');
    console.error('  Host:', process.env.DB_HOST || '50.116.57.115');
    console.error('  Port:', process.env.DB_PORT || 5434);
    console.error('  Database:', process.env.DB_NAME || 'VacationManagement');
    console.error('  User:', process.env.DB_USER || 'admin');
    console.error('');
    console.error('Troubleshooting:');
    console.error('  1. Verify PostgreSQL is accessible at 50.116.57.115:5434');
    console.error('  2. Check if database "VacationManagement" exists');
    console.error('  3. Run: CREATE DATABASE "VacationManagement"; (if needed)');
    console.error('  4. Check firewall/network settings');
  } else {
    console.log('✅ PostgreSQL connected successfully!');
    console.log('   Database:', res.rows[0].current_database || process.env.DB_NAME || 'VacationManagement');
    console.log('   Server time:', res.rows[0].current_time);
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Routes - using /api/v1 prefix to match HR Portal pattern
app.use('/api/v1', routes);

// Not Found Error Handler
app.use(NotFoundError);

// Default Error Handler
app.use(DefaultErrorHandler);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API endpoints available at http://localhost:${PORT}/api/v1`);
});

export default app;
