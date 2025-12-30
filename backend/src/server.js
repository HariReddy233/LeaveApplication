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

// Enhanced health check with database status
app.get('/api/health', async (req, res) => {
  try {
    // Test database connection
    await database.query('SELECT 1');
    res.json({ 
      status: 'ok', 
      message: 'Server is running',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({ 
      status: 'error', 
      message: 'Server is running but database connection failed',
      database: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Routes - using /api/v1 prefix to match HR Portal pattern
app.use('/api/v1', routes);

// Not Found Error Handler
app.use(NotFoundError);

// Default Error Handler
app.use(DefaultErrorHandler);

// Initialize permissions on server startup (dynamic permission creation)
const initializePermissions = async () => {
  try {
    const { InitializeRequiredPermissionsService } = await import('./services/Permission/PermissionService.js');
    await InitializeRequiredPermissionsService();
  } catch (error) {
    console.error('⚠️ Warning: Could not initialize permissions on startup:', error.message);
    // Don't block server startup if permission initialization fails
  }
};

const server = app.listen(PORT, async () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`✅ API endpoints available at http://localhost:${PORT}/api/v1`);
  console.log(`✅ Health check available at http://localhost:${PORT}/api/health`);
  
  // Initialize required permissions dynamically
  await initializePermissions();
  
  // Signal PM2 that the server is ready
  if (process.send) {
    process.send('ready');
  }
});

// Graceful shutdown handling
const gracefulShutdown = async (signal) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);
  
  server.close(async () => {
    console.log('HTTP server closed.');
    
    // Close database pool
    try {
      await database.end();
      console.log('Database pool closed.');
    } catch (error) {
      console.error('Error closing database pool:', error);
    }
    
    console.log('Graceful shutdown complete.');
    process.exit(0);
  });
  
  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Don't exit, let PM2 handle restart
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit, let PM2 handle restart
});

// Keep process alive
process.on('exit', (code) => {
  console.log(`Process exiting with code ${code}`);
});

export default app;
