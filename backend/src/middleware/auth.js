import { verifyToken } from '../utils/auth.js';
import database from '../config/database.js';

/**
 * Authenticate request using JWT token
 */
export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    // Verify token
    const decoded = verifyToken(token);

    if (!decoded) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    // Get user from database (uses user_id as primary key)
    let userResult;
    try {
      userResult = await database.query(
        `SELECT user_id, email, role, status 
         FROM users 
         WHERE user_id = $1 
         AND (status = 'Active' OR status IS NULL)
         LIMIT 1`,
        [decoded.id]
      );
    } catch (dbError) {
      console.error('Auth middleware database error:', dbError);
      return res.status(500).json({ error: 'Database error', message: dbError.message });
    }

    if (userResult.rows.length === 0) {
      return res.status(403).json({ error: 'User not found or inactive' });
    }

    const user = userResult.rows[0];
    req.user = {
      id: user.user_id,
      email: user.email,
      role: user.role,
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(403).json({ error: 'Token verification failed' });
  }
};

/**
 * Authorize user by role
 */
export const authorizeRole = (...roles) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      if (!roles.includes(req.user.role)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      next();
    } catch (error) {
      return res.status(403).json({ error: 'Authorization failed' });
    }
  };
};
