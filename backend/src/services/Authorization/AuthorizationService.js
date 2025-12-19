//Internal Lib Import
import database from "../../config/database.js";
import { CreateError } from "../../helper/ErrorHandler.js";

/**
 * Create Authorization Request
 */
export const CreateAuthorizationService = async (Request) => {
  const { authorization_type, title, description, requested_access, reason, priority, expiry_date } = Request.body;
  const UserId = Request.EmployeeId || Request.UserId;

  if (!authorization_type || !title || !reason) {
    throw CreateError("Authorization type, title, and reason are required", 400);
  }

  // Get employee_id from user_id if not provided
  let empId = Request.EmployeeId;
  if (!empId) {
    const empResult = await database.query(
      'SELECT employee_id FROM employees WHERE user_id = $1 LIMIT 1',
      [Request.UserId]
    );
    if (empResult.rows.length === 0) {
      throw CreateError("Employee record not found for user", 404);
    }
    empId = empResult.rows[0].employee_id;
  }

  const result = await database.query(
    `INSERT INTO authorizations (employee_id, authorization_type, title, description, requested_access, reason, priority, expiry_date, status, requested_date, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', NOW(), NOW())
     RETURNING *`,
    [empId, authorization_type, title, description || null, requested_access || null, reason, priority || 'normal', expiry_date || null]
  );

  return result.rows[0];
};

/**
 * Get Authorization List for Employee
 */
export const GetAuthorizationListService = async (Request) => {
  const UserId = Request.UserId;
  const EmployeeId = Request.EmployeeId;

  // Get employee_id from user_id if not available
  let empId = EmployeeId;
  if (!empId) {
    const empResult = await database.query(
      'SELECT employee_id FROM employees WHERE user_id = $1 LIMIT 1',
      [UserId]
    );
    if (empResult.rows.length === 0) {
      throw CreateError("Employee record not found", 404);
    }
    empId = empResult.rows[0].employee_id;
  }

  const result = await database.query(
    `SELECT a.*, 
     COALESCE(u.first_name || ' ' || u.last_name, u.first_name, u.last_name, u.email) as employee_name,
     u.email as employee_email
     FROM authorizations a
     JOIN employees e ON a.employee_id = e.employee_id
     JOIN users u ON e.user_id = u.user_id
     WHERE a.employee_id = $1 
     ORDER BY a.requested_date DESC`,
    [empId]
  );

  return result.rows;
};

/**
 * Get All Authorization Requests (Admin/HOD)
 */
export const GetAllAuthorizationsService = async (Request) => {
  const { status, authorization_type, employee_id } = Request.query;
  
  let query = `SELECT a.*, 
               COALESCE(u.first_name || ' ' || u.last_name, u.first_name, u.last_name, u.email) as employee_name,
               u.email as employee_email,
               COALESCE(approver.first_name || ' ' || approver.last_name, approver.first_name, approver.last_name, approver.email) as approver_name
               FROM authorizations a
               JOIN employees e ON a.employee_id = e.employee_id
               JOIN users u ON e.user_id = u.user_id
               LEFT JOIN employees approver_emp ON a.approved_by = approver_emp.employee_id
               LEFT JOIN users approver ON approver_emp.user_id = approver.user_id
               WHERE 1=1`;
  const params = [];
  let paramCount = 1;

  if (status) {
    query += ` AND a.status = $${paramCount}`;
    params.push(status);
    paramCount++;
  }

  if (authorization_type) {
    query += ` AND a.authorization_type = $${paramCount}`;
    params.push(authorization_type);
    paramCount++;
  }

  if (employee_id) {
    query += ` AND a.employee_id = $${paramCount}`;
    params.push(employee_id);
    paramCount++;
  }

  query += ` ORDER BY a.requested_date DESC`;

  const result = await database.query(query, params);
  return result.rows;
};

/**
 * Get Authorization Details
 */
export const GetAuthorizationDetailsService = async (Request) => {
  const { id } = Request.params;

  const result = await database.query(
    `SELECT a.*, 
     COALESCE(u.first_name || ' ' || u.last_name, u.first_name, u.last_name, u.email) as employee_name,
     u.email as employee_email,
     COALESCE(approver.first_name || ' ' || approver.last_name, approver.first_name, approver.last_name, approver.email) as approver_name
     FROM authorizations a
     JOIN employees e ON a.employee_id = e.employee_id
     JOIN users u ON e.user_id = u.user_id
     LEFT JOIN employees approver_emp ON a.approved_by = approver_emp.employee_id
     LEFT JOIN users approver ON approver_emp.user_id = approver.user_id
     WHERE a.id = $1`,
    [id]
  );

  if (result.rows.length === 0) {
    throw CreateError("Authorization request not found", 404);
  }

  return result.rows[0];
};

/**
 * Update Authorization Request
 */
export const UpdateAuthorizationService = async (Request) => {
  const { id } = Request.params;
  const { title, description, requested_access, reason, priority, expiry_date } = Request.body;

  // Only allow updates if status is pending
  const checkResult = await database.query(
    'SELECT status FROM authorizations WHERE id = $1',
    [id]
  );

  if (checkResult.rows.length === 0) {
    throw CreateError("Authorization request not found", 404);
  }

  if (checkResult.rows[0].status !== 'pending') {
    throw CreateError("Cannot update authorization request that is not pending", 400);
  }

  // Build update query dynamically
  const updates = [];
  const params = [];
  let paramCount = 1;

  if (title) {
    updates.push(`title = $${paramCount}`);
    params.push(title);
    paramCount++;
  }
  if (description !== undefined) {
    updates.push(`description = $${paramCount}`);
    params.push(description);
    paramCount++;
  }
  if (requested_access !== undefined) {
    updates.push(`requested_access = $${paramCount}`);
    params.push(requested_access);
    paramCount++;
  }
  if (reason) {
    updates.push(`reason = $${paramCount}`);
    params.push(reason);
    paramCount++;
  }
  if (priority) {
    updates.push(`priority = $${paramCount}`);
    params.push(priority);
    paramCount++;
  }
  if (expiry_date !== undefined) {
    updates.push(`expiry_date = $${paramCount}`);
    params.push(expiry_date);
    paramCount++;
  }

  if (updates.length === 0) {
    throw CreateError("No fields to update", 400);
  }

  updates.push(`updated_at = NOW()`);
  params.push(id);

  const result = await database.query(
    `UPDATE authorizations 
     SET ${updates.join(', ')}
     WHERE id = $${paramCount}
     RETURNING *`,
    params
  );

  return result.rows[0];
};

/**
 * Delete Authorization Request
 */
export const DeleteAuthorizationService = async (Request) => {
  const { id } = Request.params;

  // Only allow deletion if status is pending
  const checkResult = await database.query(
    'SELECT status FROM authorizations WHERE id = $1',
    [id]
  );

  if (checkResult.rows.length === 0) {
    throw CreateError("Authorization request not found", 404);
  }

  if (checkResult.rows[0].status !== 'pending') {
    throw CreateError("Cannot delete authorization request that is not pending", 400);
  }

  const result = await database.query(
    'DELETE FROM authorizations WHERE id = $1 RETURNING *',
    [id]
  );

  return { message: "Authorization request deleted successfully" };
};

/**
 * Approve/Reject Authorization
 */
export const ApproveAuthorizationService = async (Request) => {
  const { id } = Request.params;
  const { status, approval_comment } = Request.body;

  if (!['approved', 'rejected'].includes(status)) {
    throw CreateError("Invalid status. Must be 'approved' or 'rejected'", 400);
  }

  const result = await database.query(
    `UPDATE authorizations 
     SET status = $1, approved_by = $2, approval_comment = $3, approved_at = NOW(), updated_at = NOW()
     WHERE id = $4
     RETURNING *`,
    [status, Request.EmployeeId || Request.UserId, approval_comment || null, id]
  );

  if (result.rows.length === 0) {
    throw CreateError("Authorization request not found", 404);
  }

  return result.rows[0];
};

/**
 * Get Authorization Statistics
 */
export const GetAuthorizationStatsService = async (Request) => {
  const UserId = Request.UserId;
  const EmployeeId = Request.EmployeeId;

  // Get employee_id from user_id if not available
  let empId = EmployeeId;
  if (!empId) {
    const empResult = await database.query(
      'SELECT employee_id FROM employees WHERE user_id = $1 LIMIT 1',
      [UserId]
    );
    if (empResult.rows.length === 0) {
      throw CreateError("Employee record not found", 404);
    }
    empId = empResult.rows[0].employee_id;
  }

  const statsResult = await database.query(
    `SELECT 
      COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
      COUNT(*) FILTER (WHERE status = 'approved') as approved_count,
      COUNT(*) FILTER (WHERE status = 'rejected') as rejected_count,
      COUNT(*) as total_count
     FROM authorizations
     WHERE employee_id = $1`,
    [empId]
  );

  return statsResult.rows[0];
};













