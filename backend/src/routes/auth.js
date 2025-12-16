import express from 'express';
import database from '../config/database.js';
import { hashPassword, comparePassword, generateToken } from '../utils/auth.js';

const router = express.Router();

// Test database connection
router.get('/test-db', async (req, res) => {
  try {
    const result = await database.query('SELECT NOW() as current_time, current_database()');
    res.json({ 
      success: true, 
      database: result.rows[0].current_database,
      time: result.rows[0].current_time
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message,
      code: error.code
    });
  }
});

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { email, password, fullName, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if user already exists
    const existingUser = await database.query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const userResult = await database.query(
      `INSERT INTO users (email, password_hash, full_name, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, full_name, role, created_at`,
      [email.toLowerCase(), passwordHash, fullName || email, role || 'employee']
    );

    const user = userResult.rows[0];

    // Create corresponding employee record
    const employeeResult = await database.query(
      `INSERT INTO employees (user_id, email, full_name, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [user.id, user.email, user.full_name, user.role]
    );

    // Generate token
    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    res.status(201).json({
      message: 'Registration successful',
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
      },
      token,
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user - handle both schema types (id/user_id, full_name/first_name+last_name)
    let userResult;
    try {
      // Try new schema first (user_id, first_name, last_name)
      userResult = await database.query(
        `SELECT user_id as id, first_name, last_name, 
         COALESCE(first_name || ' ' || last_name, first_name, last_name, email) as full_name,
         email, password_hash, role, status, department, designation
         FROM users WHERE LOWER(email) = $1 LIMIT 1`,
        [email.toLowerCase()]
      );
      
      // If no result, try old schema (id, full_name)
      if (userResult.rows.length === 0) {
        userResult = await database.query(
          'SELECT * FROM users WHERE LOWER(email) = $1 LIMIT 1',
          [email.toLowerCase()]
        );
      }
    } catch (dbError) {
      console.error('Database query error:', dbError);
      throw new Error(`Database error: ${dbError.message}`);
    }

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = userResult.rows[0];

    // Check if account is inactive (status column)
    if (user.status && user.status.toLowerCase() !== 'active') {
      return res.status(403).json({ error: 'Account is inactive' });
    }

    // Verify password: check if it's a bcrypt hash or plaintext
    let isPasswordValid = false;
    const passwordHash = user.password_hash;
    
    // Check if password_hash looks like a bcrypt hash (starts with $2a$, $2b$, or $2y$)
    const isBcryptHash = passwordHash && /^\$2[aby]\$/.test(passwordHash);
    
    if (isBcryptHash) {
      // It's a bcrypt hash, compare properly
      isPasswordValid = await comparePassword(password, passwordHash);
    } else {
      // It's plaintext, compare directly
      isPasswordValid = password === String(passwordHash);
    }

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Get user ID (handle both user_id and id columns)
    const userId = user.id || user.user_id;
    const fullName = user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email;

    // Generate token
    const token = generateToken({
      id: userId,
      email: user.email,
      role: user.role || 'employee',
    });

    res.json({
      message: 'Login successful',
      user: {
        id: userId,
        email: user.email,
        full_name: fullName,
        role: user.role || 'employee',
        department: user.department,
        designation: user.designation,
      },
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    res.status(500).json({ 
      error: 'Login failed',
      message: error.message || 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && { details: error.stack })
    });
  }
});

// Get current user
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      console.log('❌ /auth/me: No token provided');
      return res.status(401).json({ error: 'Access token required' });
    }

    const { verifyToken } = await import('../utils/auth.js');
    const decoded = verifyToken(token);

    if (!decoded) {
      console.log('❌ /auth/me: Token verification failed');
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    console.log('✅ /auth/me: Token verified, user ID:', decoded.id);

    // Get user from database - handle both schema types (user_id or id)
    // The token contains user_id as 'id', so we need to query by user_id
    let userResult;
    try {
      // Try new schema first (user_id, first_name, last_name)
      userResult = await database.query(
        `SELECT user_id, first_name, last_name, 
         COALESCE(first_name || ' ' || last_name, first_name, last_name, email) as full_name,
         email, role, status, department, designation
         FROM users 
         WHERE user_id = $1 
         AND (status = 'Active' OR status IS NULL)
         LIMIT 1`,
        [decoded.id]
      );
      
      // If no result, try with id column (old schema)
      if (userResult.rows.length === 0) {
        userResult = await database.query(
          'SELECT id, email, full_name, role FROM users WHERE id = $1 LIMIT 1',
          [decoded.id]
        );
      }
    } catch (dbError) {
      console.error('Database query error:', dbError);
      console.error('Query details:', { decodedId: decoded.id, error: dbError.message, code: dbError.code });
      return res.status(500).json({ error: 'Database error', message: dbError.message });
    }

    if (userResult.rows.length === 0) {
      console.error('❌ /auth/me: User not found in database:', decoded.id);
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];
    const userId = user.user_id || user.id;
    
    console.log('✅ /auth/me: User found:', user.email);
    
    res.json({ 
      user: {
        id: userId,
        email: user.email,
        full_name: user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email,
        role: user.role || 'employee',
        department: user.department,
        designation: user.designation,
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

export default router;
