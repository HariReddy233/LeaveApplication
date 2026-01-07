//Internal Lib Import
import CreateToken from "../../utility/CreateToken.js";
import { CreateError } from "../../helper/ErrorHandler.js";
import { HashPassword } from "../../utility/BcryptHelper.js";
import database from "../../config/database.js";

const RegistrationService = async (Request) => {
  const { email, password, role, department, hod_id, admin_id, first_name, last_name, full_name, designation, location, phone_number } = Request.body;
  
  console.log(`\n🔵 ========== REGISTRATION START ==========`);
  console.log(`🔵 Received admin_id: ${admin_id} (type: ${typeof admin_id}, value: ${JSON.stringify(admin_id)})`);
  console.log(`🔵 Received role: ${role}`);
  console.log(`🔵 Received location: ${location} (type: ${typeof location})`);
  console.log(`🔵 Received hod_id: ${hod_id} (type: ${typeof hod_id})`);
  console.log(`🔵 Request body keys:`, Object.keys(Request.body));

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

  // Check if user already exists (including inactive/deleted users)
  // If found and inactive/deleted, clean it up before creating new user
  let existingUser;
  try {
    // Check for ANY user with this email (active or inactive)
    existingUser = await database.query(
      `SELECT user_id, email, status FROM users 
       WHERE LOWER(email) = $1 
       LIMIT 1`,
      [email.toLowerCase()]
    );
  } catch (dbError) {
    console.error('Database query error:', dbError);
    throw CreateError(`Database error: ${dbError.message}`, 500);
  }

  // If user exists and is active, throw error
  if (existingUser.rows.length > 0) {
    const existingUserData = existingUser.rows[0];
    const isActive = !existingUserData.status || existingUserData.status === 'Active' || existingUserData.status === '';
    
    if (isActive) {
      throw CreateError("User already exists with this email", 409);
    } else {
      // User exists but is inactive/deleted - clean it up completely before creating new one
      console.log(`⚠️ Found inactive/deleted user with email ${email}, cleaning up before re-creation...`);
      const existingUserId = existingUserData.user_id;
      
      try {
        // Get employee_id if exists
        let existingEmployeeId = null;
        try {
          const empCheck = await database.query(
            'SELECT employee_id FROM employees WHERE user_id = $1 LIMIT 1',
            [existingUserId]
          );
          if (empCheck.rows.length > 0) {
            existingEmployeeId = empCheck.rows[0].employee_id;
          }
        } catch (empCheckError) {
          console.warn('Error checking employee record:', empCheckError.message);
        }
        
        // Delete all related records first
        if (existingEmployeeId) {
          // Delete leave applications
          try {
            await database.query('DELETE FROM leave_applications WHERE employee_id = $1', [existingEmployeeId]);
          } catch (e) { console.warn('Error deleting leave applications:', e.message); }
          
          // Delete leave balance
          try {
            await database.query('DELETE FROM leave_balance WHERE employee_id = $1', [existingEmployeeId]);
          } catch (e) { console.warn('Error deleting leave balance:', e.message); }
          
          // Delete employee blocked dates
          try {
            await database.query('DELETE FROM employee_blocked_dates WHERE employee_id = $1', [existingEmployeeId]);
          } catch (e) { console.warn('Error deleting blocked dates:', e.message); }
        }
        
        // Delete user permissions
        try {
          await database.query('DELETE FROM user_permissions WHERE user_id = $1', [existingUserId]);
        } catch (e) { console.warn('Error deleting permissions:', e.message); }
        
        // Delete employee record
        try {
          await database.query('DELETE FROM employees WHERE user_id = $1', [existingUserId]);
        } catch (e) { console.warn('Error deleting employee record:', e.message); }
        
        // Finally, delete the user record
        await database.query('DELETE FROM users WHERE user_id = $1', [existingUserId]);
        console.log(`✅ Cleaned up inactive/deleted user: user_id=${existingUserId}, email=${email}`);
      } catch (cleanupError) {
        console.error('Error cleaning up inactive user:', cleanupError);
        // Continue anyway - the INSERT might still work if cleanup partially succeeded
      }
    }
  }

  // Hash password
  const passwordHash = await HashPassword(password);

  // Prepare user data - handle both first_name/last_name and full_name
  const normalizedRole = role?.toLowerCase() || 'employee';
  let finalFirstName = first_name || null;
  let finalLastName = last_name || null;
  
  // If full_name is provided but first_name/last_name are not, split full_name
  if (full_name && !first_name && !last_name) {
    const nameParts = full_name.trim().split(/\s+/);
    finalFirstName = nameParts[0] || null;
    finalLastName = nameParts.slice(1).join(' ') || null;
  } else if (!first_name && !last_name) {
    // Fallback: use email username as first name
    finalFirstName = email.split('@')[0];
    finalLastName = null;
  }

  // Insert user (database uses user_id, first_name, last_name)
  let userResult;
  let userId;
  
  try {
    userResult = await database.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role, status, department, designation)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING user_id, email, first_name, last_name, role, department, designation`,
      [
        email.toLowerCase(),
        passwordHash,
        finalFirstName,
        finalLastName,
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
    // Handle column not found errors more gracefully
    if (insertError.code === '42703' || insertError.message.includes('column') || insertError.message.includes('does not exist')) {
      console.error('Database schema error:', insertError.message);
      throw CreateError(`Database schema error: ${insertError.message}. Please contact administrator.`, 500);
    }
    console.error('Database insert error:', insertError);
    throw CreateError(`Failed to create user: ${insertError.message}`, 500);
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
      // Use same multi-strategy lookup as UpdateEmployeeService
      let hodEmployeeId = null;
      if (hod_id && hod_id !== '') {
        try {
          console.log(`🔍 Looking up HOD with hod_id: ${hod_id} (type: ${typeof hod_id})`);
          
          // Strategy 1: Try to find by employee_id first (most direct)
          console.log(`🔍 STEP 1: Trying to find HOD by employee_id...`);
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
            console.log(`✅ Found HOD by employee_id: ${hodEmployeeId} (user_id: ${foundUserId})`);
          } else {
            // Strategy 2: Try to find by user_id
            console.log(`⚠️ Not found by employee_id. Trying user_id lookup...`);
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
            
            if (userCheck && userCheck.rows.length > 0) {
              const hodUser = userCheck.rows[0];
              console.log(`✅ Found HOD user: ${hodUser.email} (user_id: ${hodUser.user_id})`);
              
              // Now check if this user has an employee record
              console.log(`🔍 Checking if HOD user has employee record...`);
              hodResult = await database.query(
                `SELECT employee_id, user_id 
                 FROM employees 
                 WHERE user_id = $1 
                 LIMIT 1`,
                [hodUser.user_id]
              );
              
              if (hodResult.rows.length > 0) {
                hodEmployeeId = hodResult.rows[0].employee_id;
                console.log(`✅ Found HOD employee_id: ${hodEmployeeId} from user_id: ${hodUser.user_id}`);
              } else {
                console.warn(`⚠️ HOD user ${hodUser.user_id} does not have an employee record`);
              }
            } else {
              console.warn(`⚠️ HOD not found with hod_id: ${hod_id}`);
            }
          }
        } catch (hodError) {
          console.error('❌ Could not fetch HOD employee_id:', hodError.message);
          console.error('HOD lookup error details:', hodError);
        }
      }

      // Get Admin employee_id if admin_id is provided (for HODs)
      let adminEmployeeId = null;
      // Process admin_id if role is HOD (even if admin_id is null, we need to set it)
      if (normalizedRole === 'hod' || normalizedRole === 'HOD') {
        if (admin_id && admin_id !== '' && admin_id !== null) {
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
              console.log(`✅ Found Admin employee_id: ${adminEmployeeId} for admin_id: ${admin_id}`);
            } else {
              console.warn(`⚠️ Admin not found with admin_id: ${admin_id}`);
              adminEmployeeId = null; // Explicitly set to null if not found
            }
          } catch (adminError) {
            console.warn('Could not fetch Admin employee_id:', adminError.message);
            adminEmployeeId = null; // Set to null on error
          }
        } else {
          // admin_id is null or empty - explicitly set to null
          console.log(`📝 admin_id is null/empty for HOD, will set admin_id to NULL`);
          adminEmployeeId = null;
        }
      }

      // CRITICAL: Location is ONLY set from the location dropdown field
      // Phone number does NOT affect location or country_code
      // Normalize location: Accept IN/US directly, or normalize legacy values
      // Store ONLY "IN" or "US" in database
      let normalizedLocation = location || null;
      if (normalizedLocation) {
        const locationUpper = normalizedLocation.toUpperCase().trim();
        // Accept IN or US directly (from dropdown)
        if (locationUpper === 'IN' || locationUpper === 'US') {
          normalizedLocation = locationUpper;
        } else {
          // Normalize legacy values for backward compatibility
          const locationLower = normalizedLocation.toLowerCase().trim();
          if (locationLower === 'in' || locationLower.includes('india')) {
            normalizedLocation = 'IN';
          } else if (locationLower === 'us' || locationLower.includes('united states') || locationLower.includes('miami')) {
            normalizedLocation = 'US';
          } else {
            // If invalid value, set to null
            normalizedLocation = null;
          }
        }
      }
      
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
      }
      
      // Try to insert employee record with ON CONFLICT
      try {
        console.log(`📝 Inserting employee with values:`, {
          userId,
          role: normalizedRole,
          location: normalizedLocation,
          team: department || null,
          manager_id: hodEmployeeId,
          admin_id: adminEmployeeId
        });
        const insertResult = await database.query(
          `INSERT INTO employees (user_id, role, location, team, manager_id, admin_id)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (user_id) DO UPDATE SET
             role = EXCLUDED.role,
             location = EXCLUDED.location,
             team = EXCLUDED.team,
             manager_id = EXCLUDED.manager_id,
             admin_id = EXCLUDED.admin_id,
             updated_at = NOW()
           RETURNING employee_id, location, manager_id, admin_id`,
          [
            userId,
            normalizedRole,
            normalizedLocation, // normalized location (IN or US)
            department || null, // team/department
            hodEmployeeId, // manager_id (HOD)
            adminEmployeeId // admin_id (Admin for HODs)
          ]
        );
        if (insertResult.rows.length > 0) {
          console.log('✅ Employee record created/updated successfully:', {
            employee_id: insertResult.rows[0].employee_id,
            location: insertResult.rows[0].location,
            manager_id: insertResult.rows[0].manager_id,
            admin_id: insertResult.rows[0].admin_id
          });
        } else {
          console.warn('⚠️ INSERT returned no rows (might have been skipped by ON CONFLICT)');
        }
        
        // Verify all fields were saved correctly
        try {
          const verifyResult = await database.query(
            'SELECT employee_id, location, manager_id, admin_id, role FROM employees WHERE user_id = $1',
            [userId]
          );
          if (verifyResult.rows.length > 0) {
            const saved = verifyResult.rows[0];
            console.log(`✅ VERIFIED Employee record saved:`, {
              employee_id: saved.employee_id,
              location: saved.location,
              manager_id: saved.manager_id,
              admin_id: saved.admin_id,
              role: saved.role,
              expected_location: normalizedLocation,
              expected_manager_id: hodEmployeeId,
              expected_admin_id: adminEmployeeId
            });
            
            // Check for mismatches
            if (saved.location !== normalizedLocation) {
              console.warn(`⚠️ Location mismatch: saved="${saved.location}", expected="${normalizedLocation}"`);
            }
            if (saved.manager_id !== hodEmployeeId) {
              console.warn(`⚠️ Manager ID mismatch: saved="${saved.manager_id}", expected="${hodEmployeeId}"`);
            }
            if (normalizedRole === 'hod' || normalizedRole === 'HOD') {
              if (saved.admin_id !== adminEmployeeId) {
                console.warn(`⚠️ Admin ID mismatch: saved="${saved.admin_id}", expected="${adminEmployeeId}"`);
              }
            }
          } else {
            console.error(`❌ VERIFICATION FAILED: No employee record found for user_id: ${userId}`);
          }
        } catch (verifyError) {
          console.error('❌ Error verifying employee record:', verifyError.message);
        }
        
        // Verify admin_id was saved (specific check for HODs)
        if (normalizedRole === 'hod' || normalizedRole === 'HOD') {
          try {
            const verifyResult = await database.query(
              'SELECT admin_id FROM employees WHERE user_id = $1',
              [userId]
            );
            if (verifyResult.rows.length > 0) {
              const savedAdminId = verifyResult.rows[0].admin_id;
              console.log(`✅ VERIFIED: admin_id saved as ${savedAdminId} (expected: ${adminEmployeeId || 'NULL'})`);
            }
          } catch (verifyError) {
            console.warn('⚠️ Could not verify admin_id:', verifyError.message);
          }
        }
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
            const simpleInsertResult = await database.query(
              `INSERT INTO employees (user_id, role, location, team, manager_id, admin_id)
               VALUES ($1, $2, $3, $4, $5, $6)
               RETURNING employee_id, location, manager_id, admin_id`,
              [
                userId,
                normalizedRole,
                normalizedLocation, // normalized location (IN or US)
                department || null,
                hodEmployeeId,
                adminEmployeeId // admin_id (Admin for HODs)
              ]
            );
            if (simpleInsertResult.rows.length > 0) {
              console.log('✅ Employee record created with simple INSERT:', {
                employee_id: simpleInsertResult.rows[0].employee_id,
                location: simpleInsertResult.rows[0].location,
                manager_id: simpleInsertResult.rows[0].manager_id,
                admin_id: simpleInsertResult.rows[0].admin_id
              });
            }
          } catch (simpleInsertError) {
            // If error is due to missing admin_id column, retry without it
            if (simpleInsertError.code === '42703' && simpleInsertError.message && simpleInsertError.message.includes('admin_id')) {
              console.warn('⚠️ admin_id column does not exist. Retrying insert without admin_id...');
              try {
                await database.query(
                  `INSERT INTO employees (user_id, role, location, team, manager_id)
                   VALUES ($1, $2, $3, $4, $5)`,
                  [userId, normalizedRole, normalizedLocation, department || null, hodEmployeeId]
                );
                console.log('✅ Employee record created without admin_id');
              } catch (retryError) {
                console.warn('⚠️ Retry insert failed, trying minimal insert:', retryError.message);
                // Continue to minimal insert fallback
                simpleInsertError = retryError;
              }
            }
            
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
