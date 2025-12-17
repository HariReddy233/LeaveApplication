# Seed Data Instructions

## What is Seed Data?

Seed data is initial data that your system needs to function properly. This includes:
- Leave types (Sick Leave, Casual Leave, etc.)
- User roles (Employee, Manager, HOD, Admin)
- System settings (email configuration, leave policies)
- Initial leave balances for employees
- Calendar templates
- Shift management settings
- Approval workflow templates

## How to Run Seed Data

### Option 1: Using Database Tool (pgAdmin, DBeaver, etc.)

1. Connect to your `VacationManagement` database
2. Open the SQL file: `backend/database/seed_data.sql`
3. Execute the entire script
4. Verify data was inserted

### Option 2: Using Command Line

```bash
psql -h 50.116.57.115 -p 5434 -U admin -d VacationManagement -f backend/database/seed_data.sql
```

## What Gets Created

### 1. Leave Types (8 types)
- Sick Leave (12 days)
- Casual Leave (12 days)
- Annual Leave (15 days, can carry forward)
- Earned Leave (30 days, can carry forward)
- Compensatory Off
- Maternity Leave (90 days)
- Paternity Leave (7 days)
- Bereavement Leave (5 days)

### 2. Roles (4 roles)
- **Employee**: Can apply leave, view own leaves
- **Manager**: Can approve team leaves
- **HOD**: Can approve department leaves
- **Admin**: Full system access

### 3. System Settings (12 settings)
- Email configuration
- Leave policies
- Company information
- Leave year settings

### 4. Employee Records
- Automatically creates employee records for all existing users
- Generates employee codes (EMP0001, EMP0002, etc.)

### 5. Leave Balance
- Initializes leave balance for all employees
- Sets balances based on leave type defaults

### 6. Calendar Template
- India Holidays 2025 calendar
- Can be assigned to employees

### 7. Shift Management
- Morning Shift (9 AM - 6 PM)
- Evening Shift (2 PM - 11 PM)
- Night Shift (10 PM - 6 AM)
- Flexible Hours (10 AM - 7 PM)

### 8. Approval Workflows
- Standard Approval (Manager → HOD)
- Manager Only
- HOD Only
- Admin Only

## After Running Seed Data

1. ✅ Your system will have all necessary master data
2. ✅ Employees will have leave balances initialized
3. ✅ You can start using the leave management features
4. ✅ Email notifications will be configured

## Customization

You can modify the seed data to match your company's:
- Leave policies
- Holiday calendar
- Shift timings
- Approval workflows

## Next Steps

After running seed data:
1. Test login with existing user credentials
2. Try applying for leave
3. Test approval workflow
4. Configure email settings if needed










