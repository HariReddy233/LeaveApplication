//Internal Lib Import
import CreateToken from "../../utility/CreateToken.js";
import { CreateError } from "../../helper/ErrorHandler.js";
import { HashPassword } from "../../utility/BcryptHelper.js";
import database from "../../config/database.js";

const RegistrationService = async (Request) => {
  const { email, password, role, department, hod_id, first_name, last_name, designation } = Request.body;

  if (!email || !password) {
    throw CreateError("Email and password are required", 400);
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw CreateError("Invalid email format", 400);
  }

  // Validate password length
  if (password.length < 6) {
    throw CreateError("Password must be at least 6 characters", 400);
  }

  // Check if user already exists - use user_id (standard schema)
  let existingUser;
  try {
    existingUser = await database.query(
      `SELECT user_id, email FROM users WHERE LOWER(email) = $1 LIMIT 1`,
      [email.toLowerCase()]
    );
  } catch (dbError) {
    console.error('Database query error:', dbError);
    throw CreateError(`Database error: ${dbError.message}`, 500);
  }

  if (existingUser.rows.length > 0) {
    throw CreateError("User already exists with this email", 409);
  }

  // Hash password
  const passwordHash = await HashPassword(password);

  // Prepare user data
  const normalizedRole = role?.toLowerCase() || 'employee';
  // Ensure first_name is never null (database constraint requires it)
  // Use email prefix as fallback if first_name is not provided
  const firstName = first_name || email.split('@')[0] || 'User';
  const lastName = last_name || null;
  const fullName = first_name && last_name 
    ? `${first_name} ${last_name}`.trim()
    : first_name || last_name || email.split('@')[0];

  // Insert user - use standard schema (user_id, first_name, last_name)
  let userResult;
  let userId;
  
  try {
    // Try with all columns first
    userResult = await database.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role, status, department, designation)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING user_id, email, first_name, last_name, role, department, designation`,
      [
        email.toLowerCase(),
        passwordHash,
        firstName,
        lastName,
        normalizedRole,
        'Active',
        department || null,
        designation || null
      ]
    );
    
    if (userResult.rows.length > 0) {
      userId = userResult.rows[0].user_id;
    }
  } catch (insertError) {
    // Handle duplicate email error
    if (insertError.code === '23505' && insertError.constraint === 'users_email_key') {
      throw CreateError(`Email "${email}" is already in use by another user`, 400);
    }
    
    // If columns like department or designation don't exist, try without them
    if (insertError.code === '42703' || insertError.message.includes('column') || insertError.message.includes('does not exist')) {
      try {
        // Try without department and designation columns
        userResult = await database.query(
          `INSERT INTO users (email, password_hash, first_name, last_name, role, status)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING user_id, email, first_name, last_name, role`,
          [
            email.toLowerCase(),
            passwordHash,
            firstName,
            lastName,
            normalizedRole,
            'Active'
          ]
        );
        
        if (userResult.rows.length > 0) {
          userId = userResult.rows[0].user_id;
        }
      } catch (retryError) {
        // Handle duplicate email error in retry
        if (retryError.code === '23505' && retryError.constraint === 'users_email_key') {
          throw CreateError(`Email "${email}" is already in use by another user`, 400);
        }
        console.error('Database schema error:', retryError.message);
        throw CreateError(`Database schema error: ${retryError.message}. Please contact administrator.`, 500);
      }
    } else {
      console.error('Database insert error:', insertError);
      throw CreateError(`Failed to create user: ${insertError.message}`, 500);
    }
  }

  if (!userId) {
    throw CreateError("Failed to create user", 500);
  }

  const user = userResult.rows[0];
  const userFullName = user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || email;

  // Create employee record if it doesn't exist (non-blocking - won't fail registration)
  // This is needed for the employee to appear in employee lists and leave management
  // Wrap in try-catch to prevent registration failure if employee record creation fails
  try {
    // Check if employee record already exists
    let existingEmployee;
    try {
      existingEmployee = await database.query(
        'SELECT employee_id FROM employees WHERE user_id = $1',
        [userId]
      );
    } catch (checkError) {
      console.warn('Could not check existing employee record:', checkError.message);
      existingEmployee = { rows: [] };
    }

    if (!existingEmployee || existingEmployee.rows.length === 0) {
      // Get HOD employee_id if hod_id is provided
      let hodEmployeeId = null;
      if (hod_id) {
        try {
          const hodResult = await database.query(
            'SELECT employee_id FROM employees WHERE user_id = $1 LIMIT 1',
            [hod_id]
          );
          if (hodResult.rows.length > 0) {
            hodEmployeeId = hodResult.rows[0].employee_id;
          }
        } catch (hodError) {
          console.warn('Could not fetch HOD employee_id:', hodError.message);
        }
      }

      // Try to insert employee record with ON CONFLICT
      try {
        await database.query(
          `INSERT INTO employees (user_id, role, location, team, designation, manager_id)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (user_id) DO NOTHING`,
          [
            userId,
            normalizedRole,
            null, // location
            department || null, // team/department
            designation || null,
            hodEmployeeId // manager_id (HOD)
          ]
        );
        console.log('✅ Employee record created successfully');
      } catch (empInsertError) {
        // Log the full error for debugging
        console.error('❌ Employee insert error details:', {
          code: empInsertError.code,
          message: empInsertError.message,
          detail: empInsertError.detail,
          constraint: empInsertError.constraint
        });
        console.warn('⚠️ Employee insert with ON CONFLICT failed, trying simple INSERT:', empInsertError.message);
        // If ON CONFLICT doesn't work, try simple INSERT
        if (empInsertError.code === '42P01' || empInsertError.code === '42703' || empInsertError.message.includes('ON CONFLICT') || empInsertError.message.includes('column')) {
          try {
            await database.query(
              `INSERT INTO employees (user_id, role, location, team, designation, manager_id)
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [
                userId,
                normalizedRole,
                null,
                department || null,
                designation || null,
                hodEmployeeId
              ]
            );
            console.log('✅ Employee record created with simple INSERT');
          } catch (simpleInsertError) {
            console.warn('⚠️ Simple INSERT failed, trying minimal insert:', simpleInsertError.message);
            // If that fails due to missing columns, try minimal insert
            if (simpleInsertError.code === '42703' || simpleInsertError.message.includes('column')) {
              try {
                await database.query(
                  `INSERT INTO employees (user_id, role)
                   VALUES ($1, $2)`,
                  [userId, normalizedRole]
                );
                console.log('✅ Employee record created with minimal fields');
              } catch (minInsertError) {
                console.warn('⚠️ Could not create employee record (minimal insert failed):', minInsertError.message);
                // Don't fail registration if employee record creation fails
                // The employee record can be created later via UpdateEmployee
              }
            } else if (simpleInsertError.code === '23505') {
              // Unique constraint violation - employee record already exists, that's okay
              console.log('ℹ️ Employee record already exists (unique constraint)');
            } else {
              console.warn('⚠️ Could not create employee record:', simpleInsertError.message);
              // Don't fail registration
            }
          }
        } else if (empInsertError.code === '23505') {
          // Unique constraint violation - employee record already exists, that's okay
          console.log('ℹ️ Employee record already exists (unique constraint)');
        } else {
          console.warn('⚠️ Could not create employee record:', empInsertError.message);
          // Don't fail registration
        }
      }
    } else {
      console.log('ℹ️ Employee record already exists');
    }
  } catch (empError) {
    console.warn('⚠️ Error in employee record creation (non-fatal):', empError.message);
    // Don't fail registration if employee record creation fails
    // The employee record can be created later via UpdateEmployee
  }

  // Create token
  let token;
  try {
    const payLoad = {
      id: userId,
    };
    token = await CreateToken(payLoad);
    if (!token) {
      throw new Error('Token creation returned null or undefined');
    }
  } catch (tokenError) {
    console.error('❌ Failed to create token:', tokenError);
    throw CreateError(`Failed to create authentication token: ${tokenError.message}`, 500);
  }

  return {
    AccessToken: token,
    UserDetails: {
      id: userId,
      email: user.email,
      full_name: userFullName,
      role: user.role || normalizedRole,
      department: user.department || department || null,
      designation: user.designation || designation || null,
    },
  };
};

export default RegistrationService;
export { RegistrationService };
