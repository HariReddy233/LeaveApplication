//Internal Lib Import
import database from "../../config/database.js";
import { CreateError } from "../../helper/ErrorHandler.js";

/**
 * Dashboard Summary for Employee
 * Matches HR Portal: Groups by AdminStatus
 */
export const DashboardSummaryEmployeeService = async (Request) => {
  const EmployeeId = Request.EmployeeId;
  const UserId = Request.UserId;

  // Get employee_id if not available
  let empId = EmployeeId;
  if (!empId) {
    const empResult = await database.query(
      'SELECT employee_id FROM employees WHERE user_id = $1 LIMIT 1',
      [UserId]
    );
    if (empResult.rows.length > 0) {
      empId = empResult.rows[0].employee_id;
    }
  }

  // Get total count
  const totalResult = await database.query(
    'SELECT COUNT(*) as count FROM leave_applications WHERE employee_id = $1',
    [empId]
  );
  const total = parseInt(totalResult.rows[0].count);

  // Group by AdminStatus
  const statusResult = await database.query(
    `SELECT 
      admin_status as _id,
      COUNT(*) as count
    FROM leave_applications
    WHERE employee_id = $1
    GROUP BY admin_status`,
    [empId]
  );

  return {
    Total: [{ count: total }],
    Data: statusResult.rows.map(row => ({
      _id: row._id || 'Pending',
      count: parseInt(row.count)
    }))
  };
};

/**
 * Dashboard Summary for HOD
 * Matches HR Portal: Groups by HodStatus
 */
export const DashboardSummaryHodService = async (Request) => {
  // Get total count
  const totalResult = await database.query(
    'SELECT COUNT(*) as count FROM leave_applications'
  );
  const total = parseInt(totalResult.rows[0].count);

  // Group by HodStatus
  const statusResult = await database.query(
    `SELECT 
      hod_status as _id,
      COUNT(*) as count
    FROM leave_applications
    GROUP BY hod_status`
  );

  return {
    Total: [{ count: total }],
    Data: statusResult.rows.map(row => ({
      _id: row._id || 'Pending',
      count: parseInt(row.count)
    }))
  };
};

/**
 * Dashboard Summary for Admin
 * Shows all leaves grouped by AdminStatus (Admin is an approver, not an employee)
 */
export const DashboardSummaryAdminService = async (Request) => {
  // Get total count of all leaves (Admin needs to see all leaves for approval)
  const totalResult = await database.query(
    `SELECT COUNT(*) as count FROM leave_applications`
  );
  const total = parseInt(totalResult.rows[0].count);

  // Group by AdminStatus (all leaves, not filtered by HOD status)
  const statusResult = await database.query(
    `SELECT 
      admin_status as _id,
      COUNT(*) as count
    FROM leave_applications
    GROUP BY admin_status`
  );

  return {
    Total: [{ count: total }],
    Data: statusResult.rows.map(row => ({
      _id: row._id || 'Pending',
      count: parseInt(row.count)
    }))
  };
};


