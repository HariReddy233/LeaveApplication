// Menu Items - Matches HR Portal structure
import React from 'react';
import { 
  LayoutDashboard, 
  FileText, 
  Users, 
  Building2,
  Circle,
  CheckSquare,
  Calendar,
  Settings
} from 'lucide-react';
import { hasPermission, PermissionKeys } from './permissions';

export type MenuItem = {
  key: string;
  label: string;
  url?: string;
  icon?: React.ReactNode;
  isTitle?: boolean;
  children?: MenuItem[];
  parentKey?: string;
};

const createIcon = (IconComponent: any, className: string) => {
  return React.createElement(IconComponent, { className });
};

export const getMenuItems = (userRole?: string, userPermissions?: string[]): MenuItem[] => {
  const role = userRole?.toLowerCase() || 'employee';
  const permissions = userPermissions || [];

  // Helper function to check permission
  // Dashboard.view must be strictly permission-based (no admin bypass)
  // For HOD and Employee, always check permissions (no role bypass)
  const can = (permission: string) => {
    // Special case: dashboard.view must be strictly permission-based
    if (permission === PermissionKeys.DASHBOARD_VIEW) {
      return hasPermission(permission, permissions);
    }
    // For HOD and Employee, always check permissions (no role bypass)
    // This ensures HOD permissions work fully without Admin dependency
    if (role === 'hod' || role === 'HOD' || role === 'employee' || role === 'Employee') {
      return hasPermission(permission, permissions);
    }
    // Admin role bypasses other permission checks (but backend still validates)
    if (role === 'admin') return true;
    return hasPermission(permission, permissions);
  };

  if (role === 'admin' || role === 'Admin') {
    const menuItems: MenuItem[] = [];

    // Dashboard
    if (can(PermissionKeys.DASHBOARD_VIEW)) {
      menuItems.push({
        key: 'Dashboard',
        label: 'Dashboard',
        url: '/dashboard',
        icon: createIcon(LayoutDashboard, 'w-5 h-5'),
      });
    }
    // Department
    if (can(PermissionKeys.DEPARTMENT_VIEW) || can(PermissionKeys.DEPARTMENT_CREATE) || can(PermissionKeys.DEPARTMENT_EDIT)) {
      const deptChildren: MenuItem[] = [];
      if (can(PermissionKeys.DEPARTMENT_CREATE)) {
        deptChildren.push({
          key: 'NewDepartment',
          label: 'New Department',
          url: '/dashboard/departments/create',
          parentKey: 'Department',
          icon: createIcon(Circle, 'w-4 h-4'),
        });
      }
      if (can(PermissionKeys.DEPARTMENT_VIEW)) {
        deptChildren.push({
          key: 'DepartmentList',
          label: 'Department List',
          url: '/dashboard/departments',
          parentKey: 'Department',
          icon: createIcon(Circle, 'w-4 h-4'),
        });
      }
      if (deptChildren.length > 0) {
        menuItems.push({
          key: 'Department',
          label: 'Department',
          icon: createIcon(Building2, 'w-5 h-5'),
          children: deptChildren,
        });
      }
    }
    // Leave Type
    if (can(PermissionKeys.LEAVETYPE_VIEW) || can(PermissionKeys.LEAVETYPE_CREATE) || can(PermissionKeys.LEAVETYPE_EDIT)) {
      const ltChildren: MenuItem[] = [];
      if (can(PermissionKeys.LEAVETYPE_CREATE)) {
        ltChildren.push({
          key: 'AddLeaveType',
          label: 'Add Leave Type',
          url: '/dashboard/leave-types/create',
          parentKey: 'LeaveType',
          icon: createIcon(Circle, 'w-4 h-4'),
        });
      }
      if (can(PermissionKeys.LEAVETYPE_VIEW)) {
        ltChildren.push({
          key: 'LeaveTypeList',
          label: 'Leave Type List',
          url: '/dashboard/leave-types',
          parentKey: 'LeaveType',
          icon: createIcon(Circle, 'w-4 h-4'),
        });
      }
      if (ltChildren.length > 0) {
        menuItems.push({
          key: 'LeaveType',
          label: 'Leave Type',
          icon: createIcon(FileText, 'w-5 h-5'),
          children: ltChildren,
        });
      }
    }

    // Employee
    if (can(PermissionKeys.EMPLOYEE_VIEW) || can(PermissionKeys.EMPLOYEE_CREATE) || can(PermissionKeys.EMPLOYEE_EDIT)) {
      const empChildren: MenuItem[] = [];
      if (can(PermissionKeys.EMPLOYEE_CREATE)) {
        empChildren.push({
          key: 'NewEmployee',
          label: 'New Employee',
          url: '/dashboard/employees/create',
          parentKey: 'Employee',
          icon: createIcon(Circle, 'w-4 h-4'),
        });
      }
      if (can(PermissionKeys.EMPLOYEE_VIEW)) {
        empChildren.push({
          key: 'EmployeeList',
          label: 'Employee List',
          url: '/dashboard/employees',
          parentKey: 'Employee',
          icon: createIcon(Circle, 'w-4 h-4'),
        });
      }
      if (empChildren.length > 0) {
        menuItems.push({
          key: 'Employee',
          label: 'Employee',
          icon: createIcon(Users, 'w-5 h-5'),
          children: empChildren,
        });
      }
    }

    // Leave
    if (can(PermissionKeys.LEAVE_APPLY) || can(PermissionKeys.LEAVE_VIEW_ALL) || can(PermissionKeys.LEAVE_VIEW_OWN)) {
      const leaveChildren: MenuItem[] = [];
      if (can(PermissionKeys.LEAVE_APPLY)) {
        leaveChildren.push({
          key: 'NewLeave',
          label: 'New Leave',
          url: '/dashboard/apply-leave',
          parentKey: 'Leave',
          icon: createIcon(Circle, 'w-4 h-4'),
        });
      }
      // Leave List requires leave.view_own OR leave.view_all
      if (can(PermissionKeys.LEAVE_VIEW_OWN) || can(PermissionKeys.LEAVE_VIEW_ALL)) {
        leaveChildren.push({
          key: 'LeaveList',
          label: 'Leave List',
          url: '/dashboard/leaves-admin',
          parentKey: 'Leave',
          icon: createIcon(Circle, 'w-4 h-4'),
        });
      }
      if (leaveChildren.length > 0) {
        menuItems.push({
          key: 'Leave',
          label: 'Leave',
          icon: createIcon(FileText, 'w-5 h-5'),
          children: leaveChildren,
        });
      }
    }

    // Approvals - requires leave.approve OR leave.reject
    if (can(PermissionKeys.LEAVE_APPROVE) || can(PermissionKeys.LEAVE_REJECT)) {
      menuItems.push({
        key: 'Approvals',
        label: 'Approvals',
        url: '/dashboard/approvals',
        icon: createIcon(CheckSquare, 'w-5 h-5'),
      });
    }

    // Calendar (Admin always sees it, but check permission for consistency)
    if (can(PermissionKeys.CALENDAR_VIEW)) {
      menuItems.push({
        key: 'Calendar',
        label: 'Calendar',
        url: '/dashboard/calendar',
        icon: createIcon(Calendar, 'w-5 h-5'),
      });
    }

    // Update Leave List (Organization Holidays & Blocked Dates)
    if (can(PermissionKeys.CALENDAR_BLOCK_DATES)) {
      menuItems.push({
        key: 'UpdateLeaveList',
        label: 'Update Leave List',
        url: '/dashboard/update-leave-list',
        icon: createIcon(Calendar, 'w-5 h-5'),
      });
    }

    // Settings is moved to "Additional menu items" section below the line in DashboardLayout
    // Not included in main menu to avoid duplication

    return menuItems;
  } else if (role === 'hod' || role === 'HOD') {
    const hodMenuItems: MenuItem[] = [];

    // Dashboard - check permission
    if (can(PermissionKeys.DASHBOARD_VIEW)) {
      hodMenuItems.push({
        key: 'Dashboard',
        label: 'Dashboard',
        url: '/dashboard',
        icon: createIcon(LayoutDashboard, 'w-5 h-5'),
      });
    }

    // Department - check permissions (same as Admin)
    if (can(PermissionKeys.DEPARTMENT_VIEW) || can(PermissionKeys.DEPARTMENT_CREATE) || can(PermissionKeys.DEPARTMENT_EDIT)) {
      const hodDeptChildren: MenuItem[] = [];
      if (can(PermissionKeys.DEPARTMENT_CREATE)) {
        hodDeptChildren.push({
          key: 'NewDepartment',
          label: 'New Department',
          url: '/dashboard/departments/create',
          parentKey: 'Department',
          icon: createIcon(Circle, 'w-4 h-4'),
        });
      }
      if (can(PermissionKeys.DEPARTMENT_VIEW)) {
        hodDeptChildren.push({
          key: 'DepartmentList',
          label: 'Department List',
          url: '/dashboard/departments',
          parentKey: 'Department',
          icon: createIcon(Circle, 'w-4 h-4'),
        });
      }
      if (hodDeptChildren.length > 0) {
        hodMenuItems.push({
          key: 'Department',
          label: 'Department',
          icon: createIcon(Building2, 'w-5 h-5'),
          children: hodDeptChildren,
        });
      }
    }

    // Leave Type - check permissions (same as Admin)
    if (can(PermissionKeys.LEAVETYPE_VIEW) || can(PermissionKeys.LEAVETYPE_CREATE) || can(PermissionKeys.LEAVETYPE_EDIT)) {
      const hodLtChildren: MenuItem[] = [];
      if (can(PermissionKeys.LEAVETYPE_CREATE)) {
        hodLtChildren.push({
          key: 'AddLeaveType',
          label: 'Add Leave Type',
          url: '/dashboard/leave-types/create',
          parentKey: 'LeaveType',
          icon: createIcon(Circle, 'w-4 h-4'),
        });
      }
      if (can(PermissionKeys.LEAVETYPE_VIEW)) {
        hodLtChildren.push({
          key: 'LeaveTypeList',
          label: 'Leave Type List',
          url: '/dashboard/leave-types',
          parentKey: 'LeaveType',
          icon: createIcon(Circle, 'w-4 h-4'),
        });
      }
      if (hodLtChildren.length > 0) {
        hodMenuItems.push({
          key: 'LeaveType',
          label: 'Leave Type',
          icon: createIcon(FileText, 'w-5 h-5'),
          children: hodLtChildren,
        });
      }
    }

    // Employee - check permissions (same as Admin)
    if (can(PermissionKeys.EMPLOYEE_VIEW) || can(PermissionKeys.EMPLOYEE_CREATE) || can(PermissionKeys.EMPLOYEE_EDIT)) {
      const hodEmpChildren: MenuItem[] = [];
      if (can(PermissionKeys.EMPLOYEE_CREATE)) {
        hodEmpChildren.push({
          key: 'NewEmployee',
          label: 'New Employee',
          url: '/dashboard/employees/create',
          parentKey: 'Employee',
          icon: createIcon(Circle, 'w-4 h-4'),
        });
      }
      if (can(PermissionKeys.EMPLOYEE_VIEW)) {
        hodEmpChildren.push({
          key: 'EmployeeList',
          label: 'Employee List',
          url: '/dashboard/employees',
          parentKey: 'Employee',
          icon: createIcon(Circle, 'w-4 h-4'),
        });
      }
      if (hodEmpChildren.length > 0) {
        hodMenuItems.push({
          key: 'Employee',
          label: 'Employee',
          icon: createIcon(Users, 'w-5 h-5'),
          children: hodEmpChildren,
        });
      }
    }

    // Leave - check permissions
    if (can(PermissionKeys.LEAVE_APPLY) || can(PermissionKeys.LEAVE_VIEW_ALL) || can(PermissionKeys.LEAVE_VIEW_OWN)) {
      const hodLeaveChildren: MenuItem[] = [];
      if (can(PermissionKeys.LEAVE_APPLY)) {
        hodLeaveChildren.push({
          key: 'NewLeave',
          label: 'New Leave',
          url: '/dashboard/apply-leave',
          parentKey: 'Leave',
          icon: createIcon(Circle, 'w-4 h-4'),
        });
      }
      // Leave List requires leave.view_own OR leave.view_all
      if (can(PermissionKeys.LEAVE_VIEW_OWN) || can(PermissionKeys.LEAVE_VIEW_ALL)) {
        hodLeaveChildren.push({
          key: 'LeaveList',
          label: 'Leave List',
          url: '/dashboard/leaves-hod',
          parentKey: 'Leave',
          icon: createIcon(Circle, 'w-4 h-4'),
        });
      }
      if (hodLeaveChildren.length > 0) {
        hodMenuItems.push({
          key: 'Leave',
          label: 'Leave',
          icon: createIcon(FileText, 'w-5 h-5'),
          children: hodLeaveChildren,
        });
      }
    }

    // Approvals - requires leave.approve OR leave.reject
    if (can(PermissionKeys.LEAVE_APPROVE) || can(PermissionKeys.LEAVE_REJECT)) {
      hodMenuItems.push({
        key: 'Approvals',
        label: 'Approvals',
        url: '/dashboard/approvals',
        icon: createIcon(CheckSquare, 'w-5 h-5'),
      });
    }

    // Calendar - check permission
    if (can(PermissionKeys.CALENDAR_VIEW)) {
      hodMenuItems.push({
        key: 'Calendar',
        label: 'Calendar',
        url: '/dashboard/calendar',
        icon: createIcon(Calendar, 'w-5 h-5'),
      });
    }

    // Update Leave List (Organization Holidays & Blocked Dates) - HOD with permission
    if (can(PermissionKeys.CALENDAR_BLOCK_DATES)) {
      hodMenuItems.push({
        key: 'UpdateLeaveList',
        label: 'Update Leave List',
        url: '/dashboard/update-leave-list',
        icon: createIcon(Calendar, 'w-5 h-5'),
      });
    }

    // Settings is moved to "Additional menu items" section below the line in DashboardLayout
    // Not included in main menu to avoid duplication

    return hodMenuItems;
  } else {
    // STAFF/Employee
    const employeeMenuItems: MenuItem[] = [];

    // Dashboard - check permission
    if (can(PermissionKeys.DASHBOARD_VIEW)) {
      employeeMenuItems.push({
        key: 'Dashboard',
        label: 'Dashboard',
        url: '/dashboard',
        icon: createIcon(LayoutDashboard, 'w-5 h-5'),
      });
    }

    // Leave - check permissions
    if (can(PermissionKeys.LEAVE_APPLY) || can(PermissionKeys.LEAVE_VIEW_ALL) || can(PermissionKeys.LEAVE_VIEW_OWN)) {
      const employeeLeaveChildren: MenuItem[] = [];
      if (can(PermissionKeys.LEAVE_APPLY)) {
        employeeLeaveChildren.push({
          key: 'NewLeave',
          label: 'New Leave',
          url: '/dashboard/apply-leave',
          parentKey: 'Leave',
          icon: createIcon(Circle, 'w-4 h-4'),
        });
      }
      // Leave List requires leave.view_own OR leave.view_all
      if (can(PermissionKeys.LEAVE_VIEW_OWN) || can(PermissionKeys.LEAVE_VIEW_ALL)) {
        employeeLeaveChildren.push({
          key: 'LeaveList',
          label: 'Leave List',
          url: '/dashboard/leaves',
          parentKey: 'Leave',
          icon: createIcon(Circle, 'w-4 h-4'),
        });
      }
      if (employeeLeaveChildren.length > 0) {
        employeeMenuItems.push({
          key: 'Leave',
          label: 'Leave',
          icon: createIcon(FileText, 'w-5 h-5'),
          children: employeeLeaveChildren,
        });
      }
    }

    // Calendar - check permission
    if (can(PermissionKeys.CALENDAR_VIEW)) {
      employeeMenuItems.push({
        key: 'Calendar',
        label: 'Calendar',
        url: '/dashboard/calendar',
        icon: createIcon(Calendar, 'w-5 h-5'),
      });
    }

    // Settings is moved to "Additional menu items" section below the line in DashboardLayout
    // Not included in main menu to avoid duplication

    return employeeMenuItems;
  }
};
