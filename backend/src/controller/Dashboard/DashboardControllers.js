//Internal Lib Import
import {
  DashboardSummaryEmployeeService,
  DashboardSummaryHodService,
  DashboardSummaryAdminService,
} from "../../services/Dashboard/DashboardService.js";

/**
 * @desc Dashboard Summary Employee
 * @access private
 * @route /api/v1/Dashboard/DashboardSummaryEmployee
 * @method GET
 */
export const DashboardSummaryEmployee = async (req, res, next) => {
  try {
    const result = await DashboardSummaryEmployeeService(req);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Dashboard Summary HOD
 * @access private
 * @route /api/v1/Dashboard/DashboardSummaryHod
 * @method GET
 */
export const DashboardSummaryHod = async (req, res, next) => {
  try {
    const result = await DashboardSummaryHodService(req);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Dashboard Summary Admin
 * @access private
 * @route /api/v1/Dashboard/DashboardSummaryAdmin
 * @method GET
 */
export const DashboardSummaryAdmin = async (req, res, next) => {
  try {
    const result = await DashboardSummaryAdminService(req);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export default {
  DashboardSummaryEmployee,
  DashboardSummaryHod,
  DashboardSummaryAdmin,
};

