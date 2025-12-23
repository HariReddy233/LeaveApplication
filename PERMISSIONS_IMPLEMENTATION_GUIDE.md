# Dynamic Permissions System - Implementation Guide

## Overview

This document describes the complete dynamic permissions system implementation for the Leave Management System. The system allows Admin users to manage user permissions dynamically without code changes.

## Database Setup

### Step 1: Run the SQL Script

Execute the `PERMISSIONS_DATABASE_SCHEMA.sql` file on your PostgreSQL database:

```bash
psql -h YOUR_HOST -p YOUR_PORT -U YOUR_USER -d YOUR_DATABASE -f PERMISSIONS_DATABASE_SCHEMA.sql
```

This creates:
- `permissions` table - Stores all available permissions
- `user_permissions` table - Maps users to their permissions
- Default permissions for the system
- Indexes for performance

### Step 2: Verify Tables

```sql
-- Check permissions table
SELECT * FROM permissions;

-- Check user_permissions table
SELECT * FROM user_permissions;
```

## Backend Implementation

### Files Created

1. **`backend/src/services/Permission/PermissionService.js`**
   - Service layer for permission operations
   - Functions: GetAllPermissions, GetUserPermissions, AssignPermission, etc.

2. **`backend/src/controller/Permission/PermissionControllers.js`**
   - Controllers for permission API endpoints

3. **`backend/src/routes/PermissionRoutes.js`**
   - API routes for permission management
   - All routes require Admin role and `permissions.manage` or `permissions.view` permission

4. **`backend/src/middleware/CheckPermission.js`**
   - Middleware for checking permissions on routes
   - Usage: `CheckPermission('permission.key')`

### API Endpoints

All endpoints are prefixed with `/api/v1/Permission`:

- `GET /GetAllPermissions` - Get all available permissions (Admin only)
- `GET /GetAllUsersWithPermissions` - Get all users with their permissions (Admin only)
- `GET /GetUserPermissions/:userId` - Get permissions for a specific user (Admin only)
- `POST /AssignPermission` - Assign a permission to a user (Admin only)
- `POST /RevokePermission` - Revoke a permission from a user (Admin only)
- `POST /BulkAssignPermissions` - Assign multiple permissions at once (Admin only)
- `GET /GetMyPermissions` - Get current user's permissions (Any authenticated user)

### Using Permission Middleware

To protect a route with permission checking:

```javascript
import { CheckPermission } from "../middleware/CheckPermission.js";

// Single permission
router.get(
  "/SomeRoute",
  CheckEmployeeAuth,
  CheckPermission('leave.approve'),
  SomeController
);

// Multiple permissions (any)
import { CheckMultiplePermissions } from "../middleware/CheckPermission.js";

router.get(
  "/SomeRoute",
  CheckEmployeeAuth,
  CheckMultiplePermissions(['leave.approve', 'leave.reject'], 'any'),
  SomeController
);
```

## Frontend Implementation

### Files Created

1. **`frontend/src/utils/permissions.ts`**
   - Utility functions for permission checking
   - Functions: `hasPermission()`, `hasAnyPermission()`, `loadUserPermissions()`

2. **`frontend/src/app/dashboard/permissions/page.tsx`**
   - Admin-only permissions management screen
   - Allows assigning/revoking permissions per user

3. **Updated `frontend/src/utils/menu.ts`**
   - Menu now uses permissions to show/hide items
   - Menu items are filtered based on user permissions

4. **Updated `frontend/src/components/Layout/Menu.tsx`**
   - Menu component now accepts and uses permissions

### Permission Keys

All permission keys are defined in `frontend/src/utils/permissions.ts`:

```typescript
export const PermissionKeys = {
  EMPLOYEE_CREATE: 'employee.create',
  LEAVE_APPROVE: 'leave.approve',
  // ... etc
}
```

### Using Permissions in Components

```typescript
import { hasPermission, PermissionKeys } from '@/utils/permissions';

// Check single permission
if (hasPermission(PermissionKeys.LEAVE_APPROVE)) {
  // Show approve button
}

// Check multiple permissions (any)
import { hasAnyPermission } from '@/utils/permissions';
if (hasAnyPermission([PermissionKeys.LEAVE_APPROVE, PermissionKeys.LEAVE_REJECT])) {
  // Show action buttons
}
```

## Default Permissions

The system includes these default permissions:

### Employee Management
- `employee.create` - Create Employee
- `employee.edit` - Edit Employee
- `employee.delete` - Delete Employee
- `employee.view` - View Employees

### Leave Management
- `leave.apply` - Apply Leave
- `leave.edit` - Edit Leave
- `leave.delete` - Delete Leave
- `leave.view_own` - View Own Leaves
- `leave.view_all` - View All Leaves
- `leave.approve` - Approve Leave
- `leave.reject` - Reject Leave

### Authorization Management
- `authorization.create` - Create Authorization
- `authorization.view_own` - View Own Authorizations
- `authorization.view_all` - View All Authorizations
- `authorization.approve` - Approve Authorization

### Department Management
- `department.create` - Create Department
- `department.edit` - Edit Department
- `department.delete` - Delete Department
- `department.view` - View Departments

### Leave Type Management
- `leavetype.create` - Create Leave Type
- `leavetype.edit` - Edit Leave Type
- `leavetype.delete` - Delete Leave Type
- `leavetype.view` - View Leave Types

### Calendar Management
- `calendar.view` - View Calendar
- `calendar.block` - Block Calendar Dates

### Settings
- `settings.view` - View Settings
- `settings.edit` - Edit Settings

### Permissions Management
- `permissions.manage` - Manage Permissions (Admin only)
- `permissions.view` - View Permissions (Admin only)

### Reports
- `reports.view` - View Reports
- `reports.export` - Export Data

### Dashboard
- `dashboard.view` - View Dashboard

## Admin Access

- **Admin users automatically have all permissions** (handled in backend)
- Admin role bypasses permission checks in frontend (but backend still validates)
- Only Admin can access `/dashboard/permissions` page

## Security Notes

1. **Backend is the source of truth** - Frontend permission checks are for UI only
2. **All API endpoints must validate permissions server-side**
3. **Admin role grants all permissions automatically**
4. **Permission checks fail closed** - If error, access is denied

## Testing

1. **Run database schema** - Verify tables are created
2. **Login as Admin** - Access `/dashboard/permissions`
3. **Assign permissions** - Test assigning/revoking permissions
4. **Verify menu** - Check that menu items show/hide based on permissions
5. **Test API** - Verify backend blocks unauthorized access

## Migration Notes

- Existing functionality is preserved
- Role-based access still works (roles can be used as shortcuts)
- Permissions are additive - users can have both role and specific permissions
- Admin role automatically grants all permissions

## Future Enhancements

- Permission groups/roles
- Permission inheritance
- Audit logging for permission changes
- Permission templates
- Bulk permission assignment by role



