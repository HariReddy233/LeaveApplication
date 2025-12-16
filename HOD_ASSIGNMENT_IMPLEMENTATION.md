# HOD Assignment Implementation - Option 2 (Direct Manager Assignment)

## ✅ Implementation Complete

This document explains the implementation of **Option 2: Direct Manager Assignment** where HODs are assigned to employees during user creation.

## What Was Implemented

### 1. **Database Structure** ✅
- **No database changes needed!** The `employees` table already has `manager_id` field
- `manager_id` references `employees.employee_id` (the HOD's employee record)
- Index already exists: `idx_employees_manager`

### 2. **Backend API Endpoint** ✅
- **New Endpoint**: `/api/v1/User/HodsList`
- **Method**: GET
- **Access**: Admin only
- **Returns**: List of all users with HOD role
- **Service**: `GetHodsListService` in `backend/src/services/User/UserService.js`
- **Controller**: `HodsList` in `backend/src/controller/User/UserControllers.js`
- **Route**: Added to `backend/src/routes/UserRoutes.js`

### 3. **Frontend User Creation Form** ✅
- **Location**: `frontend/src/app/dashboard/employees/create/page.tsx`
- **New Field**: "Assign HOD" dropdown
- **Features**:
  - Fetches list of HODs on page load
  - Shows HOD name, email, and department
  - Optional field (can be left empty)
  - Clear label explaining its purpose

### 4. **Backend Registration Service** ✅
- **File**: `backend/src/services/Auth/RegistrationService.js`
- **Changes**:
  - Accepts `hod_id` from request body
  - Converts `hod_id` (which could be user_id or employee_id) to `employee_id`
  - Saves `manager_id` in employees table
  - Handles all database schema variations (with/without designation column)

### 5. **Approval Process** ✅
- **Already implemented!** The leave approval system was updated earlier
- **Priority Order**:
  1. **Direct Manager Assignment** (manager_id) - **HIGHEST PRIORITY** ✅
  2. Department-based HOD
  3. Location-based HOD
- **Email Notifications**:
  - Sends to **assigned HOD only** (not all HODs)
  - Sends to **Admin** (one admin for all users)
- **Authorization**:
  - Only the assigned HOD can approve leaves for their employees
  - Admin can approve any leave (bypasses authorization)

## How It Works

### Step 1: Creating a User
1. Admin navigates to `/dashboard/employees/create`
2. Fills in user details (name, email, password, role, department, etc.)
3. **Selects HOD from dropdown** (optional)
4. Clicks "Create Employee"
5. Backend saves user and employee records
6. **If HOD selected**: `manager_id` is set in employees table

### Step 2: Employee Applies for Leave
1. Employee applies for leave
2. System finds assigned HOD using priority:
   - **First**: Checks `manager_id` (direct assignment) ✅
   - If not found: Checks department
   - If not found: Checks location
3. **Email sent to**:
   - Assigned HOD (specific HOD only)
   - Admin (one admin for all)

### Step 3: HOD Approves/Rejects
1. HOD receives email notification
2. HOD logs in and sees leave application
3. System verifies HOD is authorized (checks manager_id, department, or location)
4. HOD approves/rejects
5. **Email sent to employee** with approval/rejection status
6. **Admin also receives notification** (can approve/reject independently)

### Step 4: Final Approval
- **Both HOD and Admin must approve** for final approval
- If either rejects, leave is rejected
- Leave balance is updated only when both approve

## Database Schema

```sql
-- employees table (already exists)
CREATE TABLE employees (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    employee_id SERIAL,  -- or UUID depending on schema
    manager_id UUID REFERENCES employees(id),  -- ✅ This is used for HOD assignment
    email VARCHAR(255),
    full_name VARCHAR(255),
    role VARCHAR(50),
    location VARCHAR(100),
    team VARCHAR(100),
    ...
);
```

## API Endpoints

### Get HODs List
```
GET /api/v1/User/HodsList
Authorization: Bearer <admin_token>
Response: {
  Data: [
    {
      id: "user_id",
      user_id: "user_id",
      employee_id: "employee_id",
      email: "hod@company.com",
      full_name: "John Doe",
      department: "IT",
      location: "India"
    },
    ...
  ]
}
```

### Create User with HOD Assignment
```
POST /api/v1/Auth/RegisterUser
Authorization: Bearer <admin_token>
Body: {
  full_name: "Jane Smith",
  email: "jane@company.com",
  password: "password123",
  role: "employee",
  department: "IT",
  location: "India",
  designation: "Developer",
  hod_id: "employee_id_of_hod"  // ✅ New field
}
```

## Testing Checklist

- [x] HOD dropdown appears in user creation form
- [x] HOD list loads correctly
- [x] User creation saves manager_id
- [x] Leave application sends email to assigned HOD
- [x] Leave application sends email to Admin
- [x] HOD can approve leaves for assigned employees
- [x] HOD cannot approve leaves for unassigned employees
- [x] Admin can approve any leave
- [x] Both HOD and Admin must approve for final approval

## Example Flow

### Example 1: Employee with Assigned HOD
1. **Create Employee**:
   - Name: "John Employee"
   - Email: "john@company.com"
   - Department: "IT"
   - **HOD: "Jane HOD" (IT Department)**

2. **John Applies for Leave**:
   - System finds: `manager_id` = Jane HOD's employee_id ✅
   - **Email sent to**: Jane HOD + Admin

3. **Jane HOD Approves**:
   - System verifies: Jane is John's manager ✅
   - Approval successful
   - **Email sent to**: John Employee

4. **Admin Approves**:
   - Final approval complete
   - Leave balance updated

### Example 2: Employee without Assigned HOD
1. **Create Employee**:
   - Name: "Bob Employee"
   - Email: "bob@company.com"
   - Department: "HR"
   - **HOD: (Not selected)**

2. **Bob Applies for Leave**:
   - System finds: No manager_id
   - Falls back to: Department-based HOD (HR Department)
   - **Email sent to**: HR HOD + Admin

## Notes

1. **HOD Assignment is Optional**: If not selected, system falls back to department-based or location-based HOD
2. **One Admin for All**: Admin receives notifications for all leave applications
3. **Authorization**: Only assigned HOD can approve (unless Admin)
4. **Flexible**: Supports direct assignment, department-based, and location-based HODs

## Files Modified

1. `backend/src/services/User/UserService.js` - Added `GetHodsListService`
2. `backend/src/controller/User/UserControllers.js` - Added `HodsList` controller
3. `backend/src/routes/UserRoutes.js` - Added `/HodsList` route
4. `backend/src/services/Auth/RegistrationService.js` - Added `hod_id` handling and `manager_id` saving
5. `frontend/src/app/dashboard/employees/create/page.tsx` - Added HOD dropdown
6. `backend/src/services/Leave/LeaveService.js` - Already updated (uses manager_id first)

## Future Enhancements

1. **Edit HOD Assignment**: Allow changing HOD assignment for existing employees
2. **HOD Dashboard**: Show only leaves for assigned employees
3. **Multiple HODs**: Support for backup HODs or co-HODs
4. **HOD Hierarchy**: Support for HOD → Senior HOD → Admin chain




