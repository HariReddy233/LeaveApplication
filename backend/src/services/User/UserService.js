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
                   NULLIF(TRIM(u.first_name || ' ' || COALESCE(u.last_name, '')), ''),
                   NULLIF(TRIM(COALESCE(u.first_name, '')), ''),
                   u.email
                 ) as full_name,
                 u.email,
                 u.phone_number,
                 e.location, 
                 u.department as team,
                 u.department,
                 e.manager_id,
                 e.admin_id,
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
                 ) as hod_name,
                 admin_u.email as admin_email,
                 COALESCE(
                   NULLIF(TRIM(admin_u.first_name || ' ' || COALESCE(admin_u.last_name, '')), ''),
                   admin_u.email
                 ) as admin_name
               FROM users u
               LEFT JOIN employees e ON e.user_id = u.user_id
               LEFT JOIN employees admin_e ON admin_e.employee_id = e.admin_id
               LEFT JOIN users admin_u ON admin_u.user_id = admin_e.user_id 
                 AND LOWER(TRIM(COALESCE(admin_u.role, ''))) = 'admin'
               WHERE u.role IS NOT NULL 
               AND (u.status = 'Active' OR u.status IS NULL OR u.status = '')`;
    const params = [];
    let paramCount = 1;

    if (location && location !== 'All' && location !== '') {
      // Filter by location from employees table
      query += ` AND e.location = $${paramCount}`;
      params.push(location);
      paramCount++;
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
    
    // Debug: Log employees with admin_id to verify admin assignment
    const employeesWithAdmin = result.rows.filter(r => r.admin_id);
    console.log(`📊 Employees with admin_id: ${employeesWithAdmin.length}`);
    if (employeesWithAdmin.length > 0) {
      console.log('📊 Employees with admin_id assigned:', employeesWithAdmin.map(e => ({
        name: e.full_name,
        email: e.email,
        role: e.role,
        admin_id: e.admin_id,
        admin_name: e.admin_name,
        admin_email: e.admin_email,
        hasAdminInfo: !!(e.admin_name || e.admin_email)
      })));
    } else {
      console.log('⚠️ No employees found with admin_id assigned');
    }
    
    // Debug: Log HODs specifically to check admin assignment
    const hods = result.rows.filter(r => r.role && r.role.toLowerCase() === 'hod');
    console.log(`📊 Total HODs found: ${hods.length}`);
    if (hods.length > 0) {
      console.log('📊 HOD admin assignments:', hods.map(h => ({
        name: h.full_name,
        email: h.email,
        admin_id: h.admin_id,
        admin_name: h.admin_name,
        admin_email: h.admin_email,
        hasAdmin: !!(h.admin_id && (h.admin_name || h.admin_email))
      })));
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
    
    // Test: Verify admin_id is being returned correctly
    console.log('\n🔍 TEST: Checking admin_id in response...');
    const testHods = result.rows.filter(r => r.role && (r.role.toLowerCase() === 'hod' || r.role.toLowerCase() === 'h.o.d'));
    if (testHods.length > 0) {
      console.log(`✅ Found ${testHods.length} HOD(s) in response`);
      testHods.forEach((hod, index) => {
        console.log(`\n📋 HOD #${index + 1}:`, {
          name: hod.full_name,
          email: hod.email,
          user_id: hod.user_id,
          role: hod.role,
          admin_id: hod.admin_id,
          admin_id_type: typeof hod.admin_id,
          admin_name: hod.admin_name,
          admin_email: hod.admin_email,
          hasAdminId: !!hod.admin_id,
          hasAdminName: !!hod.admin_name,
          hasAdminEmail: !!hod.admin_email
        });
      });
    } else {
      console.log('⚠️ No HODs found in response to test admin assignment');
    }
    console.log('🔍 TEST: End of admin_id check\n');
    
    // CRITICAL: Ensure admin_id, admin_name, and admin_email are always in response
    // Map the results to guarantee these fields exist (even if NULL)
    const mappedResults = result.rows.map(row => ({
      ...row,
      admin_id: row.admin_id ?? null,
      admin_name: row.admin_name ?? null,
      admin_email: row.admin_email ?? null,
    }));
    
    console.log(`\n✅ Mapped ${mappedResults.length} results with guaranteed admin fields`);
    // Log sample to verify
    const sampleHod = mappedResults.find(r => r.role && r.role.toLowerCase() === 'hod');
    if (sampleHod) {
      console.log(`📋 Sample HOD in response:`, {
        name: sampleHod.full_name,
        email: sampleHod.email,
        admin_id: sampleHod.admin_id,
        admin_name: sampleHod.admin_name,
        admin_email: sampleHod.admin_email
      });
    }
    
    return mappedResults;
  } catch (error) {
    // Fallback: try simpler query with just users table (no join)
    try {
      const result = await database.query(
        `SELECT 
          u.user_id,
          u.user_id::text as id,
          u.user_id::text as employee_id,
          COALESCE(
            NULLIF(TRIM(u.first_name || ' ' || COALESCE(u.last_name, '')), ''),
            NULLIF(TRIM(COALESCE(u.first_name, '')), ''),
            u.email
          ) as full_name,
          u.email,
          u.phone_number,
          COALESCE(u.role, 'employee') as role,
          u.department as team,
          u.department,
          u.designation,
          e.location,
          e.manager_id,
          e.admin_id,
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
          admin_u.email as admin_email,
          COALESCE(
            NULLIF(TRIM(admin_u.first_name || ' ' || COALESCE(admin_u.last_name, '')), ''),
            admin_u.email
          ) as admin_name
         FROM users u
         LEFT JOIN employees e ON e.user_id = u.user_id
         LEFT JOIN employees admin_e ON admin_e.employee_id = e.admin_id
         LEFT JOIN users admin_u ON admin_u.user_id = admin_e.user_id 
           AND LOWER(TRIM(COALESCE(admin_u.role, ''))) = 'admin'
         WHERE u.role IS NOT NULL 
         AND (u.status = 'Active' OR u.status IS NULL OR u.status = '')
         ORDER BY COALESCE(
           NULLIF(TRIM(COALESCE(u.first_name, '')), ''),
           NULLIF(TRIM(u.first_name || ' ' || COALESCE(u.last_name, '')), ''),
           u.email
         ) ASC
         LIMIT 1000`
      );
      console.log(`Fallback query returned ${result.rows.length} rows`);
      
      // CRITICAL: Ensure admin_id, admin_name, and admin_email are always in response
      const mappedFallbackResults = result.rows.map(row => ({
        ...row,
        admin_id: row.admin_id ?? null,
        admin_name: row.admin_name ?? null,
        admin_email: row.admin_email ?? null,
      }));
      
      return mappedFallbackResults;
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
    `SELECT 
     e.employee_id, 
          COALESCE(
            NULLIF(TRIM(u.first_name || ' ' || COALESCE(u.last_name, '')), ''),
            NULLIF(TRIM(COALESCE(u.first_name, '')), ''),
            u.email
          ) as full_name,
     u.email, 
     u.phone_number,
     e.location, 
     e.team, 
     e.manager_id,
     e.admin_id,
     u.role,
     u.designation,
     u.department,
     (
       SELECT hod_u.email 
       FROM employees hod_e 
       JOIN users hod_u ON hod_u.user_id = hod_e.user_id 
       WHERE hod_e.employee_id = e.manager_id
         AND LOWER(TRIM(COALESCE(hod_u.role, ''))) = 'hod'
       LIMIT 1
     ) as hod_email,
     (
       SELECT admin_u.email 
       FROM employees admin_e 
       JOIN users admin_u ON admin_u.user_id = admin_e.user_id 
       WHERE admin_e.employee_id = e.admin_id
         AND LOWER(TRIM(COALESCE(admin_u.role, ''))) = 'admin'
       LIMIT 1
     ) as admin_email
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
    
    // Ensure all Admins have employee records - create them if missing
    for (const admin of result.rows) {
      if (!admin.employee_id) {
        try {
          const createResult = await database.query(
            `INSERT INTO employees (user_id, role)
             VALUES ($1, 'admin')
             ON CONFLICT (user_id) DO UPDATE SET
               role = 'admin'
             RETURNING employee_id`,
            [admin.user_id]
          );
          
          if (createResult.rows.length > 0 && createResult.rows[0].employee_id) {
            admin.employee_id = createResult.rows[0].employee_id;
          } else {
            // If RETURNING didn't work, fetch it
            const fetchResult = await database.query(
              'SELECT employee_id FROM employees WHERE user_id = $1',
              [admin.user_id]
            );
            if (fetchResult.rows.length > 0) {
              admin.employee_id = fetchResult.rows[0].employee_id;
            }
          }
        } catch (createError) {
          // If INSERT fails (duplicate), fetch existing
          if (createError.code === '23505' || createError.message.includes('duplicate') || createError.message.includes('unique')) {
            const existing = await database.query(
              'SELECT employee_id FROM employees WHERE user_id = $1',
              [admin.user_id]
            );
            if (existing.rows.length > 0) {
              admin.employee_id = existing.rows[0].employee_id;
            }
          } else {
            console.warn(`Failed to create employee record for Admin ${admin.email}:`, createError.message);
          }
        }
      }
    }
    
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

  // Note: Role is stored in users table, not employees table
  // Employee record update is not needed for role changes
  // The role has already been updated in the users table above

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
            NULLIF(TRIM(u.first_name || ' ' || COALESCE(u.last_name, '')), ''),
            NULLIF(TRIM(COALESCE(u.first_name, '')), ''),
            u.email
          ) as full_name,
        u.role as role,
        u.status,
        e.employee_id,
        u.department as team,
        u.department,
        e.location,
        u.designation,
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
        admin_u.email as admin_email,
        COALESCE(
          NULLIF(TRIM(admin_u.first_name || ' ' || COALESCE(admin_u.last_name, '')), ''),
          admin_u.email
        ) as admin_name
       FROM users u
       LEFT JOIN employees e ON e.user_id = u.user_id
       LEFT JOIN employees admin_e ON admin_e.employee_id = e.admin_id
       LEFT JOIN users admin_u ON admin_u.user_id = admin_e.user_id 
         AND LOWER(TRIM(COALESCE(admin_u.role, ''))) = 'admin'
       WHERE u.role IS NOT NULL
       AND (u.status = 'Active' OR u.status IS NULL OR u.status = '')
       ORDER BY COALESCE(
         NULLIF(TRIM(COALESCE(u.first_name, '')), ''),
         NULLIF(TRIM(u.first_name || ' ' || COALESCE(u.last_name, '')), ''),
         u.email
       ) ASC`
    );

    // CRITICAL: Ensure admin_id, admin_name, and admin_email are always in response
    const mappedRows = result.rows.map(row => ({
      ...row,
      admin_id: row.admin_id ?? null,
      admin_name: row.admin_name ?? null,
      admin_email: row.admin_email ?? null,
    }));
    
    console.log(`\n✅ GetAllUsersService: Mapped ${mappedRows.length} results with guaranteed admin fields`);
    // Log sample HOD to verify
    const sampleHod = mappedRows.find(r => r.role && (r.role.toLowerCase() === 'hod' || r.role.toLowerCase() === 'h.o.d'));
    if (sampleHod) {
      console.log(`📋 Sample HOD in GetAllUsersService response:`, {
        name: sampleHod.full_name,
        email: sampleHod.email,
        admin_id: sampleHod.admin_id,
        admin_name: sampleHod.admin_name,
        admin_email: sampleHod.admin_email
      });
    }

    return {
      Data: mappedRows
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

    // Update designation in users table (NOT in employees table)
    if (designation !== undefined) {
      userUpdateQuery += `, designation = $${paramCount}`;
      userParams.push(designation || null);
      paramCount++;
    }

    // Update phone_number in users table
    // NOTE: Phone number does NOT affect location or country_code
    // Location is ONLY set from the location dropdown field
    if (phone_number !== undefined) {
      userUpdateQuery += `, phone_number = $${paramCount}`;
      userParams.push(phone_number || null);
      paramCount++;
    }

    // Handle full_name - split into first_name and last_name, preserving spaces
    if (full_name) {
      // Trim the name but preserve internal spaces (don't collapse multiple spaces)
      const trimmedName = full_name.trim();
      const nameParts = trimmedName.split(/\s+/);
      const firstName = nameParts[0] || '';
      // Join all remaining parts as last name (preserves spaces between words)
      // This handles names like "John  Middle  Last" -> first_name="John", last_name="Middle Last"
      const lastName = nameParts.slice(1).join(' ').trim() || '';
      
      console.log(`📝 Processing name: "${full_name}" -> first_name: "${firstName}", last_name: "${lastName}"`);
      
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
        
        if (designation !== undefined) {
          retryQuery += `, designation = $${retryCount}`;
          retryParams.push(designation || null);
          retryCount++;
        }
        
        if (phone_number !== undefined) {
          retryQuery += `, phone_number = $${retryCount}`;
          retryParams.push(phone_number || null);
          retryCount++;
        }
        
        if (full_name) {
          // Normalize the name (trim and handle multiple spaces)
          const normalizedName = full_name.trim().replace(/\s+/g, ' ');
          retryQuery += `, full_name = $${retryCount}`;
          retryParams.push(normalizedName);
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
    
    // Verify name was updated correctly
    if (full_name) {
      try {
        const verifyNameResult = await database.query(
          'SELECT first_name, last_name, full_name FROM users WHERE user_id = $1',
          [userId]
        );
        if (verifyNameResult.rows.length > 0) {
          const dbFirstName = verifyNameResult.rows[0].first_name || '';
          const dbLastName = verifyNameResult.rows[0].last_name || '';
          const dbFullName = verifyNameResult.rows[0].full_name || '';
          const reconstructedName = (dbFirstName + ' ' + dbLastName).trim() || dbFullName;
          console.log(`✅ Name update verified: first_name="${dbFirstName}", last_name="${dbLastName}", full_name="${dbFullName}", reconstructed="${reconstructedName}"`);
        }
      } catch (verifyError) {
        console.warn('⚠️ Could not verify name update:', verifyError.message);
      }
    }

    // Update employees table
    // Always start with updated_at, even if no other fields are being updated
    let empUpdateQuery = 'UPDATE employees SET updated_at = NOW()';
    const empParams = [];
    paramCount = 1;
    
    // Track if we have any fields to update (besides manager_id)
    let hasOtherFields = false;

    // Note: email, full_name, and role are in users table, not employees table
    // They are already handled in the users table update above
    // Do NOT update email, full_name, or role in employees table

    // Track normalized location for logging
    let normalizedLocation = null;
    let shouldUpdateLocation = false;
    
    // CRITICAL: Location is ONLY set from the location dropdown field
    // Phone number does NOT affect location or country_code
    // Check if location is provided (even if null or empty string)
    // IMPORTANT: Always process location if it's in the request body (even if null or empty string)
    if (location !== undefined) {
      // Normalize location: Accept IN/US directly, or normalize legacy values
      // Store ONLY "IN" or "US" in database
      if (location === null || location === '') {
        // Explicitly null or empty string - clear location
        normalizedLocation = null;
        shouldUpdateLocation = true;
      } else {
        const locationStr = String(location).trim();
        if (locationStr) {
          const locationUpper = locationStr.toUpperCase();
          // Accept IN or US directly (from dropdown)
          if (locationUpper === 'IN' || locationUpper === 'US') {
            normalizedLocation = locationUpper;
            shouldUpdateLocation = true;
          } else {
            // Normalize legacy values for backward compatibility
            const locationLower = locationStr.toLowerCase();
            if (locationLower === 'in' || locationLower.includes('india')) {
              normalizedLocation = 'IN';
              shouldUpdateLocation = true;
            } else if (locationLower === 'us' || locationLower.includes('united states') || locationLower.includes('miami')) {
              normalizedLocation = 'US';
              shouldUpdateLocation = true;
            } else {
              // If invalid value, set to null but still update
              normalizedLocation = null;
              shouldUpdateLocation = true;
            }
          }
        } else {
          // Empty string after trim - set to null but still update
          normalizedLocation = null;
          shouldUpdateLocation = true;
        }
      }
    }
    
    // ALWAYS include location in UPDATE query when location field is provided
    if (shouldUpdateLocation) {
      empUpdateQuery += `, location = $${paramCount}`;
      empParams.push(normalizedLocation);
      paramCount++;
      hasOtherFields = true;
      
      console.log(`📍 Location update: original="${location}", normalized="${normalizedLocation}"`);
      
      // Auto-set country_code based on normalized location ONLY
      // Phone number does NOT affect this
      if (normalizedLocation) {
        try {
          await database.query(
            `UPDATE users SET country_code = $1 WHERE user_id = $2`,
            [normalizedLocation, userId]
          );
          console.log(`✅ Auto-set country_code to ${normalizedLocation} for user ${userId} based on location dropdown: ${location} → ${normalizedLocation}`);
        } catch (countryCodeError) {
          console.warn('Could not update country_code:', countryCodeError.message);
        }
      } else {
        // If location is being cleared, also clear country_code
        try {
          await database.query(
            `UPDATE users SET country_code = NULL WHERE user_id = $1`,
            [userId]
          );
          console.log(`✅ Cleared country_code for user ${userId} (location was cleared)`);
        } catch (countryCodeError) {
          console.warn('Could not clear country_code:', countryCodeError.message);
        }
      }
    }

    if (department !== undefined) {
      empUpdateQuery += `, team = $${paramCount}`;
      empParams.push(department || null);
      paramCount++;
      hasOtherFields = true;
    }

    // NOTE: designation is in users table, not employees table
    // Do NOT add designation to employees UPDATE query
    // It will be handled in the users table UPDATE above

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
                  // Try INSERT with minimal fields (role column doesn't exist in employees table)
                  let createEmpResult;
                  try {
                    // Note: role is stored in users table, not employees table
                    createEmpResult = await database.query(
                      `INSERT INTO employees (user_id)
                       VALUES ($1)
                       RETURNING employee_id`,
                      [hodUser.user_id]
                    );
                  } catch (insertError) {
                    // If insert fails (duplicate), try to get existing record
                    if (insertError.code === '23505' || insertError.message.includes('duplicate')) {
                      const existingResult = await database.query(
                        'SELECT employee_id FROM employees WHERE user_id = $1',
                        [hodUser.user_id]
                      );
                      if (existingResult.rows.length > 0) {
                        createEmpResult = { rows: existingResult.rows };
                      } else {
                        throw insertError;
                      }
                    } else {
                      throw insertError;
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
    // CRITICAL: Always process admin_id if it's provided in the request OR if role is HOD
    let shouldUpdateAdminId = false;
    let adminEmployeeId = null;
    let finalAdminId = null; // Store final value for verification (declared at function scope)
    console.log(`\n🔵 ========== ADMIN ASSIGNMENT START ==========`);
    console.log(`🔵 User ID being updated: ${userId}`);
    console.log(`🔵 Received admin_id: ${admin_id} (type: ${typeof admin_id}, value: ${JSON.stringify(admin_id)})`);
    console.log(`🔵 Request body keys: ${Object.keys(Request.body).join(', ')}`);
    console.log(`🔵 Full request body: ${JSON.stringify(Request.body)}`);
    console.log(`🔵 Current role: ${normalizedRole || 'not provided'}`);
    console.log(`🔵 Final role: ${finalRole || 'not provided'}`);
    
    // CRITICAL: If role is HOD, we MUST process admin_id (even if not explicitly provided)
    // This ensures admin_id is always handled for HODs
    const isHodRole = finalRole === 'hod' || normalizedRole?.toLowerCase() === 'hod';
    
    // ALWAYS process admin_id if it's in the request body OR if role is HOD
    if (admin_id !== undefined || isHodRole) {
      shouldUpdateAdminId = true;
      if (admin_id !== undefined) {
        console.log(`✅ admin_id is provided in request (value: ${admin_id}), will update`);
      } else if (isHodRole) {
        console.log(`✅ Role is HOD but admin_id not in request - will process anyway (may be null)`);
        // If admin_id is not provided but role is HOD, set it to null explicitly
        // This allows clearing admin_id when needed
        admin_id = null;
      }
      
      if (admin_id && admin_id !== '' && admin_id !== null && admin_id !== 'null' && admin_id !== 'undefined') {
        console.log(`🔍 admin_id has a value (${admin_id}), processing...`);
        
        // CRITICAL: Frontend sends employee_id directly, so try to use it as-is first
        // Parse the admin_id to ensure it's a number
        const parsedAdminId = parseInt(admin_id, 10);
        
        if (!isNaN(parsedAdminId) && parsedAdminId > 0) {
          // Verify the employee_id exists in employees table
          try {
            const verifyEmp = await database.query(
              'SELECT employee_id, user_id FROM employees WHERE employee_id = $1',
              [parsedAdminId]
            );
            
            if (verifyEmp.rows.length > 0) {
              // Employee exists - use it directly (frontend already validated it's an Admin)
              adminEmployeeId = parsedAdminId;
              console.log(`✅ Using admin_id directly as employee_id: ${adminEmployeeId} (employee exists)`);
              
              // Optional: Verify it's actually an Admin (for logging only, don't fail if not)
              try {
                const roleCheck = await database.query(
                  'SELECT u.role FROM users u JOIN employees e ON e.user_id = u.user_id WHERE e.employee_id = $1',
                  [parsedAdminId]
                );
                if (roleCheck.rows.length > 0) {
                  const role = roleCheck.rows[0].role;
                  console.log(`   User role: ${role} (${role?.toLowerCase() === 'admin' ? '✅ Admin' : '⚠️ Not Admin, but using anyway'})`);
                }
              } catch (roleError) {
                console.warn('   Could not verify role, but proceeding with admin_id');
              }
            } else {
              console.warn(`⚠️ Employee with employee_id ${parsedAdminId} does not exist - will set to NULL`);
              adminEmployeeId = null;
            }
          } catch (verifyError) {
            console.error('❌ Error verifying employee_id:', verifyError.message);
            // Even if verification fails, if it's a valid number, use it
            adminEmployeeId = parsedAdminId;
            console.log(`⚠️ Verification failed, but using admin_id directly: ${adminEmployeeId}`);
          }
        } else {
          console.warn(`⚠️ admin_id is not a valid number: ${admin_id} - will set to NULL`);
          adminEmployeeId = null;
        }
      } else {
        // Empty string, null, or invalid value means clear the Admin assignment
        console.log(`📝 admin_id is empty/null/invalid (${admin_id}), will set admin_id to NULL`);
        adminEmployeeId = null;
      }
      
      // CRITICAL: Always add admin_id to UPDATE query if it was provided
      console.log(`\n🔵 STEP 2: Adding admin_id to UPDATE query`);
      console.log(`📝 admin_id value to save: ${adminEmployeeId || 'NULL'}`);
      console.log(`📝 Original admin_id from request: ${admin_id}`);
      console.log(`📝 Looked up adminEmployeeId: ${adminEmployeeId}`);
      
      // CRITICAL: If lookup failed but we have a valid admin_id value, try using it directly
      // This handles cases where the Admin exists but lookup query has issues
      if (!adminEmployeeId && admin_id && admin_id !== '' && admin_id !== null) {
        // Try to parse as integer (employee_id is usually an integer)
        const parsedAdminId = parseInt(admin_id, 10);
        if (!isNaN(parsedAdminId) && parsedAdminId > 0) {
          console.log(`⚠️ Admin lookup returned null, but admin_id value looks valid (${parsedAdminId}). Will try direct save.`);
          // Verify the Admin exists before using direct value
          try {
            const verifyAdmin = await database.query(
              'SELECT employee_id FROM employees WHERE employee_id = $1',
              [parsedAdminId]
            );
            if (verifyAdmin.rows.length > 0) {
              adminEmployeeId = parsedAdminId;
              console.log(`✅ Verified Admin exists with employee_id: ${adminEmployeeId}, using direct value`);
            } else {
              console.warn(`⚠️ Admin with employee_id ${parsedAdminId} does not exist, will save as NULL`);
            }
          } catch (verifyError) {
            console.error('❌ Error verifying Admin:', verifyError.message);
          }
        }
      }
      
      // CRITICAL: Ensure adminEmployeeId is properly converted
      // Convert empty string to null, and ensure it's a number or null
      finalAdminId = null; // Reset to null first (using function-scoped variable)
      if (adminEmployeeId !== null && adminEmployeeId !== undefined) {
        // If it's already a number, use it
        if (typeof adminEmployeeId === 'number') {
          finalAdminId = adminEmployeeId;
        } else if (typeof adminEmployeeId === 'string' && adminEmployeeId.trim() !== '') {
          // If it's a non-empty string, try to parse it
          const parsed = parseInt(adminEmployeeId, 10);
          if (!isNaN(parsed) && parsed > 0) {
            finalAdminId = parsed;
          }
        } else {
          // Try to convert to number if possible
          const parsed = parseInt(adminEmployeeId, 10);
          if (!isNaN(parsed) && parsed > 0) {
            finalAdminId = parsed;
          }
        }
      }
      
      // CRITICAL: Always add admin_id to UPDATE query - even if null (to allow clearing)
      empUpdateQuery += `, admin_id = $${paramCount}`;
      empParams.push(finalAdminId);
      console.log(`✅ Added admin_id = $${paramCount} to query`);
      console.log(`📝 Final admin_id value being saved: ${finalAdminId || 'NULL'} (type: ${typeof finalAdminId})`);
      console.log(`📝 Current query: ${empUpdateQuery}`);
      console.log(`📝 Current params (${empParams.length}): ${JSON.stringify(empParams)}`);
      console.log(`📝 Param at index ${paramCount - 1}: ${JSON.stringify(empParams[paramCount - 1])}`);
      paramCount++;
      hasOtherFields = true;
    } else {
      console.log('📝 admin_id is undefined in request, skipping admin_id update (keeping existing value)');
    }
    console.log(`🔵 ========== ADMIN ASSIGNMENT COMPLETE ==========\n`);
    
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
    console.log(`📝 Location being updated: ${location || 'NULL/EMPTY'}`);
    console.log(`📝 Normalized location: ${normalizedLocation || 'NULL'}`);
    console.log(`📝 Employee exists check: ${employeeExists}`);

    try {
      const empUpdateResult = await database.query(empUpdateQuery, empParams);
      console.log(`✅ STEP 3 RESULT: Employees table updated. Rows affected: ${empUpdateResult.rowCount}`);
      
      // CRITICAL: Verify and fix admin_id if it was supposed to be updated
      if (shouldUpdateAdminId) {
        console.log(`\n🔵 STEP 4: Verifying admin_id was saved correctly`);
        console.log(`📝 Expected admin_id value: ${finalAdminId || 'NULL'} (type: ${typeof finalAdminId})`);
        console.log(`📝 Original adminEmployeeId: ${adminEmployeeId || 'NULL'}`);
        try {
          // Wait a tiny bit to ensure transaction is committed
          await new Promise(resolve => setTimeout(resolve, 100));
          
          const verifyAdminResult = await database.query(
            'SELECT employee_id, admin_id, role FROM employees WHERE user_id = $1',
            [userId]
          );
          if (verifyAdminResult.rows.length > 0) {
            const savedAdminId = verifyAdminResult.rows[0].admin_id;
            const employeeId = verifyAdminResult.rows[0].employee_id;
            const employeeRole = verifyAdminResult.rows[0].role;
            // Use finalAdminId if available, otherwise fall back to adminEmployeeId
            const expectedAdminId = finalAdminId !== null && finalAdminId !== undefined ? finalAdminId : adminEmployeeId;
            console.log(`📝 VERIFY: employee_id: ${employeeId}, role: ${employeeRole}`);
            console.log(`📝 VERIFY: admin_id in database: ${savedAdminId || 'NULL'} (type: ${typeof savedAdminId}), expected: ${expectedAdminId || 'NULL'}`);
            console.log(`📝 finalAdminId: ${finalAdminId || 'NULL'}, adminEmployeeId: ${adminEmployeeId || 'NULL'}`);
            
            // Compare values (handling null/undefined and type conversion)
            const savedValue = savedAdminId === null || savedAdminId === undefined ? null : Number(savedAdminId);
            const expectedValue = expectedAdminId === null || expectedAdminId === undefined ? null : Number(expectedAdminId);
            
            if (savedValue !== expectedValue) {
              console.warn(`⚠️ ADMIN_ID MISMATCH DETECTED! Expected ${expectedValue || 'NULL'}, but got ${savedValue || 'NULL'}. Attempting to fix...`);
              console.warn(`   UPDATE query was: ${empUpdateQuery}`);
              console.warn(`   UPDATE params were: ${JSON.stringify(empParams)}`);
              try {
                // Use the final value we calculated
                const fixResult = await database.query(
                  'UPDATE employees SET admin_id = $1, updated_at = NOW() WHERE user_id = $2',
                  [expectedAdminId, userId]
                );
                console.log(`🔧 ADMIN_ID FIX: Direct UPDATE executed. Rows affected: ${fixResult.rowCount}`);
                
                // Verify the fix worked
                const verifyFixResult = await database.query(
                  'SELECT admin_id FROM employees WHERE user_id = $1',
                  [userId]
                );
                if (verifyFixResult.rows.length > 0) {
                  const fixedAdminId = verifyFixResult.rows[0].admin_id;
                  console.log(`✅ ADMIN_ID FIX VERIFIED: admin_id is now ${fixedAdminId || 'NULL'}`);
                }
              } catch (fixError) {
                console.error('❌ Failed to fix admin_id:', fixError.message);
                console.error('Fix error details:', fixError);
              }
            } else {
              console.log(`✅ VERIFIED: admin_id matches expected value (${savedValue || 'NULL'})`);
            }
          } else {
            console.warn(`⚠️ No employee record found for user_id: ${userId} to verify admin_id`);
          }
        } catch (verifyError) {
          console.error('❌ Failed to verify admin_id:', verifyError.message);
        }
      }
      
      // ALWAYS verify location was actually updated (even if normalizedLocation is null)
      if (location !== undefined && empUpdateResult.rowCount > 0) {
        const verifyResult = await database.query(
          'SELECT location FROM employees WHERE user_id = $1',
          [userId]
        );
        if (verifyResult.rows.length > 0) {
          const savedLocation = verifyResult.rows[0].location;
          console.log(`✅ VERIFIED: Location in database is now: ${savedLocation} (expected: ${normalizedLocation || 'NULL'})`);
          if (savedLocation !== normalizedLocation) {
            console.warn(`⚠️ LOCATION MISMATCH: Expected ${normalizedLocation || 'NULL'}, but got ${savedLocation}. Attempting to fix...`);
            // Try to fix it with a direct UPDATE
            try {
              const fixResult = await database.query(
                'UPDATE employees SET location = $1, updated_at = NOW() WHERE user_id = $2',
                [normalizedLocation, userId]
              );
              console.log(`🔧 LOCATION FIX: Direct UPDATE executed. Rows affected: ${fixResult.rowCount}`);
              // Verify again after fix
              const verifyAfterFix = await database.query(
                'SELECT location FROM employees WHERE user_id = $1',
                [userId]
              );
              if (verifyAfterFix.rows.length > 0) {
                console.log(`✅ LOCATION FIX VERIFIED: Location is now: ${verifyAfterFix.rows[0].location}`);
              }
            } catch (fixError) {
              console.error('❌ Failed to fix location:', fixError.message);
            }
          }
        }
      } else if (location !== undefined && empUpdateResult.rowCount > 0) {
        // UPDATE succeeded - double-check location was saved correctly
        // This is a safety check to ensure location persists
        const doubleCheck = await database.query(
          'SELECT location FROM employees WHERE user_id = $1',
          [userId]
        );
        if (doubleCheck.rows.length > 0) {
          const currentLocation = doubleCheck.rows[0].location;
          if (currentLocation !== normalizedLocation) {
            console.warn(`⚠️ Location mismatch detected after UPDATE. Current: ${currentLocation}, Expected: ${normalizedLocation}. Fixing...`);
            try {
              await database.query(
                'UPDATE employees SET location = $1, updated_at = NOW() WHERE user_id = $2',
                [normalizedLocation, userId]
              );
              console.log(`✅ Location corrected to: ${normalizedLocation}`);
            } catch (fixErr) {
              console.error('❌ Failed to correct location:', fixErr.message);
            }
          }
        }
      }
      
      // If UPDATE affected 0 rows, employee record might not exist
      // Check if we need to create it with location and/or manager_id
      if (empUpdateResult.rowCount === 0) {
        console.warn('⚠️ UPDATE affected 0 rows. Employee record might not exist.');
        console.warn(`⚠️ Location being set: ${location} → normalized: ${normalizedLocation}`);
        
        // If we have location or manager_id to update, try to create the record
        // CRITICAL: Always try to create/update if location is provided (even if null)
        if (location !== undefined || shouldUpdateManagerId) {
          // Use already normalized location value (calculated above)
          // This ensures consistency - location is ONLY from dropdown, not from phone number
          
          try {
            const createResult = await database.query(
              `INSERT INTO employees (user_id, role, location, manager_id)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT (user_id) DO UPDATE SET
                 location = EXCLUDED.location,
                 manager_id = EXCLUDED.manager_id,
                 updated_at = NOW()
               RETURNING employee_id, location, manager_id`,
              [
                userId,
                normalizedRole || 'employee',
                normalizedLocation, // Use already normalized value
                shouldUpdateManagerId ? hodEmployeeId : null
              ]
            );
            if (createResult.rows.length > 0) {
              console.log(`✅ Created/updated employee record with location: ${createResult.rows[0].location}, manager_id: ${createResult.rows[0].manager_id}`);
              employeeExists = true;
              
              // Update country_code if location was set
              // Phone number does NOT affect this
              if (normalizedLocation) {
                try {
                  await database.query(
                    `UPDATE users SET country_code = $1 WHERE user_id = $2`,
                    [normalizedLocation, userId]
                  );
                  console.log(`✅ Auto-set country_code to ${normalizedLocation} for user ${userId} (from location dropdown only)`);
                } catch (countryCodeError) {
                  console.warn('Could not update country_code:', countryCodeError.message);
                }
              }
            }
          } catch (createError) {
            console.error('❌ Failed to create employee record:', createError.message);
            // If ON CONFLICT doesn't work, try simple INSERT
            if (createError.code === '42704' || createError.message.includes('conflict')) {
              try {
                await database.query(
                  `INSERT INTO employees (user_id, role, location, manager_id)
                   VALUES ($1, $2, $3, $4)`,
                  [
                    userId,
                    normalizedRole || 'employee',
                    normalizedLocation, // Use already normalized value
                    shouldUpdateManagerId ? hodEmployeeId : null
                  ]
                );
                console.log(`✅ Created employee record with simple INSERT`);
                employeeExists = true;
              } catch (simpleInsertError) {
                console.error('❌ Simple INSERT also failed:', simpleInsertError.message);
              }
            }
          }
        }
      }
      
      if (empUpdateResult.rowCount === 0 && !employeeExists && (location !== undefined || shouldUpdateManagerId || department !== undefined || shouldUpdateAdminId)) {
        console.warn('⚠️ No rows were updated in employees table. Employee record might not exist. Attempting to insert/upsert...');
        // Try to insert/upsert the employee record
        try {
          const insertHodEmployeeId = hodEmployeeId;
          console.log(`📝 Using HOD employee_id for insert: ${insertHodEmployeeId || 'NULL'}`);
          
          // Use already normalized location value (calculated above)
          // Location is ONLY from dropdown, not from phone number
          
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
                  normalizedLocation, // Use already normalized value
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
                    normalizedLocation, // Use already normalized value
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
                // Use already normalized location value (calculated above)
                // Location is ONLY from dropdown, not from phone number
                
                await database.query(
                  `INSERT INTO employees (user_id, role, location, team, designation, manager_id)
                   VALUES ($1, $2, $3, $4, $5, $6)`,
                  [
                    userId,
                    normalizedRole || 'employee',
                    normalizedLocation, // Use already normalized value
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
                      normalizedLocation || null,
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
                normalizedLocation || null,
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
                  normalizedLocation || null,
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
                    normalizedLocation || null,
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
              normalizedLocation || null,
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

    // FINAL VERIFICATION: Ensure location was saved correctly
    if (shouldUpdateLocation) {
      try {
        const finalCheck = await database.query(
          'SELECT location FROM employees WHERE user_id = $1',
          [userId]
        );
        if (finalCheck.rows.length > 0) {
          const savedLocation = finalCheck.rows[0].location;
          if (savedLocation !== normalizedLocation) {
            console.warn(`⚠️ FINAL CHECK: Location mismatch! Expected: ${normalizedLocation}, Got: ${savedLocation}. Forcing update...`);
            // Force update location one more time
            await database.query(
              'UPDATE employees SET location = $1, updated_at = NOW() WHERE user_id = $2',
              [normalizedLocation, userId]
            );
            console.log(`✅ FINAL FIX: Location forced to ${normalizedLocation}`);
          } else {
            console.log(`✅ FINAL CHECK: Location correctly saved as ${savedLocation}`);
          }
        }
      } catch (finalCheckError) {
        console.error('❌ Final location check failed:', finalCheckError.message);
      }
    }

    return {
      message: "Employee updated successfully",
      user: {
        id: userId,
        email: email,
        full_name: full_name,
        role: normalizedRole,
        location: normalizedLocation
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

  try {
    // Check if user exists
    const userResult = await database.query(
      'SELECT user_id, email, role FROM users WHERE user_id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw CreateError("User not found", 404);
    }

    const user = userResult.rows[0];

    // Get employee_id first to check for pending leaves
    let employeeId = null;
    try {
      const empCheck = await database.query(
        'SELECT employee_id FROM employees WHERE user_id = $1 LIMIT 1',
        [userId]
      );
      if (empCheck.rows.length > 0) {
        employeeId = empCheck.rows[0].employee_id;
      }
    } catch (empCheckError) {
      console.warn('Error checking employee record:', empCheckError.message);
    }

    // Store email before deletion for response
    const userEmail = user.email;

    // Delete related records first (in correct order to avoid foreign key violations)
    // 1. Delete leave applications (all leaves, not just pending)
    if (employeeId) {
      try {
        const leaveDeleteResult = await database.query(
          'DELETE FROM leave_applications WHERE employee_id = $1',
          [employeeId]
        );
        console.log(`✅ Deleted ${leaveDeleteResult.rowCount} leave application(s) for employee_id: ${employeeId}`);
      } catch (leaveError) {
        console.warn('Error deleting leave applications:', leaveError.message);
        // Continue even if leaves don't exist
      }
    }

    // 2. Delete leave balance records
    if (employeeId) {
      try {
        const balanceDeleteResult = await database.query(
          'DELETE FROM leave_balance WHERE employee_id = $1',
          [employeeId]
        );
        console.log(`✅ Deleted ${balanceDeleteResult.rowCount} leave balance record(s) for employee_id: ${employeeId}`);
      } catch (balanceError) {
        console.warn('Error deleting leave balance:', balanceError.message);
        // Continue even if balance doesn't exist
      }
    }

    // 3. Delete user permissions
    try {
      const permDeleteResult = await database.query(
        'DELETE FROM user_permissions WHERE user_id = $1',
        [userId]
      );
      console.log(`✅ Deleted ${permDeleteResult.rowCount} user permission(s) for user_id: ${userId}`);
    } catch (permError) {
      console.warn('Error deleting user permissions:', permError.message);
      // Continue even if permissions don't exist
    }

    // 4. Delete employee blocked dates
    if (employeeId) {
      try {
        const blockedDeleteResult = await database.query(
          'DELETE FROM employee_blocked_dates WHERE employee_id = $1',
          [employeeId]
        );
        console.log(`✅ Deleted ${blockedDeleteResult.rowCount} employee blocked date(s) for employee_id: ${employeeId}`);
      } catch (blockedError) {
        console.warn('Error deleting employee blocked dates:', blockedError.message);
      }
    }

    // 5. Delete employee record (if exists)
    if (employeeId) {
      try {
        const empDeleteResult = await database.query(
          'DELETE FROM employees WHERE user_id = $1',
          [userId]
        );
        console.log(`✅ Deleted employee record for user_id: ${userId}`);
      } catch (empError) {
        console.warn('Error deleting employee record:', empError.message);
        // Continue even if employee record doesn't exist
      }
    }

    // 6. Hard delete user record (including email)
    const result = await database.query(
      `DELETE FROM users WHERE user_id = $1 RETURNING user_id, email`,
      [userId]
    );

    if (result.rows.length === 0) {
      throw CreateError("Failed to delete user", 500);
    }

    console.log(`✅ User deleted successfully: user_id=${userId}, email=${result.rows[0].email}`);

    return {
      message: "Employee deleted successfully",
      data: {
        user_id: result.rows[0].user_id,
        email: result.rows[0].email,
        deleted: true
      }
    };
  } catch (error) {
    console.error('DeleteEmployeeService error:', error);
    if (error.status) throw error;
    throw CreateError(error.message || "Failed to delete employee", 500);
  }
};

