//Internal Lib Import
import database from "../../config/database.js";
import { CreateError } from "../../helper/ErrorHandler.js";
import { verifyAndUseToken } from "../../utils/approvalToken.js";
import { ApproveLeaveHodService, ApproveLeaveAdminService } from "./LeaveService.js";

/**
 * Email-based Approval Service
 * Handles approval/rejection from email links
 */
export const EmailApprovalService = async (Request) => {
  const { token, action } = Request.query;
  
  if (!token) {
    throw CreateError("Approval token is required", 400);
  }
  
  // Validate action parameter
  if (!action || !['approve', 'reject'].includes(action.toLowerCase())) {
    throw CreateError("Action parameter is required and must be 'approve' or 'reject'", 400);
  }
  
  // Verify and use the token (one-time use)
  const tokenRecord = await verifyAndUseToken(token);
  
  if (!tokenRecord) {
    throw CreateError("Invalid, expired, or already used approval token. This leave request may have already been processed.", 400);
  }
  
  // Check if leave still exists and is pending
  const leaveResult = await database.query(
    `SELECT la.*, 
            e.user_id as employee_user_id,
            u.email as employee_email,
            COALESCE(u.first_name || ' ' || u.last_name, u.first_name, u.last_name, u.email) as employee_name
     FROM leave_applications la
     JOIN employees e ON la.employee_id = e.employee_id
     JOIN users u ON e.user_id = u.user_id
     WHERE la.id = $1`,
    [tokenRecord.leave_id]
  );
  
  if (leaveResult.rows.length === 0) {
    throw CreateError("Leave application not found", 404);
  }
  
  const leave = leaveResult.rows[0];
  
  // Check if leave is already processed (approved or rejected)
  const isAlreadyProcessed = 
    (tokenRecord.approver_role === 'hod' && leave.hod_status !== 'Pending') ||
    (tokenRecord.approver_role === 'admin' && leave.admin_status !== 'Pending');
  
  if (isAlreadyProcessed) {
    const currentStatus = tokenRecord.approver_role === 'hod' ? leave.hod_status : leave.admin_status;
    throw CreateError(`This leave request has already been ${currentStatus.toLowerCase()}. Status cannot be changed.`, 400);
  }
  
  // Verify the approver email matches
  const approverResult = await database.query(
    `SELECT u.user_id, u.email, u.role, e.employee_id,
            COALESCE(
              NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''),
              u.first_name,
              u.last_name,
              u.email
            ) as full_name
     FROM users u
     LEFT JOIN employees e ON e.user_id = u.user_id
     WHERE LOWER(u.email) = $1`,
    [tokenRecord.approver_email.toLowerCase()]
  );
  
  if (approverResult.rows.length === 0) {
    throw CreateError("Approver not found", 404);
  }
  
  const approver = approverResult.rows[0];
  
  // Verify role matches
  const expectedRole = tokenRecord.approver_role.toLowerCase();
  const actualRole = approver.role?.toLowerCase();
  
  if (expectedRole !== actualRole && actualRole !== 'admin') {
    throw CreateError("You are not authorized to approve this leave request", 403);
  }
  
  // Determine action based on query parameter (not token)
  const actionLower = action.toLowerCase();
  const status = actionLower === 'approve' ? 'Approved' : 'Rejected';
  const comment = actionLower === 'approve' 
    ? 'Approved via email' 
    : 'Rejected via email';
  
  // Create a request object for the approval service
  const approvalRequest = {
    params: { id: tokenRecord.leave_id.toString() },
    body: { status, comment },
    UserId: approver.user_id || null,
    EmployeeId: approver.employee_id || null,
    Role: approver.role || tokenRecord.approver_role
  };
  
  // Call the appropriate approval service
  let result;
  if (tokenRecord.approver_role === 'hod') {
    result = await ApproveLeaveHodService(approvalRequest);
  } else {
    result = await ApproveLeaveAdminService(approvalRequest);
  }
  
  // Get approver name for the success message
  const approverName = approver.full_name || approver.email;
  
  return {
    message: `Leave request has been ${status.toLowerCase()} successfully by ${approverName}`,
    leave: result,
    tokenUsed: true,
    approverName: approverName,
    action: status
  };
};

