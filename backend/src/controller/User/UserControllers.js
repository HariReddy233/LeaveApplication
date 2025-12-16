//Internal Lib Import
import {
  GetAllEmployeesService,
  GetUserProfileService,
  UpdateUserRoleService,
  GetAllUsersService,
  UpdateEmployeeService,
  GetUsersForAvailabilityService,
  GetHodsListService,
} from "../../services/User/UserService.js";

/**
 * @desc Get All Employees
 * @access private
 * @route /api/v1/User/EmployeeList
 * @method GET
 */
export const EmployeeList = async (req, res, next) => {
  try {
    // Try GetAllEmployeesService first, fallback to GetAllUsersService if it fails
    let result;
    try {
      result = await GetAllEmployeesService(req);
      res.json({ data: result });
    } catch (empError) {
      console.warn('GetAllEmployeesService failed, trying GetAllUsersService:', empError.message);
      // Fallback to GetAllUsersService which handles both schemas better
      const usersResult = await GetAllUsersService(req);
      res.json({ data: usersResult.Data || usersResult.data || [] });
    }
  } catch (error) {
    console.error('EmployeeList error:', error);
    next(error);
  }
};

/**
 * @desc Get User Profile
 * @access private
 * @route /api/v1/User/UserProfile
 * @method GET
 */
export const UserProfile = async (req, res, next) => {
  try {
    const result = await GetUserProfileService(req);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Update User Role (Admin only)
 * @access private (Admin only)
 * @route /api/v1/User/UpdateRole/:userId
 * @method PATCH
 */
export const UpdateUserRole = async (req, res, next) => {
  try {
    const result = await UpdateUserRoleService(req);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Get All Users (Admin only)
 * @access private (Admin only)
 * @route /api/v1/User/UserList
 * @method GET
 */
export const UserList = async (req, res, next) => {
  try {
    const result = await GetAllUsersService(req);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Update Employee Details (Admin only)
 * @access private (Admin only)
 * @route /api/v1/User/UpdateEmployee/:userId
 * @method PATCH
 */
export const UpdateEmployee = async (req, res, next) => {
  try {
    const result = await UpdateEmployeeService(req);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Get All Users for Availability Checking (All authenticated users)
 * @access private (All authenticated users)
 * @route /api/v1/User/UserListForAvailability
 * @method GET
 */
export const UserListForAvailability = async (req, res, next) => {
  try {
    const result = await GetUsersForAvailabilityService(req);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Get All HODs (for HOD assignment dropdown)
 * @access private (Admin only)
 * @route /api/v1/User/HodsList
 * @method GET
 */
export const HodsList = async (req, res, next) => {
  try {
    const result = await GetHodsListService(req);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export default {
  EmployeeList,
  UserProfile,
  UpdateUserRole,
  UserList,
  UpdateEmployee,
  UserListForAvailability,
  HodsList,
};

