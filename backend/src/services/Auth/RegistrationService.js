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

  // Check if user already exists - handle both schema types
  let existingUser;
  try {
    // Try new schema first (user_id, first_name, last_name)
    existingUser = await database.query(
      `SELECT user_id, email FROM users WHERE LOWER(email) = $1 LIMIT 1`,
      [email.toLowerCase()]
    );
    
    // If no result, try old schema (id, full_name)
    if (existingUser.rows.length === 0) {
      existingUser = await database.query(
        'SELECT id, email FROM users WHERE LOWER(email) = $1 LIMIT 1',
        [email.toLowerCase()]
      );
    }
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
  const fullName = first_name && last_name 
    ? `${first_name} ${last_name}`.trim()
    : first_name || last_name || email.split('@')[0];

  // Insert user - handle both schema types
  let userResult;
  let userId;
  
  try {
    // Try new schema first (user_id, first_name, last_name)
    userResult = await database.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role, status, department, designation)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING user_id, email, first_name, last_name, role, department, designation`,
      [
        email.toLowerCase(),
        passwordHash,
        first_name || null,
        last_name || null,
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
    
    // If new schema fails, try old schema (id, full_name)
    if (insertError.code === '42703' || insertError.message.includes('column')) {
      try {
        userResult = await database.query(
          `INSERT INTO users (email, password_hash, full_name, role, status)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id, email, full_name, role`,
          [
            email.toLowerCase(),
            passwordHash,
            fullName,
            normalizedRole,
            'Active'
          ]
        );
        
        if (userResult.rows.length > 0) {
          userId = userResult.rows[0].id;
        }
      } catch (oldSchemaError) {
        // Handle duplicate email error in retry
        if (oldSchemaError.code === '23505' && oldSchemaError.constraint === 'users_email_key') {
          throw CreateError(`Email "${email}" is already in use by another user`, 400);
        }
        console.error('Database insert error:', oldSchemaError);
        throw CreateError(`Failed to create user: ${oldSchemaError.message}`, 500);
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

  // Create employee record if it doesn't exist
  // This is needed for the employee to appear in employee lists and leave management
  try {
    // Check if employee record already exists
    const existingEmployee = await database.query(
      'SELECT employee_id FROM employees WHERE user_id = $1',
      [userId]
    );

    if (existingEmployee.rows.length === 0) {
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
      } catch (empInsertError) {
        // If ON CONFLICT doesn't work, try simple INSERT
        if (empInsertError.code === '42P01' || empInsertError.message.includes('ON CONFLICT')) {
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
          } catch (simpleInsertError) {
            // If that fails due to missing columns, try minimal insert
            if (simpleInsertError.code === '42703' || simpleInsertError.message.includes('column')) {
              try {
                await database.query(
                  `INSERT INTO employees (user_id, role)
                   VALUES ($1, $2)`,
                  [userId, normalizedRole]
                );
              } catch (minInsertError) {
                console.warn('Could not create employee record:', minInsertError.message);
                // Don't fail registration if employee record creation fails
              }
            } else {
              console.warn('Could not create employee record:', simpleInsertError.message);
            }
          }
        } else {
          console.warn('Could not create employee record:', empInsertError.message);
        }
      }
    }
  } catch (empError) {
    console.warn('Error creating employee record:', empError.message);
    // Don't fail registration if employee record creation fails
    // The employee record can be created later via UpdateEmployee
  }

  // Create token
  const payLoad = {
    id: userId,
  };

  const token = await CreateToken(payLoad);

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
