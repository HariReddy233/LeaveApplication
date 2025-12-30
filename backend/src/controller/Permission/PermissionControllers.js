//Internal Lib Import
import {
  GetAllPermissionsService,
  GetUserPermissionsService,
  GetAllUsersWithPermissionsService,
  AssignPermissionService,
  RevokePermissionService,
  BulkAssignPermissionsService,
  GetUserPermissionKeysService,
  InitializeRequiredPermissionsService
} from "../../services/Permission/PermissionService.js";

/**
 * @desc Get All Permissions
 * @access private (Admin only)
 * @route /api/v1/Permission/GetAllPermissions
 * @method GET
 */
export const GetAllPermissions = async (req, res, next) => {
  try {
    const result = await GetAllPermissionsService();
    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Get User Permissions
 * @access private (Admin only)
 * @route /api/v1/Permission/GetUserPermissions/:userId
 * @method GET
 */
export const GetUserPermissions = async (req, res, next) => {
  try {
    const result = await GetUserPermissionsService(req);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Get All Users with Permissions
 * @access private (Admin only)
 * @route /api/v1/Permission/GetAllUsersWithPermissions
 * @method GET
 */
export const GetAllUsersWithPermissions = async (req, res, next) => {
  try {
    const result = await GetAllUsersWithPermissionsService(req);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Assign Permission to User
 * @access private (Admin only)
 * @route /api/v1/Permission/AssignPermission
 * @method POST
 */
export const AssignPermission = async (req, res, next) => {
  try {
    const result = await AssignPermissionService(req);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Revoke Permission from User
 * @access private (Admin only)
 * @route /api/v1/Permission/RevokePermission
 * @method POST
 */
export const RevokePermission = async (req, res, next) => {
  try {
    const result = await RevokePermissionService(req);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Bulk Assign Permissions
 * @access private (Admin only)
 * @route /api/v1/Permission/BulkAssignPermissions
 * @method POST
 */
export const BulkAssignPermissions = async (req, res, next) => {
  try {
    const result = await BulkAssignPermissionsService(req);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Get Current User Permission Keys
 * @access private
 * @route /api/v1/Permission/GetMyPermissions
 * @method GET
 */
export const GetMyPermissions = async (req, res, next) => {
  try {
    const userId = req.UserId;
    const permissionKeys = await GetUserPermissionKeysService(userId);
    res.json({ 
      data: permissionKeys,
      count: permissionKeys.length
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Initialize Required Permissions (Admin only)
 * @access private (Admin only)
 * @route /api/v1/Permission/InitializePermissions
 * @method POST
 */
export const InitializePermissions = async (req, res, next) => {
  try {
    const result = await InitializeRequiredPermissionsService();
    res.json({
      message: "Permissions initialized successfully",
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export default {
  GetAllPermissions,
  GetUserPermissions,
  GetAllUsersWithPermissions,
  AssignPermission,
  RevokePermission,
  BulkAssignPermissions,
  GetMyPermissions,
  InitializePermissions
};



