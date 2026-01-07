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
      la.start_date::text as start_date,
      la.end_date::text as end_date,
      la.number_of_days,
      la.reason,
      la.hod_status,
      la.admin_status,
      la.status,
      la.approved_by_hod,
      la.approved_by_admin,
      COALESCE(u.first_name || ' ' || u.last_name, u.first_name, u.last_name, u.email) as full_name,
      u.email,
      u.role as employee_role,
      COALESCE(e.location, u.department) as location,
      COALESCE(e.team, u.department) as team,
      la.approved_by_hod,
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
  
  // NOTE: Location filter removed for leaves - approved leaves are visible organization-wide
  // Location filtering only applies to holidays, not to approved leaves
  // All users should see all approved leaves regardless of location
  
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

/**
 * Get All Blocked Dates for Calendar
 * Returns both organization holidays and employee-specific blocked dates
 */
export const GetAllBlockedDatesForCalendarService = async (Request) => {
  // Get location from query parameter (for filtering) or from employee
  const locationFilter = Request.query?.location;
  let employeeLocation = null;
  const employeeId = Request.EmployeeId || Request.query?.employee_id;
  const userId = Request.UserId || Request.query?.user_id;
  
  // If location filter is provided and not "All", use it
  // Otherwise, get employee location for default
  if (locationFilter && locationFilter !== '' && locationFilter !== 'All') {
    employeeLocation = locationFilter;
  } else if (!locationFilter || locationFilter === '') {
    // Get employee location for default (when no filter is set)
    if (employeeId || userId) {
      try {
        let locationQuery;
        let locationParams;
        
        if (employeeId) {
          locationQuery = 'SELECT location FROM employees WHERE employee_id = $1 LIMIT 1';
          locationParams = [employeeId];
        } else if (userId) {
          locationQuery = `
            SELECT e.location 
            FROM employees e 
            WHERE e.user_id = $1 
            LIMIT 1
          `;
          locationParams = [userId];
        }
        
        if (locationQuery) {
          const locationResult = await database.query(locationQuery, locationParams);
          if (locationResult.rows.length > 0 && locationResult.rows[0].location) {
            employeeLocation = locationResult.rows[0].location;
          }
        }
      } catch (err) {
        console.error('Error fetching employee location:', err);
      }
    }
  }
  // If locationFilter === 'All', employeeLocation stays null (will show all holidays)
  
  // Build holidays query with location filtering
  let holidaysQuery = `
    SELECT 
      id,
      holiday_name,
      holiday_date::text as holiday_date,
      country_code,
      'organization_holiday' as type
     FROM holidays 
     WHERE is_active = true
  `;
  
  const holidaysParams = [];
  let paramCount = 1;
  
  // Get user role from middleware
  const userRole = Request.Role;
  const isAdmin = userRole && userRole.toLowerCase() === 'admin';
  
  // Map employee location to country_code format
  // Employee location might be "India" but country_code might be "IN" or "India"
  // Employee location might be "US" but country_code might be "US" or "United States"
  // Support all formats
  const mapLocationToCountryCode = (location) => {
    if (!location) return [];
    const loc = location.toString().trim();
    if (loc === 'India' || loc === 'IN') return ['IN', 'India'];
    if (loc === 'US' || loc === 'United States') return ['US', 'United States'];
    return [loc]; // Return as-is if not recognized
  };
  
  // Filter holidays by location
  // Always include holidays with country_code = 'All' when filtering by location
  // If locationFilter is "All", show all holidays
  // Otherwise, show holidays matching location + "All" holidays
  if (locationFilter === 'All') {
    // Show all holidays (no filter) - includes "All", "IN", "US", "India", etc.
  } else if (employeeLocation) {
    // Show holidays for selected location + "All" holidays
    const countryCodes = mapLocationToCountryCode(employeeLocation);
    // Build condition: country_code IN (location codes) OR country_code = 'All'
    const conditions = [];
    countryCodes.forEach((code, index) => {
      conditions.push(`country_code = $${paramCount + index}`);
      holidaysParams.push(code);
    });
    // Include "All" holidays (case-insensitive: 'All', 'ALL', 'all')
    conditions.push(`(UPPER(country_code) = 'ALL' OR country_code = 'All' OR country_code = 'all')`);
    holidaysQuery += ` AND (${conditions.join(' OR ')})`;
    paramCount += countryCodes.length;
  } else {
    // No location specified: show only "All" holidays (case-insensitive)
    holidaysQuery += ` AND (UPPER(country_code) = 'ALL' OR country_code = 'All' OR country_code = 'all')`;
  }
  
  holidaysQuery += ` ORDER BY holiday_date ASC`;
  
  const holidaysResult = await database.query(holidaysQuery, holidaysParams.length > 0 ? holidaysParams : undefined);
  
  // Get employee blocked dates with employee info
  const blockedDatesResult = await database.query(
    `SELECT 
      bcd.id,
      bcd.reason,
      bcd.blocked_date::text as blocked_date,
      bcd.employee_id,
      COALESCE(
        NULLIF(TRIM(u.first_name || ' ' || COALESCE(u.last_name, '')), ''),
        NULLIF(TRIM(COALESCE(u.first_name, '')), ''),
        u.email
      ) as full_name,
      u.email,
      'employee_blocked' as type
     FROM blocked_calendar_dates bcd
     LEFT JOIN employees e ON bcd.employee_id = e.employee_id
     LEFT JOIN users u ON e.user_id = u.user_id
     ORDER BY bcd.blocked_date ASC`
  );
  
  // Map holidays to match frontend expectations
  // Ensure dates are plain strings (YYYY-MM-DD) without time component
  const mappedHolidays = holidaysResult.rows.map(h => {
    // Extract date part only (YYYY-MM-DD) if it includes time
    const holidayDateStr = typeof h.holiday_date === 'string' 
      ? h.holiday_date.split('T')[0] 
      : h.holiday_date;
    return {
      id: h.id,
      holiday_name: h.holiday_name,
      holiday_date: holidayDateStr,
      blocked_date: holidayDateStr, // Also provide as blocked_date for consistency
      reason: h.holiday_name, // Map holiday_name to reason for display
      name: h.holiday_name, // Also provide as name
      country_code: h.country_code,
      type: 'organization_holiday',
      employee_id: null,
      full_name: null,
      email: null
    };
  });
  
  // Combine both results
  // Ensure blocked dates also have plain date strings
  const allBlockedDates = [
    ...mappedHolidays,
    ...blockedDatesResult.rows.map(b => {
      // Extract date part only (YYYY-MM-DD) if it includes time
      const blockedDateStr = typeof b.blocked_date === 'string' 
        ? b.blocked_date.split('T')[0] 
        : b.blocked_date;
      return {
        ...b,
        blocked_date: blockedDateStr,
        type: 'employee_blocked'
      };
    })
  ];
  
  // Sort by date using string comparison (YYYY-MM-DD format sorts correctly)
  allBlockedDates.sort((a, b) => {
    const dateA = (a.holiday_date || a.blocked_date || '').split('T')[0];
    const dateB = (b.holiday_date || b.blocked_date || '').split('T')[0];
    return dateA.localeCompare(dateB);
  });
  
  return allBlockedDates;
};

/**
 * Create Organization Holiday
 */
export const CreateOrganizationHolidayService = async (Request) => {
  const { name, date, country_code } = Request.body;
  const holiday_name = name; // Map 'name' to 'holiday_name'
  const holiday_date = date; // Map 'date' to 'holiday_date'
  
  if (!holiday_name || !holiday_date) {
    throw CreateError("Holiday name and date are required", 400);
  }
  
  // country_code has NOT NULL constraint, so provide default value if not provided
  const final_country_code = country_code && country_code.trim() !== '' ? country_code.trim() : 'ALL';
  
  const result = await database.query(
    `INSERT INTO holidays (holiday_name, holiday_date, country_code, is_active, created_at)
     VALUES ($1, $2, $3, true, NOW())
     RETURNING id, country_code, holiday_date, holiday_name, is_active, created_at, updated_at`,
    [holiday_name, holiday_date, final_country_code]
  );
  
  // Map response to match frontend expectations
  const row = result.rows[0];
  return {
    ...row,
    name: row.holiday_name,
    date: row.holiday_date,
    is_recurring: false // Default to false since column doesn't exist in DB
  };
};

/**
 * Bulk Create Organization Holidays
 */
export const BulkCreateOrganizationHolidaysService = async (Request) => {
  const { holidays } = Request.body;
  
  if (!holidays || !Array.isArray(holidays)) {
    throw CreateError("Holidays array is required", 400);
  }
  
  const results = [];
  for (const holiday of holidays) {
    const { name, date, country_code } = holiday;
    const holiday_name = name; // Map 'name' to 'holiday_name'
    const holiday_date = date; // Map 'date' to 'holiday_date'
    if (holiday_name && holiday_date) {
      try {
        // country_code has NOT NULL constraint, so provide default value if not provided
        const final_country_code = country_code && country_code.trim() !== '' ? country_code.trim() : 'ALL';
        
        const result = await database.query(
          `INSERT INTO holidays (holiday_name, holiday_date, country_code, is_active, created_at)
           VALUES ($1, $2, $3, true, NOW())
           ON CONFLICT DO NOTHING
           RETURNING id, country_code, holiday_date, holiday_name, is_active, created_at, updated_at`,
          [holiday_name, holiday_date, final_country_code]
        );
        if (result.rows.length > 0) {
          results.push(result.rows[0]);
        }
      } catch (err) {
        console.error('Error creating holiday:', err);
      }
    }
  }
  
  return {
    message: `Created ${results.length} holidays`,
    data: results
  };
};

/**
 * Get Organization Holidays
 */
export const GetOrganizationHolidaysService = async (Request) => {
  try {
    const { country_code, location, year } = Request.query || {};
    // Use location parameter if provided, otherwise fall back to country_code
    const locationFilter = location || country_code;
    
    // Map location to country_code format
    const mapLocationToCountryCode = (loc) => {
      if (!loc) return [];
      const l = loc.toString().trim();
      if (l === 'India' || l === 'IN') return ['IN', 'India'];
      if (l === 'US' || l === 'United States') return ['US', 'United States'];
      return [l];
    };
    
    let query = `SELECT id, country_code, holiday_date, holiday_name, is_active, created_at, updated_at FROM holidays WHERE is_active = true`;
    const params = [];
    let paramCount = 1;
    
    if (locationFilter && locationFilter !== 'All' && locationFilter !== '') {
      // Filter by location: show location-specific holidays + "All" holidays
      const countryCodes = mapLocationToCountryCode(locationFilter);
      const conditions = [];
      countryCodes.forEach((code) => {
        conditions.push(`country_code = $${paramCount}`);
        params.push(code);
        paramCount++;
      });
      // Include "All" holidays (case-insensitive: 'All', 'ALL', 'all')
      conditions.push(`(UPPER(country_code) = 'ALL' OR country_code = 'All' OR country_code = 'all')`);
      query += ` AND (${conditions.join(' OR ')})`;
    }
    // If locationFilter is "All" or empty, show all holidays (no additional filter)
    
    if (year) {
      query += ` AND EXTRACT(YEAR FROM holiday_date) = $${paramCount}`;
      params.push(parseInt(year));
      paramCount++;
    }
    
    query += ` ORDER BY holiday_date ASC`;
    
    const result = await database.query(query, params.length > 0 ? params : undefined);
    
    // Map response to match frontend expectations (name, date) while keeping DB column names
    return result.rows.map(row => ({
      ...row,
      name: row.holiday_name, // Map holiday_name to name for frontend
      date: row.holiday_date, // Map holiday_date to date for frontend
      is_recurring: false, // Default to false since column doesn't exist in DB
      // Keep original column names as well for backward compatibility
      holiday_name: row.holiday_name,
      holiday_date: row.holiday_date
    }));
  } catch (error) {
    console.error('GetOrganizationHolidaysService error:', error);
    console.error('Error details:', {
      code: error.code,
      message: error.message,
      detail: error.detail,
      hint: error.hint
    });
    
    // If table doesn't exist, return empty array instead of error
    if (error.code === '42P01' || error.message.includes('does not exist')) {
      console.warn('⚠️ holidays table does not exist, returning empty array');
      return [];
    }
    
    throw CreateError("Failed to fetch organization holidays: " + error.message, 500);
  }
};

/**
 * Update Organization Holiday
 */
export const UpdateOrganizationHolidayService = async (Request) => {
  const { id } = Request.params;
  const { name, date, country_code } = Request.body;
  const holiday_name = name; // Map 'name' to 'holiday_name'
  const holiday_date = date; // Map 'date' to 'holiday_date'
  
  const updates = [];
  const params = [];
  let paramCount = 1;
  
  if (holiday_name) {
    updates.push(`holiday_name = $${paramCount}`);
    params.push(holiday_name);
    paramCount++;
  }
  if (holiday_date) {
    updates.push(`holiday_date = $${paramCount}`);
    params.push(holiday_date);
    paramCount++;
  }
  if (country_code !== undefined) {
    // country_code has NOT NULL constraint, so provide default value if empty
    const final_country_code = country_code && country_code.trim() !== '' ? country_code.trim() : 'ALL';
    updates.push(`country_code = $${paramCount}`);
    params.push(final_country_code);
    paramCount++;
  }
  
  if (updates.length === 0) {
    throw CreateError("No fields to update", 400);
  }
  
  // Note: updated_at column may not exist in holidays table, so we don't include it
  // Add id as the last parameter for WHERE clause
  params.push(id);
  const whereParamIndex = paramCount;
  
  try {
    const result = await database.query(
      `UPDATE holidays 
       SET ${updates.join(', ')}
       WHERE id = $${whereParamIndex}
       RETURNING id, country_code, holiday_date, holiday_name, is_active, created_at, updated_at`,
      params
    );
    
    if (result.rows.length === 0) {
      throw CreateError("Organization holiday not found", 404);
    }
    
    // Map response to match frontend expectations
    const row = result.rows[0];
    return {
      ...row,
      name: row.holiday_name,
      date: row.holiday_date,
      is_recurring: false // Default to false since column doesn't exist in DB
    };
  } catch (error) {
    // If updated_at column doesn't exist, try without it in RETURNING
    if (error.code === '42703') { // Column does not exist
      const result = await database.query(
        `UPDATE holidays 
         SET ${updates.join(', ')}
         WHERE id = $${whereParamIndex}
         RETURNING id, country_code, holiday_date, holiday_name, is_active, created_at`,
        params
      );
      
      if (result.rows.length === 0) {
        throw CreateError("Organization holiday not found", 404);
      }
      
      // Map response to match frontend expectations
      const row = result.rows[0];
      return {
        ...row,
        name: row.holiday_name,
        date: row.holiday_date,
        is_recurring: false
      };
    }
    throw error;
  }
  
  if (result.rows.length === 0) {
    throw CreateError("Organization holiday not found", 404);
  }
  
  // Map response to match frontend expectations
  const row = result.rows[0];
  return {
    ...row,
    name: row.holiday_name,
    date: row.holiday_date,
    is_recurring: false // Default to false since column doesn't exist in DB
  };
};

/**
 * Delete Organization Holiday
 */
export const DeleteOrganizationHolidayService = async (Request) => {
  const { id } = Request.params;
  
  const result = await database.query(
    `DELETE FROM holidays 
     WHERE id = $1
     RETURNING id, country_code, holiday_date, holiday_name, is_active, created_at, updated_at`,
    [id]
  );
  
  if (result.rows.length === 0) {
    throw CreateError("Organization holiday not found", 404);
  }
  
  return {
    message: "Organization holiday deleted successfully",
    data: result.rows[0]
  };
};

/**
 * Block Employee Dates
 */
export const BlockEmployeeDatesService = async (Request) => {
  const { employee_id, blocked_dates, reason } = Request.body;
  
  if (!employee_id || !blocked_dates || !Array.isArray(blocked_dates)) {
    throw CreateError("Employee ID and blocked dates array are required", 400);
  }
  
  const result = await database.query(
    `INSERT INTO employee_blocked_dates (employee_id, blocked_date, reason, created_by, created_at)
     SELECT $1, unnest($2::date[]), $3, $4, NOW()
     ON CONFLICT (employee_id, blocked_date) DO UPDATE
     SET reason = EXCLUDED.reason, updated_at = NOW()
     RETURNING *`,
    [employee_id, blocked_dates, reason || null, Request.UserId]
  );
  
  return result.rows;
};

/**
 * Get Employee Blocked Dates
 */
export const GetEmployeeBlockedDatesService = async (Request) => {
  const { employee_id } = Request.query;
  const userId = employee_id || Request.EmployeeId || Request.UserId;
  
  const result = await database.query(
    `SELECT * FROM employee_blocked_dates 
     WHERE employee_id = $1 
     ORDER BY blocked_date ASC`,
    [userId]
  );
  
  return result.rows;
};

/**
 * Delete Employee Blocked Date
 */
export const DeleteEmployeeBlockedDateService = async (Request) => {
  const { id } = Request.params;
  
  const result = await database.query(
    `DELETE FROM employee_blocked_dates 
     WHERE id = $1
     RETURNING *`,
    [id]
  );
  
  if (result.rows.length === 0) {
    throw CreateError("Employee blocked date not found", 404);
  }
  
  return {
    message: "Employee blocked date deleted successfully",
    data: result.rows[0]
  };
};

/**
 * Delete Country-Specific Holiday
 */
export const DeleteCountryHolidayService = async (Request) => {
  const { id } = Request.params;
  const { country_code } = Request.query;
  
  let query = `DELETE FROM holidays WHERE id = $1`;
  const params = [id];
  
  if (country_code) {
    query += ` AND country_code = $2`;
    params.push(country_code);
  }
  
  query += ` RETURNING id, country_code, holiday_date, holiday_name, is_active, created_at, updated_at`;
  
  const result = await database.query(query, params);
  
  if (result.rows.length === 0) {
    throw CreateError("Country holiday not found", 404);
  }
  
  return {
    message: "Country holiday deleted successfully",
    data: result.rows[0]
  };
};



