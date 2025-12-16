import express from 'express';
import database from '../config/database.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';

const router = express.Router();

// Apply for leave
router.post('/apply', authenticateToken, async (req, res) => {
  try {
    const { leave_type, start_date, end_date, reason, employee_id } = req.body;

    // Get employee_id from user_id
    let empId = employee_id;
    if (!empId) {
      const empResult = await database.query(
        'SELECT employee_id FROM employees WHERE user_id = $1 LIMIT 1',
        [req.user.id]
      );
      if (empResult.rows.length === 0) {
        return res.status(404).json({ error: 'Employee record not found for user' });
      }
      empId = empResult.rows[0].employee_id;
    }

    const result = await database.query(
      `INSERT INTO leave_applications (employee_id, leave_type, start_date, end_date, reason, status, created_at)
       VALUES ($1, $2, $3, $4, $5, 'pending', NOW())
       RETURNING *`,
      [empId, leave_type, start_date, end_date, reason]
    );

    // TODO: Send email notification
    // TODO: Trigger multi-level approval workflow

    res.status(201).json({
      message: 'Leave application submitted successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Leave application error:', error);
    res.status(500).json({ error: 'Failed to submit leave application' });
  }
});

// Get leave applications (for employee)
router.get('/my-leaves', authenticateToken, async (req, res) => {
  try {
    // Get employee_id from user_id
    const empResult = await database.query(
      'SELECT employee_id FROM employees WHERE user_id = $1 LIMIT 1',
      [req.user.id]
    );
    
    if (empResult.rows.length === 0) {
      return res.status(404).json({ error: 'Employee record not found' });
    }

    const employeeId = empResult.rows[0].employee_id;

    const result = await database.query(
      `SELECT * FROM leave_applications 
       WHERE employee_id = $1 
       ORDER BY created_at DESC`,
      [employeeId]
    );

    res.json({ data: result.rows });
  } catch (error) {
    console.error('Get leaves error:', error);
    res.status(500).json({ error: 'Failed to fetch leave applications' });
  }
});

// Get all leave applications (for admin/HOD)
router.get('/all', authenticateToken, authorizeRole('admin', 'hod', 'manager'), async (req, res) => {
  try {
    const { status, employee_id } = req.query;
    let query = `SELECT la.*, 
                 COALESCE(u.first_name || ' ' || u.last_name, u.first_name, u.last_name, u.email) as full_name,
                 u.email 
                 FROM leave_applications la
                 JOIN employees e ON la.employee_id = e.employee_id
                 JOIN users u ON e.user_id = u.user_id
                 WHERE 1=1`;
    const params = [];
    let paramCount = 1;

    if (status) {
      query += ` AND la.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    if (employee_id) {
      query += ` AND la.employee_id = $${paramCount}`;
      params.push(employee_id);
      paramCount++;
    }

    query += ` ORDER BY la.created_at DESC`;

    const result = await database.query(query, params);

    res.json({ data: result.rows });
  } catch (error) {
    console.error('Get all leaves error:', error);
    res.status(500).json({ error: 'Failed to fetch leave applications' });
  }
});

// Approve/Reject leave
router.patch('/:id/approve', authenticateToken, authorizeRole('admin', 'hod', 'manager'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, comment } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const result = await database.query(
      `UPDATE leave_applications 
       SET status = $1, approved_by = $2, approval_comment = $3, approved_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [status, req.user.id, comment, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Leave application not found' });
    }

    // TODO: Send email notification
    // TODO: Update leave balance if approved

    res.json({
      message: `Leave application ${status}`,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Approve leave error:', error);
    res.status(500).json({ error: 'Failed to update leave application' });
  }
});

// Get leave balance
router.get('/balance', authenticateToken, async (req, res) => {
  try {
    // Get employee_id from user_id
    const empResult = await database.query(
      'SELECT employee_id FROM employees WHERE user_id = $1 LIMIT 1',
      [req.user.id]
    );
    
    if (empResult.rows.length === 0) {
      return res.status(404).json({ error: 'Employee record not found' });
    }

    const employeeId = empResult.rows[0].employee_id;

    const result = await database.query(
      `SELECT leave_type, total_balance, used_balance, remaining_balance
       FROM leave_balance
       WHERE employee_id = $1`,
      [employeeId]
    );

    res.json({ data: result.rows });
  } catch (error) {
    console.error('Get leave balance error:', error);
    res.status(500).json({ error: 'Failed to fetch leave balance' });
  }
});

export default router;

