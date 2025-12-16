import express from 'express';
import database from '../config/database.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';

const router = express.Router();

// Get calendar view (leave days)
router.get('/view', authenticateToken, async (req, res) => {
  try {
    const { employee_id, location, team, manager, start_date, end_date } = req.query;
    
    let query = `
      SELECT 
        la.id,
        la.leave_type,
        la.start_date,
        la.end_date,
        la.status,
        COALESCE(u.first_name || ' ' || u.last_name, u.first_name, u.last_name, u.email) as full_name,
        u.email,
        e.location,
        e.team
      FROM leave_applications la
      JOIN employees e ON la.employee_id = e.employee_id
      JOIN users u ON e.user_id = u.user_id
      WHERE la.status = 'approved'
    `;
    
    const params = [];
    let paramCount = 1;
    
    if (start_date && end_date) {
      query += ` AND (
        (la.start_date >= $${paramCount} AND la.start_date <= $${paramCount + 1}) OR
        (la.end_date >= $${paramCount} AND la.end_date <= $${paramCount + 1}) OR
        (la.start_date <= $${paramCount} AND la.end_date >= $${paramCount + 1})
      )`;
      params.push(start_date, end_date);
      paramCount += 2;
    }
    
    if (employee_id) {
      query += ` AND la.employee_id = $${paramCount}`;
      params.push(employee_id);
      paramCount++;
    }
    
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
    
    query += ` ORDER BY la.start_date ASC`;
    
    const result = await database.query(query, params);
    
    res.json({ data: result.rows });
  } catch (error) {
    console.error('Calendar view error:', error);
    res.status(500).json({ error: 'Failed to fetch calendar data' });
  }
});

// Block calendar dates
router.post('/block', authenticateToken, authorizeRole('admin', 'hod'), async (req, res) => {
  try {
    const { employee_id, blocked_dates, reason } = req.body;
    
    if (!employee_id || !blocked_dates || !Array.isArray(blocked_dates)) {
      return res.status(400).json({ error: 'Employee ID and blocked dates array are required' });
    }
    
    const result = await database.query(
      `INSERT INTO blocked_calendar_dates (employee_id, blocked_date, reason, created_by, created_at)
       SELECT $1, unnest($2::date[]), $3, $4, NOW()
       ON CONFLICT (employee_id, blocked_date) DO UPDATE
       SET reason = EXCLUDED.reason, updated_at = NOW()
       RETURNING *`,
      [employee_id, blocked_dates, reason, req.user.id]
    );
    
    res.status(201).json({
      message: 'Calendar dates blocked successfully',
      data: result.rows,
    });
  } catch (error) {
    console.error('Block calendar error:', error);
    res.status(500).json({ error: 'Failed to block calendar dates' });
  }
});

// Get blocked dates
router.get('/blocked', authenticateToken, async (req, res) => {
  try {
    const { employee_id } = req.query;
    const userId = employee_id || req.user.id;
    
    const result = await database.query(
      `SELECT * FROM blocked_calendar_dates 
       WHERE employee_id = $1 
       ORDER BY blocked_date ASC`,
      [userId]
    );
    
    res.json({ data: result.rows });
  } catch (error) {
    console.error('Get blocked dates error:', error);
    res.status(500).json({ error: 'Failed to fetch blocked dates' });
  }
});

export default router;


