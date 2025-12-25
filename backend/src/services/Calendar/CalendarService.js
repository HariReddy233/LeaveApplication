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
      la.approved_by_hod,
      la.approved_by_admin,
      COALESCE(u.first_name || ' ' || u.last_name, u.first_name, u.last_name, u.email) as full_name,
      u.email,
      COALESCE(e.location, u.department) as location,
      COALESCE(e.team, u.department) as team,
      -- HOD approver name
      COALESCE(
        NULLIF(TRIM(hod_approver.first_name || ' ' || hod_approver.last_name), ''),
        hod_approver.first_name,
        hod_approver.last_name,
        hod_approver.email,
        NULL
      ) as hod_approver_name,
      -- Admin approver name
      COALESCE(
        NULLIF(TRIM(admin_approver.first_name || ' ' || admin_approver.last_name), ''),
        admin_approver.first_name,
        admin_approver.last_name,
        admin_approver.email,
        NULL
      ) as admin_approver_name
    FROM leave_applications la
    JOIN employees e ON la.employee_id = e.employee_id
    JOIN users u ON e.user_id = u.user_id
    LEFT JOIN employees hod_emp ON la.approved_by_hod = hod_emp.employee_id
    LEFT JOIN users hod_approver ON hod_emp.user_id = hod_approver.user_id
    LEFT JOIN employees admin_emp ON la.approved_by_admin = admin_emp.employee_id
    LEFT JOIN users admin_approver ON admin_emp.user_id = admin_approver.user_id
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
 * Get Blocked Dates (includes organization holidays and employee-specific blocked dates)
 */
export const GetBlockedDatesService = async (Request) => {
  const { employee_id } = Request.query;
  const userId = employee_id || Request.EmployeeId || Request.UserId;
  
  // Get employee-specific blocked dates
  const employeeBlocked = await database.query(
    `SELECT blocked_date, reason, 'employee_blocked' as type
     FROM blocked_calendar_dates 
     WHERE employee_id = $1 
     ORDER BY blocked_date ASC`,
    [userId]
  );
  
  // Get organization-wide holidays (for current year and recurring)
  const currentYear = new Date().getFullYear();
  const orgHolidays = await database.query(
    `SELECT holiday_date as blocked_date, holiday_name as reason, 'organization_holiday' as type
     FROM organization_holidays
     WHERE (is_recurring = true AND (recurring_year IS NULL OR recurring_year = $1))
        OR (is_recurring = false AND EXTRACT(YEAR FROM holiday_date) = $1)
     ORDER BY holiday_date ASC`,
    [currentYear]
  );
  
  // Get employee-specific blocked dates from employee_blocked_dates table
  const empBlockedDates = await database.query(
    `SELECT blocked_date, reason, 'employee_blocked' as type
     FROM employee_blocked_dates
     WHERE employee_id = $1
     ORDER BY blocked_date ASC`,
    [userId]
  );
  
  // Combine all blocked dates
  const allBlocked = [
    ...employeeBlocked.rows,
    ...orgHolidays.rows,
    ...empBlockedDates.rows
  ];
  
  return allBlocked;
};

/**
 * Get All Blocked Dates for Calendar (organization holidays + employee-specific)
 * Used by calendar view to show blocked dates
 */
export const GetAllBlockedDatesForCalendarService = async (Request) => {
  const { start_date, end_date, employee_id } = Request.query;
  
  let orgHolidaysQuery = `
    SELECT holiday_date as blocked_date, holiday_name as reason, 'organization_holiday' as type, NULL as employee_id
    FROM organization_holidays
    WHERE 1=1
  `;
  const params = [];
  let paramCount = 1;
  
  if (start_date && end_date) {
    orgHolidaysQuery += ` AND holiday_date BETWEEN $${paramCount} AND $${paramCount + 1}`;
    params.push(start_date, end_date);
    paramCount += 2;
  } else {
    // Default to current year if no date range
    const currentYear = new Date().getFullYear();
    orgHolidaysQuery += ` AND (
      (is_recurring = true AND (recurring_year IS NULL OR recurring_year = $${paramCount}))
      OR (is_recurring = false AND EXTRACT(YEAR FROM holiday_date) = $${paramCount})
    )`;
    params.push(currentYear);
    paramCount++;
  }
  
  const orgHolidays = await database.query(orgHolidaysQuery, params);
  
  // Get employee-specific blocked dates if employee_id provided
  let employeeBlocked = { rows: [] };
  if (employee_id) {
    let empQuery = `
      SELECT blocked_date, reason, 'employee_blocked' as type, employee_id
      FROM employee_blocked_dates
      WHERE employee_id = $${paramCount}
    `;
    const empParams = [employee_id];
    
    if (start_date && end_date) {
      empQuery += ` AND blocked_date BETWEEN $${paramCount + 1} AND $${paramCount + 2}`;
      empParams.push(start_date, end_date);
    }
    
    employeeBlocked = await database.query(empQuery, empParams);
  }
  
  // Combine results
  return [...orgHolidays.rows, ...employeeBlocked.rows];
};

/**
 * Create Organization Holiday
 */
export const CreateOrganizationHolidayService = async (Request) => {
  const { holiday_name, holiday_date, is_recurring, recurring_year } = Request.body;
  
  if (!holiday_name || !holiday_date) {
    throw CreateError("Holiday name and date are required", 400);
  }
  
  // Validate date format
  const dateObj = new Date(holiday_date);
  if (isNaN(dateObj.getTime())) {
    throw CreateError("Invalid date format", 400);
  }
  
  // Auto-create tables if they don't exist (for local and server compatibility)
  try {
    await database.query(`
      CREATE TABLE IF NOT EXISTS organization_holidays (
        id SERIAL PRIMARY KEY,
        holiday_name VARCHAR(255) NOT NULL,
        holiday_date DATE NOT NULL,
        is_recurring BOOLEAN DEFAULT FALSE,
        recurring_year INTEGER NULL,
        created_by INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(holiday_date, recurring_year)
      )
    `).catch(() => {}); // Ignore if table already exists
    
    await database.query(`
      CREATE TABLE IF NOT EXISTS employee_blocked_dates (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER NOT NULL,
        blocked_date DATE NOT NULL,
        reason VARCHAR(500),
        blocked_by INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(employee_id, blocked_date)
      )
    `).catch(() => {}); // Ignore if table already exists
    
    await database.query(`
      CREATE TABLE IF NOT EXISTS holiday_notifications (
        id SERIAL PRIMARY KEY,
        holiday_id INTEGER NOT NULL,
        notification_type VARCHAR(50) NOT NULL,
        notification_date DATE NOT NULL,
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(holiday_id, notification_type, notification_date)
      )
    `).catch(() => {}); // Ignore if table already exists
    
    // Create indexes if they don't exist
    await database.query(`CREATE INDEX IF NOT EXISTS idx_org_holidays_date ON organization_holidays(holiday_date)`).catch(() => {});
    await database.query(`CREATE INDEX IF NOT EXISTS idx_org_holidays_recurring ON organization_holidays(is_recurring, recurring_year)`).catch(() => {});
    await database.query(`CREATE INDEX IF NOT EXISTS idx_employee_blocked_dates_employee ON employee_blocked_dates(employee_id)`).catch(() => {});
    await database.query(`CREATE INDEX IF NOT EXISTS idx_employee_blocked_dates_date ON employee_blocked_dates(blocked_date)`).catch(() => {});
    await database.query(`CREATE INDEX IF NOT EXISTS idx_holiday_notifications_date ON holiday_notifications(notification_date)`).catch(() => {});
  } catch (tableError) {
    console.warn('Warning: Could not create organization holidays tables:', tableError.message);
    // Continue anyway - tables might already exist
  }
  
  const result = await database.query(
    `INSERT INTO organization_holidays (holiday_name, holiday_date, is_recurring, recurring_year, created_by)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (holiday_date, recurring_year) DO UPDATE
     SET holiday_name = EXCLUDED.holiday_name,
         is_recurring = EXCLUDED.is_recurring,
         updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [holiday_name, holiday_date, is_recurring || false, recurring_year || null, Request.UserId]
  );
  
  return result.rows[0];
};

/**
 * Get All Organization Holidays
 */
export const GetOrganizationHolidaysService = async (Request) => {
  const { year, start_date, end_date } = Request.query;
  
  let query = `SELECT * FROM organization_holidays WHERE 1=1`;
  const params = [];
  let paramCount = 1;
  
  if (year) {
    query += ` AND (is_recurring = true AND (recurring_year IS NULL OR recurring_year = $${paramCount}))
               OR (is_recurring = false AND EXTRACT(YEAR FROM holiday_date) = $${paramCount})`;
    params.push(year);
    paramCount++;
  }
  
  if (start_date && end_date) {
    query += ` AND holiday_date BETWEEN $${paramCount} AND $${paramCount + 1}`;
    params.push(start_date, end_date);
    paramCount += 2;
  }
  
  query += ` ORDER BY holiday_date ASC`;
  
  const result = await database.query(query, params);
  return result.rows;
};

/**
 * Update Organization Holiday
 */
export const UpdateOrganizationHolidayService = async (Request) => {
  const { id } = Request.params;
  const { holiday_name, holiday_date, is_recurring, recurring_year } = Request.body;
  
  if (!id) {
    throw CreateError("Holiday ID is required", 400);
  }
  
  const result = await database.query(
    `UPDATE organization_holidays
     SET holiday_name = COALESCE($1, holiday_name),
         holiday_date = COALESCE($2, holiday_date),
         is_recurring = COALESCE($3, is_recurring),
         recurring_year = COALESCE($4, recurring_year),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $5
     RETURNING *`,
    [holiday_name, holiday_date, is_recurring, recurring_year, id]
  );
  
  if (result.rows.length === 0) {
    throw CreateError("Holiday not found", 404);
  }
  
  return result.rows[0];
};

/**
 * Delete Organization Holiday
 */
export const DeleteOrganizationHolidayService = async (Request) => {
  const { id } = Request.params;
  
  if (!id) {
    throw CreateError("Holiday ID is required", 400);
  }
  
  const result = await database.query(
    `DELETE FROM organization_holidays WHERE id = $1 RETURNING *`,
    [id]
  );
  
  if (result.rows.length === 0) {
    throw CreateError("Holiday not found", 404);
  }
  
  return { message: "Holiday deleted successfully" };
};

/**
 * Block Employee-Specific Dates
 */
export const BlockEmployeeDatesService = async (Request) => {
  const { employee_id, blocked_dates, reason } = Request.body;
  
  if (!employee_id || !blocked_dates || !Array.isArray(blocked_dates) || blocked_dates.length === 0) {
    throw CreateError("Employee ID and blocked dates array are required", 400);
  }
  
  // Insert blocked dates
  const result = await database.query(
    `INSERT INTO employee_blocked_dates (employee_id, blocked_date, reason, blocked_by)
     SELECT $1, unnest($2::date[]), $3, $4
     ON CONFLICT (employee_id, blocked_date) DO UPDATE
     SET reason = EXCLUDED.reason,
         updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [employee_id, blocked_dates, reason || null, Request.UserId]
  );
  
  return result.rows;
};

/**
 * Get Employee Blocked Dates
 * If employee_id is provided, returns blocked dates for that employee
 * If employee_id is not provided, returns all employee blocked dates (for admin/HOD management)
 */
export const GetEmployeeBlockedDatesService = async (Request) => {
  const { employee_id } = Request.query;
  
  let query = `
    SELECT ebd.*, 
           COALESCE(u.first_name || ' ' || u.last_name, u.first_name, u.last_name, u.email) as blocked_by_name,
           COALESCE(emp_u.first_name || ' ' || emp_u.last_name, emp_u.first_name, emp_u.last_name, emp_u.email) as employee_name
    FROM employee_blocked_dates ebd
    LEFT JOIN users u ON ebd.blocked_by = u.user_id
    LEFT JOIN employees e ON ebd.employee_id = e.employee_id
    LEFT JOIN users emp_u ON e.user_id = emp_u.user_id
  `;
  
  const params = [];
  
  if (employee_id) {
    query += ` WHERE ebd.employee_id = $1`;
    params.push(employee_id);
  }
  
  query += ` ORDER BY ebd.blocked_date ASC`;
  
  const result = await database.query(query, params);
  
  return result.rows;
};

/**
 * Delete Employee Blocked Date
 */
export const DeleteEmployeeBlockedDateService = async (Request) => {
  const { id } = Request.params;
  
  if (!id) {
    throw CreateError("Blocked date ID is required", 400);
  }
  
  const result = await database.query(
    `DELETE FROM employee_blocked_dates WHERE id = $1 RETURNING *`,
    [id]
  );
  
  if (result.rows.length === 0) {
    throw CreateError("Blocked date not found", 404);
  }
  
  return { message: "Blocked date deleted successfully" };
};



