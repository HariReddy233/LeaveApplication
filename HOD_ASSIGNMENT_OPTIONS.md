# Multiple HOD Assignment - Implementation Guide

## Overview
This document explains how the system handles multiple HODs (Head of Department) where different employees can have different HODs, while maintaining one Admin for all users.

## Current Implementation (Hybrid Approach)

The system now uses a **3-tier priority system** to assign HODs to employees:

### Priority Order:
1. **Direct Manager Assignment** (Highest Priority)
   - If an employee has a `manager_id` set, and that manager is a HOD
   - The employee's leave applications go to that specific HOD

2. **Department-Based Assignment** (Medium Priority)
   - If no direct manager HOD is found
   - The system looks for HODs in the same department
   - Employees in the same department get the same HOD

3. **Location-Based Assignment** (Fallback)
   - If no department HOD is found
   - The system looks for HODs in the same location
   - Useful for multi-location organizations (India, US Miami, etc.)

## How It Works

### 1. When Employee Applies for Leave:
- System determines the assigned HOD using the priority order above
- Email notification is sent **only to the specific HOD** (not all HODs)
- Admin also receives notification (one Admin for all users)

### 2. When HOD Approves/Rejects:
- System verifies that the HOD is authorized for that employee
- Authorization checks:
  - Is the HOD the employee's direct manager?
  - Is the HOD from the same department?
  - Is the HOD from the same location?
- If none of these match, the HOD cannot approve (error message shown)
- Admin can always approve any leave (bypasses authorization check)

### 3. Database Fields Used:
- `employees.manager_id` - Direct manager assignment
- `users.department` - Department-based assignment
- `employees.location` - Location-based assignment
- `users.role` - Must be 'HOD' or 'hod' for HOD role

## Configuration Options

### Option 1: Department-Based (Recommended for Most Cases)
**Best for:** Organizations with clear department structure

**Setup:**
1. Ensure all users have `department` field set in `users` table
2. Assign HOD role to users who should be department heads
3. Set `department` field for HOD users to match their department

**Example:**
- IT Department → HOD: john@company.com (department: "IT")
- HR Department → HOD: jane@company.com (department: "HR")
- Finance Department → HOD: bob@company.com (department: "Finance")

### Option 2: Direct Manager Assignment
**Best for:** Custom reporting structures, matrix organizations

**Setup:**
1. Set `manager_id` in `employees` table to point to the HOD's `employee_id`
2. Ensure the manager has role 'HOD' in `users` table

**Example:**
- Employee A → manager_id: 5 (HOD's employee_id)
- Employee B → manager_id: 5 (Same HOD)
- Employee C → manager_id: 8 (Different HOD)

### Option 3: Location-Based
**Best for:** Multi-location organizations

**Setup:**
1. Set `location` field in `employees` table (e.g., "India", "US Miami")
2. Assign HOD role to location heads
3. Set `location` field for HOD employees

**Example:**
- India Location → HOD: india-hod@company.com (location: "India")
- US Miami Location → HOD: miami-hod@company.com (location: "US Miami")

### Option 4: Hybrid (Current Implementation)
**Best for:** Complex organizations with mixed structures

**Setup:**
- Combine all three methods
- System automatically uses the best match based on priority

## Admin Role

- **One Admin for All Users**: The system maintains one Admin role that can approve/reject any leave application
- Admin bypasses all HOD authorization checks
- Admin receives notifications for all leave applications

## Code Changes Made

### 1. Leave Application Creation (`CreateLeaveService`)
- Updated HOD assignment logic to use 3-tier priority system
- Changed from sending emails to all HODs → sending to specific HOD only
- Added logging for HOD assignment

### 2. HOD Approval (`ApproveLeaveHodService`)
- Added authorization checks to verify HOD can approve the leave
- Checks: manager_id, department, location
- Admin bypasses authorization checks

### 3. Email Notifications
- Now sends to specific HOD only (not all HODs)
- Admin still receives all notifications

## Testing Checklist

- [ ] Test department-based HOD assignment
- [ ] Test direct manager HOD assignment
- [ ] Test location-based HOD assignment
- [ ] Test authorization checks (HOD cannot approve unauthorized leaves)
- [ ] Test Admin can approve any leave
- [ ] Test email notifications go to correct HOD
- [ ] Test fallback logic when no HOD found

## Troubleshooting

### Issue: "No HOD found for employee"
**Solution:** 
- Check if employee has department set
- Check if any HOD exists with matching department
- Check if employee has manager_id set
- Check if location-based HOD exists

### Issue: "You are not authorized to approve leaves for this employee"
**Solution:**
- Verify the HOD is assigned to the employee (manager_id, department, or location)
- Check if HOD role is correctly set in users table
- Admin can always approve (bypasses this check)

### Issue: Multiple HODs receiving emails
**Solution:** 
- This should not happen with the new implementation
- System now sends to only one HOD (the first match found)
- Check if multiple HODs have same department/location

## Future Enhancements

1. **UI for HOD Assignment**: Add admin interface to assign HODs to employees
2. **HOD Dashboard**: Show only leaves for assigned employees
3. **Multiple HODs per Department**: Support for co-HODs or backup HODs
4. **HOD Hierarchy**: Support for HOD → Senior HOD → Admin approval chain






