//Internal Lib Import
import {
  GetDepartmentListService,
  CreateDepartmentService
} from "../../services/Department/DepartmentService.js";

/**
 * @desc Get Department List
 * @access private
 * @route /api/v1/Department/DepartmentList
 * @method GET
 */
export const DepartmentList = async (req, res, next) => {
  try {
    const result = await GetDepartmentListService();
    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Create Department
 * @access private (Admin only)
 * @route /api/v1/Department/DepartmentCreate
 * @method POST
 */
export const DepartmentCreate = async (req, res, next) => {
  try {
    const result = await CreateDepartmentService(req);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export default {
  DepartmentList,
  DepartmentCreate,
};

