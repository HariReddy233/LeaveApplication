import express from 'express';
import database from '../config/database.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';

const router = express.Router();

// Get all employees
router.get('/employees', authenticateToken, authorizeRole('admin', 'hod', 'manager'), async (req, res) => {
  try {
    const { location, team, manager } = req.query;
    let query = `SELECT e.employee_id, 
                 COALESCE(u.first_name || ' ' || u.last_name, u.first_name, u.last_name, u.email) as full_name,
                 u.email, e.location, e.team, e.manager_id, e.role
                 FROM employees e
                 JOIN users u ON e.user_id = u.user_id
                 WHERE 1=1`;
    const params = [];
    let paramCount = 1;

    if (location) {
      query += ` AND e.location = $${paramCount}`;
      params.push(location);
      paramCount++;
    }

    if (team) {
      query += ` AND e.team = $${paramCount}`;
      params.push(team);
      paramCount++;
    }

    if (manager) {
      query += ` AND e.manager_id = $${paramCount}`;
      params.push(manager);
      paramCount++;
    }

    const result = await database.query(query, params);

    res.json({ data: result.rows });
  } catch (error) {
    console.error('Get employees error:', error);
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
});

// Get user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    // Get employee record linked to user
    const result = await database.query(
      `SELECT e.employee_id, 
       COALESCE(u.first_name || ' ' || u.last_name, u.first_name, u.last_name, u.email) as full_name,
       u.email, e.location, e.team, e.manager_id, e.role
       FROM employees e
       JOIN users u ON e.user_id = u.user_id
       WHERE u.user_id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

export default router;

