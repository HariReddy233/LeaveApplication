//Internal Lib Import
import { CreateError } from "../helper/ErrorHandler.js";
import { CheckUserPermissionService } from "../services/Permission/PermissionService.js";

/**
 * @desc CheckPermission Middleware
 * @access private
 * @method POST/GET/PATCH/DELETE
 * 
 * Usage: CheckPermission('permission.key')
 * Example: CheckPermission('leave.approve')
 */
export const CheckPermission = (permissionKey) => {
  return async (req, res, next) => {
    try {
      const userId = req.UserId;
      
      if (!userId) {
        throw CreateError("Authentication required", 401);
      }
      
      if (!permissionKey) {
        throw CreateError("Permission key is required", 400);
      }
      
      // Check if user has the required permission
      const hasPermission = await CheckUserPermissionService(userId, permissionKey);
      
      // Log permission check for debugging
      console.log(`🔐 Permission check for user ${userId}: ${permissionKey} = ${hasPermission ? 'GRANTED' : 'DENIED'}`);
      
      if (!hasPermission) {
        throw CreateError(`Access denied. Required permission: ${permissionKey}`, 403);
      }
      
      // Permission granted, continue
      next();
    } catch (error) {
      res.status(error.status || 403).json({ 
        message: error.message || "Permission denied",
        requiredPermission: permissionKey
      });
    }
  };
};

/**
 * @desc CheckMultiplePermissions Middleware
 * @access private
 * @method POST/GET/PATCH/DELETE
 * 
 * Usage: CheckMultiplePermissions(['permission.key1', 'permission.key2'], 'any' | 'all')
 * - 'any': User needs at least one permission
 * - 'all': User needs all permissions
 */
export const CheckMultiplePermissions = (permissionKeys, mode = 'any') => {
  return async (req, res, next) => {
    try {
      const userId = req.UserId;
      
      if (!userId) {
        throw CreateError("Authentication required", 401);
      }
      
      if (!Array.isArray(permissionKeys) || permissionKeys.length === 0) {
        throw CreateError("Permission keys array is required", 400);
      }
      
      // Check all permissions
      const permissionChecks = await Promise.all(
        permissionKeys.map(key => CheckUserPermissionService(userId, key))
      );
      
      let hasPermission = false;
      
      if (mode === 'any') {
        // User needs at least one permission
        hasPermission = permissionChecks.some(check => check === true);
      } else {
        // User needs all permissions
        hasPermission = permissionChecks.every(check => check === true);
      }
      
      if (!hasPermission) {
        const required = mode === 'any' ? 'one of' : 'all of';
        throw CreateError(
          `Access denied. Required ${required}: ${permissionKeys.join(', ')}`, 
          403
        );
      }
      
      // Permission granted, continue
      next();
    } catch (error) {
      res.status(error.status || 403).json({ 
        message: error.message || "Permission denied",
        requiredPermissions: permissionKeys,
        mode
      });
    }
  };
};

/**
 * @desc CheckAdminOrPermission Middleware
 * @access private
 * @method POST/GET/PATCH/DELETE
 * 
 * Usage: CheckAdminOrPermission('permission.key')
 * - Admin: Always allowed (bypasses permission check)
 * - HOD/Employee: Must have the specified permission
 * 
 * This is useful for features where Admin has full access by default,
 * but HODs need explicit permission (e.g., Update Leave List)
 */
export const CheckAdminOrPermission = (permissionKey) => {
  return async (req, res, next) => {
    try {
      const userId = req.UserId;
      const userRole = req.Role;
      
      if (!userId) {
        throw CreateError("Authentication required", 401);
      }
      
      if (!permissionKey) {
        throw CreateError("Permission key is required", 400);
      }
      
      // Admin always has access (bypass permission check)
      if (userRole && userRole.toLowerCase() === 'admin') {
        return next();
      }
      
      // For non-admin users, check the permission
      const hasPermission = await CheckUserPermissionService(userId, permissionKey);
      
      if (!hasPermission) {
        throw CreateError(`Access denied. Required permission: ${permissionKey}`, 403);
      }
      
      // Permission granted, continue
      next();
    } catch (error) {
      res.status(error.status || 403).json({ 
        message: error.message || "Permission denied",
        requiredPermission: permissionKey
      });
    }
  };
};



