// Menu Items - Matches HR Portal structure
import React from 'react';
import { 
  LayoutDashboard, 
  FileText, 
  Users, 
  Building2,
  Circle,
  CheckSquare
} from 'lucide-react';

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

export const getMenuItems = (userRole?: string): MenuItem[] => {
  const role = userRole?.toLowerCase() || 'employee';

  if (role === 'admin' || role === 'Admin') {
    return [
      { key: 'navigation', label: 'Admin Routes', isTitle: true },
      {
        key: 'Dashboard',
        label: 'Dashboard',
        url: '/dashboard',
        icon: createIcon(LayoutDashboard, 'w-5 h-5'),
      },
      {
        key: 'Department',
        label: 'Department',
        icon: createIcon(Building2, 'w-5 h-5'),
        children: [
          {
            key: 'NewDepartment',
            label: 'New Department',
            url: '/dashboard/departments/create',
            parentKey: 'Department',
            icon: createIcon(Circle, 'w-4 h-4'),
          },
          {
            key: 'DepartmentList',
            label: 'Department List',
            url: '/dashboard/departments',
            parentKey: 'Department',
            icon: createIcon(Circle, 'w-4 h-4'),
          },
        ],
      },
      {
        key: 'LeaveType',
        label: 'Leave Type',
        icon: createIcon(FileText, 'w-5 h-5'),
        children: [
          {
            key: 'LeaveTypeList',
            label: 'Leave Type List',
            url: '/dashboard/leave-types',
            parentKey: 'LeaveType',
            icon: createIcon(Circle, 'w-4 h-4'),
          },
        ],
      },
      {
        key: 'Employee',
        label: 'Employee',
        icon: createIcon(Users, 'w-5 h-5'),
        children: [
          {
            key: 'NewEmployee',
            label: 'New Employee',
            url: '/dashboard/employees/create',
            parentKey: 'Employee',
            icon: createIcon(Circle, 'w-4 h-4'),
          },
          {
            key: 'EmployeeList',
            label: 'Employee List',
            url: '/dashboard/employees',
            parentKey: 'Employee',
            icon: createIcon(Circle, 'w-4 h-4'),
          },
        ],
      },
      {
        key: 'Leave',
        label: 'Leave',
        icon: createIcon(FileText, 'w-5 h-5'),
        children: [
          {
            key: 'LeaveList',
            label: 'Leave List',
            url: '/dashboard/leaves-admin',
            parentKey: 'Leave',
            icon: createIcon(Circle, 'w-4 h-4'),
          },
        ],
      },
      {
        key: 'Approvals',
        label: 'Approvals',
        url: '/dashboard/approvals',
        icon: createIcon(CheckSquare, 'w-5 h-5'),
      },
    ];
  } else if (role === 'hod' || role === 'HOD') {
    return [
      { key: 'navigation', label: 'HOD Routes', isTitle: true },
      {
        key: 'Dashboard',
        label: 'Dashboard',
        url: '/dashboard',
        icon: createIcon(LayoutDashboard, 'w-5 h-5'),
      },
      {
        key: 'Leave',
        label: 'Leave',
        icon: createIcon(FileText, 'w-5 h-5'),
        children: [
          {
            key: 'NewLeave',
            label: 'New Leave',
            url: '/dashboard/apply-leave',
            parentKey: 'Leave',
            icon: createIcon(Circle, 'w-4 h-4'),
          },
          {
            key: 'LeaveList',
            label: 'Leave List',
            url: '/dashboard/leaves-hod',
            parentKey: 'Leave',
            icon: createIcon(Circle, 'w-4 h-4'),
          },
        ],
      },
      {
        key: 'Approvals',
        label: 'Approvals',
        url: '/dashboard/approvals',
        icon: createIcon(CheckSquare, 'w-5 h-5'),
      },
    ];
  } else {
    // STAFF/Employee
    return [
      {
        key: 'Dashboard',
        label: 'Dashboard',
        url: '/dashboard',
        icon: createIcon(LayoutDashboard, 'w-5 h-5'),
      },
      {
        key: 'Leave',
        label: 'Leave',
        icon: createIcon(FileText, 'w-5 h-5'),
        children: [
          {
            key: 'NewLeave',
            label: 'New Leave',
            url: '/dashboard/apply-leave',
            parentKey: 'Leave',
            icon: createIcon(Circle, 'w-4 h-4'),
          },
          {
            key: 'LeaveList',
            label: 'Leave List',
            url: '/dashboard/leaves',
            parentKey: 'Leave',
            icon: createIcon(Circle, 'w-4 h-4'),
          },
        ],
      },
    ];
  }
};
