//Internal Lib Import
import {
  CreateLeaveService,
  GetLeaveListService,
  GetAllLeavesService,
  GetAllLeavesHodService,
  GetLeaveDetailsService,
  UpdateLeaveService,
  DeleteLeaveService,
  ApproveLeaveHodService,
  ApproveLeaveAdminService,
  FilterLeaveByStatusAdminService,
  FilterLeaveByStatusHodService,
  GetLeaveBalanceService,
  CheckOverlappingLeavesService,
  BulkApproveLeaveHodService,
  BulkApproveLeaveAdminService,
} from "../../services/Leave/LeaveService.js";
import { EmailApprovalService } from "../../services/Leave/EmailApprovalService.js";

/**
 * @desc Leave Create
 * @access private
 * @route /api/v1/Leave/LeaveCreate
 * @method POST
 */
export const LeaveCreate = async (req, res, next) => {
  try {
    const result = await CreateLeaveService(req);
    res.status(201).json({ message: "Leave application submitted successfully", data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Leave List (Employee's own leaves with pagination)
 * @access private
 * @route /api/v1/Leave/LeaveList/:pageNumber/:perPage/:searchKeyword
 * @method GET
 */
export const LeaveList = async (req, res, next) => {
  try {
    const result = await GetLeaveListService(req);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Leave Admin List (All leaves for Admin with pagination)
 * Shows only leaves where HOD status is Approved
 * @access private
 * @route /api/v1/Leave/LeaveAdminList/:pageNumber/:perPage/:searchKeyword
 * @method GET
 */
export const LeaveAdminList = async (req, res, next) => {
  try {
    const result = await GetAllLeavesService(req);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Leave HOD List (All leaves for HOD with pagination)
 * @access private
 * @route /api/v1/Leave/LeaveListHod/:pageNumber/:perPage/:searchKeyword
 * @method GET
 */
export const LeaveListHod = async (req, res, next) => {
  try {
    const result = await GetAllLeavesHodService(req);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Leave List Admin By Status (Filter by Admin Status)
 * @access private
 * @route /api/v1/Leave/LeaveListAdminByStatus/:pageNumber/:perPage/:searchKeyword
 * @method POST
 */
export const LeaveListAdminByStatus = async (req, res, next) => {
  try {
    const result = await FilterLeaveByStatusAdminService(req);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Leave List HOD By Status (Filter by HOD Status)
 * @access private
 * @route /api/v1/Leave/LeaveListHodByStatus/:pageNumber/:perPage/:searchKeyword
 * @method POST
 */
export const LeaveListHodByStatus = async (req, res, next) => {
  try {
    const result = await FilterLeaveByStatusHodService(req);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Leave Details
 * @access private
 * @route /api/v1/Leave/LeaveDetails/:id
 * @method GET
 */
export const LeaveDetails = async (req, res, next) => {
  try {
    const result = await GetLeaveDetailsService(req);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Leave Update
 * @access private
 * @route /api/v1/Leave/LeaveUpdate/:id
 * @method PATCH
 */
export const LeaveUpdate = async (req, res, next) => {
  try {
    const result = await UpdateLeaveService(req);
    res.json({ message: "Leave application updated successfully", data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Leave Delete
 * @access private
 * @route /api/v1/Leave/LeaveDelete/:id
 * @method DELETE
 */
export const LeaveDelete = async (req, res, next) => {
  try {
    const result = await DeleteLeaveService(req);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Approve/Reject Leave (HOD)
 * @access private
 * @route /api/v1/Leave/LeaveApproveHod/:id
 * @method PATCH
 */
export const LeaveApproveHod = async (req, res, next) => {
  try {
    const result = await ApproveLeaveHodService(req);
    res.json({ message: `Leave application HOD status updated to ${result.hod_status}`, data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Approve/Reject Leave (Admin)
 * @access private
 * @route /api/v1/Leave/LeaveApprove/:id
 * @method PATCH
 */
export const LeaveApprove = async (req, res, next) => {
  try {
    const result = await ApproveLeaveAdminService(req);
    res.json({ message: `Leave application Admin status updated to ${result.admin_status}`, data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Get Leave Balance
 * @access private
 * @route /api/v1/Leave/LeaveBalance
 * @method GET
 */
export const LeaveBalance = async (req, res, next) => {
  try {
    const result = await GetLeaveBalanceService(req);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Check for Overlapping Leave Dates
 * @access private
 * @route /api/v1/Leave/CheckOverlappingLeaves
 * @method POST
 */
export const CheckOverlappingLeaves = async (req, res, next) => {
  try {
    const result = await CheckOverlappingLeavesService(req);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Bulk Approve/Reject Leaves (HOD)
 * @access private
 * @route /api/v1/Leave/BulkApproveHod
 * @method POST
 */
export const BulkApproveHod = async (req, res, next) => {
  try {
    const result = await BulkApproveLeaveHodService(req);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Bulk Approve/Reject Leaves (Admin)
 * @access private
 * @route /api/v1/Leave/BulkApprove
 * @method POST
 */
export const BulkApprove = async (req, res, next) => {
  try {
    const result = await BulkApproveLeaveAdminService(req);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Email-based Approval/Rejection
 * @access public (via token)
 * @route /api/v1/Leave/email-action?token=xxx&action=approve or /api/v1/Leave/email-action?token=xxx&action=reject
 * @method GET
 * @note One token per leave request, works for both approve and reject. Token can only be used once.
 */
export const EmailApprove = async (req, res, next) => {
  try {
    const result = await EmailApprovalService(req);
    const { action } = req.query;
    const actionText = action?.toLowerCase() === 'approve' ? 'Approved' : 'Rejected';
    const approverName = result.approverName || 'Approver';
    
    // Set Content-Type to HTML (MANDATORY - browser must render HTML, not JSON)
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    
    // Return simple HTML confirmation page (NO redirect, NO JSON, NO navigation)
    res.status(200).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Leave Action Completed</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            background: #f6f8fb;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
          }
          .box {
            background: #fff;
            padding: 30px;
            border-radius: 10px;
            text-align: center;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            max-width: 500px;
          }
          h2 {
            color: ${actionText === 'Approved' ? '#10b981' : '#ef4444'};
            margin-bottom: 16px;
          }
          p {
            color: #6b7280;
            line-height: 1.6;
            margin: 12px 0;
          }
          a {
            display: inline-block;
            margin-top: 15px;
            text-decoration: none;
            color: #2563eb;
            font-weight: bold;
          }
          a:hover {
            text-decoration: underline;
          }
        </style>
      </head>
      <body>
        <div class="box">
          <h2>Leave ${actionText}</h2>
          <p>This leave request has been processed successfully.</p>
          <p>You may now close this tab.</p>
          <a href="https://hrportal.consultare.io/">Go to HR Portal</a>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    // Set Content-Type to HTML for error page (MANDATORY)
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    
    // Determine error message
    const isAlreadyProcessed = error.message && (
      error.message.includes('already been processed') || 
      error.message.includes('already been') ||
      error.message.includes('already used')
    );
    
    // Return simple HTML error page (NO redirect, NO JSON)
    res.status(error.status || 400).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Error Processing Leave Request</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            background: #f6f8fb;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
          }
          .box {
            background: #fff;
            padding: 30px;
            border-radius: 10px;
            text-align: center;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            max-width: 500px;
          }
          h2 {
            color: #ef4444;
            margin-bottom: 16px;
          }
          p {
            color: #6b7280;
            line-height: 1.6;
            margin: 12px 0;
          }
          a {
            display: inline-block;
            margin-top: 15px;
            text-decoration: none;
            color: #2563eb;
            font-weight: bold;
          }
          a:hover {
            text-decoration: underline;
          }
        </style>
      </head>
      <body>
        <div class="box">
          <h2>Unable to Process Request</h2>
          <p><strong>${error.message || 'An error occurred while processing your request.'}</strong></p>
          ${isAlreadyProcessed ? 
            '<p>This leave request has already been processed.</p>' :
            '<p>This link may have expired or already been used.</p>'
          }
          <p>Please log in to the HR Portal to review this request.</p>
          <a href="https://hrportal.consultare.io/">Go to HR Portal</a>
        </div>
      </body>
      </html>
    `);
  }
};

export default {
  LeaveCreate,
  LeaveList,
  LeaveAdminList,
  LeaveListHod,
  LeaveListAdminByStatus,
  LeaveListHodByStatus,
  LeaveDetails,
  LeaveUpdate,
  LeaveDelete,
  LeaveApprove,
  LeaveApproveHod,
  LeaveBalance,
  CheckOverlappingLeaves,
  BulkApproveHod,
  BulkApprove,
  EmailApprove,
};

