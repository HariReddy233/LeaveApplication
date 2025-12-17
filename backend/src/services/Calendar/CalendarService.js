//Internal Lib Import
import database from "../../config/database.js";
import { CreateError } from "../../helper/ErrorHandler.js";

/**
 * Get Calendar View (Leave Days)
 * Shows only leaves that are approved by both HOD and Admin
 */
export const GetCalendarViewService = async (Request) => {
  const { employee_id, user_id, location, team, manager, start_date, end_date } = Request.query;
  
  // Handle both employee_id and user_id - if user_id is provided, convert to employee_id
  let actualEmployeeId = employee_id;
  if (user_id && !employee_id) {
    try {
      const empResult = await database.query(
        'SELECT employee_id FROM employees WHERE user_id = $1 LIMIT 1',
        [user_id]
      );
      if (empResult.rows.length > 0) {
        actualEmployeeId = empResult.rows[0].employee_id;
      }
    } catch (err) {
      console.error('Error converting user_id to employee_id:', err);
    }
  }
  
  let query = `
    SELECT 
      la.id,
      la.leave_type,
      la.start_date,
      la.end_date,
      la.number_of_days,
      la.reason,
      la.hod_status,
      la.admin_status,
      la.status,
      COALESCE(u.first_name || ' ' || u.last_name, u.first_name, u.last_name, u.email) as full_name,
      u.email,
      COALESCE(e.location, u.department) as location,
      COALESCE(e.team, u.department) as team
    FROM leave_applications la
    JOIN employees e ON la.employee_id = e.employee_id
    JOIN users u ON e.user_id = u.user_id
    WHERE (la.hod_status = 'Approved' OR la.admin_status = 'Approved')
    AND la.hod_status != 'Rejected'
    AND la.admin_status != 'Rejected'
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
  
  if (actualEmployeeId) {
    query += ` AND la.employee_id = $${paramCount}`;
    params.push(actualEmployeeId);
    paramCount++;
  }
  
  if (location) {
    // Check both employees.location and users.department (as fallback)
    query += ` AND (e.location = $${paramCount} OR (e.location IS NULL AND u.department = $${paramCount}))`;
    params.push(location);
    paramCount++;
  }
  
  if (team) {
    query += ` AND (e.team = $${paramCount} OR (e.team IS NULL AND u.department = $${paramCount}))`;
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
  return result.rows;
};

/**
 * Block Calendar Dates
 */
export const BlockCalendarDatesService = async (Request) => {
  const { employee_id, blocked_dates, reason } = Request.body;
  
  if (!employee_id || !blocked_dates || !Array.isArray(blocked_dates)) {
    throw CreateError("Employee ID and blocked dates array are required", 400);
  }
  
  const result = await database.query(
    `INSERT INTO blocked_calendar_dates (employee_id, blocked_date, reason, created_by, created_at)
     SELECT $1, unnest($2::date[]), $3, $4, NOW()
     ON CONFLICT (employee_id, blocked_date) DO UPDATE
     SET reason = EXCLUDED.reason, updated_at = NOW()
     RETURNING *`,
    [employee_id, blocked_dates, reason, Request.UserId]
  );
  
  return result.rows;
};

/**
 * Get Blocked Dates
 */
export const GetBlockedDatesService = async (Request) => {
  const { employee_id } = Request.query;
  const userId = employee_id || Request.EmployeeId || Request.UserId;
  
  const result = await database.query(
    `SELECT * FROM blocked_calendar_dates 
     WHERE employee_id = $1 
     ORDER BY blocked_date ASC`,
    [userId]
  );
  
  return result.rows;
};



