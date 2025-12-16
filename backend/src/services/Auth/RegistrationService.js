//Internal Lib Import
import { CreateError } from "../../helper/ErrorHandler.js";
import { HashPassword } from "../../utility/BcryptHelper.js";
import CreateToken from "../../utility/CreateToken.js";
import database from "../../config/database.js";

const RegistrationService = async (Request) => {
  const { email, password, fullName, role, location, department, designation, hod_id } = Request.body;

  if (!email || !password) {
    throw CreateError("Email and password are required", 400);
  }

  if (password.length < 6) {
    throw CreateError("Password must be at least 6 characters", 400);
  }

  // HOD assignment is mandatory for employees (not for HODs or admins)
  const normalizedRole = (role || 'employee').toLowerCase().trim();
  if (normalizedRole === 'employee' && !hod_id) {
    throw CreateError("HOD assignment is required for employees", 400);
  }

  // Check if user already exists - handle both schema types
  let existingUser;
  try {
    // Try new schema first (user_id)
    existingUser = await database.query(
      'SELECT user_id FROM users WHERE LOWER(email) = $1',
      [email.toLowerCase()]
    );
  } catch (e1) {
    // If that fails, try old schema (id)
    try {
      existingUser = await database.query(
        'SELECT id FROM users WHERE LOWER(email) = $1',
        [email.toLowerCase()]
      );
    } catch (e2) {
      // If both fail, just try a simple query
      existingUser = await database.query(
        'SELECT * FROM users WHERE LOWER(email) = $1 LIMIT 1',
        [email.toLowerCase()]
      );
    }
  }

  if (existingUser.rows.length > 0) {
    throw CreateError("User with this email already exists", 400);
  }

  // Hash password
  const passwordHash = await HashPassword(password);

  // Create user - handle both schema types
  let userResult;
  try {
    // Try new schema first (user_id, first_name, last_name)
    const nameParts = (fullName || email).split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    userResult = await database.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role, status, department)
       VALUES ($1, $2, $3, $4, $5, 'Active', $6)
       RETURNING user_id as id, email, first_name, last_name, role, status, department`,
      [email.toLowerCase(), passwordHash, firstName, lastName, role || 'employee', department || null]
    );
  } catch (dbError) {
    // If new schema fails, try old schema
    if (dbError.code === '42703' || dbError.message.includes('column') || dbError.message.includes('does not exist')) {
      // Try with department if column exists
      try {
        userResult = await database.query(
          `INSERT INTO users (email, password_hash, full_name, role, department)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id, email, full_name, role, created_at, department`,
          [email.toLowerCase(), passwordHash, fullName || email, role || 'employee', department || null]
        );
      } catch (deptError) {
        // If department column doesn't exist, insert without it
        userResult = await database.query(
          `INSERT INTO users (email, password_hash, full_name, role)
           VALUES ($1, $2, $3, $4)
           RETURNING id, email, full_name, role, created_at`,
          [email.toLowerCase(), passwordHash, fullName || email, role || 'employee']
        );
      }
    } else {
      throw CreateError(`Database error: ${dbError.message}`, 500);
    }
  }

  const user = userResult.rows[0];
  // Handle both schema types: user.id (old schema) or user.user_id (new schema)
  const userId = user.id || user.user_id;
  
  if (!userId) {
    console.error('❌ User ID is missing after user creation:', user);
    throw CreateError("Failed to create user: User ID not found", 500);
  }
  
  console.log('✅ User created successfully:', { userId, email: user.email, role: user.role });

  // Create corresponding employee record
  // First, get the employee_id of the HOD if hod_id is provided
  let hodEmployeeId = null;
  if (hod_id) {
    try {
      // hod_id could be employee_id, user_id, or id (UUID)
      // Try multiple approaches to find the HOD's employee record
      let hodResult;
      
      // Approach 1: Try with employee_id (SERIAL schema)
      try {
        hodResult = await database.query(
          `SELECT employee_id, id FROM employees 
           WHERE employee_id = $1 OR user_id = $1 OR id = $1 
           LIMIT 1`,
          [hod_id]
        );
      } catch (e1) {
        // If that fails, try with text casting
        try {
          hodResult = await database.query(
            `SELECT employee_id, id FROM employees 
             WHERE employee_id::text = $1 OR user_id::text = $1 OR id::text = $1 
             LIMIT 1`,
            [hod_id.toString()]
          );
        } catch (e2) {
          // If both fail, try just user_id
          hodResult = await database.query(
            `SELECT employee_id, id FROM employees WHERE user_id = $1 LIMIT 1`,
            [hod_id]
          );
        }
      }
      
      if (hodResult && hodResult.rows.length > 0) {
        // Use employee_id if available, otherwise use id (for UUID schema)
        hodEmployeeId = hodResult.rows[0].employee_id || hodResult.rows[0].id;
        console.log('✅ Found HOD employee_id:', hodEmployeeId);
      } else {
        // HOD not found in employees table - might be a new HOD without employee record
        // Try to find by user_id and create employee record if needed
        console.warn('⚠️ HOD not found in employees table with hod_id:', hod_id);
        console.log('🔍 Attempting to find HOD by user_id and create employee record...');
        
        try {
          // Try to find the HOD user
          const hodUserResult = await database.query(
            `SELECT user_id, email, role, 
                    COALESCE(NULLIF(TRIM(first_name || ' ' || COALESCE(last_name, '')), ''), email) as full_name
             FROM users 
             WHERE user_id = $1 OR user_id::text = $1
             LIMIT 1`,
            [hod_id]
          );
          
          if (hodUserResult.rows.length > 0) {
            const hodUser = hodUserResult.rows[0];
            console.log(`✅ Found HOD user: ${hodUser.email} (user_id: ${hodUser.user_id})`);
            
            // Create employee record for this HOD
            try {
              const createHodEmpResult = await database.query(
                `INSERT INTO employees (user_id, email, full_name, role)
                 VALUES ($1, $2, $3, $4)
                 RETURNING employee_id`,
                [hodUser.user_id, hodUser.email, hodUser.full_name || hodUser.email, hodUser.role || 'HOD']
              );
              
              if (createHodEmpResult.rows.length > 0) {
                hodEmployeeId = createHodEmpResult.rows[0].employee_id;
                console.log(`✅ Created employee record for HOD ${hodUser.email} - employee_id: ${hodEmployeeId}`);
              }
            } catch (createError) {
              // If insert fails (duplicate), fetch existing
              if (createError.code === '23505' || createError.message.includes('duplicate')) {
                const existingHod = await database.query(
                  'SELECT employee_id FROM employees WHERE user_id = $1',
                  [hodUser.user_id]
                );
                if (existingHod.rows.length > 0) {
                  hodEmployeeId = existingHod.rows[0].employee_id;
                  console.log(`✅ Found existing employee record for HOD ${hodUser.email} - employee_id: ${hodEmployeeId}`);
                }
              } else {
                console.warn(`⚠️ Could not create employee record for HOD:`, createError.message);
              }
            }
          } else {
            console.warn('⚠️ HOD user not found with hod_id:', hod_id);
          }
        } catch (userLookupError) {
          console.warn('⚠️ Failed to lookup HOD user:', userLookupError.message);
        }
      }
    } catch (hodError) {
      console.warn('⚠️ Failed to find HOD employee_id:', hodError.message);
      // Continue without HOD assignment - it's optional
    }
  }

  // Create corresponding employee record
  // Use a simple approach: Try INSERT, if duplicate then UPDATE
  try {
    // First, try to insert (with all possible fields)
    let insertSuccess = false;
    
    // Try with designation and manager_id
    try {
      await database.query(
        `INSERT INTO employees (user_id, email, full_name, role, location, team, designation, manager_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          userId, 
          user.email, 
          fullName || email, 
          user.role,
          location || null,
          department || null,
          designation || null,
          hodEmployeeId || null
        ]
      );
      insertSuccess = true;
      console.log('✅ Created employee record (with all fields)');
    } catch (insertError1) {
      // If fails due to duplicate or missing column, try UPDATE or simpler INSERT
      if (insertError1.code === '23505' || insertError1.message.includes('duplicate') || insertError1.message.includes('unique')) {
        // Duplicate key - try UPDATE instead
        try {
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
              user.email, 
              fullName || email, 
              user.role,
              location || null,
              department || null,
              designation || null,
              hodEmployeeId || null,
              userId
            ]
          );
          insertSuccess = true;
          console.log('✅ Updated existing employee record');
        } catch (updateError) {
          // If update fails (maybe designation column doesn't exist), try without it
          try {
            await database.query(
              `UPDATE employees SET
               email = $1,
               full_name = $2,
               role = $3,
               location = $4,
               team = $5,
               manager_id = $6,
               updated_at = NOW()
               WHERE user_id = $7`,
              [
                user.email, 
                fullName || email, 
                user.role,
                location || null,
                department || null,
                hodEmployeeId || null,
                userId
              ]
            );
            insertSuccess = true;
            console.log('✅ Updated existing employee record (without designation)');
          } catch (updateError2) {
            console.warn('⚠️ Failed to update employee:', updateError2.message);
          }
        }
      } else if (insertError1.code === '42703' || insertError1.message.includes('column') || insertError1.message.includes('designation')) {
        // Missing column - try without designation
        try {
          await database.query(
            `INSERT INTO employees (user_id, email, full_name, role, location, team, manager_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              userId, 
              user.email, 
              fullName || email, 
              user.role,
              location || null,
              department || null,
              hodEmployeeId || null
            ]
          );
          insertSuccess = true;
          console.log('✅ Created employee record (without designation)');
        } catch (insertError2) {
          // If still fails, try without manager_id too
          try {
            await database.query(
              `INSERT INTO employees (user_id, email, full_name, role, location, team)
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [
                userId, 
                user.email, 
                fullName || email, 
                user.role,
                location || null,
                department || null
              ]
            );
            insertSuccess = true;
            console.log('✅ Created employee record (minimal fields)');
          } catch (insertError3) {
            console.warn('⚠️ Employee record creation failed:', insertError3.message);
            // Employee record creation is optional, continue if it fails
          }
        }
      } else {
        // Other error - log and continue (employee record is optional)
        console.warn('⚠️ Employee record creation failed:', insertError1.message);
      }
    }
  } catch (empError) {
    // Employee record creation is optional, continue if it fails
    console.warn('⚠️ Employee record creation failed:', empError.message);
    console.warn('⚠️ Employee error details:', {
      code: empError.code,
      message: empError.message,
      detail: empError.detail
    });
  }

  // Generate token
  try {
    const token = await CreateToken({
      id: userId,
    });

    console.log('✅ User registration completed successfully:', { userId, email: user.email });

    return {
      AccessToken: token,
      UserDetails: {
        id: userId,
        email: user.email,
        full_name: user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email,
        role: user.role || 'employee',
      },
    };
  } catch (tokenError) {
    console.error('❌ Token creation failed:', tokenError);
    throw CreateError(`Failed to create authentication token: ${tokenError.message}`, 500);
  }
};

export default RegistrationService;



