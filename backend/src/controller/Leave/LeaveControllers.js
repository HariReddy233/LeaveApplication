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
};

