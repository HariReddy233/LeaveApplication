//Internal Lib Import
import database from "../../config/database.js";
import { CreateError } from "../../helper/ErrorHandler.js";
import sseService from "../SSE/SSEService.js";
import { createApprovalTokens, getBaseUrl } from "../../utils/approvalToken.js";

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

  // Calculate number of days if not provided
  let numDays = number_of_days;
  if (!numDays) {
    const start = new Date(start_date);
    const end = new Date(end_date);
    const diffTime = Math.abs(end - start);
    numDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  }

  // Get employee_id from user_id if not provided
  let empId = employee_id;
  if (!empId) {
    const empResult = await database.query(
      'SELECT employee_id FROM employees WHERE user_id = $1 LIMIT 1',
      [UserId]
    );
    if (empResult.rows.length === 0) {
      throw CreateError("Employee record not found for user", 404);
    }
    empId = empResult.rows[0].employee_id;
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

  // Set initial statuses based on role (matching HR Portal)
  // If HOD creates leave, HOD status is auto-approved
  // If Admin creates leave, both are auto-approved and status is 'Approved'
  const isAdmin = (Role === 'admin' || Role === 'ADMIN');
  const isHod = (Role === 'hod' || Role === 'HOD');
  const hodStatus = isHod ? 'Approved' : 'Pending';
  const adminStatus = isAdmin ? 'Approved' : 'Pending';
  const hodRemark = isHod ? 'Autoapproved' : null;
  const adminRemark = isAdmin ? 'Autoapproved' : null;
  // Admin leaves are fully approved immediately
  const finalStatus = isAdmin ? 'Approved' : 'pending';

  const result = await database.query(
    `INSERT INTO leave_applications (
      employee_id, leave_type, start_date, end_date, number_of_days, 
      reason, status, hod_status, admin_status, hod_remark, admin_remark,
      applied_date, created_at
    )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
     RETURNING *`,
    [empId, leave_type, start_date, end_date, numDays, reason || leave_details || null, 
     finalStatus, hodStatus, adminStatus, hodRemark, adminRemark]
  );

  const leave = result.rows[0];

  // If Admin applies leave, update balance immediately (since it's auto-approved)
  if (isAdmin && finalStatus === 'Approved') {
    const year = new Date(leave.start_date).getFullYear();
    await database.query(
      `INSERT INTO leave_balance (employee_id, leave_type, total_balance, used_balance, year)
       VALUES ($1, $2, COALESCE((SELECT total_balance FROM leave_balance WHERE employee_id = $1 AND leave_type = $2 AND year = $3), 0), $4, $3)
       ON CONFLICT (employee_id, leave_type, year) 
       DO UPDATE SET 
         used_balance = leave_balance.used_balance + $4,
         updated_at = NOW()`,
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
      try {
        // Get employee user_id for SSE notification
        const empUserResult = await database.query(
          'SELECT user_id FROM employees WHERE employee_id = $1',
          [empId]
        );
        const employeeUserId = empUserResult.rows[0]?.user_id;

        // Notify assigned HOD (if exists)
        if (employee.manager_id) {
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

        // Notify all admins
        const adminResult = await database.query(
          'SELECT user_id FROM users WHERE LOWER(TRIM(role)) = \'admin\' LIMIT 10'
        );
        adminResult.rows.forEach(admin => {
          sseService.sendToUser(admin.user_id.toString(), {
            type: 'new_leave',
            message: `New leave application from ${employee.employee_name}`,
            leaveId: leave.id,
            employeeName: employee.employee_name,
            leaveType: leave.leave_type
          });
        });
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
          // Generate approval tokens for HOD
          try {
            const tokens = await createApprovalTokens(leave.id, hod.email, 'hod');
            const baseUrl = getBaseUrl();
            // Send email asynchronously without blocking the response
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
              approveToken: tokens.approveToken,
              rejectToken: tokens.rejectToken,
              baseUrl: baseUrl
            }).catch((emailErr) => {
              console.error(`Failed to send email to HOD ${hod.email}:`, emailErr.message);
            });
          } catch (tokenError) {
            console.error(`Failed to generate tokens for HOD ${hod.email}:`, tokenError.message);
            // Send email without tokens as fallback
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
          }
        } else if (hodStatus === 'Pending') {
          console.error(`❌ ERROR: No HOD found for employee ${employee.employee_email}. manager_id: ${employee.manager_id || 'NULL'}, department: ${employee.department || 'NULL'}, location: ${employee.location || 'NULL'}`);
        }

        // Send email to Admins - Non-blocking
        if (adminStatus === 'Pending' && adminResult.rows.length > 0) {
          for (const admin of adminResult.rows) {
            // Generate approval tokens for Admin
            try {
              const tokens = await createApprovalTokens(leave.id, admin.email, 'admin');
              const baseUrl = getBaseUrl();
              // Send email asynchronously without blocking the response
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
                approveToken: tokens.approveToken,
                rejectToken: tokens.rejectToken,
                baseUrl: baseUrl
              }).catch((adminEmailErr) => {
                console.error(`Failed to send email to Admin ${admin.email}:`, adminEmailErr.message);
              });
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
            // Generate approval tokens for Admin
            try {
              const tokens = await createApprovalTokens(leave.id, admin.email, 'admin');
              const baseUrl = getBaseUrl();
              // Send email asynchronously without blocking the response
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
                approveToken: tokens.approveToken,
                rejectToken: tokens.rejectToken,
                baseUrl: baseUrl
              }).catch((adminEmailErr) => {
                console.error(`Failed to send email to Admin ${admin.email}:`, adminEmailErr.message);
              });
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
    WHERE la.employee_id = $1 AND EXTRACT(YEAR FROM la.start_date) = $2
  `;
  
  const params = [empId, year];
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
      u.last_name
    FROM leave_applications la
    JOIN employees e ON la.employee_id = e.employee_id
    JOIN users u ON e.user_id = u.user_id
    LEFT JOIN leave_types lt ON la.leave_type = lt.name
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
  if (number_of_days) {
    updates.push(`number_of_days = $${paramCount}`);
    params.push(parseInt(number_of_days));
    paramCount++;
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

  // If leave was approved and balance was deducted, restore the balance before deleting
  if (isAdmin && (leave.hod_status === 'Approved' || leave.admin_status === 'Approved')) {
    try {
      const year = new Date(leave.start_date).getFullYear();
      // Restore leave balance by subtracting the used days
      await database.query(
        `UPDATE leave_balance 
         SET used_balance = GREATEST(0, used_balance - $1),
             updated_at = NOW()
         WHERE employee_id = $2 
         AND leave_type = $3 
         AND year = $4`,
        [leave.number_of_days, leave.employee_id, leave.leave_type, year]
      );
    } catch (balanceError) {
      // Log error but don't fail deletion
      console.error('Failed to restore leave balance:', balanceError);
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

  const result = await database.query(
    'DELETE FROM leave_applications WHERE id = $1 RETURNING *',
    [id]
  );

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

  // Update leave balance when EITHER HOD OR Admin approves (first approval)
  // Check if this is the first approval (balance not yet deducted)
  const wasHodApproved = leave.hod_status === 'Approved';
  const wasAdminApproved = leave.admin_status === 'Approved';
  const wasAlreadyDeducted = wasHodApproved || wasAdminApproved;
  
  // Update balance if this is the first approval (HOD approves and balance not yet deducted)
  if (hodStatus === 'Approved' && !wasAlreadyDeducted) {
    const year = new Date(leave.start_date).getFullYear();
    
    // Update or insert leave balance
    // Deduct the days from remaining balance on first approval
    await database.query(
      `INSERT INTO leave_balance (employee_id, leave_type, total_balance, used_balance, year)
       VALUES ($1, $2, COALESCE((SELECT total_balance FROM leave_balance WHERE employee_id = $1 AND leave_type = $2 AND year = $3), 0), $4, $3)
       ON CONFLICT (employee_id, leave_type, year) 
       DO UPDATE SET 
         used_balance = leave_balance.used_balance + $4,
         updated_at = NOW()`,
      [leave.employee_id, leave.leave_type, year, leave.number_of_days]
    );
    
    console.log(`✅ Leave balance updated for ${leave.leave_type} (${leave.number_of_days} days) - First approval by HOD`);
  }

  // Get approver name
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
  const approverName = approverResult.rows[0]?.approver_name || 'HOD';

  // Send email notification to employee (non-blocking)
  // Only send email if final status changed to Approved or Rejected (not if still Pending)
  if (finalStatus !== 'Pending') {
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

    // If approved, send organization-wide informational notification to all users (NOT approval emails)
    if (finalStatus === 'Approved') {
      try {
        const { sendLeaveInfoNotificationEmail } = await import('../../utils/emailService.js');
        
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

  // If HOD approved/rejected and Admin status is still pending, notify all admins
  if ((status === 'Approved' || status === 'Rejected') && adminStatus === 'Pending') {
    try {
      const { sendLeaveApplicationEmail } = await import('../../utils/emailService.js');
      
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

      // Send email to all admins
      if (adminResult.rows.length > 0) {
        for (const admin of adminResult.rows) {
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
            hod_name: hodName
          });
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

  // Update leave balance when EITHER HOD OR Admin approves (first approval)
  // Check if this is the first approval (balance not yet deducted)
  const wasHodApproved = leave.hod_status === 'Approved';
  const wasAdminApproved = leave.admin_status === 'Approved';
  const wasAlreadyDeducted = wasHodApproved || wasAdminApproved;
  
  // Update balance if this is the first approval (Admin approves and balance not yet deducted)
  if (adminStatus === 'Approved' && !wasAlreadyDeducted) {
    const year = new Date(leave.start_date).getFullYear();
    
    // Update or insert leave balance
    // Deduct the days from remaining balance on first approval
    await database.query(
      `INSERT INTO leave_balance (employee_id, leave_type, total_balance, used_balance, year)
       VALUES ($1, $2, COALESCE((SELECT total_balance FROM leave_balance WHERE employee_id = $1 AND leave_type = $2 AND year = $3), 0), $4, $3)
       ON CONFLICT (employee_id, leave_type, year) 
       DO UPDATE SET 
         used_balance = leave_balance.used_balance + $4,
         updated_at = NOW()`,
      [leave.employee_id, leave.leave_type, year, leave.number_of_days]
    );
    
    console.log(`✅ Leave balance updated for ${leave.leave_type} (${leave.number_of_days} days) - First approval by Admin`);
  }

  // Get approver name
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
  const approverName = approverResult.rows[0]?.approver_name || 'Admin';

  // Send email notification to employee (non-blocking)
  // Only send email if final status changed to Approved or Rejected (not if still Pending)
  if (finalStatus !== 'Pending') {
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

    // If approved, send organization-wide informational notification to all users (NOT approval emails)
    if (finalStatus === 'Approved') {
      try {
        const { sendLeaveInfoNotificationEmail } = await import('../../utils/emailService.js');
        
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
  if (status === 'Approved' && hodStatus === 'Pending') {
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

  // Get year from query params or use current year
  const year = parseInt(Request.query?.year) || new Date().getFullYear();

  const result = await database.query(
    `SELECT leave_type, total_balance, used_balance, remaining_balance, year
     FROM leave_balance
     WHERE employee_id = $1 AND year = $2
     ORDER BY leave_type`,
    [empId, year]
  );

  return result.rows;
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

// Note: All services are exported inline using 'export const'
// This list is for reference only - no duplicate exports needed

