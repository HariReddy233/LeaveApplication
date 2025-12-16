import express from 'express';
import database from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get dashboard stats
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const { employee_id, location, team, manager } = req.query;
    
    // Get pending leaves count
    let pendingQuery = `SELECT COUNT(*) as count FROM leave_applications WHERE status = 'pending'`;
    const pendingParams = [];
    
    if (employee_id) {
      pendingQuery += ` AND employee_id = $1`;
      pendingParams.push(employee_id);
    }
    
    const pendingResult = await database.query(pendingQuery, pendingParams);
    
    // Get approved leaves count
    let approvedQuery = `SELECT COUNT(*) as count FROM leave_applications WHERE status = 'approved'`;
    const approvedParams = [];
    
    if (employee_id) {
      approvedQuery += ` AND employee_id = $1`;
      approvedParams.push(employee_id);
    }
    
    const approvedResult = await database.query(approvedQuery, approvedParams);
    
    // Get leave grid data
    let gridQuery = `
      SELECT 
        la.id,
        la.leave_type,
        la.start_date,
        la.end_date,
        la.status,
        la.number_of_days as days,
        COALESCE(u.first_name || ' ' || u.last_name, u.first_name, u.last_name, u.email) as full_name,
        u.email
      FROM leave_applications la
      JOIN employees e ON la.employee_id = e.employee_id
      JOIN users u ON e.user_id = u.user_id
      WHERE 1=1
    `;
    const gridParams = [];
    let paramCount = 1;
    
    if (employee_id) {
      gridQuery += ` AND la.employee_id = $${paramCount}`;
      gridParams.push(employee_id);
      paramCount++;
    }
    
    if (location) {
      gridQuery += ` AND e.location = $${paramCount}`;
      gridParams.push(location);
      paramCount++;
    }
    
    if (team) {
      gridQuery += ` AND e.team = $${paramCount}`;
      gridParams.push(team);
      paramCount++;
    }
    
    if (manager) {
      gridQuery += ` AND e.manager_id = $${paramCount}`;
      gridParams.push(manager);
      paramCount++;
    }
    
    gridQuery += ` ORDER BY la.start_date DESC LIMIT 50`;
    
    const gridResult = await database.query(gridQuery, gridParams);
    
    res.json({
      pending_leaves: parseInt(pendingResult.rows[0].count),
      approved_leaves: parseInt(approvedResult.rows[0].count),
      leave_grid: gridResult.rows,
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

export default router;


