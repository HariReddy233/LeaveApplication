/**
 * Permission Utility Functions
 * Helper functions for checking user permissions in the frontend
 */

let cachedPermissions: string[] = [];
let permissionsLoaded = false;

/**
 * Load user permissions from API
 */
export const loadUserPermissions = async (): Promise<string[]> => {
  try {
    const api = (await import('@/lib/api')).default;
    const response = await api.get('/Permission/GetMyPermissions');
    if (response.data?.data) {
      cachedPermissions = response.data.data;
      permissionsLoaded = true;
      return cachedPermissions;
    }
    return [];
  } catch (error) {
    console.error('Failed to load permissions:', error);
    return [];
  }
};

/**
 * Check if user has a specific permission
 */
export const hasPermission = (permissionKey: string, userPermissions?: string[]): boolean => {
  const perms = userPermissions || cachedPermissions;
  
  // Admin always has all permissions (handled by backend, but check here too)
  // This is a fallback - backend is the source of truth
  return perms.includes(permissionKey);
};

/**
 * Check if user has any of the specified permissions
 */
export const hasAnyPermission = (permissionKeys: string[], userPermissions?: string[]): boolean => {
  const perms = userPermissions || cachedPermissions;
  return permissionKeys.some(key => perms.includes(key));
};

/**
 * Check if user has all of the specified permissions
 */
export const hasAllPermissions = (permissionKeys: string[], userPermissions?: string[]): boolean => {
  const perms = userPermissions || cachedPermissions;
  return permissionKeys.every(key => perms.includes(key));
};

/**
 * Get all user permissions
 */
export const getUserPermissions = (): string[] => {
  return [...cachedPermissions];
};

/**
 * Clear cached permissions (useful for logout)
 */
export const clearPermissions = (): void => {
  cachedPermissions = [];
  permissionsLoaded = false;
};

/**
 * Permission keys mapping
 * Centralized list of all permission keys for easy reference
 */
export const PermissionKeys = {
  // Employee Management
  EMPLOYEE_CREATE: 'employee.create',
  EMPLOYEE_EDIT: 'employee.edit',
  EMPLOYEE_DELETE: 'employee.delete',
  EMPLOYEE_VIEW: 'employee.view',
  
  // Leave Management
  LEAVE_APPLY: 'leave.apply',
  LEAVE_EDIT: 'leave.edit',
  LEAVE_DELETE: 'leave.delete',
  LEAVE_VIEW_OWN: 'leave.view_own',
  LEAVE_VIEW_ALL: 'leave.view_all',
  LEAVE_APPROVE: 'leave.approve',
  LEAVE_REJECT: 'leave.reject',
  
  // Department Management
  DEPARTMENT_CREATE: 'department.create',
  DEPARTMENT_EDIT: 'department.edit',
  DEPARTMENT_DELETE: 'department.delete',
  DEPARTMENT_VIEW: 'department.view',
  
  // Leave Type Management
  LEAVETYPE_CREATE: 'leavetype.create',
  LEAVETYPE_EDIT: 'leavetype.edit',
  LEAVETYPE_DELETE: 'leavetype.delete',
  LEAVETYPE_VIEW: 'leavetype.view',
  
  // Calendar Management
  CALENDAR_VIEW: 'calendar.view',
  CALENDAR_BLOCK_DATES: 'calendar.block_dates',
  
  // Settings
  SETTINGS_VIEW: 'settings.view',
  SETTINGS_EDIT: 'settings.edit',
  
  // Permissions Management
  PERMISSIONS_MANAGE: 'permissions.manage',
  PERMISSIONS_VIEW: 'permissions.view',
  
  // Reports
  REPORTS_VIEW: 'reports.view',
  REPORTS_EXPORT: 'reports.export',
  
  // Dashboard
  DASHBOARD_VIEW: 'dashboard.view',
} as const;

