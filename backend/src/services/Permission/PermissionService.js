//Internal Lib Import
import database from "../../config/database.js";
import { CreateError } from "../../helper/ErrorHandler.js";

/**
 * Get All Permissions
 * Returns list of all available permissions
 */
export const GetAllPermissionsService = async () => {
  try {
    const result = await database.query(
      `SELECT permission_id, permission_key, permission_name, description, category, is_active
       FROM permissions
       WHERE is_active = TRUE
       AND LOWER(category) != 'authorization'
       AND LOWER(category) != 'general'
       AND permission_key != 'department.view'
       AND permission_key != 'employee.view'
       AND permission_key != 'reports.export'
       ORDER BY category, permission_name`
    );
    
    return {
      data: result.rows
    };
  } catch (error) {
    console.error('GetAllPermissionsService error:', error);
    throw CreateError("Failed to fetch permissions", 500);
  }
};

/**
 * Get User Permissions
 * Returns all permissions for a specific user
 */
export const GetUserPermissionsService = async (Request) => {
  const { userId } = Request.params;
  const requestingUserId = Request.UserId;
  
  try {
    // Get user permissions with permission details (excluding authorization, general, and specific view permissions)
    const result = await database.query(
      `SELECT 
        p.permission_id,
        p.permission_key,
        p.permission_name,
        p.description,
        p.category,
        up.granted,
        up.granted_at
       FROM user_permissions up
       JOIN permissions p ON up.permission_id = p.permission_id
       WHERE up.user_id = $1 
       AND up.granted = TRUE 
       AND p.is_active = TRUE
       AND LOWER(p.category) != 'authorization'
       AND LOWER(p.category) != 'general'
       AND p.permission_key != 'department.view'
       AND p.permission_key != 'employee.view'
       AND p.permission_key != 'reports.export'
       ORDER BY p.category, p.permission_name`,
      [userId]
    );
    
    // Also get user info
    const userResult = await database.query(
      `SELECT user_id, email, first_name, last_name, 
       COALESCE(first_name || ' ' || last_name, first_name, last_name, email) as full_name,
       role
       FROM users WHERE user_id = $1`,
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      throw CreateError("User not found", 404);
    }
    
    return {
      user: userResult.rows[0],
      permissions: result.rows
    };
  } catch (error) {
    console.error('GetUserPermissionsService error:', error);
    if (error.status) throw error;
    throw CreateError("Failed to fetch user permissions", 500);
  }
};

/**
 * Get All Users with Their Permissions
 * Returns list of all users with their permission summary
 */
export const GetAllUsersWithPermissionsService = async (Request) => {
  try {
    // Get all users
    const usersResult = await database.query(
      `SELECT 
        u.user_id,
        u.email,
        u.first_name,
        u.last_name,
        COALESCE(u.first_name || ' ' || u.last_name, u.first_name, u.last_name, u.email) as full_name,
        u.role,
        u.status,
        COUNT(up.permission_id) FILTER (WHERE up.granted = TRUE) as permission_count
       FROM users u
       LEFT JOIN user_permissions up ON u.user_id = up.user_id
       WHERE u.status = 'Active' OR u.status IS NULL
       GROUP BY u.user_id, u.email, u.first_name, u.last_name, u.role, u.status
       ORDER BY u.first_name, u.last_name, u.email`
    );
    
    // For each user, get their permissions
    const usersWithPermissions = await Promise.all(
      usersResult.rows.map(async (user) => {
        const permissionsResult = await database.query(
          `SELECT 
            p.permission_id,
            p.permission_key,
            p.permission_name,
            p.category
           FROM user_permissions up
           JOIN permissions p ON up.permission_id = p.permission_id
           WHERE up.user_id = $1 AND up.granted = TRUE AND p.is_active = TRUE
           ORDER BY p.category, p.permission_name`,
          [user.user_id]
        );
        
        return {
          ...user,
          permissions: permissionsResult.rows
        };
      })
    );
    
    return {
      data: usersWithPermissions
    };
  } catch (error) {
    console.error('GetAllUsersWithPermissionsService error:', error);
    throw CreateError("Failed to fetch users with permissions", 500);
  }
};

/**
 * Assign Permission to User
 * Grants a permission to a user
 */
export const AssignPermissionService = async (Request) => {
  const { userId, permissionId } = Request.body;
  const grantedBy = Request.UserId;
  
  if (!userId || !permissionId) {
    throw CreateError("User ID and Permission ID are required", 400);
  }
  
  try {
    // Verify permission exists and get its details
    const permissionCheck = await database.query(
      'SELECT permission_id, permission_key, category FROM permissions WHERE permission_id = $1 AND is_active = TRUE',
      [permissionId]
    );
    
    if (permissionCheck.rows.length === 0) {
      throw CreateError("Permission not found or inactive", 404);
    }
    
    const permission = permissionCheck.rows[0];
    
    // Verify user exists and get role
    const userCheck = await database.query(
      'SELECT user_id, role FROM users WHERE user_id = $1',
      [userId]
    );
    
    if (userCheck.rows.length === 0) {
      throw CreateError("User not found", 404);
    }
    
    const user = userCheck.rows[0];
    const userRole = (user.role || '').toLowerCase();
    
    // Backend validation: Prevent assigning restricted permissions to Employees
    if (userRole === 'employee') {
      const permKey = (permission.permission_key || '').toLowerCase();
      const permCategory = (permission.category || '').toLowerCase();
      
      // Block Department permissions for Employees
      if (permCategory === 'department') {
        throw CreateError("Employees cannot be assigned Department permissions", 403);
      }
      
      // Block Employee Management permissions for Employees
      if (permCategory === 'employee') {
        throw CreateError("Employees cannot be assigned Employee Management permissions", 403);
      }
      
      // Block Permissions Management for Employees
      if (permCategory === 'permissions') {
        throw CreateError("Employees cannot be assigned Permissions Management permissions", 403);
      }
      
      // Block Leave Type permissions for Employees
      if (permCategory === 'leave type' || permCategory === 'leavetype') {
        throw CreateError("Employees cannot be assigned Leave Type permissions", 403);
      }
    }
    
    // Insert or update user permission
    const result = await database.query(
      `INSERT INTO user_permissions (user_id, permission_id, granted, granted_by, granted_at)
       VALUES ($1, $2, TRUE, $3, NOW())
       ON CONFLICT (user_id, permission_id) 
       DO UPDATE SET 
         granted = TRUE,
         granted_by = $3,
         granted_at = NOW(),
         revoked_at = NULL
       RETURNING *`,
      [userId, permissionId, grantedBy]
    );
    
    return {
      message: "Permission assigned successfully",
      data: result.rows[0]
    };
  } catch (error) {
    console.error('AssignPermissionService error:', error);
    if (error.status) throw error;
    throw CreateError("Failed to assign permission", 500);
  }
};

/**
 * Revoke Permission from User
 * Revokes a permission from a user
 */
export const RevokePermissionService = async (Request) => {
  const { userId, permissionId } = Request.body;
  const revokedBy = Request.UserId;
  
  if (!userId || !permissionId) {
    throw CreateError("User ID and Permission ID are required", 400);
  }
  
  try {
    // Update user permission to revoked
    const result = await database.query(
      `UPDATE user_permissions
       SET granted = FALSE, revoked_at = NOW()
       WHERE user_id = $1 AND permission_id = $2
       RETURNING *`,
      [userId, permissionId]
    );
    
    if (result.rows.length === 0) {
      throw CreateError("User permission not found", 404);
    }
    
    return {
      message: "Permission revoked successfully",
      data: result.rows[0]
    };
  } catch (error) {
    console.error('RevokePermissionService error:', error);
    if (error.status) throw error;
    throw CreateError("Failed to revoke permission", 500);
  }
};

/**
 * Bulk Assign Permissions
 * Assigns multiple permissions to a user at once
 */
export const BulkAssignPermissionsService = async (Request) => {
  const { userId, permissionIds } = Request.body;
  const grantedBy = Request.UserId;
  
  if (!userId || !Array.isArray(permissionIds)) {
    throw CreateError("User ID and Permission IDs array are required", 400);
  }
  
  try {
    // Verify user exists and get role
    const userCheck = await database.query(
      'SELECT user_id, role FROM users WHERE user_id = $1',
      [userId]
    );
    
    if (userCheck.rows.length === 0) {
      throw CreateError("User not found", 404);
    }
    
    const user = userCheck.rows[0];
    const userRole = (user.role || '').toLowerCase();
    
    // Verify all permissions exist and get their details
    const permissionCheck = await database.query(
      `SELECT permission_id, permission_key, category FROM permissions 
       WHERE permission_id = ANY($1) AND is_active = TRUE`,
      [permissionIds]
    );
    
    if (permissionCheck.rows.length !== permissionIds.length) {
      throw CreateError("One or more permissions not found or inactive", 400);
    }
    
    // Backend validation: Check all permissions before assigning (for Employees)
    if (userRole === 'employee') {
      for (const perm of permissionCheck.rows) {
        const permCategory = (perm.category || '').toLowerCase();
        
        // Block restricted categories for Employees
        if (permCategory === 'department' || 
            permCategory === 'employee' ||
            permCategory === 'permissions' ||
            permCategory === 'leave type' ||
            permCategory === 'leavetype') {
          throw CreateError(
            `Employees cannot be assigned ${permCategory} permissions. Permission: ${perm.permission_key}`,
            403
          );
        }
      }
    }
    
    // Bulk insert/update permissions using individual queries (safer for PostgreSQL)
    for (const permId of permissionIds) {
      await database.query(
        `INSERT INTO user_permissions (user_id, permission_id, granted, granted_by, granted_at)
         VALUES ($1, $2, TRUE, $3, NOW())
         ON CONFLICT (user_id, permission_id) 
         DO UPDATE SET 
           granted = TRUE,
           granted_by = $3,
           granted_at = NOW(),
           revoked_at = NULL`,
        [userId, permId, grantedBy]
      );
    }
    
    return {
      message: `${permissionIds.length} permissions assigned successfully`,
      assigned: permissionIds.length
    };
  } catch (error) {
    console.error('BulkAssignPermissionsService error:', error);
    if (error.status) throw error;
    throw CreateError("Failed to assign permissions", 500);
  }
};

/**
 * Check User Permission
 * Checks if a user has a specific permission
 */
export const CheckUserPermissionService = async (userId, permissionKey) => {
  try {
    // Special case: dashboard.view must be strictly permission-based (no admin bypass)
    if (permissionKey === 'dashboard.view') {
      // Check specific permission only (no admin bypass)
      const result = await database.query(
        `SELECT up.granted
         FROM user_permissions up
         JOIN permissions p ON up.permission_id = p.permission_id
         WHERE up.user_id = $1 
         AND p.permission_key = $2 
         AND up.granted = TRUE 
         AND p.is_active = TRUE`,
        [userId, permissionKey]
      );
      return result.rows.length > 0;
    }
    
    // For other permissions, check if user is admin (admins have all permissions except dashboard.view)
    const userResult = await database.query(
      'SELECT role FROM users WHERE user_id = $1',
      [userId]
    );
    
    if (userResult.rows.length > 0 && 
        (userResult.rows[0].role?.toLowerCase() === 'admin')) {
      return true; // Admins have all permissions (except dashboard.view which is checked above)
    }
    
    // Check specific permission
    const result = await database.query(
      `SELECT up.granted, p.permission_key, p.is_active, up.granted as user_granted
       FROM user_permissions up
       JOIN permissions p ON up.permission_id = p.permission_id
       WHERE up.user_id = $1 
       AND p.permission_key = $2`,
      [userId, permissionKey]
    );
    
    // Log detailed permission check result
    if (result.rows.length > 0) {
      const perm = result.rows[0];
      const hasPermission = perm.user_granted === true && perm.is_active === true;
      console.log(`🔐 Permission check details for user ${userId}, permission ${permissionKey}:`, {
        found: true,
        granted: perm.user_granted,
        is_active: perm.is_active,
        hasPermission
      });
      return hasPermission;
    } else {
      console.log(`🔐 Permission check for user ${userId}, permission ${permissionKey}: NOT FOUND in user_permissions`);
      return false;
    }
  } catch (error) {
    console.error('CheckUserPermissionService error:', error);
    return false; // Fail closed - if error, deny access
  }
};

/**
 * Get User Permissions by Keys
 * Returns permission keys for a user (useful for frontend)
 */
export const GetUserPermissionKeysService = async (userId) => {
  try {
    // First check if user is admin
    const userResult = await database.query(
      'SELECT role FROM users WHERE user_id = $1',
      [userId]
    );
    
    if (userResult.rows.length > 0 && 
        (userResult.rows[0].role?.toLowerCase() === 'admin')) {
      // Admin has all permissions - return all active permission keys (excluding authorization, general, and specific view permissions)
      const allPerms = await database.query(
        `SELECT permission_key FROM permissions 
         WHERE is_active = TRUE 
         AND LOWER(category) != 'authorization'
         AND LOWER(category) != 'general'
         AND permission_key != 'department.view'
         AND permission_key != 'employee.view'
         AND permission_key != 'reports.export'`
      );
      return allPerms.rows.map(p => p.permission_key);
    }
    
    // Get user's specific permissions (excluding authorization, general, and specific view permissions)
    const result = await database.query(
      `SELECT p.permission_key
       FROM user_permissions up
       JOIN permissions p ON up.permission_id = p.permission_id
       WHERE up.user_id = $1 
       AND up.granted = TRUE 
       AND p.is_active = TRUE
       AND LOWER(p.category) != 'authorization'
       AND LOWER(p.category) != 'general'
       AND p.permission_key != 'department.view'
       AND p.permission_key != 'employee.view'
       AND p.permission_key != 'reports.export'`,
      [userId]
    );
    
    return result.rows.map(p => p.permission_key);
  } catch (error) {
    console.error('GetUserPermissionKeysService error:', error);
    return [];
  }
};

/**
 * Initialize Required Permissions
 * Creates all required permissions if they don't exist
 */
export const InitializeRequiredPermissionsService = async () => {
  try {
    // Get all required permissions from the system
    const requiredPermissions = [
      'dashboard.view',
      'leave.apply',
      'leave.view.own',
      'leave.view.all',
      'leave.edit',
      'leave.delete',
      'leave.approve',
      'leave.reject',
      'leave.update_list',
      'employee.view',
      'employee.create',
      'employee.edit',
      'employee.delete',
      'department.view',
      'department.create',
      'department.edit',
      'department.delete',
      'leavetype.view',
      'leavetype.create',
      'leavetype.edit',
      'leavetype.delete',
      'reports.view',
      'permission.view',
      'permission.assign',
      'permission.revoke'
    ];
    
    const created = [];
    const existing = [];
    
    for (const permissionKey of requiredPermissions) {
      try {
        // Generate a readable permission name from the key
        const permissionName = permissionKey
          .split('.')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
        
        // Determine category based on permission key prefix
        let category = 'GENERAL';
        if (permissionKey.startsWith('leave.')) {
          category = 'LEAVE';
        } else if (permissionKey.startsWith('employee.')) {
          category = 'EMPLOYEE';
        } else if (permissionKey.startsWith('department.')) {
          category = 'DEPARTMENT';
        } else if (permissionKey.startsWith('leavetype.')) {
          category = 'LEAVE TYPE';
        } else if (permissionKey.startsWith('reports.')) {
          category = 'REPORTS';
        } else if (permissionKey.startsWith('permission.')) {
          category = 'PERMISSIONS';
        } else if (permissionKey.startsWith('dashboard.')) {
          category = 'DASHBOARD';
        }
        
        // Generate description based on permission key
        let description = `Permission: ${permissionKey}`;
        if (permissionKey === 'leave.update_list') {
          description = 'View and manage update leave list (organization holidays and blocked dates)';
        }
        
        // First try to insert, if it already exists, update it to ensure category and description are correct
        let result = await database.query(
          `INSERT INTO permissions (permission_key, permission_name, description, category, is_active, created_at)
           VALUES ($1, $2, $3, $4, TRUE, NOW())
           ON CONFLICT (permission_key) DO UPDATE
           SET permission_name = EXCLUDED.permission_name,
               description = EXCLUDED.description,
               category = EXCLUDED.category,
               is_active = TRUE
           RETURNING *`,
          [permissionKey, permissionName, description, category]
        );
        
        if (result.rows.length > 0) {
          // Check if this was an insert or update
          const wasInsert = result.rows[0].created_at && 
            new Date(result.rows[0].created_at).getTime() > Date.now() - 1000; // Created within last second
          if (wasInsert) {
            created.push(permissionKey);
          } else {
            existing.push(permissionKey);
          }
        } else {
          existing.push(permissionKey);
        }
      } catch (err) {
        console.error(`Error initializing permission ${permissionKey}:`, err);
      }
    }
    
    return {
      message: `Permissions initialized. Created: ${created.length}, Already existed: ${existing.length}`,
      created,
      existing,
      total: requiredPermissions.length
    };
  } catch (error) {
    console.error('InitializeRequiredPermissionsService error:', error);
    throw CreateError("Failed to initialize permissions", 500);
  }
};

