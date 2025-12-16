//Internal Lib Import
import {
  GetLeaveTypeListService,
  CreateLeaveTypeService,
  UpdateLeaveTypeService,
  DeleteLeaveTypeService
} from "../../services/LeaveType/LeaveTypeService.js";

/**
 * @desc Get Leave Type List
 * @access private
 * @route /api/v1/LeaveType/LeaveTypeList
 * @method GET
 */
export const LeaveTypeList = async (req, res, next) => {
  try {
    const result = await GetLeaveTypeListService();
    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Create Leave Type
 * @access private (Admin only)
 * @route /api/v1/LeaveType/LeaveTypeCreate
 * @method POST
 */
export const LeaveTypeCreate = async (req, res, next) => {
  try {
    const result = await CreateLeaveTypeService(req);
    res.json({ message: "Leave type created successfully", data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Update Leave Type
 * @access private (Admin only)
 * @route /api/v1/LeaveType/LeaveTypeUpdate/:id
 * @method PATCH
 */
export const LeaveTypeUpdate = async (req, res, next) => {
  try {
    const result = await UpdateLeaveTypeService(req);
    res.json({ message: "Leave type updated successfully", data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Delete Leave Type
 * @access private (Admin only)
 * @route /api/v1/LeaveType/LeaveTypeDelete/:id
 * @method DELETE
 */
export const LeaveTypeDelete = async (req, res, next) => {
  try {
    const result = await DeleteLeaveTypeService(req);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export default {
  LeaveTypeList,
  LeaveTypeCreate,
  LeaveTypeUpdate,
  LeaveTypeDelete,
};

