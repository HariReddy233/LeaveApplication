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
    // Redirect to a success page or return JSON
    // For now, return a simple HTML response that can be displayed
    res.status(200).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Leave Request Processed</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          }
          .container {
            background: white;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            text-align: center;
            max-width: 500px;
          }
          .success-icon {
            font-size: 64px;
            margin-bottom: 20px;
          }
          h1 {
            color: #10b981;
            margin-bottom: 16px;
          }
          p {
            color: #6b7280;
            line-height: 1.6;
            margin-bottom: 24px;
          }
          .button {
            display: inline-block;
            padding: 12px 24px;
            background: #4f46e5;
            color: white;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="success-icon">✅</div>
          <h1>Leave Request Processed</h1>
          <p>${result.message}</p>
          <p style="font-size: 14px; color: #9ca3af;">You can close this window now.</p>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    // Return error page
    res.status(error.status || 400).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Error Processing Leave Request</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
          }
          .container {
            background: white;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            text-align: center;
            max-width: 500px;
          }
          .error-icon {
            font-size: 64px;
            margin-bottom: 20px;
          }
          h1 {
            color: #ef4444;
            margin-bottom: 16px;
          }
          p {
            color: #6b7280;
            line-height: 1.6;
            margin-bottom: 24px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="error-icon">❌</div>
          <h1>Unable to Process Request</h1>
          <p>${error.message || 'An error occurred while processing your request.'}</p>
          <p style="font-size: 14px; color: #9ca3af;">This link may have expired or already been used. Please log in to the Leave Management Portal to review this request.</p>
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

