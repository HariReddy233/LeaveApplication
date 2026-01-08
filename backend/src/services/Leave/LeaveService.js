//Internal Lib Import
import database from "../../config/database.js";
import { CreateError } from "../../helper/ErrorHandler.js";
import sseService from "../SSE/SSEService.js";
import { createApprovalToken, getBaseUrl } from "../../utils/approvalToken.js";

/**
 * Helper function to update Comp-Off balance (increase Casual Leave for India, PTO for USA)
 * @param {number} employeeId - The employee ID
 * @param {number} compOffDays - Number of Comp-Off days to add
 * @param {string} employeeLocation - Employee location (India/IN or US/United States)
 * @param {number} year - The year
 */
const updateCompOffBalance = async (employeeId, compOffDays, employeeLocation, year) => {
  try {
    // Map location to target leave type
    let targetLeaveType = null;
    const location = (employeeLocation || '').toString().trim();
    const normalizedLocation = location.toLowerCase();
    
    if (normalizedLocation === 'india' || normalizedLocation === 'in') {
      targetLeaveType = 'Casual Leave';
    } else if (normalizedLocation === 'us' || normalizedLocation === 'usa' || normalizedLocation === 'united states' || 
               normalizedLocation === 'u.s.' || normalizedLocation === 'u.s' || normalizedLocation.includes('miami')) {
      targetLeaveType = 'PTO';
    } else {
      // Default to Casual Leave if location not recognized
      console.warn(`⚠️ Unknown location "${location}", defaulting to Casual Leave for Comp-Off balance update`);
      targetLeaveType = 'Casual Leave';
    }
    
    if (!targetLeaveType) {
      console.error(`❌ Cannot update Comp-Off balance: No target leave type for location "${location}"`);
      return;
    }
    
    // Get current balance for target leave type
    const balanceCheck = await database.query(
      `SELECT total_balance, used_balance, remaining_balance
       FROM leave_balance
       WHERE employee_id = $1 AND leave_type = $2 AND year = $3
       LIMIT 1`,
      [employeeId, targetLeaveType, year]
    );
    
    let currentTotalBalance = 0;
    let currentUsedBalance = 0;
    
    if (balanceCheck.rows.length > 0) {
      currentTotalBalance = parseFloat(balanceCheck.rows[0].total_balance || 0);
      currentUsedBalance = parseFloat(balanceCheck.rows[0].used_balance || 0);
    } else {
      // If no balance record exists, get default from leave_types
      const leaveTypeResult = await database.query(
        `SELECT max_days FROM leave_types WHERE name = $1 AND is_active = true LIMIT 1`,
        [targetLeaveType]
      );
      
      if (leaveTypeResult.rows.length > 0) {
        currentTotalBalance = parseFloat(leaveTypeResult.rows[0].max_days || 0);
      }
    }
    
    // Increase total_balance by compOffDays (Comp-Off adds to balance, not subtracts)
    const newTotalBalance = currentTotalBalance + compOffDays;
    
    // Insert or update balance record
    await database.query(
      `INSERT INTO leave_balance (employee_id, leave_type, total_balance, used_balance, year)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (employee_id, leave_type, year) 
       DO UPDATE SET 
         total_balance = $3,
         used_balance = $4,
         updated_at = NOW()`,
      [employeeId, targetLeaveType, newTotalBalance, currentUsedBalance, year]
    );
    
    console.log(`✅ Comp-Off balance updated: Added ${compOffDays} day(s) to ${targetLeaveType} for employee ${employeeId} (location: ${location})`);
  } catch (error) {
    console.error(`❌ Failed to update Comp-Off balance:`, error);
    throw error;
  }
};

/**
 * Helper function to revert Comp-Off balance (decrease Casual Leave for India, PTO for USA)
 * @param {number} employeeId - The employee ID
 * @param {number} compOffDays - Number of Comp-Off days to remove
 * @param {string} employeeLocation - Employee location (India/IN or US/United States)
 * @param {number} year - The year
 */
const revertCompOffBalance = async (employeeId, compOffDays, employeeLocation, year) => {
  try {
    // Map location to target leave type
    let targetLeaveType = null;
    const location = (employeeLocation || '').toString().trim();
    
    if (location === 'India' || location === 'IN') {
      targetLeaveType = 'Casual Leave';
    } else if (location === 'US' || location === 'United States') {
      targetLeaveType = 'PTO';
    } else {
      // Default to Casual Leave if location not recognized
      console.warn(`⚠️ Unknown location "${location}", defaulting to Casual Leave for Comp-Off balance revert`);
      targetLeaveType = 'Casual Leave';
    }
    
    if (!targetLeaveType) {
      console.error(`❌ Cannot revert Comp-Off balance: No target leave type for location "${location}"`);
      return;
    }
    
    // Get current balance for target leave type
    const balanceCheck = await database.query(
      `SELECT total_balance, used_balance
       FROM leave_balance
       WHERE employee_id = $1 AND leave_type = $2 AND year = $3
       LIMIT 1`,
      [employeeId, targetLeaveType, year]
    );
    
    if (balanceCheck.rows.length === 0) {
      console.warn(`⚠️ No balance record found to revert Comp-Off for employee ${employeeId}, leave type ${targetLeaveType}`);
      return;
    }
    
    const currentTotalBalance = parseFloat(balanceCheck.rows[0].total_balance || 0);
    const currentUsedBalance = parseFloat(balanceCheck.rows[0].used_balance || 0);
    
    // Decrease total_balance by compOffDays
    const newTotalBalance = Math.max(0, currentTotalBalance - compOffDays);
    
    // Update balance record
    await database.query(
      `UPDATE leave_balance 
       SET total_balance = $1,
           updated_at = NOW()
       WHERE employee_id = $2 AND leave_type = $3 AND year = $4`,
      [newTotalBalance, employeeId, targetLeaveType, year]
    );
    
    console.log(`✅ Comp-Off balance reverted: Removed ${compOffDays} day(s) from ${targetLeaveType} for employee ${employeeId} (location: ${location})`);
  } catch (error) {
    console.error(`❌ Failed to revert Comp-Off balance:`, error);
    throw error;
  }
};

/**
 * Helper function to recalculate leave balance based on current approved leaves
 * This ensures balance is always accurate by recalculating from source of truth
 * @param {number} employeeId - The employee ID
 * @param {string} leaveType - The leave type name
 * @param {number} year - The year
 */
const recalculateLeaveBalance = async (employeeId, leaveType, year) => {
  try {
    // IMPORTANT: Comp-Off should NEVER deduct balance (it only increases balance)
    // If this is Comp-Off leave type, set used_balance to 0 and return early
    const isCompOff = leaveType && leaveType.toLowerCase().trim() === 'compensatory off';
    if (isCompOff) {
      // Comp-Off balance should always have used_balance = 0 (it doesn't deduct balance)
      const leaveTypeResult = await database.query(
        `SELECT max_days FROM leave_types WHERE name = $1 AND is_active = true LIMIT 1`,
        [leaveType]
      );
      const defaultBalance = leaveTypeResult.rows.length > 0 ? (leaveTypeResult.rows[0].max_days || 0) : 0;
      
      await database.query(
        `INSERT INTO leave_balance (employee_id, leave_type, total_balance, used_balance, year)
         VALUES ($1, $2, $3, 0, $4)
         ON CONFLICT (employee_id, leave_type, year) 
         DO UPDATE SET 
           total_balance = COALESCE(leave_balance.total_balance, EXCLUDED.total_balance),
           used_balance = 0,
           updated_at = NOW()`,
        [employeeId, leaveType, defaultBalance, year]
      );
      return; // Early return - Comp-Off doesn't deduct balance
    }
    
    // Get default total_balance from leave_types if balance doesn't exist
    const leaveTypeResult = await database.query(
      `SELECT max_days, code FROM leave_types WHERE name = $1 AND is_active = true LIMIT 1`,
      [leaveType]
    );
    
    let defaultBalance = 0;
    if (leaveTypeResult.rows.length > 0) {
      const lt = leaveTypeResult.rows[0];
      defaultBalance = lt.max_days || 0;
    }
    
    // Calculate used_balance as sum of all leaves that have at least one approval
    // A leave is counted if:
    // - At least one approver has approved (hod_status = 'Approved' OR admin_status = 'Approved')
    // - AND no approver has rejected (hod_status != 'Rejected' AND admin_status != 'Rejected')
    // This means: count if approved by ANY, but don't count if rejected by ANY
    // Handle NULL values properly - NULL means Pending, so treat as not approved/rejected
    // IMPORTANT: Comp-Off leaves should NOT be counted in used_balance (they increase balance, not decrease)
    // Use date range instead of EXTRACT for better index usage
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;
    const approvedLeavesSum = await database.query(
      `SELECT COALESCE(SUM(number_of_days), 0) as total_days
       FROM leave_applications
       WHERE employee_id = $1 
       AND leave_type = $2
       AND UPPER(TRIM(leave_type)) != 'COMPENSATORY OFF'
       AND start_date >= $3::date
       AND start_date <= $4::date
       AND (
         (UPPER(TRIM(COALESCE(hod_status, 'Pending'))) = 'APPROVED' OR UPPER(TRIM(COALESCE(admin_status, 'Pending'))) = 'APPROVED')
         AND UPPER(TRIM(COALESCE(hod_status, 'Pending'))) != 'REJECTED'
         AND UPPER(TRIM(COALESCE(admin_status, 'Pending'))) != 'REJECTED'
       )`,
      [employeeId, leaveType, yearStart, yearEnd]
    );
    
    const usedDays = parseFloat(approvedLeavesSum.rows[0]?.total_days || 0);
    
    // First, ensure the balance record exists with correct total_balance
    // Note: remaining_balance is a generated column - do NOT insert/update it directly
    await database.query(
      `INSERT INTO leave_balance (employee_id, leave_type, total_balance, used_balance, year)
       VALUES ($1, $2, $4, $5, $3)
       ON CONFLICT (employee_id, leave_type, year) 
       DO UPDATE SET 
         total_balance = COALESCE(leave_balance.total_balance, EXCLUDED.total_balance),
         used_balance = $5,
         updated_at = NOW()`,
      [employeeId, leaveType, year, defaultBalance, usedDays]
    );
  } catch (error) {
    console.error(`❌ Failed to recalculate leave balance:`, error);
    throw error;
  }
};

/**
 * Create Leave Application
 * Matches HR Portal: Sets HOD and Admin status based on user role
 */
export const CreateLeaveService = async (Request) => {
  const { leave_type, start_date, end_date, reason, number_of_days, leave_details, employee_id } = Request.body;
  const UserId = Request.UserId;
  const Role = Request.Role || 'employee';

  if (!leave_type || !start_date || !end_date) {
    throw CreateError("Leave type, start date, and end date are required", 400);
  }

  // Get employee_id and location FIRST (needed for accurate day calculation)
  let empId = employee_id;
  let employeeLocation = null;
  if (!empId) {
    const empResult = await database.query(
      'SELECT employee_id, location FROM employees WHERE user_id = $1 LIMIT 1',
      [UserId]
    );
    if (empResult.rows.length === 0) {
      throw CreateError("Employee record not found for user", 404);
    }
    empId = empResult.rows[0].employee_id;
    employeeLocation = empResult.rows[0].location;
  } else {
    // Get location for provided employee_id
    const empResult = await database.query(
      'SELECT location FROM employees WHERE employee_id = $1 LIMIT 1',
      [empId]
    );
    if (empResult.rows.length > 0) {
      employeeLocation = empResult.rows[0].location;
    }
  }

  // Validate leave type matches employee location
  // Handle case where location column might not exist
  let leaveTypeCheck;
  try {
    leaveTypeCheck = await database.query(
      `SELECT name, location FROM leave_types WHERE name = $1 AND is_active = true LIMIT 1`,
      [leave_type]
    );
  } catch (colError) {
    // Location column doesn't exist - try without it
    if (colError.code === '42703') {
      leaveTypeCheck = await database.query(
        `SELECT name FROM leave_types WHERE name = $1 AND is_active = true LIMIT 1`,
        [leave_type]
      );
    } else {
      throw colError;
    }
  }
  
  if (leaveTypeCheck.rows.length === 0) {
    throw CreateError(`Leave type "${leave_type}" not found or is inactive`, 400);
  }
  
  // Only validate location if column exists and value is set
  const leaveTypeLocation = leaveTypeCheck.rows[0].location;
  if (leaveTypeLocation !== undefined && leaveTypeLocation !== null) {
    // Allow if leave type location is "All", null, or matches employee location
    if (leaveTypeLocation && leaveTypeLocation !== 'All' && leaveTypeLocation !== employeeLocation) {
      throw CreateError(
        `Leave type "${leave_type}" is only available for location "${leaveTypeLocation}". Your location is "${employeeLocation || 'not set'}".`,
        400
      );
    }
  }
  // If location column doesn't exist or is null, treat as "IN" (India) - allow all

  // Check if this is Comp-Off leave type (case-insensitive)
  const isCompOff = leave_type && leave_type.toLowerCase().trim() === 'compensatory off';
  
  // Calculate number of days based on leave type
  let numDays = 0;
  
  // For Comp-Off: Validate that ALL dates are non-working days (weekends or holidays)
  if (isCompOff) {
    const { validateCompOffDates } = await import('../../utils/helpers.js');
    const compOffValidation = await validateCompOffDates(start_date, end_date, employeeLocation, database);
    
    if (!compOffValidation.isValid) {
      const invalidDatesList = compOffValidation.invalidDates.join(', ');
      throw CreateError(
        `Comp-Off can only be applied on non-working days (weekends or location-specific holidays). The following dates are working days: ${invalidDatesList}. Please select only weekends or holidays for your location.`,
        400
      );
    }
    
    // For Comp-Off, count only non-working days
    numDays = compOffValidation.nonWorkingDays;
    console.log(`✅ Comp-Off: Calculated ${numDays} non-working days (weekends + location-specific holidays) for employee location: ${employeeLocation || 'N/A'}`);
  } else {
    // For other leave types: ALWAYS calculate number of days excluding holidays and weekends
    // Never use provided number_of_days - always recalculate to ensure accuracy
    try {
      const { calculateLeaveDaysExcludingHolidays } = await import('../../utils/helpers.js');
      numDays = await calculateLeaveDaysExcludingHolidays(start_date, end_date, employeeLocation, database);
      
      if (!numDays || numDays === 0) {
        throw CreateError("Invalid date range: No working days found between start and end date. Please check if dates include only weekends/holidays.", 400);
      }
      console.log(`✅ Calculated ${numDays} working days (excluding holidays and weekends) for employee location: ${employeeLocation || 'N/A'}`);
    } catch (calcError) {
      // If it's already a CreateError, rethrow it
      if (calcError.status || calcError.statusCode) {
        throw calcError;
      }
      // For other errors, throw a descriptive error
      console.error('❌ Failed to calculate working days:', calcError);
      throw CreateError(`Failed to calculate working days: ${calcError.message}. Please ensure dates are valid and employee location is set.`, 400);
    }
  }

  // Check for overlapping leave dates (only for pending or approved leaves)
  const overlapCheck = await database.query(
    `SELECT id, leave_type, start_date, end_date, hod_status, admin_status
     FROM leave_applications
     WHERE employee_id = $1
     AND (
       (hod_status = 'Pending' OR hod_status = 'Approved')
       OR (admin_status = 'Pending' OR admin_status = 'Approved')
     )
     AND (
       (start_date <= $2 AND end_date >= $2)
       OR (start_date <= $3 AND end_date >= $3)
       OR (start_date >= $2 AND end_date <= $3)
     )`,
    [empId, start_date, end_date]
  );

  if (overlapCheck.rows.length > 0) {
    const overlappingLeave = overlapCheck.rows[0];
    throw CreateError(
      `You already have a ${overlappingLeave.leave_type} leave from ${overlappingLeave.start_date} to ${overlappingLeave.end_date} that is ${overlappingLeave.hod_status === 'Approved' && overlappingLeave.admin_status === 'Approved' ? 'approved' : 'pending'}. Please select different dates.`,
      400
    );
  }

  // Check leave exhaustion - validate available balance before creating leave
  // First, recalculate balance to ensure we have the latest data
  const year = new Date(start_date).getFullYear();
  try {
    await recalculateLeaveBalance(empId, leave_type, year);
  } catch (recalcError) {
    console.warn('Failed to recalculate balance before validation, using existing balance:', recalcError);
  }
  
  // Get the recalculated balance
  const balanceCheck = await database.query(
    `SELECT total_balance, used_balance, remaining_balance
     FROM leave_balance
     WHERE employee_id = $1 AND leave_type = $2 AND year = $3
     LIMIT 1`,
    [empId, leave_type, year]
  );

  // Get default balance from leave_types if no balance record exists
  let availableBalance = 0;
  if (balanceCheck.rows.length > 0) {
    availableBalance = parseFloat(balanceCheck.rows[0].remaining_balance || 0);
  } else {
    // No balance record exists, get default from leave_types
    const leaveTypeResult = await database.query(
      `SELECT max_days, code FROM leave_types WHERE name = $1 AND is_active = true LIMIT 1`,
      [leave_type]
    );
    
    if (leaveTypeResult.rows.length > 0) {
      const lt = leaveTypeResult.rows[0];
      // Use max_days from database (fully dynamic)
      availableBalance = parseFloat(lt.max_days || 0);
    }
  }

  // Check if user has exhausted available balance (remaining balance = 0 or less than requested)
  if (availableBalance <= 0 || availableBalance < numDays) {
    throw CreateError(
      `You have exhausted your available balance for ${leave_type}. Available: ${availableBalance} days, Requested: ${numDays} days.`,
      400
    );
  }

  // Set initial statuses based on role
  // If Admin creates leave, both HOD and Admin status are auto-approved and status is 'Approved'
  // If HOD creates leave, HOD status remains Pending (only Admin approval required)
  const isAdmin = (Role === 'admin' || Role === 'ADMIN');
  const isHod = (Role === 'hod' || Role === 'HOD');
  // HOD leaves: HOD status stays Pending, only Admin can approve
  // Admin leaves: Both statuses auto-approved
  // Employee leaves: Both statuses Pending (HOD → Admin flow)
  const hodStatus = isAdmin ? 'Approved' : 'Pending'; // HOD leaves stay Pending
  const adminStatus = isAdmin ? 'Approved' : 'Pending';
  const hodRemark = isAdmin ? 'Autoapproved' : null; // No auto-approval for HOD leaves
  const adminRemark = isAdmin ? 'Autoapproved' : null;
  // Admin leaves are fully approved immediately
  const finalStatus = isAdmin ? 'Approved' : 'pending';
  
  // When admin applies leave, set approved_by_hod and approved_by_admin to admin's employee_id
  // When HOD applies leave, do NOT set approved_by_hod (stays null, status stays Pending)
  const approvedByHod = isAdmin ? empId : null; // HOD leaves: approved_by_hod = null
  const approvedByAdmin = isAdmin ? empId : null;

  const result = await database.query(
    `INSERT INTO leave_applications (
      employee_id, leave_type, start_date, end_date, number_of_days, 
      reason, status, hod_status, admin_status, hod_remark, admin_remark,
      approved_by_hod, approved_by_admin, applied_date, created_at
    )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
     RETURNING *`,
    [empId, leave_type, start_date, end_date, numDays, reason || leave_details || null, 
     finalStatus, hodStatus, adminStatus, hodRemark, adminRemark, approvedByHod, approvedByAdmin]
  );

  const leave = result.rows[0];

  // If Admin applies leave, update balance immediately (since it's auto-approved)
  if (isAdmin && finalStatus === 'Approved') {
    const year = new Date(leave.start_date).getFullYear();
    
    // Get default total_balance from leave_types if balance doesn't exist
    const leaveTypeResult = await database.query(
      `SELECT max_days, code FROM leave_types WHERE name = $1 AND is_active = true LIMIT 1`,
      [leave.leave_type]
    );
    
    let defaultBalance = 0;
    if (leaveTypeResult.rows.length > 0) {
      const lt = leaveTypeResult.rows[0];
      // Use max_days from database (fully dynamic)
      defaultBalance = lt.max_days || 0;
    }
    
    // First, ensure the balance record exists with correct total_balance
    // Note: remaining_balance is a generated column - do NOT insert/update it directly
    await database.query(
      `INSERT INTO leave_balance (employee_id, leave_type, total_balance, used_balance, year)
       VALUES ($1, $2, $5, 0, $3)
       ON CONFLICT (employee_id, leave_type, year) 
       DO UPDATE SET 
         total_balance = COALESCE(leave_balance.total_balance, EXCLUDED.total_balance),
         updated_at = NOW()`,
      [leave.employee_id, leave.leave_type, year, leave.number_of_days, defaultBalance]
    );
    
    // Then update the used_balance (remaining_balance will be auto-calculated by DB)
    await database.query(
      `UPDATE leave_balance 
       SET used_balance = used_balance + $4,
           updated_at = NOW()
       WHERE employee_id = $1 
       AND leave_type = $2 
       AND year = $3`,
      [leave.employee_id, leave.leave_type, year, leave.number_of_days]
    );
    console.log(`✅ Admin leave balance updated immediately for ${leave.leave_type} (${leave.number_of_days} days)`);
  }

  // Check email configuration before attempting to send
  const emailConfigured = process.env.SMTP_USER && process.env.SMTP_PASS;
  if (!emailConfigured) {
    console.error('⚠️ Email not configured: SMTP_USER or SMTP_PASS missing');
  }

  // Send email notifications based on who is applying
  try {
    // Get employee details including manager_id (assigned HOD)
    const empDetailsResult = await database.query(
      `SELECT 
        u.email as employee_email,
        COALESCE(
          NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''),
          u.first_name,
          u.last_name,
          u.email
        ) as employee_name,
        u.department,
        e.manager_id,
        e.location
      FROM employees e
      JOIN users u ON e.user_id = u.user_id
      WHERE e.employee_id = $1`,
      [empId]
    );

    if (empDetailsResult.rows.length > 0) {
      const employee = empDetailsResult.rows[0];

      // Send real-time SSE event for new leave application
      // Skip HOD notifications if admin is applying leave (admin leaves are auto-approved)
      try {
        // Get employee user_id for SSE notification
        const empUserResult = await database.query(
          'SELECT user_id FROM employees WHERE employee_id = $1',
          [empId]
        );
        const employeeUserId = empUserResult.rows[0]?.user_id;

        // Notify assigned HOD (if exists) - ONLY if employee applies (not admin, not HOD)
        // HOD leaves skip HOD approval and go directly to Admin
        if (employee.manager_id && !isAdmin && !isHod) {
          const hodUserResult = await database.query(
            'SELECT user_id FROM employees WHERE employee_id = $1',
            [employee.manager_id]
          );
          const hodUserId = hodUserResult.rows[0]?.user_id;
          if (hodUserId) {
            sseService.sendToUser(hodUserId.toString(), {
              type: 'new_leave',
              message: `New leave application from ${employee.employee_name}`,
              leaveId: leave.id,
              employeeName: employee.employee_name,
              leaveType: leave.leave_type
            });
          }
        }

        // Notify all admins (ALWAYS notify admins when employee applies, even if HOD status is pending)
        // Admin needs to see all leave applications for approval
        const adminResult = await database.query(
          `SELECT user_id FROM users 
           WHERE (LOWER(TRIM(role)) = 'admin' OR role IN ('Admin', 'admin', 'ADMIN'))
           AND (status = 'Active' OR status IS NULL)
           LIMIT 10`
        );
        if (adminResult.rows.length > 0) {
          adminResult.rows.forEach(admin => {
            try {
              sseService.sendToUser(admin.user_id.toString(), {
                type: 'new_leave',
                message: `New leave application from ${employee.employee_name}`,
                leaveId: leave.id,
                employeeName: employee.employee_name,
                leaveType: leave.leave_type
              });
            } catch (sseErr) {
              console.error(`Failed to send SSE notification to admin ${admin.user_id}:`, sseErr);
            }
          });
          console.log(`✅ Sent SSE notifications to ${adminResult.rows.length} admin(s) for new leave application`);
        } else {
          console.warn('⚠️ No active admin users found for notifications');
        }
      } catch (sseError) {
        // Silent fail - don't block the response
      }
      const { sendLeaveApplicationEmail } = await import('../../utils/emailService.js');
      
      // If Employee applies: Send email to both HOD and Admin
      if (Role?.toLowerCase() === 'employee' && (hodStatus === 'Pending' || adminStatus === 'Pending')) {
        // Get HOD emails - Priority: 1) Direct manager_id (if manager is HOD), 2) Department-based HOD, 3) Location-based HOD
        let hodResult;
        let hodSource = 'none';
        
        // First, try to get HOD from direct manager assignment (if employee has manager_id and manager is HOD)
        if (employee.manager_id) {
          const directHodResult = await database.query(
            `SELECT u.email, 
             COALESCE(
               NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''),
               u.first_name,
               u.last_name,
               u.email
             ) as full_name
             FROM employees e
             JOIN users u ON e.user_id = u.user_id
             WHERE e.employee_id = $1
             AND LOWER(TRIM(u.role)) = 'hod'
             LIMIT 1`,
            [employee.manager_id]
          );
          
          if (directHodResult.rows.length > 0) {
            hodResult = directHodResult;
            hodSource = 'assigned';
          } else {
            // manager_id is set but HOD not found - this is an error condition
            // DO NOT fall back to department/location - assigned HOD should be used
          }
        }
        
        // If no direct HOD found AND no manager_id was assigned, try department-based HOD
        if ((!hodResult || hodResult.rows.length === 0) && !employee.manager_id) {
          hodResult = await database.query(
            `SELECT email, 
             COALESCE(
               NULLIF(TRIM(first_name || ' ' || last_name), ''),
               first_name,
               last_name,
               email
             ) as full_name
             FROM users 
             WHERE LOWER(TRIM(role)) = 'hod'
             AND (department = $1 OR department IS NULL)
             ORDER BY 
               CASE WHEN department = $1 THEN 1 ELSE 2 END
             LIMIT 1`,
            [employee.department]
          );
          if (hodResult.rows.length > 0) {
            hodSource = 'department';
          }
        }
        
        // If still no HOD found, try location-based HOD (ONLY if no manager_id was assigned)
        if ((!hodResult || hodResult.rows.length === 0) && !employee.manager_id && employee.location) {
          hodResult = await database.query(
            `SELECT u.email, 
             COALESCE(
               NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''),
               u.first_name,
               u.last_name,
               u.email
             ) as full_name
             FROM users u
             LEFT JOIN employees e ON e.user_id = u.user_id
             WHERE LOWER(TRIM(u.role)) = 'hod'
             AND (e.location = $1 OR e.location IS NULL)
             ORDER BY 
               CASE WHEN e.location = $1 THEN 1 ELSE 2 END
             LIMIT 1`,
            [employee.location]
          );
          if (hodResult.rows.length > 0) {
            hodSource = 'location';
          }
        }

        // Get Admin emails
        const adminResult = await database.query(
          `SELECT email, 
           COALESCE(first_name || ' ' || last_name, first_name, last_name, email) as full_name
           FROM users 
           WHERE role IN ('Admin', 'admin', 'ADMIN')
           LIMIT 10`
        );

        // Send email to ASSIGNED HOD ONLY (not all HODs) - Non-blocking
        if (hodStatus === 'Pending' && hodResult && hodResult.rows.length > 0) {
          const hod = hodResult.rows[0];
          // Generate approval token for HOD (one token for both approve/reject)
          try {
            const token = await createApprovalToken(leave.id, hod.email, 'hod');
            const baseUrl = getBaseUrl();
            console.log(`✅ Token created for HOD ${hod.email}: ${token.substring(0, 10)}...`);
            console.log(`✅ Base URL for HOD email: ${baseUrl}`);
            // Send email asynchronously without blocking the response
            // Use Comp-Off specific email if this is Comp-Off, otherwise use normal email
            if (isCompOff) {
              const { sendCompOffApplicationEmail } = await import('../../utils/emailService.js');
              sendCompOffApplicationEmail({
                to: hod.email,
                approver_name: hod.full_name,
                employee_email: employee.employee_email,
                employee_name: employee.employee_name,
                start_date: start_date,
                end_date: end_date,
                number_of_days: numDays,
                reason: reason || leave_details || null,
                approvalToken: token,
                baseUrl: baseUrl
              }).then(() => {
                console.log(`✅ Comp-Off email sent to HOD ${hod.email} with approval buttons`);
              }).catch((emailErr) => {
                console.error(`❌ Failed to send Comp-Off email to HOD ${hod.email}:`, emailErr.message);
              });
            } else {
              const { sendLeaveApplicationEmail } = await import('../../utils/emailService.js');
              sendLeaveApplicationEmail({
                to: hod.email,
                approver_name: hod.full_name,
                employee_email: employee.employee_email,
                employee_name: employee.employee_name,
                leave_type: leave_type,
                start_date: start_date,
                end_date: end_date,
                number_of_days: numDays,
                reason: reason || leave_details || null,
                approvalToken: token,
                baseUrl: baseUrl
              }).then(() => {
                console.log(`✅ Email sent to HOD ${hod.email} with approval buttons`);
              }).catch((emailErr) => {
                console.error(`❌ Failed to send email to HOD ${hod.email}:`, emailErr.message);
              });
            }
          } catch (tokenError) {
            console.error(`❌ CRITICAL: Failed to generate tokens for HOD ${hod.email}:`, tokenError.message);
            console.error(`❌ Token error stack:`, tokenError.stack);
            console.error(`❌ Token error details:`, {
              code: tokenError.code,
              detail: tokenError.detail,
              hint: tokenError.hint
            });
            // DO NOT send email without tokens - this is a critical error
            // Instead, log the error and investigate
            console.error(`❌ Email NOT sent to HOD ${hod.email} due to token creation failure. Please check database and token creation logic.`);
            // Uncomment below to send email without buttons as fallback (NOT RECOMMENDED)
            /*
            sendLeaveApplicationEmail({
              to: hod.email,
              approver_name: hod.full_name,
              employee_email: employee.employee_email,
              employee_name: employee.employee_name,
              leave_type: leave_type,
              start_date: start_date,
              end_date: end_date,
              number_of_days: numDays,
              reason: reason || leave_details || null
            }).catch((emailErr) => {
              console.error(`Failed to send email to HOD ${hod.email}:`, emailErr.message);
            });
            */
          }
        } else if (hodStatus === 'Pending') {
          console.error(`❌ ERROR: No HOD found for employee ${employee.employee_email}. manager_id: ${employee.manager_id || 'NULL'}, department: ${employee.department || 'NULL'}, location: ${employee.location || 'NULL'}`);
        }

        // Send email to Admins - Non-blocking
        if (adminStatus === 'Pending' && adminResult.rows.length > 0) {
          for (const admin of adminResult.rows) {
            // Generate approval token for Admin (one token for both approve/reject)
            try {
              console.log(`🔑 Creating approval token for Admin: ${admin.email}, leave_id: ${leave.id}`);
              const token = await createApprovalToken(leave.id, admin.email, 'admin');
              if (!token) {
                throw new Error('Token creation returned null/undefined');
              }
              const baseUrl = getBaseUrl();
              console.log(`✅ Token created successfully for Admin ${admin.email}: ${token.substring(0, 10)}...`);
              console.log(`✅ Base URL for Admin email: ${baseUrl}`);
              console.log(`✅ Sending email to Admin with token: ${token ? 'YES' : 'NO'}`);
              // Send email asynchronously without blocking the response
              // Use Comp-Off specific email if this is Comp-Off, otherwise use normal email
              if (isCompOff) {
                const { sendCompOffApplicationEmail } = await import('../../utils/emailService.js');
                sendCompOffApplicationEmail({
                  to: admin.email,
                  approver_name: admin.full_name,
                  employee_email: employee.employee_email,
                  employee_name: employee.employee_name,
                  start_date: start_date,
                  end_date: end_date,
                  number_of_days: numDays,
                  reason: reason || leave_details || null,
                  approvalToken: token,
                  baseUrl: baseUrl
                }).then(() => {
                  console.log(`✅ Comp-Off email sent to Admin ${admin.email} with approval buttons`);
                }).catch((adminEmailErr) => {
                  console.error(`❌ Failed to send Comp-Off email to Admin ${admin.email}:`, adminEmailErr.message);
                });
              } else {
                const { sendLeaveApplicationEmail } = await import('../../utils/emailService.js');
                sendLeaveApplicationEmail({
                  to: admin.email,
                  approver_name: admin.full_name,
                  employee_email: employee.employee_email,
                  employee_name: employee.employee_name,
                  leave_type: leave_type,
                  start_date: start_date,
                  end_date: end_date,
                  number_of_days: numDays,
                  reason: reason || leave_details || null,
                  approvalToken: token,
                  baseUrl: baseUrl
                }).then(() => {
                  console.log(`✅ Email sent to Admin ${admin.email} with approval buttons`);
                }).catch((adminEmailErr) => {
                  console.error(`❌ Failed to send email to Admin ${admin.email}:`, adminEmailErr.message);
                });
              }
            } catch (tokenError) {
              console.error(`❌ CRITICAL: Failed to generate tokens for Admin ${admin.email}:`, tokenError.message);
              console.error(`❌ Token error stack:`, tokenError.stack);
              console.error(`❌ Token error details:`, {
                code: tokenError.code,
                detail: tokenError.detail,
                hint: tokenError.hint,
                leaveId: leave.id,
                approverEmail: admin.email
              });
              // Still send email but log the critical error
              // Use Comp-Off specific email if this is Comp-Off, otherwise use normal email
              if (isCompOff) {
                const { sendCompOffApplicationEmail } = await import('../../utils/emailService.js');
                sendCompOffApplicationEmail({
                  to: admin.email,
                  approver_name: admin.full_name,
                  employee_email: employee.employee_email,
                  employee_name: employee.employee_name,
                  start_date: start_date,
                  end_date: end_date,
                  number_of_days: numDays,
                  reason: reason || leave_details || null,
                  approvalToken: null,
                  baseUrl: null
                }).catch((adminEmailErr) => {
                  console.error(`Failed to send Comp-Off email to Admin ${admin.email}:`, adminEmailErr.message);
                });
              } else {
                const { sendLeaveApplicationEmail } = await import('../../utils/emailService.js');
                sendLeaveApplicationEmail({
                  to: admin.email,
                  approver_name: admin.full_name,
                  employee_email: employee.employee_email,
                  employee_name: employee.employee_name,
                  leave_type: leave_type,
                  start_date: start_date,
                  end_date: end_date,
                  number_of_days: numDays,
                  reason: reason || leave_details || null,
                  approvalToken: null, // Explicitly set to null so we know buttons won't appear
                  baseUrl: null
                }).catch((adminEmailErr) => {
                  console.error(`Failed to send email to Admin ${admin.email}:`, adminEmailErr.message);
                });
              }
            }
          }
        }
      }
      // If HOD applies: Send email to Admin only
      else if ((Role?.toLowerCase() === 'hod' || Role === 'HOD') && adminStatus === 'Pending') {
        // Get Admin emails
        const adminResult = await database.query(
          `SELECT email, 
           COALESCE(first_name || ' ' || last_name, first_name, last_name, email) as full_name
           FROM users 
           WHERE role IN ('Admin', 'admin', 'ADMIN')
           LIMIT 10`
        );

        // Send email to Admins - Non-blocking
        if (adminResult.rows.length > 0) {
          for (const admin of adminResult.rows) {
            // Generate approval token for Admin (one token for both approve/reject)
            try {
              const token = await createApprovalToken(leave.id, admin.email, 'admin');
              const baseUrl = getBaseUrl();
              // Send email asynchronously without blocking the response
              // Use Comp-Off specific email if this is Comp-Off, otherwise use normal email
              if (isCompOff) {
                const { sendCompOffApplicationEmail } = await import('../../utils/emailService.js');
                sendCompOffApplicationEmail({
                  to: admin.email,
                  approver_name: admin.full_name,
                  employee_email: employee.employee_email,
                  employee_name: employee.employee_name,
                  start_date: start_date,
                  end_date: end_date,
                  number_of_days: numDays,
                  reason: reason || leave_details || null,
                  approvalToken: token,
                  baseUrl: baseUrl
                }).catch((adminEmailErr) => {
                  console.error(`Failed to send Comp-Off email to Admin ${admin.email}:`, adminEmailErr.message);
                });
              } else {
                const { sendLeaveApplicationEmail } = await import('../../utils/emailService.js');
                sendLeaveApplicationEmail({
                  to: admin.email,
                  approver_name: admin.full_name,
                  employee_email: employee.employee_email,
                  employee_name: employee.employee_name,
                  leave_type: leave_type,
                  start_date: start_date,
                  end_date: end_date,
                  number_of_days: numDays,
                  reason: reason || leave_details || null,
                  approvalToken: token,
                  baseUrl: baseUrl
                }).catch((adminEmailErr) => {
                  console.error(`Failed to send email to Admin ${admin.email}:`, adminEmailErr.message);
                });
              }
            } catch (tokenError) {
              console.error(`Failed to generate tokens for Admin ${admin.email}:`, tokenError.message);
              // Send email without tokens as fallback
              sendLeaveApplicationEmail({
                to: admin.email,
                approver_name: admin.full_name,
                employee_email: employee.employee_email,
                employee_name: employee.employee_name,
                leave_type: leave_type,
                start_date: start_date,
                end_date: end_date,
                number_of_days: numDays,
                reason: reason || leave_details || null
              }).catch((adminEmailErr) => {
                console.error(`Failed to send email to Admin ${admin.email}:`, adminEmailErr.message);
              });
            }
          }
        }
      }
      // If Admin applies leave, send organization-wide notification
      else if (isAdmin && finalStatus === 'Approved') {
        const { sendLeaveApprovalEmail } = await import('../../utils/emailService.js');
        
        // Get all active users for organization-wide notification
        const allUsersResult = await database.query(
          `SELECT email, 
           COALESCE(
             NULLIF(TRIM(first_name || ' ' || last_name), ''),
             first_name,
             last_name,
             email
           ) as full_name
           FROM users 
           WHERE (status = 'Active' OR status IS NULL)
           AND email != $1
           LIMIT 100`,
          [employee.employee_email]
        );

        // Send notification email to all users (non-blocking)
        for (const user of allUsersResult.rows) {
          if (user.email) {
            sendLeaveApprovalEmail({
              employee_email: user.email,
              employee_name: user.full_name,
              leave_type: leave_type,
              start_date: start_date,
              end_date: end_date,
              number_of_days: numDays,
              status: 'Approved',
              remark: `Admin leave approved for ${employee.employee_name}. This is an organization-wide notification.`
            }, employee.employee_name).catch((emailErr) => {
              console.error(`Failed to send org-wide notification to ${user.email}:`, emailErr.message);
            });
          }
        }
      }
    }
  } catch (emailError) {
    console.error('Email notification error:', emailError.message);
    // Don't fail the leave creation if email fails
  }

  return leave;
};

/**
 * Get Leave List for Employee (with pagination and search)
 * Matches HR Portal pattern
 */
export const GetLeaveListService = async (Request) => {
  const UserId = Request.UserId;
  const EmployeeId = Request.EmployeeId;
  const pageNumber = parseInt(Request.params?.pageNumber) || 1;
  const perPage = parseInt(Request.params?.perPage) || 5;
  const searchKeyword = Request.params?.searchKeyword || '0';
  const year = parseInt(Request.query?.year) || new Date().getFullYear();
  
  const skipRow = (pageNumber - 1) * perPage;

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

  // Build query with search and year filter (filter by year of start_date)
  let query = `
    SELECT 
      la.*,
      lt.name as leave_type_name,
      COALESCE(u.first_name || ' ' || u.last_name, u.first_name, u.last_name, u.email) as full_name,
      u.email,
      u.first_name,
      u.last_name
    FROM leave_applications la
    JOIN employees e ON la.employee_id = e.employee_id
    JOIN users u ON e.user_id = u.user_id
    LEFT JOIN leave_types lt ON la.leave_type = lt.name
    WHERE la.employee_id = $1 
    AND la.start_date >= $2::date 
    AND la.start_date <= $3::date
  `;
  
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const params = [empId, yearStart, yearEnd];
  let paramCount = 4;

  // Add search filter
  if (searchKeyword && searchKeyword !== '0') {
    query += ` AND (
      la.leave_type ILIKE $${paramCount} OR
      la.reason ILIKE $${paramCount} OR
      u.first_name ILIKE $${paramCount} OR
      u.last_name ILIKE $${paramCount} OR
      u.email ILIKE $${paramCount}
    )`;
    params.push(`%${searchKeyword}%`);
    paramCount++;
  }

  // Get total count (remove ORDER BY and LIMIT/OFFSET for count)
  const countQuery = query.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) as total FROM').replace(/ORDER BY[\s\S]*$/, '');
  const countResult = await database.query(countQuery, params);
  const total = parseInt(countResult.rows[0]?.total || 0);

  // Add pagination and ordering
  query += ` ORDER BY la.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
  params.push(perPage, skipRow);

  const result = await database.query(query, params);

  return {
    Total: [{ count: total }],
    Data: result.rows.map(row => ({
      ...row,
      LeaveType: row.leave_type_name || row.leave_type,
      Employee: [{
        FirstName: row.first_name,
        LastName: row.last_name,
        Email: row.email,
        Image: null // Add if you have image field
      }],
      HodStatus: row.hod_status || 'Pending',
      AdminStatus: row.admin_status || 'Pending',
      NumOfDay: row.number_of_days,
      LeaveDetails: row.reason,
      createdAt: row.created_at
    }))
  };
};

/**
 * Get All Leave Applications for Admin (with pagination and search)
 * Shows all leaves for Admin to approve/reject
 */
export const GetAllLeavesService = async (Request) => {
  const pageNumber = parseInt(Request.params?.pageNumber) || 1;
  const perPage = parseInt(Request.params?.perPage) || 5;
  const searchKeyword = Request.params?.searchKeyword || '0';
  const userId = Request.query?.userId || Request.body?.userId || Request.params?.userId || null;
  const skipRow = (pageNumber - 1) * perPage;

  let query = `
    SELECT 
      la.*,
      lt.name as leave_type_name,
      COALESCE(u.first_name || ' ' || u.last_name, u.first_name, u.last_name, u.email) as full_name,
      u.email,
      u.first_name,
      u.last_name,
      u.user_id,
      COALESCE(
        NULLIF(TRIM(hod_approver.first_name || ' ' || hod_approver.last_name), ''),
        hod_approver.first_name,
        hod_approver.last_name,
        hod_approver.email
      ) as hod_approver_name,
      COALESCE(
        NULLIF(TRIM(admin_approver.first_name || ' ' || admin_approver.last_name), ''),
        admin_approver.first_name,
        admin_approver.last_name,
        admin_approver.email
      ) as admin_approver_name
    FROM leave_applications la
    JOIN employees e ON la.employee_id = e.employee_id
    JOIN users u ON e.user_id = u.user_id
    LEFT JOIN leave_types lt ON la.leave_type = lt.name
    LEFT JOIN employees hod_emp ON la.approved_by_hod = hod_emp.employee_id
    LEFT JOIN users hod_approver ON hod_emp.user_id = hod_approver.user_id
    LEFT JOIN employees admin_emp ON la.approved_by_admin = admin_emp.employee_id
    LEFT JOIN users admin_approver ON admin_emp.user_id = admin_approver.user_id
    WHERE 1=1
  `;
  
  const params = [];
  let paramCount = 1;

  // Add user filter (ONLY for Admin - filter by specific user_id)
  if (userId && userId !== 'all' && userId !== 'All Users' && userId !== '') {
    query += ` AND u.user_id = $${paramCount}`;
    params.push(parseInt(userId));
    paramCount++;
  }

  // Add search filter
  if (searchKeyword && searchKeyword !== '0') {
    query += ` AND (
      la.leave_type ILIKE $${paramCount} OR
      la.reason ILIKE $${paramCount} OR
      u.first_name ILIKE $${paramCount} OR
      u.last_name ILIKE $${paramCount} OR
      u.email ILIKE $${paramCount}
    )`;
    params.push(`%${searchKeyword}%`);
    paramCount++;
  }

  // Get total count (remove ORDER BY and LIMIT/OFFSET for count)
  const countQuery = query.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) as total FROM').replace(/ORDER BY[\s\S]*$/, '');
  const countResult = await database.query(countQuery, params);
  const total = parseInt(countResult.rows[0]?.total || 0);

  // Add pagination and ordering
  query += ` ORDER BY la.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
  params.push(perPage, skipRow);

  const result = await database.query(query, params);

  return {
    Total: [{ count: total }],
    Data: result.rows.map(row => ({
      ...row,
      LeaveType: row.leave_type_name || row.leave_type,
      Employee: [{
        FirstName: row.first_name,
        LastName: row.last_name,
        Email: row.email,
        Image: null
      }],
      HodStatus: row.hod_status || 'Pending',
      AdminStatus: row.admin_status || 'Pending',
      HodApproverName: row.hod_approver_name || null,
      AdminApproverName: row.admin_approver_name || null,
      EmployeeRole: row.employee_role || null,
      NumOfDay: row.number_of_days,
      LeaveDetails: row.reason,
      createdAt: row.created_at
    }))
  };
};

/**
 * Get All Leave Applications for HOD (with pagination and search)
 */
export const GetAllLeavesHodService = async (Request) => {
  const pageNumber = parseInt(Request.params?.pageNumber) || 1;
  const perPage = parseInt(Request.params?.perPage) || 5;
  const searchKeyword = Request.params?.searchKeyword || '0';
  const skipRow = (pageNumber - 1) * perPage;
  const UserId = Request.UserId;
  const EmployeeId = Request.EmployeeId;

  // Get the logged-in HOD's employee_id
  let hodEmployeeId = EmployeeId;
  if (!hodEmployeeId && UserId) {
    const hodEmpResult = await database.query(
      'SELECT employee_id FROM employees WHERE user_id = $1 LIMIT 1',
      [UserId]
    );
    if (hodEmpResult.rows.length > 0) {
      hodEmployeeId = hodEmpResult.rows[0].employee_id;
    }
  }

  if (!hodEmployeeId) {
    throw CreateError("HOD employee record not found", 404);
  }

  let query = `
    SELECT 
      la.*,
      lt.name as leave_type_name,
      COALESCE(u.first_name || ' ' || u.last_name, u.first_name, u.last_name, u.email) as full_name,
      u.email,
      u.first_name,
      u.last_name,
      u.role as employee_role,
      COALESCE(
        NULLIF(TRIM(hod_approver.first_name || ' ' || hod_approver.last_name), ''),
        hod_approver.first_name,
        hod_approver.last_name,
        hod_approver.email
      ) as hod_approver_name,
      COALESCE(
        NULLIF(TRIM(admin_approver.first_name || ' ' || admin_approver.last_name), ''),
        admin_approver.first_name,
        admin_approver.last_name,
        admin_approver.email
      ) as admin_approver_name
    FROM leave_applications la
    JOIN employees e ON la.employee_id = e.employee_id
    JOIN users u ON e.user_id = u.user_id
    LEFT JOIN leave_types lt ON la.leave_type = lt.name
    LEFT JOIN employees hod_emp ON la.approved_by_hod = hod_emp.employee_id
    LEFT JOIN users hod_approver ON hod_emp.user_id = hod_approver.user_id
    LEFT JOIN employees admin_emp ON la.approved_by_admin = admin_emp.employee_id
    LEFT JOIN users admin_approver ON admin_emp.user_id = admin_approver.user_id
    WHERE (
      -- Priority 1: Direct manager assignment (employee's manager_id = logged-in HOD's employee_id)
      e.manager_id = $1
      OR
      -- Priority 2: Department-based (only if no manager_id assigned)
      (e.manager_id IS NULL AND EXISTS (
        SELECT 1 FROM users hod_u
        JOIN employees hod_e ON hod_e.user_id = hod_u.user_id
        WHERE hod_e.employee_id = $1
        AND hod_u.department = u.department
        AND LOWER(TRIM(hod_u.role)) = 'hod'
      ))
      OR
      -- Priority 3: Location-based (only if no manager_id assigned)
      (e.manager_id IS NULL AND EXISTS (
        SELECT 1 FROM employees hod_e
        JOIN employees emp_e ON emp_e.location = hod_e.location
        WHERE hod_e.employee_id = $1
        AND emp_e.employee_id = e.employee_id
        AND EXISTS (
          SELECT 1 FROM users hod_u
          WHERE hod_u.user_id = hod_e.user_id
          AND LOWER(TRIM(hod_u.role)) = 'hod'
        )
      ))
    )
  `;
  
  const params = [hodEmployeeId];
  let paramCount = 2;

  // Add search filter
  if (searchKeyword && searchKeyword !== '0') {
    query += ` AND (
      la.leave_type ILIKE $${paramCount} OR
      la.reason ILIKE $${paramCount} OR
      u.first_name ILIKE $${paramCount} OR
      u.last_name ILIKE $${paramCount} OR
      u.email ILIKE $${paramCount}
    )`;
    params.push(`%${searchKeyword}%`);
    paramCount++;
  }

  // Get total count (remove ORDER BY and LIMIT/OFFSET for count)
  const countQuery = query.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) as total FROM').replace(/ORDER BY[\s\S]*$/, '');
  const countResult = await database.query(countQuery, params);
  const total = parseInt(countResult.rows[0]?.total || 0);

  // Add pagination and ordering
  query += ` ORDER BY la.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
  params.push(perPage, skipRow);

  const result = await database.query(query, params);

  return {
    Total: [{ count: total }],
    Data: result.rows.map(row => ({
      ...row,
      LeaveType: row.leave_type_name || row.leave_type,
      Employee: [{
        FirstName: row.first_name,
        LastName: row.last_name,
        Email: row.email,
        Image: null
      }],
      HodStatus: row.hod_status || 'Pending',
      AdminStatus: row.admin_status || 'Pending',
      EmployeeRole: row.employee_role || null,
      NumOfDay: row.number_of_days,
      LeaveDetails: row.reason,
      createdAt: row.created_at
    }))
  };
};

/**
 * Get Leave Details
 */
export const GetLeaveDetailsService = async (Request) => {
  const { id } = Request.params;

  const result = await database.query(
    `SELECT la.*, 
     COALESCE(u.first_name || ' ' || u.last_name, u.first_name, u.last_name, u.email) as full_name,
     u.email
     FROM leave_applications la
     JOIN employees e ON la.employee_id = e.employee_id
     JOIN users u ON e.user_id = u.user_id
     WHERE la.id = $1`,
    [id]
  );

  if (result.rows.length === 0) {
    throw CreateError("Leave application not found", 404);
  }

  return result.rows[0];
};

/**
 * Update Leave Application
 * Admin can edit any leave. Employees can only edit pending leaves.
 */
export const UpdateLeaveService = async (Request) => {
  const { id } = Request.params;
  const { leave_type, start_date, end_date, reason, number_of_days } = Request.body;
  const Role = Request.Role || '';
  const isAdmin = Role === 'admin' || Role === 'Admin';

  // Get current leave to check status
  const currentLeave = await database.query(
    'SELECT * FROM leave_applications WHERE id = $1',
    [id]
  );

  if (currentLeave.rows.length === 0) {
    throw CreateError("Leave application not found", 404);
  }

  const leave = currentLeave.rows[0];

  // Check if user can edit (admin can edit any, employees only pending)
  if (!isAdmin && leave.hod_status !== 'Pending' && leave.admin_status !== 'Pending') {
    throw CreateError("Cannot edit leave that is already approved or rejected", 400);
  }

  // Build update query dynamically
  const updates = [];
  const params = [];
  let paramCount = 1;

  if (leave_type) {
    updates.push(`leave_type = $${paramCount}`);
    params.push(leave_type);
    paramCount++;
  }
  if (start_date) {
    updates.push(`start_date = $${paramCount}`);
    params.push(start_date);
    paramCount++;
  }
  if (end_date) {
    updates.push(`end_date = $${paramCount}`);
    params.push(end_date);
    paramCount++;
  }
  
  // Determine final leave type (use updated value if provided, otherwise use existing)
  const finalLeaveType = leave_type || leave.leave_type;
  const isCompOff = finalLeaveType && finalLeaveType.toLowerCase().trim() === 'compensatory off';
  
  // If start_date or end_date is being updated, recalculate number_of_days
  // Always recalculate to ensure working days are accurate (excluding weekends and holidays)
  if (start_date || end_date) {
    const finalStartDate = start_date || leave.start_date;
    const finalEndDate = end_date || leave.end_date;
    const empId = leave.employee_id;
    
    // Get employee location for accurate holiday calculation
    const empResult = await database.query(
      'SELECT location FROM employees WHERE employee_id = $1 LIMIT 1',
      [empId]
    );
    const employeeLocation = empResult.rows[0]?.location || null;
    
    // For Comp-Off: Validate that ALL dates are non-working days (weekends or holidays)
    if (isCompOff) {
      const { validateCompOffDates } = await import('../../utils/helpers.js');
      const compOffValidation = await validateCompOffDates(finalStartDate, finalEndDate, employeeLocation, database);
      
      if (!compOffValidation.isValid) {
        const invalidDatesList = compOffValidation.invalidDates.join(', ');
        throw CreateError(
          `Comp-Off can only be applied on non-working days (weekends or organization holidays). The following dates are working days: ${invalidDatesList}. Please select only weekends or holidays.`,
          400
        );
      }
      
      // For Comp-Off, count only non-working days
      updates.push(`number_of_days = $${paramCount}`);
      params.push(compOffValidation.nonWorkingDays);
      paramCount++;
      console.log(`✅ Comp-Off: Recalculated ${compOffValidation.nonWorkingDays} non-working days (weekends + location-specific holidays) for updated leave`);
    } else {
      // For other leave types: Recalculate working days
      try {
        const { calculateLeaveDaysExcludingHolidays } = await import('../../utils/helpers.js');
        const recalculatedDays = await calculateLeaveDaysExcludingHolidays(finalStartDate, finalEndDate, employeeLocation, database);
        
        if (!recalculatedDays || recalculatedDays === 0) {
          throw CreateError("Invalid date range: No working days found between start and end date. Please check if dates include only weekends/holidays.", 400);
        }
        
        updates.push(`number_of_days = $${paramCount}`);
        params.push(recalculatedDays);
        paramCount++;
        console.log(`✅ Recalculated ${recalculatedDays} working days for updated leave (excluding holidays and weekends)`);
      } catch (calcError) {
        if (calcError.status || calcError.statusCode) {
          throw calcError;
        }
        console.error('❌ Failed to recalculate working days:', calcError);
        throw CreateError(`Failed to recalculate working days: ${calcError.message}`, 400);
      }
    }
  } else if (number_of_days) {
    // If only number_of_days is provided without date changes, recalculate to ensure accuracy
    const finalStartDate = leave.start_date;
    const finalEndDate = leave.end_date;
    const empId = leave.employee_id;
    
    // Get employee location
    const empResult = await database.query(
      'SELECT location FROM employees WHERE employee_id = $1 LIMIT 1',
      [empId]
    );
    const employeeLocation = empResult.rows[0]?.location || null;
    
    // Recalculate to ensure accuracy
    try {
      if (isCompOff) {
        const { validateCompOffDates } = await import('../../utils/helpers.js');
        const compOffValidation = await validateCompOffDates(finalStartDate, finalEndDate, employeeLocation, database);
        
        if (compOffValidation.isValid && compOffValidation.nonWorkingDays > 0) {
          updates.push(`number_of_days = $${paramCount}`);
          params.push(compOffValidation.nonWorkingDays);
          paramCount++;
          console.log(`✅ Comp-Off: Recalculated ${compOffValidation.nonWorkingDays} non-working days (weekends + location-specific holidays)`);
        } else {
          console.warn('⚠️ Could not recalculate Comp-Off days, keeping existing value');
        }
      } else {
        const { calculateLeaveDaysExcludingHolidays } = await import('../../utils/helpers.js');
        const recalculatedDays = await calculateLeaveDaysExcludingHolidays(finalStartDate, finalEndDate, employeeLocation, database);
        
        if (recalculatedDays > 0) {
          updates.push(`number_of_days = $${paramCount}`);
          params.push(recalculatedDays);
          paramCount++;
          console.log(`✅ Recalculated ${recalculatedDays} working days (excluding holidays and weekends)`);
        } else {
          // If recalculation fails, don't update number_of_days
          console.warn('⚠️ Could not recalculate days, keeping existing value');
        }
      }
    } catch (calcError) {
      // On error, don't update number_of_days
      console.warn('⚠️ Could not recalculate days, keeping existing value:', calcError.message);
    }
  } else if (leave_type && isCompOff) {
    // If leave_type is being changed to Comp-Off, validate existing dates
    const finalStartDate = leave.start_date;
    const finalEndDate = leave.end_date;
    const empId = leave.employee_id;
    
    // Get employee location
    const empResult = await database.query(
      'SELECT location FROM employees WHERE employee_id = $1 LIMIT 1',
      [empId]
    );
    const employeeLocation = empResult.rows[0]?.location || null;
    
    // Validate Comp-Off dates
    const { validateCompOffDates } = await import('../../utils/helpers.js');
    const compOffValidation = await validateCompOffDates(finalStartDate, finalEndDate, employeeLocation, database);
    
    if (!compOffValidation.isValid) {
      const invalidDatesList = compOffValidation.invalidDates.join(', ');
      throw CreateError(
        `Comp-Off can only be applied on non-working days (weekends or location-specific holidays). The following dates are working days: ${invalidDatesList}. Please select only weekends or holidays for your location.`,
        400
      );
    }
    
    // Update number_of_days to count only non-working days
    updates.push(`number_of_days = $${paramCount}`);
    params.push(compOffValidation.nonWorkingDays);
    paramCount++;
    console.log(`✅ Comp-Off: Updated number_of_days to ${compOffValidation.nonWorkingDays} non-working days (weekends + location-specific holidays)`);
  }
  
  if (reason !== undefined) {
    updates.push(`reason = $${paramCount}`);
    params.push(reason);
    paramCount++;
  }

  if (updates.length === 0) {
    throw CreateError("No fields to update", 400);
  }

  updates.push(`updated_at = NOW()`);
  params.push(id);

  const result = await database.query(
    `UPDATE leave_applications 
     SET ${updates.join(', ')}
     WHERE id = $${paramCount}
     RETURNING *`,
    params
  );

  return result.rows[0];
};

/**
 * Delete Leave Application
 * Admin can delete any leave (approved, rejected, pending)
 * Other users (HOD, employees) can only delete pending leaves
 */
export const DeleteLeaveService = async (Request) => {
  const { id } = Request.params;
  const Role = Request.Role || '';
  const isAdmin = Role?.toLowerCase() === 'admin';

  // Get current leave to check status
  const leaveResult = await database.query(
    'SELECT * FROM leave_applications WHERE id = $1',
    [id]
  );

  if (leaveResult.rows.length === 0) {
    throw CreateError("Leave application not found", 404);
  }

  const leave = leaveResult.rows[0];

  // Check permissions: Admin can delete any leave, others can only delete pending leaves
  if (!isAdmin) {
    const hodStatus = (leave.hod_status || 'Pending').toString().trim().toLowerCase();
    const adminStatus = (leave.admin_status || 'Pending').toString().trim().toLowerCase();
    
    // If either HOD or Admin has approved/rejected, non-admin cannot delete
    if (hodStatus !== 'pending' || adminStatus !== 'pending') {
      throw CreateError("Only pending leave applications can be deleted. Admin can delete approved/rejected leaves.", 403);
    }
  }

  // Get leave details before deletion for SSE notification
  const leaveBeforeDelete = await database.query(
    `SELECT la.*, e.user_id as employee_user_id
     FROM leave_applications la
     JOIN employees e ON la.employee_id = e.employee_id
     WHERE la.id = $1`,
    [id]
  );

  // Store leave info for balance recalculation after deletion
  const hadApproval = leave.hod_status === 'Approved' || leave.admin_status === 'Approved';
  const leaveInfo = {
    employee_id: leave.employee_id,
    leave_type: leave.leave_type,
    start_date: leave.start_date,
    number_of_days: leave.number_of_days
  };
  
  // Check if this is Comp-Off leave type
  const isCompOff = leave.leave_type && leave.leave_type.toLowerCase().trim() === 'compensatory off';
  
  // Get employee location for Comp-Off balance revert
  let employeeLocation = null;
  if (isCompOff && hadApproval) {
    const empLocResult = await database.query(
      'SELECT location FROM employees WHERE employee_id = $1 LIMIT 1',
      [leave.employee_id]
    );
    if (empLocResult.rows.length > 0) {
      employeeLocation = empLocResult.rows[0].location;
    }
  }

  const result = await database.query(
    'DELETE FROM leave_applications WHERE id = $1 RETURNING *',
    [id]
  );

  // Handle Comp-Off balance revert or normal balance recalculation
  if (isCompOff && hadApproval) {
    // For Comp-Off: Revert the balance that was previously added
    const year = new Date(leave.start_date).getFullYear();
    await revertCompOffBalance(leave.employee_id, leave.number_of_days, employeeLocation, year);
  } else if (hadApproval) {
    // For other leave types: Recalculate leave balance after deletion if leave had any approval
    // This ensures balance is accurate after deletion (leave is already deleted, so won't be counted)
    try {
      const year = new Date(leaveInfo.start_date).getFullYear();
      // Recalculate balance to reflect the deletion (deleted leave won't be in the sum)
      await recalculateLeaveBalance(leaveInfo.employee_id, leaveInfo.leave_type, year);
      console.log(`✅ Leave balance recalculated after deletion: ${leaveInfo.leave_type}`);
    } catch (balanceError) {
      // Log error but don't fail deletion
      console.error('Failed to recalculate leave balance after deletion:', balanceError);
    }
  }

  // Send real-time SSE event for leave deletion
  try {
    if (leaveBeforeDelete.rows.length > 0) {
      const deletedLeave = leaveBeforeDelete.rows[0];
      const employeeUserId = deletedLeave.employee_user_id;
      if (employeeUserId) {
        sseService.sendToUser(employeeUserId.toString(), {
          type: 'leave_deleted',
          message: 'Your leave application has been deleted',
          leaveId: id
        });
      }
    }
  } catch (sseError) {
    console.error('SSE notification error:', sseError);
  }

  return { message: "Leave application deleted successfully" };
};

/**
 * Approve/Reject Leave (HOD)
 * Logic: If either HOD or Admin approves, leave is approved. If any one rejects, leave is rejected.
 * Updates leave balance when approved.
 * Sends email notification.
 */
export const ApproveLeaveHodService = async (Request) => {
  const { id } = Request.params;
  const { status, comment } = Request.body;
  const Role = Request.Role || '';

  if (!['Approved', 'Rejected'].includes(status)) {
    throw CreateError("Invalid status. Must be 'Approved' or 'Rejected'", 400);
  }

  // Get employee_id for approved_by_hod
  let empId = Request.EmployeeId;
  if (!empId) {
    const empResult = await database.query(
      'SELECT employee_id FROM employees WHERE user_id = $1 LIMIT 1',
      [Request.UserId]
    );
    if (empResult.rows.length > 0) {
      empId = empResult.rows[0].employee_id;
    }
  }

  // Get current leave application with employee details
  const leaveResult = await database.query(
    `SELECT la.*, 
            e.user_id as employee_user_id,
            u.email as employee_email,
            COALESCE(u.first_name || ' ' || u.last_name, u.first_name, u.last_name, u.email) as employee_name
     FROM leave_applications la
     JOIN employees e ON la.employee_id = e.employee_id
     JOIN users u ON e.user_id = u.user_id
     WHERE la.id = $1`,
    [id]
  );

  if (leaveResult.rows.length === 0) {
    throw CreateError("Leave application not found", 404);
  }

  const leave = leaveResult.rows[0];

  // Authorization check: Verify that the HOD is authorized to approve this leave
  // Check if the HOD is the direct manager, department HOD, or location HOD
  // Admin can approve any leave, so skip this check for admin
  if (Role?.toLowerCase() !== 'admin') {
    // Get the employee's department and location
    const empDeptResult = await database.query(
      `SELECT e.manager_id, e.location, u.department
       FROM employees e
       JOIN users u ON e.user_id = u.user_id
       WHERE e.employee_id = $1`,
      [leave.employee_id]
    );
    
    if (empDeptResult.rows.length > 0) {
      const empInfo = empDeptResult.rows[0];
      let isAuthorized = false;
      
      // Check 1: Is the HOD the direct manager?
      if (empInfo.manager_id && empId && empInfo.manager_id.toString() === empId.toString()) {
        isAuthorized = true;
      }
      
      // Check 2: Is the HOD from the same department?
      if (!isAuthorized && empInfo.department) {
        const hodDeptResult = await database.query(
          `SELECT u.user_id, u.department
           FROM employees e
           JOIN users u ON e.user_id = u.user_id
           WHERE e.employee_id = $1 AND u.role IN ('HOD', 'hod') AND u.department = $2`,
          [empId, empInfo.department]
        );
        if (hodDeptResult.rows.length > 0) {
          isAuthorized = true;
        }
      }
      
      // Check 3: Is the HOD from the same location?
      if (!isAuthorized && empInfo.location) {
        const hodLocResult = await database.query(
          `SELECT e.employee_id
           FROM employees e
           WHERE e.employee_id = $1 AND e.location = $2`,
          [empId, empInfo.location]
        );
        if (hodLocResult.rows.length > 0) {
          // Verify the employee at this location is a HOD
          const hodUserResult = await database.query(
            `SELECT u.role
             FROM employees e
             JOIN users u ON e.user_id = u.user_id
             WHERE e.employee_id = $1 AND u.role IN ('HOD', 'hod')`,
            [empId]
          );
          if (hodUserResult.rows.length > 0) {
            isAuthorized = true;
          }
        }
      }
      
      // If none of the checks pass, throw error (unless admin)
      if (!isAuthorized) {
        throw CreateError("You are not authorized to approve leaves for this employee. Only the assigned HOD (by manager, department, or location) can approve.", 403);
      }
    }
  }

  // Update HOD status
  // Ensure empId is an integer or null, and comment is null if empty
  const approvedByHod = empId ? parseInt(empId) : null;
  // Use COALESCE to handle null properly - convert empty string to null
  const hodRemark = comment && typeof comment === 'string' && comment.trim() ? comment.trim() : null;
  
  const result = await database.query(
    `UPDATE leave_applications 
     SET hod_status = $1, 
         hod_remark = COALESCE($2, NULL), 
         approved_by_hod = $3, 
         hod_approved_at = NOW(),
         updated_at = NOW()
     WHERE id = $4
     RETURNING *`,
    [status, hodRemark, approvedByHod, parseInt(id)]
  );

  const updatedLeave = result.rows[0];

  // Determine final status: Both HOD and Admin must approve. If any one rejects, leave is rejected.
  const hodStatus = status;
  const adminStatus = updatedLeave.admin_status || 'Pending';
  
  let finalStatus = 'Pending';
  if (hodStatus === 'Rejected' || adminStatus === 'Rejected') {
    finalStatus = 'Rejected';
  } else if (hodStatus === 'Approved' && adminStatus === 'Approved') {
    // Both must approve for final approval
    finalStatus = 'Approved';
  } else {
    // Still waiting for the other approver
    finalStatus = 'Pending';
  }

  // Update final status
  await database.query(
    `UPDATE leave_applications 
     SET status = $1
     WHERE id = $2`,
    [finalStatus, id]
  );

  // Check if this is Comp-Off leave type
  const isCompOff = leave.leave_type && leave.leave_type.toLowerCase().trim() === 'compensatory off';
  
  // Get employee location for Comp-Off balance update
  let employeeLocation = null;
  if (isCompOff) {
    const empLocResult = await database.query(
      'SELECT location FROM employees WHERE employee_id = $1 LIMIT 1',
      [leave.employee_id]
    );
    if (empLocResult.rows.length > 0) {
      employeeLocation = empLocResult.rows[0].location;
    }
  }
  
  // Handle balance update/revert based on status change
  const year = new Date(leave.start_date).getFullYear();
  const oldFinalStatus = leave.status || 'Pending';
  
  if (isCompOff) {
    // For Comp-Off: Update balance when approved, revert when rejected
    // Comp-Off should NOT deduct balance, only INCREASE it
    if (finalStatus === 'Approved' && oldFinalStatus !== 'Approved') {
      // Final status changed to 'Approved' for the first time - INCREASE balance
      await updateCompOffBalance(leave.employee_id, leave.number_of_days, employeeLocation, year);
    } else if (finalStatus === 'Rejected' && oldFinalStatus === 'Approved') {
      // Final status changed from 'Approved' to 'Rejected' - revert the balance increase
      await revertCompOffBalance(leave.employee_id, leave.number_of_days, employeeLocation, year);
    }
    // If status didn't change (e.g., was already Approved and still Approved), don't update balance again
  } else {
    // For other leave types: Update balance ONLY when status changes
    // Balance is deducted when status becomes APPROVED, reverted when REJECTED/CANCELLED
    if (finalStatus === 'Approved' && oldFinalStatus !== 'Approved') {
      // Status changed to APPROVED - recalculate balance (will include this leave in used_balance)
      await recalculateLeaveBalance(leave.employee_id, leave.leave_type, year);
    } else if ((finalStatus === 'Rejected' || finalStatus === 'Cancelled') && oldFinalStatus === 'Approved') {
      // Status changed from APPROVED to REJECTED/CANCELLED - recalculate balance (will exclude this leave)
      await recalculateLeaveBalance(leave.employee_id, leave.leave_type, year);
    }
    // If status didn't change, don't update balance
  }

  // Get approver name
  let approverName = 'HOD';
  if (empId) {
    const approverResult = await database.query(
      `SELECT COALESCE(
        NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''),
        u.first_name,
        u.last_name,
        u.email
      ) as approver_name
       FROM employees e
       JOIN users u ON e.user_id = u.user_id
       WHERE e.employee_id = $1`,
      [empId]
    );
    approverName = approverResult.rows[0]?.approver_name || 'HOD';
  }

  // Send email notification to employee (non-blocking)
  // Only send email if final status changed to Approved or Rejected (not if still Pending)
  if (finalStatus !== 'Pending') {
    if (isCompOff) {
      // Use Comp-Off specific email templates
      const { sendCompOffApprovalEmail, sendCompOffRejectionEmail } = await import('../../utils/emailService.js');
      if (finalStatus === 'Approved') {
        sendCompOffApprovalEmail({
          employee_email: leave.employee_email,
          employee_name: leave.employee_name,
          start_date: leave.start_date,
          end_date: leave.end_date,
          number_of_days: leave.number_of_days,
          remark: comment
        }, approverName)
          .then(() => {
            console.log(`✅ Comp-Off approval email sent to employee: ${leave.employee_email}`);
          })
          .catch((emailError) => {
            console.error('Comp-Off approval email sending failed:', emailError);
          });
      } else if (finalStatus === 'Rejected') {
        sendCompOffRejectionEmail({
          employee_email: leave.employee_email,
          employee_name: leave.employee_name,
          start_date: leave.start_date,
          end_date: leave.end_date,
          number_of_days: leave.number_of_days,
          remark: comment
        }, approverName)
          .then(() => {
            console.log(`✅ Comp-Off rejection email sent to employee: ${leave.employee_email}`);
          })
          .catch((emailError) => {
            console.error('Comp-Off rejection email sending failed:', emailError);
          });
      }
    } else {
      // Use normal leave email templates
      const { sendLeaveApprovalEmail } = await import('../../utils/emailService.js');
      sendLeaveApprovalEmail({
        employee_email: leave.employee_email,
        employee_name: leave.employee_name,
        leave_type: leave.leave_type,
        start_date: leave.start_date,
        end_date: leave.end_date,
        number_of_days: leave.number_of_days,
        status: finalStatus,
        remark: comment
      }, approverName)
        .then(() => {
          console.log(`✅ Approval email sent to employee: ${leave.employee_email}`);
        })
        .catch((emailError) => {
          console.error('Email sending failed:', emailError);
        });
    }
  }

  // If approved, send organization-wide informational notification to all users (NOT approval emails)
  if (finalStatus === 'Approved') {
    try {
      const { sendLeaveInfoNotificationEmail } = await import('../../utils/emailService.js');
      
      // Get all active employees for organization-wide notification
      // Join with employees table to ensure we get all active employees
      const allUsersResult = await database.query(
        `SELECT DISTINCT u.email, 
         COALESCE(
           NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''),
           u.first_name,
           u.last_name,
           u.email
         ) as full_name
         FROM users u
         LEFT JOIN employees e ON e.user_id = u.user_id
         WHERE (u.status = 'Active' OR u.status IS NULL)
         AND u.email IS NOT NULL
         AND u.email != $1
         ORDER BY u.email`,
        [leave.employee_email]
      );

      // Send informational notification email to all users (non-blocking)
      for (const user of allUsersResult.rows) {
        if (user.email) {
          sendLeaveInfoNotificationEmail({
            to: user.email,
            recipient_name: user.full_name,
            employee_name: leave.employee_name,
            leave_type: leave.leave_type,
            start_date: leave.start_date,
            end_date: leave.end_date,
            number_of_days: leave.number_of_days,
            approver_name: approverName
          }).catch((emailErr) => {
            console.error(`Failed to send org-wide info notification to ${user.email}:`, emailErr.message);
          });
        }
      }
    } catch (orgEmailError) {
      console.error('Failed to send organization-wide notifications:', orgEmailError);
      // Don't fail the approval if org-wide email fails
    }
  }

  // Send real-time SSE event for leave status update
  try {
    // Notify the employee
    sseService.sendToUser(leave.employee_user_id?.toString(), {
      type: 'leave_status_update',
      message: `Your leave has been ${finalStatus.toLowerCase()}`,
      leaveId: id,
      status: finalStatus,
      approver: approverName
    });
    
    // Notify the approver (HOD) so their approvals page refreshes
    if (Request.UserId) {
      sseService.sendToUser(Request.UserId.toString(), {
        type: 'leave_status_update',
        message: `Leave application status updated`,
        leaveId: id,
        status: finalStatus
      });
    }
    
    // Notify all admins (they might be viewing approvals)
    sseService.sendToRole('admin', {
      type: 'leave_status_update',
      message: `Leave application status updated`,
      leaveId: id,
      status: finalStatus
    });
  } catch (sseError) {
    // Silent fail - don't block the response
  }

  // If HOD approved/rejected and Admin status is still pending, notify all admins WITH APPROVAL BUTTONS
  if ((status === 'Approved' || status === 'Rejected') && adminStatus === 'Pending') {
    try {
      const { sendLeaveApplicationEmail } = await import('../../utils/emailService.js');
      const { createApprovalToken, getBaseUrl } = await import('../../utils/approvalToken.js');
      
      // Get all Admin emails
      const adminResult = await database.query(
        `SELECT email, 
         COALESCE(
           NULLIF(TRIM(first_name || ' ' || last_name), ''),
           first_name,
           last_name,
           email
         ) as full_name
         FROM users 
         WHERE LOWER(TRIM(role)) = 'admin'
         LIMIT 10`
      );

      // Get HOD name who approved/rejected (use approverName which was already fetched)
      const hodName = approverName;

      // Send email to all admins WITH APPROVAL BUTTONS (since Admin needs to approve)
      if (adminResult.rows.length > 0) {
        for (const admin of adminResult.rows) {
          // Generate approval token for Admin (one token for both approve/reject)
          try {
            const token = await createApprovalToken(updatedLeave.id, admin.email, 'admin');
            const baseUrl = getBaseUrl();
            // Send email with approval buttons
            await sendLeaveApplicationEmail({
              to: admin.email,
              approver_name: admin.full_name,
              employee_email: leave.employee_email,
              employee_name: leave.employee_name,
              leave_type: leave.leave_type,
              start_date: leave.start_date,
              end_date: leave.end_date,
              number_of_days: leave.number_of_days,
              reason: leave.reason || null,
              hod_status: status, // 'Approved' or 'Rejected'
              hod_name: hodName,
              approvalToken: token,
              baseUrl: baseUrl
            }).catch((adminEmailErr) => {
              console.error(`Failed to send email to Admin ${admin.email}:`, adminEmailErr.message);
            });
          } catch (tokenError) {
            console.error(`Failed to generate tokens for Admin ${admin.email}:`, tokenError.message);
            // Send email without tokens as fallback
            await sendLeaveApplicationEmail({
              to: admin.email,
              approver_name: admin.full_name,
              employee_email: leave.employee_email,
              employee_name: leave.employee_name,
              leave_type: leave.leave_type,
              start_date: leave.start_date,
              end_date: leave.end_date,
              number_of_days: leave.number_of_days,
              reason: leave.reason || null,
              hod_status: status,
              hod_name: hodName
            }).catch((adminEmailErr) => {
              console.error(`Failed to send email to Admin ${admin.email}:`, adminEmailErr.message);
            });
          }
        }
      }
    } catch (adminNotifyError) {
      console.error('Failed to notify admins:', adminNotifyError);
    }
  }

  return { ...updatedLeave, status: finalStatus };
};

/**
 * Approve/Reject Leave (Admin)
 * Logic: If either HOD or Admin approves, leave is approved. If any one rejects, leave is rejected.
 * Updates leave balance when approved.
 * Sends email notification.
 */
export const ApproveLeaveAdminService = async (Request) => {
  const { id } = Request.params;
  const { status, comment } = Request.body;

  if (!['Approved', 'Rejected'].includes(status)) {
    throw CreateError("Invalid status. Must be 'Approved' or 'Rejected'", 400);
  }

  // Get employee_id for approved_by_admin
  let empId = Request.EmployeeId;
  if (!empId) {
    const empResult = await database.query(
      'SELECT employee_id FROM employees WHERE user_id = $1 LIMIT 1',
      [Request.UserId]
    );
    if (empResult.rows.length > 0) {
      empId = empResult.rows[0].employee_id;
    }
  }

  // Get current leave application with employee details
  const leaveResult = await database.query(
    `SELECT la.*, 
            e.user_id as employee_user_id,
            u.email as employee_email,
            COALESCE(u.first_name || ' ' || u.last_name, u.first_name, u.last_name, u.email) as employee_name
     FROM leave_applications la
     JOIN employees e ON la.employee_id = e.employee_id
     JOIN users u ON e.user_id = u.user_id
     WHERE la.id = $1`,
    [id]
  );

  if (leaveResult.rows.length === 0) {
    throw CreateError("Leave application not found", 404);
  }

  const leave = leaveResult.rows[0];

  // ENFORCEMENT RULE: If HOD has rejected, Admin cannot approve
  // Rejected leaves should be final unless the employee submits a new request
  if (leave.hod_status === 'Rejected' && status === 'Approved') {
    throw CreateError("Cannot approve leave: HOD has already rejected this leave application. The employee must submit a new request.", 400);
  }

  // Update Admin status
  // Ensure empId is an integer or null, and comment is null if empty
  const approvedByAdmin = empId ? parseInt(empId) : null;
  // Convert empty string/undefined to null for proper SQL handling
  const adminRemark = (comment && typeof comment === 'string' && comment.trim()) ? comment.trim() : null;
  
  // Use explicit parameter types to avoid PostgreSQL type inference issues
  const result = await database.query(
    `UPDATE leave_applications 
     SET admin_status = $1::text, 
         admin_remark = $2::text, 
         approved_by_admin = $3::integer, 
         admin_approved_at = NOW(),
         updated_at = NOW()
     WHERE id = $4::integer
     RETURNING *`,
    [status, adminRemark, approvedByAdmin, parseInt(id)]
  );

  const updatedLeave = result.rows[0];

  // Determine final status: Both HOD and Admin must approve. If any one rejects, leave is rejected.
  const adminStatus = status;
  const hodStatus = updatedLeave.hod_status || 'Pending';
  
  let finalStatus = 'Pending';
  if (hodStatus === 'Rejected' || adminStatus === 'Rejected') {
    finalStatus = 'Rejected';
  } else if (hodStatus === 'Approved' && adminStatus === 'Approved') {
    // Both must approve for final approval
    finalStatus = 'Approved';
  } else {
    // Still waiting for the other approver
    finalStatus = 'Pending';
  }

  // Update final status
  await database.query(
    `UPDATE leave_applications 
     SET status = $1
     WHERE id = $2`,
    [finalStatus, id]
  );

  // Check if this is Comp-Off leave type
  const isCompOff = leave.leave_type && leave.leave_type.toLowerCase().trim() === 'compensatory off';
  
  // Get employee location for Comp-Off balance update
  let employeeLocation = null;
  if (isCompOff) {
    const empLocResult = await database.query(
      'SELECT location FROM employees WHERE employee_id = $1 LIMIT 1',
      [leave.employee_id]
    );
    if (empLocResult.rows.length > 0) {
      employeeLocation = empLocResult.rows[0].location;
    }
  }
  
  // Handle balance update/revert based on status change
  const year = new Date(leave.start_date).getFullYear();
  const oldFinalStatus = leave.status || 'Pending';
  
  if (isCompOff) {
    // For Comp-Off: Update balance when approved, revert when rejected
    // Comp-Off should NOT deduct balance, only INCREASE it
    if (finalStatus === 'Approved' && oldFinalStatus !== 'Approved') {
      // Final status changed to 'Approved' for the first time - INCREASE balance
      await updateCompOffBalance(leave.employee_id, leave.number_of_days, employeeLocation, year);
    } else if (finalStatus === 'Rejected' && oldFinalStatus === 'Approved') {
      // Final status changed from 'Approved' to 'Rejected' - revert the balance increase
      await revertCompOffBalance(leave.employee_id, leave.number_of_days, employeeLocation, year);
    }
    // If status didn't change (e.g., was already Approved and still Approved), don't update balance again
  } else {
    // For other leave types: Update balance ONLY when status changes
    // Balance is deducted when status becomes APPROVED, reverted when REJECTED/CANCELLED
    if (finalStatus === 'Approved' && oldFinalStatus !== 'Approved') {
      // Status changed to APPROVED - recalculate balance (will include this leave in used_balance)
      await recalculateLeaveBalance(leave.employee_id, leave.leave_type, year);
    } else if ((finalStatus === 'Rejected' || finalStatus === 'Cancelled') && oldFinalStatus === 'Approved') {
      // Status changed from APPROVED to REJECTED/CANCELLED - recalculate balance (will exclude this leave)
      await recalculateLeaveBalance(leave.employee_id, leave.leave_type, year);
    }
    // If status didn't change, don't update balance
  }

  // Get approver name
  let approverName = 'Admin';
  if (empId) {
    const approverResult = await database.query(
      `SELECT COALESCE(
        NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''),
        u.first_name,
        u.last_name,
        u.email
      ) as approver_name
       FROM employees e
       JOIN users u ON e.user_id = u.user_id
       WHERE e.employee_id = $1`,
      [empId]
    );
    approverName = approverResult.rows[0]?.approver_name || 'Admin';
  }

  // Send email notification to employee (non-blocking)
  // Only send email if final status changed to Approved or Rejected (not if still Pending)
  if (finalStatus !== 'Pending') {
    if (isCompOff) {
      // Use Comp-Off specific email templates
      const { sendCompOffApprovalEmail, sendCompOffRejectionEmail } = await import('../../utils/emailService.js');
      if (finalStatus === 'Approved') {
        sendCompOffApprovalEmail({
          employee_email: leave.employee_email,
          employee_name: leave.employee_name,
          start_date: leave.start_date,
          end_date: leave.end_date,
          number_of_days: leave.number_of_days,
          remark: comment
        }, approverName)
          .then(() => {
            console.log(`✅ Comp-Off approval email sent to employee: ${leave.employee_email}`);
          })
          .catch((emailError) => {
            console.error('Comp-Off approval email sending failed:', emailError);
          });
      } else if (finalStatus === 'Rejected') {
        sendCompOffRejectionEmail({
          employee_email: leave.employee_email,
          employee_name: leave.employee_name,
          start_date: leave.start_date,
          end_date: leave.end_date,
          number_of_days: leave.number_of_days,
          remark: comment
        }, approverName)
          .then(() => {
            console.log(`✅ Comp-Off rejection email sent to employee: ${leave.employee_email}`);
          })
          .catch((emailError) => {
            console.error('Comp-Off rejection email sending failed:', emailError);
          });
      }
    } else {
      // Use normal leave email templates
      const { sendLeaveApprovalEmail } = await import('../../utils/emailService.js');
      sendLeaveApprovalEmail({
        employee_email: leave.employee_email,
        employee_name: leave.employee_name,
        leave_type: leave.leave_type,
        start_date: leave.start_date,
        end_date: leave.end_date,
        number_of_days: leave.number_of_days,
        status: finalStatus,
        remark: comment
      }, approverName)
        .then(() => {
        console.log(`✅ Approval email sent to employee: ${leave.employee_email}`);
      })
      .catch((emailError) => {
        console.error('Email sending failed:', emailError);
      });
    }
  }

  // If approved, send organization-wide informational notification to all users (NOT approval emails)
  // This applies to ALL approved leaves (including Comp-Off and normal leaves)
  if (finalStatus === 'Approved') {
    try {
      const { sendLeaveInfoNotificationEmail } = await import('../../utils/emailService.js');
      
      // Get all active employees for organization-wide notification
      // Join with employees table to ensure we get all active employees
      const allUsersResult = await database.query(
        `SELECT DISTINCT u.email, 
         COALESCE(
           NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''),
           u.first_name,
           u.last_name,
           u.email
         ) as full_name
         FROM users u
         LEFT JOIN employees e ON e.user_id = u.user_id
         WHERE (u.status = 'Active' OR u.status IS NULL)
         AND u.email IS NOT NULL
         AND u.email != $1
         ORDER BY u.email`,
        [leave.employee_email]
      );

      // Send informational notification email to all users (non-blocking)
      for (const user of allUsersResult.rows) {
        if (user.email) {
          sendLeaveInfoNotificationEmail({
            to: user.email,
            recipient_name: user.full_name,
            employee_name: leave.employee_name,
            leave_type: leave.leave_type,
            start_date: leave.start_date,
            end_date: leave.end_date,
            number_of_days: leave.number_of_days,
            approver_name: approverName
          }).catch((emailErr) => {
            console.error(`Failed to send org-wide info notification to ${user.email}:`, emailErr.message);
          });
        }
      }
    } catch (orgEmailError) {
      console.error('Failed to send organization-wide notifications:', orgEmailError);
      // Don't fail the approval if org-wide email fails
    }
  }

  // Send real-time SSE event for leave status update
  try {
    // Notify the employee
    sseService.sendToUser(leave.employee_user_id?.toString(), {
      type: 'leave_status_update',
      message: `Your leave has been ${finalStatus.toLowerCase()}`,
      leaveId: id,
      status: finalStatus,
      approver: approverName
    });
    
    // Notify the approver (Admin) so their approvals page refreshes
    if (Request.UserId) {
      sseService.sendToUser(Request.UserId.toString(), {
        type: 'leave_status_update',
        message: `Leave application status updated`,
        leaveId: id,
        status: finalStatus
      });
    }
    
    // Notify all HODs (they might be viewing approvals)
    sseService.sendToRole('hod', {
      type: 'leave_status_update',
      message: `Leave application status updated`,
      leaveId: id,
      status: finalStatus
    });
  } catch (sseError) {
    // Silent fail - don't block the response
  }

  // If admin approved and HOD status is still pending, notify assigned HOD
  // BUT skip this if the leave was created by admin (admin leaves are auto-approved, no HOD notification needed)
  // Check if leave was auto-approved by admin (both statuses were already Approved with Autoapproved remarks)
  const leaveWasCreatedByAdmin = (leave.hod_status === 'Approved' && leave.admin_status === 'Approved' && 
                                  leave.hod_remark === 'Autoapproved' && leave.admin_remark === 'Autoapproved') ||
                                 (leave.hod_status === 'Approved' && leave.admin_status === 'Approved' && 
                                  leave.hod_approved_at && leave.admin_approved_at && 
                                  Math.abs(new Date(leave.hod_approved_at) - new Date(leave.admin_approved_at)) < 1000);
  
  if (status === 'Approved' && hodStatus === 'Pending' && !leaveWasCreatedByAdmin) {
    try {
      // Get employee's assigned HOD (manager_id)
      const empHodResult = await database.query(
        `SELECT e.manager_id, e.location, u.department
         FROM employees e
         JOIN users u ON e.user_id = u.user_id
         WHERE e.employee_id = $1`,
        [leave.employee_id]
      );
      
      if (empHodResult.rows.length > 0) {
        const empInfo = empHodResult.rows[0];
        let assignedHod = null;
        
        // Priority 1: Direct manager assignment (ONLY use assigned HOD, never all HODs)
        if (empInfo.manager_id) {
          const hodResult = await database.query(
            `SELECT u.email, 
             COALESCE(
               NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''),
               u.first_name,
               u.last_name,
               u.email
             ) as full_name
             FROM employees e
             JOIN users u ON e.user_id = u.user_id
             WHERE e.employee_id = $1
             AND LOWER(TRIM(u.role)) = 'hod'
             LIMIT 1`,
            [empInfo.manager_id]
          );
          
          if (hodResult.rows.length > 0) {
            assignedHod = hodResult.rows[0];
          } else {
            console.error(`❌ ERROR: Employee ${leave.employee_email} has manager_id ${empInfo.manager_id} but assigned HOD not found. Email will NOT be sent to any HOD.`);
          }
        } else {
        }
        
        // If assigned HOD found, send notification to ASSIGNED HOD ONLY (not all HODs)
        if (assignedHod) {
          const { sendLeaveApplicationEmail } = await import('../../utils/emailService.js');
          // Send email asynchronously without blocking
          sendLeaveApplicationEmail({
            to: assignedHod.email,
            approver_name: assignedHod.full_name,
            employee_email: leave.employee_email,
            employee_name: leave.employee_name,
            leave_type: leave.leave_type,
            start_date: leave.start_date,
            end_date: leave.end_date,
            number_of_days: leave.number_of_days,
            reason: leave.reason || null
          }).catch((emailErr) => {
            console.error(`Failed to send email to assigned HOD ${assignedHod.email}:`, emailErr.message);
          });
        }
      }
    } catch (hodNotifyError) {
      console.error('Failed to notify assigned HOD:', hodNotifyError);
    }
  }

  return { ...updatedLeave, status: finalStatus };
};

/**
 * Filter Leave by Admin Status
 * Matches HR Portal: FilterLeaveByStatusAdminService
 */
export const FilterLeaveByStatusAdminService = async (Request) => {
  const status = Request.body?.status || Request.params?.status;
  const pageNumber = parseInt(Request.params?.pageNumber) || 1;
  const perPage = parseInt(Request.params?.perPage) || 5;
  const searchKeyword = Request.params?.searchKeyword || '0';
  const skipRow = (pageNumber - 1) * perPage;

  let query = `
    SELECT 
      la.*,
      lt.name as leave_type_name,
      COALESCE(u.first_name || ' ' || u.last_name, u.first_name, u.last_name, u.email) as full_name,
      u.email,
      u.first_name,
      u.last_name,
      u.role as employee_role,
      COALESCE(
        NULLIF(TRIM(hod_approver.first_name || ' ' || hod_approver.last_name), ''),
        hod_approver.first_name,
        hod_approver.last_name,
        hod_approver.email
      ) as hod_approver_name,
      COALESCE(
        NULLIF(TRIM(admin_approver.first_name || ' ' || admin_approver.last_name), ''),
        admin_approver.first_name,
        admin_approver.last_name,
        admin_approver.email
      ) as admin_approver_name
    FROM leave_applications la
    JOIN employees e ON la.employee_id = e.employee_id
    JOIN users u ON e.user_id = u.user_id
    LEFT JOIN leave_types lt ON la.leave_type = lt.name
    LEFT JOIN employees hod_emp ON la.approved_by_hod = hod_emp.employee_id
    LEFT JOIN users hod_approver ON hod_emp.user_id = hod_approver.user_id
    LEFT JOIN employees admin_emp ON la.approved_by_admin = admin_emp.employee_id
    LEFT JOIN users admin_approver ON admin_emp.user_id = admin_approver.user_id
    WHERE la.admin_status = $1
  `;
  
  const params = [status];
  let paramCount = 2;

  // Add search filter
  if (searchKeyword && searchKeyword !== '0') {
    query += ` AND (
      la.leave_type ILIKE $${paramCount} OR
      la.reason ILIKE $${paramCount} OR
      u.first_name ILIKE $${paramCount} OR
      u.last_name ILIKE $${paramCount} OR
      u.email ILIKE $${paramCount}
    )`;
    params.push(`%${searchKeyword}%`);
    paramCount++;
  }

  // Get total count (remove ORDER BY and LIMIT/OFFSET for count)
  const countQuery = query.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) as total FROM').replace(/ORDER BY[\s\S]*$/, '');
  const countResult = await database.query(countQuery, params);
  const total = parseInt(countResult.rows[0]?.total || 0);

  // Add pagination and ordering
  query += ` ORDER BY la.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
  params.push(perPage, skipRow);

  const result = await database.query(query, params);

  return {
    Total: [{ count: total }],
    Data: result.rows.map(row => ({
      ...row,
      LeaveType: row.leave_type_name || row.leave_type,
      Employee: [{
        FirstName: row.first_name,
        LastName: row.last_name,
        Email: row.email,
        Image: null
      }],
      HodStatus: row.hod_status || 'Pending',
      AdminStatus: row.admin_status || 'Pending',
      HodApproverName: row.hod_approver_name || null,
      AdminApproverName: row.admin_approver_name || null,
      NumOfDay: row.number_of_days,
      LeaveDetails: row.reason,
      createdAt: row.created_at
    }))
  };
};

/**
 * Filter Leave by HOD Status
 * Matches HR Portal: FilterLeaveByStatusHodService
 */
export const FilterLeaveByStatusHodService = async (Request) => {
  const status = Request.body?.status || Request.params?.status;
  const pageNumber = parseInt(Request.params?.pageNumber) || 1;
  const perPage = parseInt(Request.params?.perPage) || 5;
  const searchKeyword = Request.params?.searchKeyword || '0';
  const skipRow = (pageNumber - 1) * perPage;
  const UserId = Request.UserId;
  const EmployeeId = Request.EmployeeId;

  // Get the logged-in HOD's employee_id
  let hodEmployeeId = EmployeeId;
  if (!hodEmployeeId && UserId) {
    const hodEmpResult = await database.query(
      'SELECT employee_id FROM employees WHERE user_id = $1 LIMIT 1',
      [UserId]
    );
    if (hodEmpResult.rows.length > 0) {
      hodEmployeeId = hodEmpResult.rows[0].employee_id;
    }
  }

  if (!hodEmployeeId) {
    throw CreateError("HOD employee record not found", 404);
  }

  let query = `
    SELECT 
      la.*,
      lt.name as leave_type_name,
      COALESCE(u.first_name || ' ' || u.last_name, u.first_name, u.last_name, u.email) as full_name,
      u.email,
      u.first_name,
      u.last_name
    FROM leave_applications la
    JOIN employees e ON la.employee_id = e.employee_id
    JOIN users u ON e.user_id = u.user_id
    LEFT JOIN leave_types lt ON la.leave_type = lt.name
    WHERE la.hod_status = $1
    AND (
      -- Priority 1: Direct manager assignment (employee's manager_id = logged-in HOD's employee_id)
      e.manager_id = $2
      OR
      -- Priority 2: Department-based (only if no manager_id assigned)
      (e.manager_id IS NULL AND EXISTS (
        SELECT 1 FROM users hod_u
        JOIN employees hod_e ON hod_e.user_id = hod_u.user_id
        WHERE hod_e.employee_id = $2
        AND hod_u.department = u.department
        AND LOWER(TRIM(hod_u.role)) = 'hod'
      ))
      OR
      -- Priority 3: Location-based (only if no manager_id assigned)
      (e.manager_id IS NULL AND EXISTS (
        SELECT 1 FROM employees hod_e
        JOIN employees emp_e ON emp_e.location = hod_e.location
        WHERE hod_e.employee_id = $2
        AND emp_e.employee_id = e.employee_id
        AND EXISTS (
          SELECT 1 FROM users hod_u
          WHERE hod_u.user_id = hod_e.user_id
          AND LOWER(TRIM(hod_u.role)) = 'hod'
        )
      ))
    )
  `;
  
  const params = [status, hodEmployeeId];
  let paramCount = 3;

  // Add search filter
  if (searchKeyword && searchKeyword !== '0') {
    query += ` AND (
      la.leave_type ILIKE $${paramCount} OR
      la.reason ILIKE $${paramCount} OR
      u.first_name ILIKE $${paramCount} OR
      u.last_name ILIKE $${paramCount} OR
      u.email ILIKE $${paramCount}
    )`;
    params.push(`%${searchKeyword}%`);
    paramCount++;
  }

  // Get total count (remove ORDER BY and LIMIT/OFFSET for count)
  const countQuery = query.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) as total FROM').replace(/ORDER BY[\s\S]*$/, '');
  const countResult = await database.query(countQuery, params);
  const total = parseInt(countResult.rows[0]?.total || 0);

  // Add pagination and ordering
  query += ` ORDER BY la.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
  params.push(perPage, skipRow);

  const result = await database.query(query, params);

  return {
    Total: [{ count: total }],
    Data: result.rows.map(row => ({
      ...row,
      LeaveType: row.leave_type_name || row.leave_type,
      Employee: [{
        FirstName: row.first_name,
        LastName: row.last_name,
        Email: row.email,
        Image: null
      }],
      HodStatus: row.hod_status || 'Pending',
      AdminStatus: row.admin_status || 'Pending',
      NumOfDay: row.number_of_days,
      LeaveDetails: row.reason,
      createdAt: row.created_at
    }))
  };
};

/**
 * Check for Overlapping Leave Dates
 * Returns overlapping leaves for the given date range
 */
/**
 * Calculate Working Days Service
 * Returns the number of working days between start_date and end_date
 * Excludes weekends and organization holidays based on employee location
 */
export const CalculateWorkingDaysService = async (Request) => {
  const { start_date, end_date } = Request.body || Request.query;
  const UserId = Request.UserId;
  const EmployeeId = Request.EmployeeId;

  if (!start_date || !end_date) {
    throw CreateError("start_date and end_date are required", 400);
  }

  // Get employee_id and location
  let empId = EmployeeId;
  let employeeLocation = null;
  if (!empId) {
    const empResult = await database.query(
      'SELECT employee_id, location FROM employees WHERE user_id = $1 LIMIT 1',
      [UserId]
    );
    if (empResult.rows.length > 0) {
      empId = empResult.rows[0].employee_id;
      employeeLocation = empResult.rows[0].location;
    }
  } else {
    const empResult = await database.query(
      'SELECT location FROM employees WHERE employee_id = $1 LIMIT 1',
      [empId]
    );
    if (empResult.rows.length > 0) {
      employeeLocation = empResult.rows[0].location;
    }
  }

  // Calculate working days excluding weekends and holidays
  const { calculateLeaveDaysExcludingHolidays } = await import('../../utils/helpers.js');
  const workingDays = await calculateLeaveDaysExcludingHolidays(start_date, end_date, employeeLocation, database);

  if (!workingDays || workingDays === 0) {
    throw CreateError("No working days found between the selected dates. Please check if dates include only weekends/holidays.", 400);
  }

  return {
    working_days: workingDays,
    start_date: start_date,
    end_date: end_date,
    employee_location: employeeLocation
  };
};

/**
 * Calculate Comp-Off Days Service
 * Returns the number of non-working days (weekends + location-specific holidays) between start_date and end_date
 * This is specifically for Comp-Off leave type calculation
 */
export const CalculateCompOffDaysService = async (Request) => {
  const { start_date, end_date } = Request.body || Request.query;
  const UserId = Request.UserId;
  const EmployeeId = Request.EmployeeId;

  if (!start_date || !end_date) {
    throw CreateError("start_date and end_date are required", 400);
  }

  // Get employee_id and location
  let empId = EmployeeId;
  let employeeLocation = null;
  if (!empId) {
    const empResult = await database.query(
      'SELECT employee_id, location FROM employees WHERE user_id = $1 LIMIT 1',
      [UserId]
    );
    if (empResult.rows.length > 0) {
      empId = empResult.rows[0].employee_id;
      employeeLocation = empResult.rows[0].location;
    }
  } else {
    const empResult = await database.query(
      'SELECT location FROM employees WHERE employee_id = $1 LIMIT 1',
      [empId]
    );
    if (empResult.rows.length > 0) {
      employeeLocation = empResult.rows[0].location;
    }
  }

  // Calculate Comp-Off days (non-working days: weekends + location-specific holidays)
  const { validateCompOffDates } = await import('../../utils/helpers.js');
  const compOffValidation = await validateCompOffDates(start_date, end_date, employeeLocation, database);

  // Return the number of non-working days (weekends + location-specific holidays)
  return {
    comp_off_days: compOffValidation.nonWorkingDays,
    start_date: start_date,
    end_date: end_date,
    employee_location: employeeLocation,
    valid_dates: compOffValidation.isValid,
    invalid_dates: compOffValidation.invalidDates
  };
};

export const CheckOverlappingLeavesService = async (Request) => {
  const UserId = Request.UserId;
  const { start_date, end_date, leave_id } = Request.body || Request.query;

  if (!start_date || !end_date) {
    throw CreateError("Start date and end date are required", 400);
  }

  // Get employee_id from user_id
  const empResult = await database.query(
    'SELECT employee_id FROM employees WHERE user_id = $1 LIMIT 1',
    [UserId]
  );
  if (empResult.rows.length === 0) {
    throw CreateError("Employee record not found", 404);
  }
  const empId = empResult.rows[0].employee_id;

  // Check for overlapping leaves (pending or approved only)
  // Exclude the current leave if updating (leave_id provided)
  let query = `
    SELECT id, leave_type, start_date, end_date, hod_status, admin_status
    FROM leave_applications
    WHERE employee_id = $1
    AND (
      (hod_status = 'Pending' OR hod_status = 'Approved')
      OR (admin_status = 'Pending' OR admin_status = 'Approved')
    )
    AND (
      (start_date <= $2 AND end_date >= $2)
      OR (start_date <= $3 AND end_date >= $3)
      OR (start_date >= $2 AND end_date <= $3)
    )
  `;
  
  const params = [empId, start_date, end_date];
  
  // Exclude current leave if updating
  if (leave_id) {
    query += ` AND id != $4`;
    params.push(leave_id);
  }

  const result = await database.query(query, params);
  
  return {
    hasOverlap: result.rows.length > 0,
    overlappingLeaves: result.rows
  };
};

/**
 * Get Leave Balance
 * Returns leave balance for the specified year, recalculated from approved leaves
 * Filters leave types by employee location (IN / US)
 */
export const GetLeaveBalanceService = async (Request) => {
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

  // Get employee location for filtering leave types
  const empLocationResult = await database.query(
    `SELECT e.location 
     FROM employees e
     WHERE e.employee_id = $1`,
    [empId]
  );
  const employeeLocation = empLocationResult.rows[0]?.location || null;

  // Get year from query params or use current year
  const year = parseInt(Request.query?.year) || new Date().getFullYear();

  // Get all active leave types, filtered by employee location
  let leaveTypesQuery = `
    SELECT name, code, max_days, location 
    FROM leave_types 
    WHERE is_active = true
  `;
  const leaveTypesParams = [];
  
  // Filter by location: show leave types that match employee location or are "All"
  if (employeeLocation) {
    // Map location to country codes for matching
    const mapLocationToCountryCode = (location) => {
      if (!location) return [];
      const loc = location.toString().trim();
      if (loc === 'India' || loc === 'IN') return ['IN', 'India'];
      if (loc === 'US' || loc === 'United States') return ['US', 'United States'];
      return [loc];
    };
    
    const countryCodes = mapLocationToCountryCode(employeeLocation);
    const conditions = [];
    countryCodes.forEach((code, index) => {
      conditions.push(`location = $${index + 1}`);
      leaveTypesParams.push(code);
    });
    conditions.push(`location = 'All'`);
    conditions.push(`location IS NULL`);
    leaveTypesQuery += ` AND (${conditions.join(' OR ')})`;
  }
  
  leaveTypesQuery += ` ORDER BY name`;
  const leaveTypesResult = await database.query(leaveTypesQuery, leaveTypesParams);

  // OPTIMIZED: Calculate all leave balances in a single query instead of looping
  // Get all approved leaves for this employee and year in one query (grouped by leave_type)
  // Use date range instead of EXTRACT for better index usage
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const approvedLeavesByType = await database.query(
    `SELECT 
       leave_type,
       COALESCE(SUM(number_of_days), 0) as used_days
     FROM leave_applications
     WHERE employee_id = $1
     AND start_date >= $2::date
     AND start_date <= $3::date
     AND (
       (UPPER(TRIM(COALESCE(hod_status, 'Pending'))) = 'APPROVED' OR UPPER(TRIM(COALESCE(admin_status, 'Pending'))) = 'APPROVED')
       AND UPPER(TRIM(COALESCE(hod_status, 'Pending'))) != 'REJECTED'
       AND UPPER(TRIM(COALESCE(admin_status, 'Pending'))) != 'REJECTED'
     )
     GROUP BY leave_type`,
    [empId, yearStart, yearEnd]
  );
  
  // Create a map of used days by leave type
  const usedDaysMap = new Map();
  approvedLeavesByType.rows.forEach(row => {
    usedDaysMap.set(row.leave_type, parseFloat(row.used_days || 0));
  });
  
  // Get existing balances in one query
  const existingBalances = await database.query(
    `SELECT leave_type, total_balance, used_balance, remaining_balance
     FROM leave_balance
     WHERE employee_id = $1 AND year = $2`,
    [empId, year]
  );
  const balanceMap = new Map();
  existingBalances.rows.forEach(balance => {
    balanceMap.set(balance.leave_type, balance);
  });
  
  // Build result array and update balances in batch
  const result = [];
  const balanceUpdates = [];
  
  for (const lt of leaveTypesResult.rows) {
    const usedDays = usedDaysMap.get(lt.name) || 0;
    const defaultBalance = lt.max_days || 0;
    const existingBalance = balanceMap.get(lt.name);
    
    // Calculate new balance values
    const totalBalance = existingBalance?.total_balance || defaultBalance;
    const newUsedBalance = usedDays;
    const newRemainingBalance = Math.max(0, totalBalance - newUsedBalance);
    
    // Prepare for batch update
    // Note: remaining_balance is a generated column - do NOT include it in updates
    balanceUpdates.push({
      leave_type: lt.name,
      total_balance: totalBalance,
      used_balance: newUsedBalance
    });
    
    // For result, calculate remaining_balance for display (DB will calculate it in actual table)
    const calculatedRemaining = Math.max(0, totalBalance - newUsedBalance);
    result.push({
      leave_type: lt.name,
      total_balance: totalBalance,
      used_balance: newUsedBalance,
      remaining_balance: calculatedRemaining,
      year: year
    });
  }
  
  // Batch update all balances efficiently
  // Note: remaining_balance is a generated column - do NOT insert/update it directly
  if (balanceUpdates.length > 0) {
    // Update balances individually but in parallel (faster than sequential)
    // Using Promise.all for parallel execution
    const updatePromises = balanceUpdates.map(b => 
      database.query(
        `INSERT INTO leave_balance (employee_id, leave_type, total_balance, used_balance, year)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (employee_id, leave_type, year)
         DO UPDATE SET
           total_balance = COALESCE(EXCLUDED.total_balance, leave_balance.total_balance),
           used_balance = EXCLUDED.used_balance,
           updated_at = NOW()`,
        [empId, b.leave_type, b.total_balance, b.used_balance, year]
      ).catch(err => {
        console.error(`Failed to update balance for ${b.leave_type}:`, err);
        return null; // Continue with other updates
      })
    );
    
    await Promise.all(updatePromises);
  }
  
  // Re-fetch balances to get the DB-calculated remaining_balance values
  const finalBalances = await database.query(
    `SELECT leave_type, total_balance, used_balance, remaining_balance
     FROM leave_balance
     WHERE employee_id = $1 AND year = $2`,
    [empId, year]
  );
  
  // Update result with actual DB-calculated remaining_balance
  const finalBalanceMap = new Map();
  finalBalances.rows.forEach(b => {
    finalBalanceMap.set(b.leave_type, b);
  });
  
  // Update result array with actual remaining_balance from DB
  result.forEach(r => {
    const dbBalance = finalBalanceMap.get(r.leave_type);
    if (dbBalance) {
      r.remaining_balance = parseFloat(dbBalance.remaining_balance || 0);
      r.used_balance = parseFloat(dbBalance.used_balance || 0);
      r.total_balance = parseFloat(dbBalance.total_balance || r.total_balance);
    }
  });

  return result;
};

/**
 * Bulk Approve/Reject Leaves (HOD)
 * Processes multiple leave applications in one action
 * All validations apply individually to each leave request
 */
export const BulkApproveLeaveHodService = async (Request) => {
  const { leave_ids, status, comment } = Request.body;
  const Role = Request.Role || '';

  if (!Array.isArray(leave_ids) || leave_ids.length === 0) {
    throw CreateError("leave_ids array is required and must not be empty", 400);
  }

  if (!['Approved', 'Rejected'].includes(status)) {
    throw CreateError("Invalid status. Must be 'Approved' or 'Rejected'", 400);
  }

  const results = [];
  const errors = [];

  // Process each leave individually
  for (const id of leave_ids) {
    try {
      const result = await ApproveLeaveHodService({
        ...Request,
        params: { id },
        body: { status, comment }
      });
      results.push({ id, success: true, data: result });
    } catch (error) {
      errors.push({ 
        id, 
        success: false, 
        error: error.message || 'Failed to process leave',
        status: error.status || 500
      });
    }
  }

  return {
    message: `Processed ${results.length} of ${leave_ids.length} leave applications`,
    successful: results,
    failed: errors,
    total: leave_ids.length,
    succeeded: results.length,
    failed_count: errors.length
  };
};

/**
 * Bulk Approve/Reject Leaves (Admin)
 * Processes multiple leave applications in one action
 * All validations apply individually to each leave request
 * Enforces HOD rejection rule: Cannot approve if HOD rejected
 */
export const BulkApproveLeaveAdminService = async (Request) => {
  const { leave_ids, status, comment } = Request.body;

  if (!Array.isArray(leave_ids) || leave_ids.length === 0) {
    throw CreateError("leave_ids array is required and must not be empty", 400);
  }

  if (!['Approved', 'Rejected'].includes(status)) {
    throw CreateError("Invalid status. Must be 'Approved' or 'Rejected'", 400);
  }

  const results = [];
  const errors = [];

  // Process each leave individually
  for (const id of leave_ids) {
    try {
      const result = await ApproveLeaveAdminService({
        ...Request,
        params: { id },
        body: { status, comment }
      });
      results.push({ id, success: true, data: result });
    } catch (error) {
      errors.push({ 
        id, 
        success: false, 
        error: error.message || 'Failed to process leave',
        status: error.status || 500
      });
    }
  }

  return {
    message: `Processed ${results.length} of ${leave_ids.length} leave applications`,
    successful: results,
    failed: errors,
    total: leave_ids.length,
    succeeded: results.length,
    failed_count: errors.length
  };
};

/**
 * Get Leave Reports (with filters)
 * Admin: sees all employees
 * HOD: sees only permitted employees (based on manager_id, department, or location)
 */
export const GetLeaveReportsService = async (Request) => {
  const UserId = Request.UserId;
  const EmployeeId = Request.EmployeeId;
  const Role = Request.Role || '';
  const isAdmin = Role?.toLowerCase() === 'admin';
  
  // Get filters from query params or body
  const employeeId = Request.query?.employeeId || Request.body?.employeeId || null;
  const status = Request.query?.status || Request.body?.status || null;
  const startDate = Request.query?.startDate || Request.body?.startDate || null;
  const endDate = Request.query?.endDate || Request.body?.endDate || null;
  const leaveType = Request.query?.leaveType || Request.body?.leaveType || null;

  let query = `
    SELECT 
      la.*,
      lt.name as leave_type_name,
      COALESCE(u.first_name || ' ' || u.last_name, u.first_name, u.last_name, u.email) as full_name,
      u.email,
      u.first_name,
      u.last_name,
      u.user_id,
      COALESCE(
        NULLIF(TRIM(hod_approver.first_name || ' ' || hod_approver.last_name), ''),
        hod_approver.first_name,
        hod_approver.last_name,
        hod_approver.email
      ) as hod_approver_name,
      COALESCE(
        NULLIF(TRIM(admin_approver.first_name || ' ' || admin_approver.last_name), ''),
        admin_approver.first_name,
        admin_approver.last_name,
        admin_approver.email
      ) as admin_approver_name
    FROM leave_applications la
    JOIN employees e ON la.employee_id = e.employee_id
    JOIN users u ON e.user_id = u.user_id
    LEFT JOIN leave_types lt ON la.leave_type = lt.name
    LEFT JOIN employees hod_emp ON la.approved_by_hod = hod_emp.employee_id
    LEFT JOIN users hod_approver ON hod_emp.user_id = hod_approver.user_id
    LEFT JOIN employees admin_emp ON la.approved_by_admin = admin_emp.employee_id
    LEFT JOIN users admin_approver ON admin_emp.user_id = admin_approver.user_id
    WHERE 1=1
  `;
  
  const params = [];
  let paramCount = 1;

  // HOD scope: Only show permitted employees
  if (!isAdmin && EmployeeId) {
    query += ` AND (
      -- Priority 1: Direct manager assignment
      e.manager_id = $${paramCount}
      OR
      -- Priority 2: Department-based (only if no manager_id assigned)
      (e.manager_id IS NULL AND EXISTS (
        SELECT 1 FROM users hod_u
        JOIN employees hod_e ON hod_e.user_id = hod_u.user_id
        WHERE hod_e.employee_id = $${paramCount}
        AND hod_u.department = u.department
        AND LOWER(TRIM(hod_u.role)) = 'hod'
      ))
      OR
      -- Priority 3: Location-based (only if no manager_id assigned)
      (e.manager_id IS NULL AND EXISTS (
        SELECT 1 FROM employees hod_e
        JOIN employees emp_e ON emp_e.location = hod_e.location
        WHERE hod_e.employee_id = $${paramCount}
        AND emp_e.employee_id = e.employee_id
        AND EXISTS (
          SELECT 1 FROM users hod_u
          WHERE hod_u.user_id = hod_e.user_id
          AND LOWER(TRIM(hod_u.role)) = 'hod'
        )
      ))
    )`;
    params.push(EmployeeId);
    paramCount++;
  }

  // Employee filter
  if (employeeId && employeeId !== 'all' && employeeId !== 'All Users' && employeeId !== '') {
    query += ` AND u.user_id = $${paramCount}`;
    params.push(parseInt(employeeId));
    paramCount++;
  }

  // Status filter
  if (status && status !== 'All' && status !== 'all') {
    if (status === 'Approved') {
      query += ` AND la.status = $${paramCount}`;
      params.push('Approved');
      paramCount++;
    } else if (status === 'Rejected') {
      query += ` AND la.status = $${paramCount}`;
      params.push('Rejected');
      paramCount++;
    } else if (status === 'Pending') {
      query += ` AND la.status = $${paramCount}`;
      params.push('Pending');
      paramCount++;
    }
  }

  // Date range filter
  if (startDate) {
    query += ` AND la.start_date >= $${paramCount}`;
    params.push(startDate);
    paramCount++;
  }
  if (endDate) {
    query += ` AND la.end_date <= $${paramCount}`;
    params.push(endDate);
    paramCount++;
  }

  // Leave type filter
  if (leaveType && leaveType !== 'all' && leaveType !== 'All') {
    query += ` AND la.leave_type = $${paramCount}`;
    params.push(leaveType);
    paramCount++;
  }

  // Get total count
  const countQuery = query.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) as total FROM').replace(/ORDER BY[\s\S]*$/, '');
  const countResult = await database.query(countQuery, params);
  const total = parseInt(countResult.rows[0]?.total || 0);

  // Add ordering
  query += ` ORDER BY la.created_at DESC`;

  const result = await database.query(query, params);

  return {
    Total: [{ count: total }],
    Data: result.rows.map(row => ({
      ...row,
      LeaveType: row.leave_type_name || row.leave_type,
      Employee: [{
        FirstName: row.first_name,
        LastName: row.last_name,
        Email: row.email,
        Image: null
      }],
      HodStatus: row.hod_status || 'Pending',
      AdminStatus: row.admin_status || 'Pending',
      HodApproverName: row.hod_approver_name || null,
      AdminApproverName: row.admin_approver_name || null,
      NumOfDay: row.number_of_days,
      LeaveDetails: row.reason,
      createdAt: row.created_at
    }))
  };
};

// Note: All services are exported inline using 'export const'
// This list is for reference only - no duplicate exports needed

