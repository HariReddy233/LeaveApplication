//Internal Lib Import
import database from "../../config/database.js";
import { CreateError } from "../../helper/ErrorHandler.js";

/**
 * Get All Employees
 */
export const GetAllEmployeesService = async (Request) => {
  const { location, team, manager } = Request.query;
  
  try {
    // Join with employees table to get manager_id and location, and join with HOD info
    let query = `SELECT 
                 u.user_id,
                 u.user_id::text as id,
                 u.user_id::text as employee_id,
                 -- Name priority: first_name alone > first_name + last_name > email
                 -- Note: If users table has full_name column (old schema), it won't be accessed here
                 -- to avoid errors. Names should be in first_name/last_name (new schema).
                 COALESCE(
                   NULLIF(TRIM(COALESCE(u.first_name, '')), ''),
                   NULLIF(TRIM(u.first_name || ' ' || COALESCE(u.last_name, '')), ''),
                   u.email
                 ) as full_name,
                 u.email, 
                 e.location, 
                 u.department as team,
                 u.department,
                 e.manager_id, 
                 COALESCE(u.role, 'employee') as role,
                 u.designation,
                 (
                   SELECT hod_u.email 
                   FROM employees hod_e 
                   JOIN users hod_u ON hod_u.user_id = hod_e.user_id 
                   WHERE hod_e.employee_id = e.manager_id
                     AND LOWER(TRIM(COALESCE(hod_u.role, ''))) = 'hod'
                   LIMIT 1
                 ) as hod_email,
                 (
                   SELECT COALESCE(
                     NULLIF(TRIM(hod_u.first_name || ' ' || COALESCE(hod_u.last_name, '')), ''),
                     hod_u.email
                   )
                   FROM employees hod_e 
                   JOIN users hod_u ON hod_u.user_id = hod_e.user_id 
                   WHERE hod_e.employee_id = e.manager_id
                     AND LOWER(TRIM(COALESCE(hod_u.role, ''))) = 'hod'
                   LIMIT 1
                 ) as hod_name
               FROM users u
               LEFT JOIN employees e ON e.user_id = u.user_id
               WHERE u.role IS NOT NULL`;
    const params = [];
    let paramCount = 1;

    if (location) {
      // Location filtering not available without employees table
      // Skip for now
    }

    if (team) {
      query += ` AND u.department = $${paramCount}`;
      params.push(team);
      paramCount++;
    }

    if (manager) {
      // Manager filtering not available without employees table
      // Skip for now
    }

    query += ` ORDER BY COALESCE(
      NULLIF(TRIM(COALESCE(u.first_name, '')), ''),
      NULLIF(TRIM(u.first_name || ' ' || COALESCE(u.last_name, '')), ''),
      u.email
    ) ASC LIMIT 1000`;

    console.log('GetAllEmployeesService query:', query);
    console.log('GetAllEmployeesService params:', params);
    
    const startTime = Date.now();
    const result = await database.query(query, params);
    const queryTime = Date.now() - startTime;
    console.log(`GetAllEmployeesService executed in ${queryTime}ms, returned ${result.rows.length} rows`);
    
    // Debug: Log employees with manager_id to verify data
    const employeesWithManager = result.rows.filter(r => r.manager_id);
    console.log(`📊 Employees with manager_id: ${employeesWithManager.length}`);
    if (employeesWithManager.length > 0) {
      console.log('📊 Sample employees with manager_id:', employeesWithManager.slice(0, 5).map(e => ({
        name: e.full_name,
        email: e.email,
        manager_id: e.manager_id,
        hod_name: e.hod_name,
        hod_email: e.hod_email,
        hasHodInfo: !!(e.hod_name || e.hod_email)
      })));
    } else {
      console.log('⚠️ No employees found with manager_id assigned');
    }
    
    // Also log employees without HOD info but with manager_id (potential issue)
    const employeesWithManagerButNoHod = result.rows.filter(r => r.manager_id && !r.hod_name && !r.hod_email);
    if (employeesWithManagerButNoHod.length > 0) {
      console.warn(`⚠️ Found ${employeesWithManagerButNoHod.length} employee(s) with manager_id but no HOD info`);
      
      // Debug: Check what's in the database for these employees
      for (const emp of employeesWithManagerButNoHod.slice(0, 3)) {
        try {
          const debugResult = await database.query(
            `SELECT 
              e.employee_id as emp_employee_id,
              e.manager_id,
              hod_e.employee_id as hod_employee_id,
              hod_u.email as hod_email,
              hod_u.role as hod_user_role,
              hod_e.role as hod_emp_role
            FROM employees e
            LEFT JOIN employees hod_e ON hod_e.employee_id = e.manager_id
            LEFT JOIN users hod_u ON hod_u.user_id = hod_e.user_id
            WHERE e.user_id = $1`,
            [emp.user_id || emp.id]
          );
          
          if (debugResult.rows.length > 0) {
            const debug = debugResult.rows[0];
            console.warn(`  Employee: ${emp.full_name || emp.email}`, {
              manager_id: debug.manager_id,
              hod_employee_id: debug.hod_employee_id,
              hod_email: debug.hod_email,
              hod_user_role: debug.hod_user_role,
              hod_emp_role: debug.hod_emp_role,
              hasHodEmployee: !!debug.hod_employee_id,
              hasHodUser: !!debug.hod_email
            });
          }
        } catch (debugError) {
          console.error(`  Error debugging employee ${emp.email}:`, debugError.message);
        }
      }
    }
    
    return result.rows;
  } catch (error) {
    // Fallback: try simpler query with just users table (no join)
    try {
      const result = await database.query(
        `SELECT 
          u.user_id,
          u.user_id::text as id,
          u.user_id::text as employee_id,
          COALESCE(
            NULLIF(TRIM(COALESCE(u.first_name, '')), ''),
            NULLIF(TRIM(u.first_name || ' ' || COALESCE(u.last_name, '')), ''),
            u.email
          ) as full_name,
          u.email,
          COALESCE(u.role, 'employee') as role,
          u.department as team,
          u.department,
          u.designation,
          e.location,
          e.manager_id,
          (
            SELECT hod_u.email 
            FROM employees hod_e 
            JOIN users hod_u ON hod_u.user_id = hod_e.user_id 
            WHERE hod_e.employee_id = e.manager_id
              AND LOWER(TRIM(COALESCE(hod_u.role, ''))) = 'hod'
            LIMIT 1
          ) as hod_email,
          (
            SELECT COALESCE(
              NULLIF(TRIM(hod_u.first_name || ' ' || COALESCE(hod_u.last_name, '')), ''),
              hod_u.email
            )
            FROM employees hod_e 
            JOIN users hod_u ON hod_u.user_id = hod_e.user_id 
            WHERE hod_e.employee_id = e.manager_id
              AND LOWER(TRIM(COALESCE(hod_u.role, ''))) = 'hod'
            LIMIT 1
          ) as hod_name
         FROM users u
         LEFT JOIN employees e ON e.user_id = u.user_id
         WHERE u.role IS NOT NULL
         ORDER BY COALESCE(
           NULLIF(TRIM(COALESCE(u.first_name, '')), ''),
           NULLIF(TRIM(u.first_name || ' ' || COALESCE(u.last_name, '')), ''),
           u.email
         ) ASC
         LIMIT 1000`
      );
      console.log(`Fallback query returned ${result.rows.length} rows`);
      return result.rows;
    } catch (fallbackError) {
      console.error('GetAllEmployeesService fallback error:', fallbackError);
      throw CreateError("Failed to fetch employees", 500);
    }
  }
};

/**
 * Get User Profile
 */
export const GetUserProfileService = async (Request) => {
  const UserId = Request.UserId;

  const result = await database.query(
    `SELECT e.employee_id, 
     COALESCE(u.first_name || ' ' || u.last_name, u.first_name, u.last_name, u.email) as full_name,
     u.email, e.location, e.team, e.manager_id, e.role
     FROM employees e
     JOIN users u ON e.user_id = u.user_id
     WHERE u.user_id = $1`,
    [UserId]
  );

  if (result.rows.length === 0) {
    throw CreateError("User not found", 404);
  }

  return result.rows[0];
};

/**
 * Get All Users for Availability Checking (All authenticated users can access)
 * Returns basic user info for checking availability
 */
/**
 * Get All HODs (for HOD assignment dropdown)
 * Returns list of users with HOD role
 */
/**
 * Get All Admins (for Admin assignment dropdown)
 * Returns list of users with Admin role
 */
export const GetAdminsListService = async (Request) => {
  try {
    if (!database) {
      throw CreateError("Database connection error", 500);
    }

    const result = await database.query(
      `SELECT 
        u.user_id,
        u.user_id::text as id,
        u.email,
        COALESCE(
          NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''),
          u.first_name,
          u.last_name,
          u.email
        ) as full_name,
        e.employee_id,
        u.department,
        e.location
       FROM users u
       LEFT JOIN employees e ON e.user_id = u.user_id
       WHERE LOWER(TRIM(u.role)) = 'admin'
       AND (u.status = 'Active' OR u.status IS NULL OR u.status = '')
       ORDER BY COALESCE(
         NULLIF(TRIM(COALESCE(u.first_name, '')), ''),
         NULLIF(TRIM(u.first_name || ' ' || COALESCE(u.last_name, '')), ''),
         u.email
       ) ASC`
    );
    
    return {
      Data: result.rows
    };
  } catch (error) {
    console.error('GetAdminsListService error:', error.message);
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      throw CreateError("Database connection failed. Please check database configuration.", 500);
    } else if (error.code && error.code.startsWith('42')) {
      throw CreateError(`Database query error: ${error.message}`, 500);
    } else {
      throw CreateError(`Failed to fetch Admins: ${error.message || 'Unknown error'}`, 500);
    }
  }
};

export const GetHodsListService = async (Request) => {
  try {
    if (!database) {
      throw CreateError("Database connection error", 500);
    }

    const result = await database.query(
      `SELECT 
        u.user_id,
        u.user_id::text as id,
        u.email,
        COALESCE(
          NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''),
          u.first_name,
          u.last_name,
          u.email
        ) as full_name,
        e.employee_id,
        u.department,
        e.location
       FROM users u
       LEFT JOIN employees e ON e.user_id = u.user_id
       WHERE LOWER(TRIM(u.role)) = 'hod'
       AND (u.status = 'Active' OR u.status IS NULL OR u.status = '')
       ORDER BY COALESCE(
         NULLIF(TRIM(COALESCE(u.first_name, '')), ''),
         NULLIF(TRIM(u.first_name || ' ' || COALESCE(u.last_name, '')), ''),
         u.email
       ) ASC`
    );
    
    // Ensure all HODs have employee records - create them if missing
    for (const hod of result.rows) {
      if (!hod.employee_id) {
        try {
          // Try INSERT with ON CONFLICT first
          try {
            // Try INSERT with minimal fields (email and full_name columns might not exist)
            let createResult;
            try {
              createResult = await database.query(
                `INSERT INTO employees (user_id, role)
                 VALUES ($1, 'HOD')
                 ON CONFLICT (user_id) DO UPDATE SET
                   role = 'HOD'
                 RETURNING employee_id`,
                [hod.user_id]
              );
            } catch (columnError) {
              // If that fails due to missing columns, try with just user_id
              if (columnError.code === '42703' || columnError.message.includes('column')) {
                try {
                  createResult = await database.query(
                    `INSERT INTO employees (user_id, role)
                     VALUES ($1, 'HOD')
                     RETURNING employee_id`,
                    [hod.user_id]
                  );
                } catch (minError) {
                  // If even that fails, try with just user_id (no role)
                  if (minError.code === '42703' || minError.message.includes('column') || minError.message.includes('role')) {
                    createResult = await database.query(
                      `INSERT INTO employees (user_id)
                       VALUES ($1)
                       RETURNING employee_id`,
                      [hod.user_id]
                    );
                  } else {
                    throw minError;
                  }
                }
              } else {
                throw columnError;
              }
            }
            
            if (createResult.rows.length > 0 && createResult.rows[0].employee_id) {
              hod.employee_id = createResult.rows[0].employee_id;
            } else {
              // If RETURNING didn't work, fetch it
              const fetchResult = await database.query(
                'SELECT employee_id FROM employees WHERE user_id = $1',
                [hod.user_id]
              );
              if (fetchResult.rows.length > 0) {
                hod.employee_id = fetchResult.rows[0].employee_id;
              }
            }
          } catch (conflictError) {
            // If ON CONFLICT fails (no unique constraint), try simple INSERT
            if (conflictError.code === '42704' || conflictError.message.includes('conflict') || conflictError.message.includes('constraint')) {
              try {
                // Try INSERT with minimal fields (email and full_name columns might not exist)
                let createResult;
                try {
                  createResult = await database.query(
                    `INSERT INTO employees (user_id, role)
                     VALUES ($1, 'HOD')
                     RETURNING employee_id`,
                    [hod.user_id]
                  );
                } catch (columnError) {
                  if (columnError.code === '42703' || columnError.message.includes('column')) {
                    // Some columns don't exist, try with just user_id
                    try {
                      createResult = await database.query(
                        `INSERT INTO employees (user_id)
                         VALUES ($1)
                         RETURNING employee_id`,
                        [hod.user_id]
                      );
                    } catch (minError) {
                      throw columnError; // Re-throw original error
                    }
                  } else {
                    throw columnError;
                  }
                }
                
                if (createResult.rows.length > 0 && createResult.rows[0].employee_id) {
                  hod.employee_id = createResult.rows[0].employee_id;
                } else {
                  // Fetch it if RETURNING didn't work
                  const fetchResult = await database.query(
                    'SELECT employee_id FROM employees WHERE user_id = $1',
                    [hod.user_id]
                  );
                  if (fetchResult.rows.length > 0) {
                    hod.employee_id = fetchResult.rows[0].employee_id;
                  }
                }
              } catch (insertError) {
                // If INSERT fails (duplicate), fetch existing
                if (insertError.code === '23505' || insertError.message.includes('duplicate') || insertError.message.includes('unique')) {
                  const existing = await database.query(
                    'SELECT employee_id FROM employees WHERE user_id = $1',
                    [hod.user_id]
                  );
                  if (existing.rows.length > 0) {
                    hod.employee_id = existing.rows[0].employee_id;
                  }
                } else {
                  throw insertError;
                }
              }
            } else {
              throw conflictError;
            }
          }
          
          // Final verification - make sure employee_id is set
          if (!hod.employee_id) {
            const finalCheck = await database.query(
              'SELECT employee_id FROM employees WHERE user_id = $1',
              [hod.user_id]
            );
            if (finalCheck.rows.length > 0) {
              hod.employee_id = finalCheck.rows[0].employee_id;
            }
          }
        } catch (createError) {
          console.error(`Failed to create employee record for HOD ${hod.email}:`, createError.message);
          // Don't fail the entire request - just log the error
        }
      }
    }

    return {
      Data: result.rows
    };
  } catch (error) {
    console.error('GetHodsListService error:', error.message);
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      throw CreateError("Database connection failed. Please check database configuration.", 500);
    } else if (error.code && error.code.startsWith('42')) {
      throw CreateError(`Database query error: ${error.message}`, 500);
    } else {
      throw CreateError(`Failed to fetch HODs: ${error.message || 'Unknown error'}`, 500);
    }
  }
};

export const GetUsersForAvailabilityService = async (Request) => {
  try {
    // Simple query to get all active users - accessible to all authenticated users
    const query = `SELECT 
                   u.user_id as id,
                   u.user_id,
                   COALESCE(
                     NULLIF(TRIM(u.first_name || ' ' || COALESCE(u.last_name, '')), ''),
                     u.email
                   ) as full_name,
                   u.email,
                   u.role,
                   u.department,
                   u.designation
                 FROM users u
                 WHERE u.role IS NOT NULL
                 ORDER BY COALESCE(
                   NULLIF(TRIM(COALESCE(u.first_name, '')), ''),
                   NULLIF(TRIM(u.first_name || ' ' || COALESCE(u.last_name, '')), ''),
                   u.email
                 ) ASC
                 LIMIT 1000`;
    
    const result = await database.query(query);
    return result.rows;
  } catch (error) {
    console.error('GetUsersForAvailabilityService error:', error);
    throw CreateError("Failed to fetch users for availability", 500);
  }
};

/**
 * Update User Role (Admin only)
 * Allows admin to assign HOD, Employee, or Admin roles
 */
export const UpdateUserRoleService = async (Request) => {
  const { userId } = Request.params;
  const { role } = Request.body;
  const RequestUserId = Request.UserId;

  if (!role || !['employee', 'Employee', 'hod', 'HOD', 'admin', 'Admin'].includes(role)) {
    throw CreateError("Valid role is required (employee, hod, admin)", 400);
  }

  // Normalize role
  const normalizedRole = role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
  if (normalizedRole === 'Hod') normalizedRole = 'HOD';
  if (normalizedRole === 'Employee') normalizedRole = 'employee';

  // Update user role
  const userResult = await database.query(
    `UPDATE users 
     SET role = $1, updated_at = NOW()
     WHERE user_id = $2
     RETURNING user_id, email, role`,
    [normalizedRole, userId]
  );

  if (userResult.rows.length === 0) {
    throw CreateError("User not found", 404);
  }

  const user = userResult.rows[0];
  const actualUserId = user.user_id;

  // Update employee role if employee record exists
  try {
    await database.query(
      `UPDATE employees 
       SET role = $1, updated_at = NOW()
       WHERE user_id = $2`,
      [normalizedRole, actualUserId]
    );
  } catch (empError) {
    // Employee record update is optional
    console.warn('Employee role update failed:', empError.message);
  }

  return {
    message: "User role updated successfully",
    user: {
      id: actualUserId,
      email: user.email,
      role: normalizedRole
    }
  };
};

/**
 * Get All Users with Roles (Admin only)
 */
export const GetAllUsersService = async (Request) => {
  try {
    const result = await database.query(
      `SELECT 
        u.user_id,
        u.user_id::text as id,
        u.user_id::text as employee_id,
        u.email,
        u.phone_number,
        COALESCE(
          NULLIF(TRIM(COALESCE(u.first_name, '')), ''),
          NULLIF(TRIM(u.first_name || ' ' || COALESCE(u.last_name, '')), ''),
          u.email
        ) as full_name,
        u.role as role,
        u.status,
        e.employee_id,
        e.team,
        e.location,
        e.designation,
        e.manager_id,
        (
          SELECT hod_u.email 
          FROM employees hod_e 
          JOIN users hod_u ON hod_u.user_id = hod_e.user_id 
          WHERE hod_e.employee_id = e.manager_id
            AND LOWER(TRIM(COALESCE(hod_u.role, ''))) = 'hod'
          LIMIT 1
        ) as hod_email,
        (
          SELECT COALESCE(
            NULLIF(TRIM(hod_u.first_name || ' ' || COALESCE(hod_u.last_name, '')), ''),
            hod_u.email
          )
          FROM employees hod_e 
          JOIN users hod_u ON hod_u.user_id = hod_e.user_id 
          WHERE hod_e.employee_id = e.manager_id
            AND LOWER(TRIM(COALESCE(hod_u.role, ''))) = 'hod'
          LIMIT 1
        ) as hod_name,
        e.admin_id,
        (
          SELECT admin_u.email 
          FROM employees admin_e 
          JOIN users admin_u ON admin_u.user_id = admin_e.user_id 
          WHERE admin_e.employee_id = e.admin_id
            AND LOWER(TRIM(COALESCE(admin_u.role, ''))) = 'admin'
          LIMIT 1
        ) as admin_email,
        (
          SELECT COALESCE(
            NULLIF(TRIM(admin_u.first_name || ' ' || COALESCE(admin_u.last_name, '')), ''),
            admin_u.email
          )
          FROM employees admin_e 
          JOIN users admin_u ON admin_u.user_id = admin_e.user_id 
          WHERE admin_e.employee_id = e.admin_id
            AND LOWER(TRIM(COALESCE(admin_u.role, ''))) = 'admin'
          LIMIT 1
        ) as admin_name
       FROM users u
       LEFT JOIN employees e ON e.user_id = u.user_id
       WHERE u.role IS NOT NULL
       ORDER BY COALESCE(
         NULLIF(TRIM(COALESCE(u.first_name, '')), ''),
         NULLIF(TRIM(u.first_name || ' ' || COALESCE(u.last_name, '')), ''),
         u.email
       ) ASC`
    );

    return {
      Data: result.rows
    };
  } catch (error) {
    console.error('GetAllUsersService error:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail
    });
    throw CreateError("Failed to fetch users", 500);
  }
};

/**
 * Update Employee Details (Admin only)
 */
export const UpdateEmployeeService = async (Request) => {
  const { userId } = Request.params;
  const { full_name, email, role, location, department, designation, hod_id, admin_id, phone_number } = Request.body;

  if (!userId) {
    throw CreateError("User ID is required", 400);
  }

  // Normalize role if provided
  let normalizedRole = null;
  if (role) {
    normalizedRole = role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
    if (normalizedRole === 'Hod') normalizedRole = 'HOD';
    if (normalizedRole === 'Employee') normalizedRole = 'employee';
  }

  // HOD assignment is mandatory for employees
  // Check current role and manager_id if role is not being updated
  let currentRole = normalizedRole;
  let currentManagerId = null;
  if (!currentRole || hod_id === undefined) {
    try {
      const currentUserResult = await database.query(
        'SELECT u.role, e.manager_id FROM users u LEFT JOIN employees e ON e.user_id = u.user_id WHERE u.user_id = $1',
        [userId]
      );
      if (currentUserResult.rows.length > 0) {
        if (!currentRole) {
          currentRole = currentUserResult.rows[0].role?.toLowerCase().trim();
        }
        currentManagerId = currentUserResult.rows[0].manager_id;
      }
    } catch (err) {
      console.warn('Could not fetch current role/manager:', err.message);
    }
  }
  
  const finalRole = (normalizedRole || currentRole || 'employee').toLowerCase().trim();
  // Only validate HOD assignment for employees (not for HODs or admins)
  // Only validate if hod_id is explicitly provided and empty, or if employee has no manager_id
  if (finalRole === 'employee') {
    if (hod_id !== undefined && (!hod_id || hod_id === '') && !currentManagerId) {
      throw CreateError("HOD assignment is required for employees", 400);
    }
  }

  try {
    // Check if email already exists for a different user (if email is being updated)
    if (email) {
      const emailCheckResult = await database.query(
        'SELECT user_id FROM users WHERE LOWER(email) = $1 AND user_id != $2',
        [email.toLowerCase(), userId]
      );
      
      if (emailCheckResult.rows.length > 0) {
        throw CreateError(`Email "${email}" is already in use by another user`, 400);
      }
    }

    // Update users table
    let userUpdateQuery = 'UPDATE users SET updated_at = NOW()';
    const userParams = [];
    let paramCount = 1;

    if (email) {
      userUpdateQuery += `, email = $${paramCount}`;
      userParams.push(email.toLowerCase());
      paramCount++;
    }

    if (normalizedRole) {
      userUpdateQuery += `, role = $${paramCount}`;
      userParams.push(normalizedRole);
      paramCount++;
    }

    // Update department in users table
    if (department !== undefined) {
      userUpdateQuery += `, department = $${paramCount}`;
      userParams.push(department || null);
      paramCount++;
    }

    // Update phone_number in users table
    if (phone_number !== undefined) {
      userUpdateQuery += `, phone_number = $${paramCount}`;
      userParams.push(phone_number || null);
      paramCount++;
    }

    // Handle full_name - try first_name/last_name first, fallback to full_name
    if (full_name) {
      const nameParts = full_name.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      
      // Try to update first_name and last_name (if columns exist)
      // If they don't exist, the query will fail and we'll catch it
      userUpdateQuery += `, first_name = $${paramCount}, last_name = $${paramCount + 1}`;
      userParams.push(firstName, lastName);
      paramCount += 2;
    }

    userUpdateQuery += ` WHERE user_id = $${paramCount}`;
    userParams.push(userId);

    let userResult;
    try {
      userResult = await database.query(userUpdateQuery, userParams);
    } catch (nameError) {
      // Handle duplicate email error first
      if (nameError.code === '23505' && nameError.constraint === 'users_email_key') {
        throw CreateError(`Email "${email}" is already in use by another user`, 400);
      }
      
      // If first_name/last_name columns don't exist, try with full_name
      if (nameError.code === '42703' && full_name) {
        // Retry with full_name instead
        let retryQuery = 'UPDATE users SET updated_at = NOW()';
        const retryParams = [];
        let retryCount = 1;
        
        if (email) {
          retryQuery += `, email = $${retryCount}`;
          retryParams.push(email.toLowerCase());
          retryCount++;
        }
        
        if (normalizedRole) {
          retryQuery += `, role = $${retryCount}`;
          retryParams.push(normalizedRole);
          retryCount++;
        }
        
        if (department !== undefined) {
          retryQuery += `, department = $${retryCount}`;
          retryParams.push(department || null);
          retryCount++;
        }
        
        if (phone_number !== undefined) {
          retryQuery += `, phone_number = $${retryCount}`;
          retryParams.push(phone_number || null);
          retryCount++;
        }
        
        if (full_name) {
          retryQuery += `, full_name = $${retryCount}`;
          retryParams.push(full_name);
          retryCount++;
        }
        
        retryQuery += ` WHERE user_id = $${retryCount}`;
        retryParams.push(userId);
        
        try {
          userResult = await database.query(retryQuery, retryParams);
        } catch (retryError) {
          // Handle duplicate email error in retry
          if (retryError.code === '23505' && retryError.constraint === 'users_email_key') {
            throw CreateError(`Email "${email}" is already in use by another user`, 400);
          }
          throw retryError;
        }
      } else {
        throw nameError;
      }
    }

    if (userResult.rowCount === 0) {
      throw CreateError("User not found", 404);
    }

    // Update employees table
    // Always start with updated_at, even if no other fields are being updated
    let empUpdateQuery = 'UPDATE employees SET updated_at = NOW()';
    const empParams = [];
    paramCount = 1;
    
    // Track if we have any fields to update (besides manager_id)
    let hasOtherFields = false;

    // Note: email and full_name are in users table, not employees table
    // They are already handled in the users table update above
    // Do NOT update email or full_name in employees table

    if (normalizedRole) {
      empUpdateQuery += `, role = $${paramCount}`;
      empParams.push(normalizedRole);
      paramCount++;
      hasOtherFields = true;
    }

    if (location !== undefined) {
      empUpdateQuery += `, location = $${paramCount}`;
      empParams.push(location || null);
      paramCount++;
      hasOtherFields = true;
    }

    if (department !== undefined) {
      empUpdateQuery += `, team = $${paramCount}`;
      empParams.push(department || null);
      paramCount++;
      hasOtherFields = true;
    }

    if (designation !== undefined) {
      empUpdateQuery += `, designation = $${paramCount}`;
      empParams.push(designation || null);
      paramCount++;
      hasOtherFields = true;
    }

    // Handle HOD assignment (manager_id)
    let hodEmployeeId = null;
    let shouldUpdateManagerId = false;
    console.log(`\n🔵 ========== HOD ASSIGNMENT START ==========`);
    console.log(`🔵 User ID being updated: ${userId}`);
    console.log(`🔵 Received hod_id: ${hod_id} (type: ${typeof hod_id}, value: ${JSON.stringify(hod_id)})`);
    
    if (hod_id !== undefined) {
      if (hod_id && hod_id !== '') {
        shouldUpdateManagerId = true;
        console.log(`✅ hod_id is provided and not empty. Will update manager_id.`);
        console.log(`🔍 Converting hod_id to manager_id. Received hod_id: ${hod_id} (type: ${typeof hod_id})`);
        // Convert hod_id to employee_id (manager_id)
        // hod_id could be: employee_id or user_id
        try {
          // hod_id from frontend could be: employee_id, id, or user_id
          // Try all possibilities to find the HOD
          console.log(`🔍 STEP 1: Looking up HOD with hod_id: ${hod_id} (type: ${typeof hod_id})`);
          
          // Strategy 1: Try to find by employee_id first (most direct)
          console.log(`🔍 STEP 1.1: Trying to find HOD by employee_id...`);
          let hodResult = await database.query(
            `SELECT employee_id, user_id 
             FROM employees 
             WHERE employee_id::text = $1 
                OR employee_id = $1::integer
                OR employee_id::text = CAST($1 AS TEXT)
             LIMIT 1`,
            [hod_id.toString()]
          );
          
          if (hodResult.rows.length > 0) {
            hodEmployeeId = hodResult.rows[0].employee_id;
            const foundUserId = hodResult.rows[0].user_id;
            console.log(`✅ STEP 1.1 SUCCESS: Found HOD by employee_id: ${hodEmployeeId} (user_id: ${foundUserId})`);
          } else {
            // Strategy 2: Try to find by user_id
            console.log(`⚠️ STEP 1.1 FAILED: Not found by employee_id. Trying user_id lookup...`);
            // Try multiple ways to match user_id (handle both text and integer)
            let userCheck;
            try {
              // First try as integer
              const hodIdInt = parseInt(hod_id, 10);
              if (!isNaN(hodIdInt)) {
                userCheck = await database.query(
                  `SELECT user_id, email, role, 
                          COALESCE(NULLIF(TRIM(first_name || ' ' || COALESCE(last_name, '')), ''), email) as full_name
                   FROM users 
                   WHERE user_id = $1
                   LIMIT 1`,
                  [hodIdInt]
                );
              }
              
              // If not found as integer, try as text
              if (!userCheck || userCheck.rows.length === 0) {
                userCheck = await database.query(
                  `SELECT user_id, email, role, 
                          COALESCE(NULLIF(TRIM(first_name || ' ' || COALESCE(last_name, '')), ''), email) as full_name
                   FROM users 
                   WHERE user_id::text = $1
                      OR CAST(user_id AS TEXT) = $1
                   LIMIT 1`,
                  [hod_id.toString()]
                );
              }
            } catch (userQueryError) {
              console.error(`❌ Error in user_id lookup:`, userQueryError.message);
              throw userQueryError;
            }
            
            console.log(`🔍 STEP 1.2 Result: Found ${userCheck?.rows?.length || 0} user(s)`);
            if (userCheck.rows.length > 0) {
              const hodUser = userCheck.rows[0];
              console.log(`✅ STEP 1.2 SUCCESS: Found HOD user: ${hodUser.email} (user_id: ${hodUser.user_id})`);
              
              // Now check if this user has an employee record
              console.log(`🔍 STEP 1.3: Checking if HOD user has employee record...`);
              hodResult = await database.query(
                `SELECT employee_id, user_id 
                 FROM employees 
                 WHERE user_id = $1
                 LIMIT 1`,
                [hodUser.user_id]
              );
              
              console.log(`🔍 STEP 1.3 Result: Found ${hodResult.rows.length} employee record(s)`);
              if (hodResult.rows.length > 0) {
                hodEmployeeId = hodResult.rows[0].employee_id;
                console.log(`✅ STEP 1.3 SUCCESS: Found HOD employee_id: ${hodEmployeeId} for user_id: ${hodUser.user_id}`);
              } else {
                // HOD user exists but no employee record - create one
                console.log(`⚠️ STEP 1.3 FAILED: HOD user found but no employee record. Creating employee record...`);
                console.log(`📝 HOD user details:`, {
                  user_id: hodUser.user_id,
                  email: hodUser.email,
                  full_name: hodUser.full_name,
                  role: hodUser.role || 'HOD'
                });
                try {
                  // Try INSERT first
                  console.log(`🔍 STEP 1.4: Creating employee record for HOD...`);
                  console.log(`📝 HOD details: user_id=${hodUser.user_id}, email=${hodUser.email}, full_name=${hodUser.full_name || hodUser.email}`);
                  // Try INSERT with minimal fields (email and full_name columns might not exist)
                  let createEmpResult;
                  try {
                    createEmpResult = await database.query(
                      `INSERT INTO employees (user_id, role)
                       VALUES ($1, $2)
                       RETURNING employee_id`,
                      [hodUser.user_id, hodUser.role || 'HOD']
                    );
                  } catch (columnError) {
                    if (columnError.code === '42703' || columnError.message.includes('column')) {
                      // Some columns don't exist, try with just user_id
                      try {
                        createEmpResult = await database.query(
                          `INSERT INTO employees (user_id)
                           VALUES ($1)
                           RETURNING employee_id`,
                          [hodUser.user_id]
                        );
                      } catch (minError) {
                        // If even that fails, try to get existing record
                        if (minError.code === '23505' || minError.message.includes('duplicate')) {
                          const existingResult = await database.query(
                            'SELECT employee_id FROM employees WHERE user_id = $1',
                            [hodUser.user_id]
                          );
                          if (existingResult.rows.length > 0) {
                            createEmpResult = { rows: existingResult.rows };
                          } else {
                            throw columnError;
                          }
                        } else {
                          throw columnError;
                        }
                      }
                    } else {
                      throw columnError;
                    }
                  }
                  
                  console.log(`🔍 STEP 1.4 Result: INSERT returned ${createEmpResult.rows.length} row(s)`);
                  if (createEmpResult.rows.length > 0) {
                    hodEmployeeId = createEmpResult.rows[0].employee_id;
                    console.log(`✅ STEP 1.4 SUCCESS: Created HOD employee record with employee_id: ${hodEmployeeId}`);
                  } else {
                    console.warn(`⚠️ STEP 1.4 WARNING: INSERT succeeded but no employee_id returned`);
                  }
                } catch (insertError) {
                  // If insert fails (duplicate), try to get existing record
                  if (insertError.code === '23505' || insertError.message.includes('duplicate') || insertError.message.includes('unique')) {
                    console.log(`📝 Duplicate key error, fetching existing employee record...`);
                    const existingResult = await database.query(
                      'SELECT employee_id FROM employees WHERE user_id = $1',
                      [hodUser.user_id]
                    );
                    if (existingResult.rows.length > 0) {
                      hodEmployeeId = existingResult.rows[0].employee_id;
                      console.log(`✅ Found existing HOD employee record with employee_id: ${hodEmployeeId}`);
                    } else {
                      console.warn(`⚠️ Duplicate error but no existing record found. Trying to fetch again...`);
                      // Try one more time with a different query
                      const retryResult = await database.query(
                        'SELECT employee_id, user_id FROM employees WHERE user_id = $1 OR user_id::text = $2',
                        [hodUser.user_id, hodUser.user_id.toString()]
                      );
                      if (retryResult.rows.length > 0) {
                        hodEmployeeId = retryResult.rows[0].employee_id;
                        console.log(`✅ Found HOD employee record on retry: ${hodEmployeeId}`);
                      }
                    }
                  } else {
                    console.error(`❌ Failed to create employee record:`, insertError.message);
                    console.error(`Insert error details:`, {
                      code: insertError.code,
                      detail: insertError.detail,
                      hint: insertError.hint
                    });
                    // Don't throw - try to continue with user_id lookup
                    console.warn(`⚠️ Will try to use user_id directly as fallback`);
                  }
                }
              }
            } else {
              console.warn(`⚠️ No HOD found with hod_id: ${hod_id} (tried employee_id and user_id)`);
              console.warn(`⚠️ This might mean the HOD doesn't exist or the ID format is incorrect`);
              
              // Last resort: Try to find by any matching ID in employees table
              console.log(`🔍 Last resort: Trying broader search in employees table...`);
              try {
                const lastResortResult = await database.query(
                  `SELECT e.employee_id, e.user_id, u.email, u.role
                   FROM employees e
                   JOIN users u ON u.user_id = e.user_id
                   WHERE (e.employee_id::text = $1 OR e.user_id::text = $1 OR e.user_id = $1::integer)
                     AND LOWER(TRIM(u.role)) = 'hod'
                   LIMIT 1`,
                  [hod_id.toString()]
                );
                
                if (lastResortResult.rows.length > 0) {
                  hodEmployeeId = lastResortResult.rows[0].employee_id;
                  console.log(`✅ Found HOD in last resort search: employee_id ${hodEmployeeId}`);
                }
              } catch (lastResortError) {
                console.error(`❌ Last resort search also failed:`, lastResortError.message);
              }
            }
          }
          
          // Final check - make sure we have a valid employee_id
          console.log(`\n🔵 STEP 1 FINAL CHECK: hodEmployeeId = ${hodEmployeeId}`);
          if (!hodEmployeeId) {
            console.error(`❌ CRITICAL: Could not find or create employee_id for HOD with hod_id: ${hod_id}`);
            console.error(`❌ Tried: employee_id lookup, user_id lookup, employee record creation, and last resort search`);
            throw new Error(`HOD not found: Unable to find employee record for HOD with ID ${hod_id}. Please ensure the HOD exists and has a valid employee record.`);
          } else {
            console.log(`✅ STEP 1 COMPLETE: Using HOD employee_id: ${hodEmployeeId} for assignment`);
          }
        } catch (hodError) {
          console.error('❌ Failed to find/create HOD employee_id:', hodError);
          console.error('Error details:', {
            message: hodError.message,
            code: hodError.code,
            detail: hodError.detail
          });
          // Don't update manager_id if HOD lookup failed
          shouldUpdateManagerId = false;
        }
      } else {
        // Empty string means clear the HOD assignment
        console.log('📝 hod_id is empty, will set manager_id to NULL');
        shouldUpdateManagerId = true;
        hodEmployeeId = null;
      }
      
      // Only update manager_id if we should (hod_id was provided)
      if (shouldUpdateManagerId) {
        console.log(`\n🔵 STEP 2: Adding manager_id to UPDATE query`);
        console.log(`📝 manager_id value: ${hodEmployeeId || 'NULL'}`);
      empUpdateQuery += `, manager_id = $${paramCount}`;
        empParams.push(hodEmployeeId);
        console.log(`✅ Added manager_id = $${paramCount} to query`);
        console.log(`📝 Current query: ${empUpdateQuery}`);
        console.log(`📝 Current params: ${JSON.stringify(empParams)}`);
      paramCount++;
        hasOtherFields = true; // manager_id is a field being updated
      }
    } else {
      console.log('📝 hod_id is undefined, skipping manager_id update (keeping existing value)');
    }

    // Handle admin_id assignment (for HODs)
    let shouldUpdateAdminId = false;
    let adminEmployeeId = null;
    if (admin_id !== undefined) {
      shouldUpdateAdminId = true;
      if (admin_id && admin_id !== '') {
        // Find Admin's employee_id
        try {
          const adminResult = await database.query(
            `SELECT e.employee_id, e.user_id, u.email, u.role
             FROM employees e
             JOIN users u ON u.user_id = e.user_id
             WHERE (e.employee_id = $1 OR e.employee_id::text = $1 OR e.user_id = $1 OR e.user_id::text = $1)
               AND LOWER(TRIM(u.role)) = 'admin'
             LIMIT 1`,
            [admin_id]
          );
          
          if (adminResult.rows.length > 0) {
            adminEmployeeId = adminResult.rows[0].employee_id;
            console.log(`✅ Found Admin employee_id: ${adminEmployeeId}`);
          } else {
            console.warn(`⚠️ Admin not found with admin_id: ${admin_id}`);
          }
        } catch (adminError) {
          console.error('❌ Failed to find Admin employee_id:', adminError);
          shouldUpdateAdminId = false;
        }
      } else {
        // Empty string means clear the Admin assignment
        console.log('📝 admin_id is empty, will set admin_id to NULL');
        adminEmployeeId = null;
      }
      
      if (shouldUpdateAdminId) {
        empUpdateQuery += `, admin_id = $${paramCount}`;
        empParams.push(adminEmployeeId);
        paramCount++;
        hasOtherFields = true;
      }
    }
    
    // If only manager_id is being updated (no other fields), make sure the query is valid
    if (!hasOtherFields && shouldUpdateManagerId) {
      // This case is already handled above, but log it for debugging
      console.log('📝 Only manager_id is being updated (no other fields)');
      // Ensure the query will work - it should have: UPDATE employees SET updated_at = NOW(), manager_id = $1
      // This is already handled above, just logging
    }

    // Check if employee record exists before updating
    let employeeExists = false;
    let existingEmployeeId = null;
    try {
      const checkEmp = await database.query(
        'SELECT employee_id, manager_id FROM employees WHERE user_id = $1',
        [userId]
      );
      employeeExists = checkEmp.rows.length > 0;
      if (employeeExists) {
        existingEmployeeId = checkEmp.rows[0].employee_id;
        console.log(`🔍 Employee record exists: ${employeeExists}, employee_id: ${existingEmployeeId}, current manager_id: ${checkEmp.rows[0].manager_id}`);
      } else {
        console.log(`🔍 Employee record does NOT exist for user_id: ${userId}`);
      }
    } catch (checkError) {
      console.warn('⚠️ Could not check if employee exists:', checkError.message);
    }

    empUpdateQuery += ` WHERE user_id = $${paramCount}`;
    empParams.push(userId);

    console.log(`\n🔵 STEP 3: Executing employees UPDATE query`);
    console.log(`📝 Full UPDATE query: ${empUpdateQuery}`);
    console.log(`📝 Query parameters (${empParams.length}): ${JSON.stringify(empParams)}`);
    console.log(`📝 Employee exists check: ${employeeExists}`);

    try {
      const empUpdateResult = await database.query(empUpdateQuery, empParams);
      console.log(`✅ STEP 3 RESULT: Employees table updated. Rows affected: ${empUpdateResult.rowCount}`);
      
      // If UPDATE affected 0 rows and we need to update manager_id, try direct UPDATE
      if (empUpdateResult.rowCount === 0 && shouldUpdateManagerId) {
        console.warn('⚠️ UPDATE affected 0 rows but manager_id needs to be set. Trying direct UPDATE...');
        try {
          const directUpdate = await database.query(
            'UPDATE employees SET manager_id = $1, updated_at = NOW() WHERE user_id = $2',
            [hodEmployeeId, userId]
          );
          console.log(`✅ Direct manager_id UPDATE. Rows affected: ${directUpdate.rowCount}`);
          if (directUpdate.rowCount > 0) {
            // Mark as successful
            employeeExists = true;
      } else {
            // If still 0 rows, employee record doesn't exist - create it
            console.warn('⚠️ Employee record still not found. Creating with manager_id...');
            try {
              const userInfo = await database.query(
                'SELECT email, COALESCE(first_name || \' \' || last_name, first_name, last_name, email) as name FROM users WHERE user_id = $1',
                [userId]
              );
              if (userInfo.rows.length > 0) {
                const createResult = await database.query(
                  `INSERT INTO employees (user_id, role, manager_id)
                   VALUES ($1, $2, $3)
                   RETURNING employee_id, manager_id`,
                  [userId, normalizedRole || 'employee', hodEmployeeId]
                );
                if (createResult.rows.length > 0) {
                  console.log(`✅ Created employee record with manager_id: ${createResult.rows[0].manager_id}`);
                  employeeExists = true;
                }
              }
            } catch (createError) {
              console.error('❌ Failed to create employee record:', createError.message);
            }
          }
        } catch (directError) {
          console.warn('⚠️ Direct UPDATE also failed:', directError.message);
        }
      }
      
      if (empUpdateResult.rowCount === 0 || !employeeExists) {
        console.warn('⚠️ No rows were updated in employees table. Employee record might not exist. Attempting to insert/upsert...');
        // Try to insert/upsert the employee record
        try {
          const insertHodEmployeeId = hodEmployeeId;
          console.log(`📝 Using HOD employee_id for insert: ${insertHodEmployeeId || 'NULL'}`);
          
          // First try with ON CONFLICT (user_id) if unique constraint exists
          try {
            // Get user email and name for insert if not provided
            let userEmail = email;
            let userName = full_name;
            if (!userEmail || !userName) {
              try {
                const userInfo = await database.query(
                  'SELECT email, COALESCE(first_name || \' \' || last_name, first_name, last_name, email) as name FROM users WHERE user_id = $1',
                  [userId]
                );
                if (userInfo.rows.length > 0) {
                  userEmail = userEmail || userInfo.rows[0].email;
                  userName = userName || userInfo.rows[0].name;
                }
              } catch (userErr) {
                console.warn('Could not fetch user info:', userErr.message);
              }
            }
            
            // Try INSERT without email (email column might not exist)
            let insertResult;
            try {
              insertResult = await database.query(
                `INSERT INTO employees (user_id, role, location, team, designation, manager_id)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (user_id) DO UPDATE SET
                   role = EXCLUDED.role,
                   location = EXCLUDED.location,
                   team = EXCLUDED.team,
                   designation = EXCLUDED.designation,
                   manager_id = EXCLUDED.manager_id,
                   updated_at = NOW()`,
                [
                  userId,
                  normalizedRole || 'employee',
                  location || null,
                  department || null,
                  designation || null,
                  insertHodEmployeeId || null
                ]
              );
            } catch (noEmailError) {
              if (noEmailError.code === '42703' || noEmailError.message.includes('column') || noEmailError.message.includes('email')) {
                // email column doesn't exist, try without it (and without full_name)
                await database.query(
                  `INSERT INTO employees (user_id, role, location, team, designation, manager_id)
                   VALUES ($1, $2, $3, $4, $5, $6)
                   RETURNING employee_id`,
                  [
                    userId,
                    normalizedRole || 'employee',
                    location || null,
                    department || null,
                    designation || null,
                    insertHodEmployeeId || null
                  ]
                );
              } else {
                throw noEmailError;
              }
            }
            console.log(`✅ Employee record inserted/upserted successfully. Rows affected: ${insertResult.rowCount || 'N/A'}`);
            console.log(`✅ manager_id saved: ${insertHodEmployeeId || 'NULL'}`);
          } catch (conflictError) {
            // If ON CONFLICT fails (no unique constraint), try simple INSERT then UPDATE
            if (conflictError.code === '42704' || conflictError.message.includes('conflict')) {
              console.log('📝 ON CONFLICT not supported, trying INSERT then UPDATE...');
              try {
                // Try INSERT first
          await database.query(
            `INSERT INTO employees (user_id, role, location, team, designation, manager_id)
                   VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              userId,
              normalizedRole || 'employee',
              location || null,
              department || null,
              designation || null,
              insertHodEmployeeId || null
            ]
          );
                console.log('✅ Employee record inserted successfully');
        } catch (insertError) {
                // If INSERT fails (duplicate), try UPDATE
                if (insertError.code === '23505' || insertError.message.includes('duplicate') || insertError.message.includes('unique')) {
                  console.log('📝 Duplicate key detected, trying UPDATE instead...');
                  const updateResult = await database.query(
                    `UPDATE employees SET
                     email = $1,
                     full_name = $2,
                     role = $3,
                     location = $4,
                     team = $5,
                     designation = $6,
                     manager_id = $7,
                     updated_at = NOW()
                     WHERE user_id = $8`,
                    [
                      email || '',
                      full_name || '',
                      normalizedRole || 'employee',
                      location || null,
                      department || null,
                      designation || null,
                      insertHodEmployeeId || null,
                      userId
                    ]
                  );
                  console.log(`✅ Employee record updated successfully. Rows affected: ${updateResult.rowCount}`);
                } else {
                  throw insertError;
                }
              }
            } else {
              throw conflictError;
            }
          }
        } catch (insertError) {
          console.error('❌ Employee record insert/upsert failed:', insertError);
          console.error('Insert error details:', {
            message: insertError.message,
            code: insertError.code,
            detail: insertError.detail
          });
        }
      } else {
        // Update succeeded - verify manager_id was saved
        if (shouldUpdateManagerId && hodEmployeeId) {
          console.log(`\n🔵 STEP 4: Verifying manager_id was saved correctly`);
          const verifyResult = await database.query(
            'SELECT manager_id, employee_id FROM employees WHERE user_id = $1',
            [userId]
          );
          console.log(`🔍 Verification query returned ${verifyResult.rows.length} row(s)`);
          if (verifyResult.rows.length > 0) {
            const savedManagerId = verifyResult.rows[0].manager_id;
            const savedEmployeeId = verifyResult.rows[0].employee_id;
            console.log(`📊 Saved manager_id: ${savedManagerId} (expected: ${hodEmployeeId})`);
            console.log(`📊 Employee record employee_id: ${savedEmployeeId}`);
            if (!savedManagerId || savedManagerId.toString() !== hodEmployeeId.toString()) {
              console.warn(`⚠️ STEP 4 MISMATCH: manager_id mismatch after UPDATE!`);
              console.warn(`⚠️ Expected: ${hodEmployeeId}, Got: ${savedManagerId}`);
              console.warn(`⚠️ Attempting to fix...`);
              // Try to fix it with a direct UPDATE
              try {
                const fixResult = await database.query(
                  'UPDATE employees SET manager_id = $1, updated_at = NOW() WHERE user_id = $2',
                  [hodEmployeeId, userId]
                );
                console.log(`🔧 STEP 4 FIX: Fixed manager_id. Rows affected: ${fixResult.rowCount}`);
                
                // Verify again after fix
                const verifyAfterFix = await database.query(
                  'SELECT manager_id FROM employees WHERE user_id = $1',
                  [userId]
                );
                if (verifyAfterFix.rows.length > 0) {
                  console.log(`✅ STEP 4 FIX VERIFIED: manager_id is now ${verifyAfterFix.rows[0].manager_id}`);
                }
              } catch (fixError) {
                console.error('❌ STEP 4 FIX FAILED:', fixError.message);
              }
            } else {
              console.log(`✅ STEP 4 SUCCESS: manager_id correctly saved as ${savedManagerId}`);
            }
          } else {
            console.warn(`⚠️ STEP 4 WARNING: Employee record not found for verification`);
          }
        }
      }
    } catch (empError) {
      console.error('❌ Employees UPDATE failed:', empError);
      console.error('Error details:', {
        message: empError.message,
        code: empError.code,
        detail: empError.detail
      });
      // If employee record doesn't exist, create it
      if (empError.code === '42P01' || empError.message.includes('does not exist')) {
        // Table doesn't exist, skip
        console.warn('Employees table not found, skipping employee update');
      } else {
        // Try to insert if update didn't affect any rows
        console.log('📝 Employee record not found or update failed. Attempting to insert/upsert...');
        try {
          // Use the same hodEmployeeId we calculated earlier
          const insertHodEmployeeId = hodEmployeeId;
          console.log(`📝 Using HOD employee_id for insert: ${insertHodEmployeeId || 'NULL'}`);
          
          // Try INSERT with ON CONFLICT first
          try {
          // Try INSERT without email (email column might not exist)
          try {
            await database.query(
              `INSERT INTO employees (user_id, role, location, team, designation, manager_id)
               VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (user_id) DO UPDATE SET
               role = EXCLUDED.role,
               location = EXCLUDED.location,
               team = EXCLUDED.team,
               designation = EXCLUDED.designation,
                 manager_id = EXCLUDED.manager_id,
                 updated_at = NOW()`,
            [
              userId,
                normalizedRole || 'employee',
                location || null,
                department || null,
                designation || null,
                insertHodEmployeeId || null
              ]
          );
          } catch (noEmailError) {
            if (noEmailError.code === '42703' || noEmailError.message.includes('column') || noEmailError.message.includes('email')) {
              // email column doesn't exist, try without it (and without full_name)
              await database.query(
                `INSERT INTO employees (user_id, role, location, team, designation, manager_id)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [
                  userId,
                  normalizedRole || 'employee',
                  location || null,
                  department || null,
                  designation || null,
                  insertHodEmployeeId || null
                ]
              );
            } else {
              throw noEmailError;
            }
          }
            console.log('✅ Employee record inserted/updated successfully with manager_id (ON CONFLICT)');
          } catch (conflictError) {
            // If ON CONFLICT fails (no unique constraint), try simple INSERT then UPDATE
            if (conflictError.code === '42704' || conflictError.message.includes('conflict') || conflictError.message.includes('constraint')) {
              console.log('📝 ON CONFLICT not supported, trying simple INSERT then UPDATE...');
              try {
                // Try INSERT first (without email column)
                await database.query(
                  `INSERT INTO employees (user_id, role, location, team, designation, manager_id)
                   VALUES ($1, $2, $3, $4, $5, $6)`,
                  [
                    userId,
                    normalizedRole || 'employee',
                    location || null,
                    department || null,
                    designation || null,
                    insertHodEmployeeId || null
                  ]
                );
                console.log('✅ Employee record inserted successfully with manager_id');
        } catch (insertError) {
                // If INSERT fails (duplicate), do UPDATE
                if (insertError.code === '23505' || insertError.message.includes('duplicate')) {
                  console.log('📝 Duplicate detected, doing UPDATE instead...');
                  await database.query(
                    `UPDATE employees SET
                     email = $1,
                     full_name = $2,
                     role = $3,
                     location = $4,
                     team = $5,
                     designation = $6,
                     manager_id = $7,
                     updated_at = NOW()
                     WHERE user_id = $8`,
                    [
              email || '',
              full_name || '',
              normalizedRole || 'employee',
              location || null,
              department || null,
              designation || null,
                      insertHodEmployeeId || null,
                      userId
                    ]
                  );
                  console.log('✅ Employee record updated successfully with manager_id');
                } else {
                  throw insertError;
                }
              }
            } else {
              throw conflictError;
            }
          }
        } catch (insertError) {
          console.error('❌ Employee record insert/update failed:', insertError);
          console.error('Insert error details:', {
            message: insertError.message,
            code: insertError.code,
            detail: insertError.detail
          });
        }
      }
    }

    // Final verification: Check if manager_id was saved correctly
    if (hod_id !== undefined && hod_id && hod_id !== '') {
      try {
        console.log(`\n🔵 STEP 5: Final verification (after all operations)`);
        // Wait a moment for any async operations to complete
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const finalCheck = await database.query(
          'SELECT manager_id, employee_id FROM employees WHERE user_id = $1',
          [userId]
        );
        console.log(`🔍 Final check query returned ${finalCheck.rows.length} row(s)`);
        if (finalCheck.rows.length > 0) {
          const savedManagerId = finalCheck.rows[0].manager_id;
          const employeeId = finalCheck.rows[0].employee_id;
          console.log(`📊 Final verification results:`);
          console.log(`   - Employee ID: ${employeeId}`);
          console.log(`   - Saved manager_id: ${savedManagerId}`);
          console.log(`   - Expected manager_id: ${hodEmployeeId}`);
          console.log(`   - Match: ${savedManagerId?.toString() === hodEmployeeId?.toString() ? '✅ YES' : '❌ NO'}`);
          
          if (!savedManagerId && hodEmployeeId) {
            console.error(`❌ CRITICAL: manager_id was NOT saved! Expected: ${hodEmployeeId}, Got: ${savedManagerId}`);
            console.error(`❌ Attempting final fix with direct UPDATE...`);
            // Try one more time to update manager_id - this is critical
            try {
              const fixResult = await database.query(
                'UPDATE employees SET manager_id = $1, updated_at = NOW() WHERE user_id = $2',
                [hodEmployeeId, userId]
              );
              console.log(`🔧 Final fix attempt. Rows affected: ${fixResult.rowCount}`);
              
              // Verify again after fix
              if (fixResult.rowCount > 0) {
                const verifyAfterFix = await database.query(
                  'SELECT manager_id FROM employees WHERE user_id = $1',
                  [userId]
                );
                if (verifyAfterFix.rows.length > 0 && verifyAfterFix.rows[0].manager_id) {
                  console.log(`✅ SUCCESS: manager_id fixed and verified: ${verifyAfterFix.rows[0].manager_id}`);
                }
              }
            } catch (fixError) {
              console.error('❌ Failed to fix manager_id:', fixError.message);
              console.error('Fix error details:', {
                code: fixError.code,
                detail: fixError.detail
              });
            }
          } else if (savedManagerId && savedManagerId.toString() !== hodEmployeeId?.toString()) {
            console.warn(`⚠️ manager_id mismatch: Saved ${savedManagerId}, Expected ${hodEmployeeId}`);
            // Try to fix the mismatch
            try {
              const fixResult = await database.query(
                'UPDATE employees SET manager_id = $1, updated_at = NOW() WHERE user_id = $2',
                [hodEmployeeId, userId]
              );
              console.log(`🔧 Fixed manager_id mismatch. Rows affected: ${fixResult.rowCount}`);
            } catch (fixError) {
              console.error('❌ Failed to fix manager_id mismatch:', fixError.message);
            }
          } else if (savedManagerId) {
            console.log(`✅ STEP 5 SUCCESS: manager_id correctly saved as ${savedManagerId}`);
            
            // Final check: Verify HOD will appear in employee list
            console.log(`\n🔵 STEP 6: Verifying HOD will appear in employee list...`);
            try {
              const hodDisplayCheck = await database.query(
                `SELECT 
                  e.employee_id,
                  e.manager_id,
                  hod_e.employee_id as hod_employee_id,
                  hod_u.email as hod_email,
                  COALESCE(
                    NULLIF(TRIM(hod_u.first_name || ' ' || COALESCE(hod_u.last_name, '')), ''),
                    hod_u.email
                  ) as hod_name
                FROM employees e
                LEFT JOIN employees hod_e ON hod_e.employee_id = e.manager_id
                LEFT JOIN users hod_u ON hod_u.user_id = hod_e.user_id
                WHERE e.user_id = $1`,
                [userId]
              );
              
              if (hodDisplayCheck.rows.length > 0) {
                const check = hodDisplayCheck.rows[0];
                console.log(`📊 Employee list display check:`);
                console.log(`   - Employee ID: ${check.employee_id}`);
                console.log(`   - Manager ID: ${check.manager_id}`);
                console.log(`   - HOD Employee ID: ${check.hod_employee_id}`);
                console.log(`   - HOD Name: ${check.hod_name || 'NULL'}`);
                console.log(`   - HOD Email: ${check.hod_email || 'NULL'}`);
                if (check.hod_name && check.hod_email) {
                  console.log(`✅ STEP 6 SUCCESS: HOD "${check.hod_name}" (${check.hod_email}) will appear in employee list!`);
                } else {
                  console.warn(`⚠️ STEP 6 WARNING: HOD info is NULL - may not display in employee list`);
                }
              }
            } catch (displayError) {
              console.warn(`⚠️ STEP 6: Could not verify display: ${displayError.message}`);
            }
            
            console.log(`🔵 ========== HOD ASSIGNMENT COMPLETE ==========\n`);
          }
        } else {
          console.warn('⚠️ STEP 5 WARNING: Employee record not found after update - attempting to create it...');
          // If employee record doesn't exist, create it with manager_id
          if (hodEmployeeId) {
            try {
              // Get user info first
              const userInfo = await database.query(
                'SELECT email, COALESCE(first_name || \' \' || last_name, first_name, last_name, email) as name FROM users WHERE user_id = $1',
                [userId]
              );
              
              if (userInfo.rows.length > 0) {
                // Try INSERT without email (email column might not exist)
                let createResult;
                try {
                  createResult = await database.query(
                    `INSERT INTO employees (user_id, role, manager_id)
                     VALUES ($1, $2, $3)
                     RETURNING employee_id, manager_id`,
                    [userId, normalizedRole || 'employee', hodEmployeeId]
                  );
                } catch (noEmailError) {
                  if (noEmailError.code === '42703' || noEmailError.message.includes('column')) {
                    // Some columns don't exist, try with minimal fields
                    try {
                      createResult = await database.query(
                        `INSERT INTO employees (user_id, role, manager_id)
                         VALUES ($1, $2, $3)
                         RETURNING employee_id, manager_id`,
                        [userId, normalizedRole || 'employee', hodEmployeeId]
                      );
                    } catch (minError) {
                      // If even that fails, try with just user_id and manager_id
                      if (minError.code === '42703' || minError.message.includes('column') || minError.message.includes('role')) {
                        createResult = await database.query(
                          `INSERT INTO employees (user_id, manager_id)
                           VALUES ($1, $2)
                           RETURNING employee_id, manager_id`,
                          [userId, hodEmployeeId]
                        );
                      } else {
                        throw minError;
                      }
                    }
                  } else {
                    throw noEmailError;
                  }
                }
                
                if (createResult.rows.length > 0) {
                  console.log(`✅ Created employee record with manager_id: ${createResult.rows[0].manager_id}`);
                }
              }
            } catch (createError) {
              console.error('❌ Failed to create employee record in final verification:', createError.message);
            }
          }
        }
      } catch (verifyError) {
        console.error('❌ Failed to verify manager_id:', verifyError.message);
      }
    }

    return {
      message: "Employee updated successfully",
      user: {
        id: userId,
        email: email,
        full_name: full_name,
        role: normalizedRole
      }
    };
  } catch (error) {
    console.error('UpdateEmployeeService error:', error);
    if (error.status) throw error;
    throw CreateError("Failed to update employee", 500);
  }
};

/**
 * Delete Employee (Admin only)
 */
export const DeleteEmployeeService = async (Request) => {
  const { userId } = Request.params;

  if (!userId) {
    throw CreateError("User ID is required", 400);
  }

  // Ensure userId is an integer (URL params are strings)
  const userIdInt = parseInt(userId, 10);
  if (isNaN(userIdInt)) {
    throw CreateError("Invalid user ID format", 400);
  }

  try {
    // Check if user exists
    const userResult = await database.query(
      'SELECT user_id, email, role FROM users WHERE user_id = $1',
      [userIdInt]
    );

    if (userResult.rows.length === 0) {
      throw CreateError("User not found", 404);
    }

    const user = userResult.rows[0];

    // Check if user has pending leave applications
    const leaveCheck = await database.query(
      `SELECT COUNT(*) as count FROM leave_applications la
       JOIN employees e ON la.employee_id = e.employee_id
       WHERE e.user_id = $1 AND (la.hod_status = 'Pending' OR la.admin_status = 'Pending')`,
      [userIdInt]
    );

    const pendingLeaves = parseInt(leaveCheck.rows[0]?.count || 0);
    if (pendingLeaves > 0) {
      throw CreateError(`Cannot delete employee: ${pendingLeaves} pending leave application(s) exist. Please process or delete leaves first.`, 400);
    }

    // Delete employee record first (if exists)
    try {
      await database.query(
        'DELETE FROM employees WHERE user_id = $1',
        [userIdInt]
      );
    } catch (empError) {
      console.warn('Error deleting employee record:', empError.message);
      // Continue even if employee record doesn't exist
    }

    // Soft delete user by setting status = 'Inactive'
    const result = await database.query(
      `UPDATE users SET status = 'Inactive', updated_at = NOW() WHERE user_id = $1 RETURNING user_id, email`,
      [userIdInt]
    );

    return {
      message: "Employee deleted successfully",
      data: result.rows[0]
    };
  } catch (error) {
    console.error('DeleteEmployeeService error:', error);
    if (error.status) throw error;
    throw CreateError("Failed to delete employee", 500);
  }
};

