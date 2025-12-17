-- =====================================================
-- COMPLETE DATABASE SETUP SCRIPTS
-- Run these scripts in your PostgreSQL database
-- Database: VacationManagement
-- =====================================================

-- =====================================================
-- SCRIPT 1: Create Authorizations Table
-- =====================================================
-- Run this FIRST if you haven't created the authorizations table yet
-- =====================================================

CREATE TABLE IF NOT EXISTS authorizations (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
    authorization_type VARCHAR(100) NOT NULL, -- e.g., 'System Access', 'Data Access', 'Tool Access', 'Permission Request'
    title VARCHAR(255) NOT NULL,
    description TEXT,
    requested_access VARCHAR(255), -- Specific access being requested
    reason TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected, cancelled
    priority VARCHAR(20) DEFAULT 'normal', -- low, normal, high, urgent
    requested_date TIMESTAMP DEFAULT NOW(),
    approved_by INTEGER REFERENCES employees(employee_id),
    approval_comment TEXT,
    approved_at TIMESTAMP,
    expiry_date DATE, -- Optional expiry date for temporary authorizations
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_authorizations_employee ON authorizations(employee_id);
CREATE INDEX IF NOT EXISTS idx_authorizations_status ON authorizations(status);
CREATE INDEX IF NOT EXISTS idx_authorizations_type ON authorizations(authorization_type);
CREATE INDEX IF NOT EXISTS idx_authorizations_approved_by ON authorizations(approved_by);
CREATE INDEX IF NOT EXISTS idx_authorizations_requested_date ON authorizations(requested_date);

-- Comments for documentation
COMMENT ON TABLE authorizations IS 'Stores authorization requests from employees that need admin approval';
COMMENT ON COLUMN authorizations.authorization_type IS 'Type of authorization: System Access, Data Access, Tool Access, Permission Request, etc.';
COMMENT ON COLUMN authorizations.status IS 'Status: pending, approved, rejected, cancelled';
COMMENT ON COLUMN authorizations.priority IS 'Priority level: low, normal, high, urgent';

-- =====================================================
-- SCRIPT 2: Update Leave Applications Table for HR Portal
-- =====================================================
-- Run this SECOND - Adds HOD and Admin status columns
-- =====================================================

-- Add HOD and Admin status columns if they don't exist
DO $$ 
BEGIN
    -- Add hod_status column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'leave_applications' AND column_name = 'hod_status'
    ) THEN
        ALTER TABLE leave_applications 
        ADD COLUMN hod_status VARCHAR(50) DEFAULT 'Pending' 
        CHECK (hod_status IN ('Pending', 'Approved', 'Rejected'));
    END IF;

    -- Add admin_status column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'leave_applications' AND column_name = 'admin_status'
    ) THEN
        ALTER TABLE leave_applications 
        ADD COLUMN admin_status VARCHAR(50) DEFAULT 'Pending' 
        CHECK (admin_status IN ('Pending', 'Approved', 'Rejected'));
    END IF;

    -- Add hod_remark column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'leave_applications' AND column_name = 'hod_remark'
    ) THEN
        ALTER TABLE leave_applications 
        ADD COLUMN hod_remark TEXT DEFAULT '';
    END IF;

    -- Add admin_remark column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'leave_applications' AND column_name = 'admin_remark'
    ) THEN
        ALTER TABLE leave_applications 
        ADD COLUMN admin_remark TEXT DEFAULT '';
    END IF;

    -- Add approved_by_hod column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'leave_applications' AND column_name = 'approved_by_hod'
    ) THEN
        ALTER TABLE leave_applications 
        ADD COLUMN approved_by_hod INTEGER REFERENCES employees(employee_id);
    END IF;

    -- Add approved_by_admin column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'leave_applications' AND column_name = 'approved_by_admin'
    ) THEN
        ALTER TABLE leave_applications 
        ADD COLUMN approved_by_admin INTEGER REFERENCES employees(employee_id);
    END IF;

    -- Add hod_approved_at column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'leave_applications' AND column_name = 'hod_approved_at'
    ) THEN
        ALTER TABLE leave_applications 
        ADD COLUMN hod_approved_at TIMESTAMP;
    END IF;

    -- Add admin_approved_at column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'leave_applications' AND column_name = 'admin_approved_at'
    ) THEN
        ALTER TABLE leave_applications 
        ADD COLUMN admin_approved_at TIMESTAMP;
    END IF;
END $$;

-- Migrate existing data: If status exists, set both hod_status and admin_status
UPDATE leave_applications 
SET 
    hod_status = CASE 
        WHEN status = 'approved' THEN 'Approved'
        WHEN status = 'rejected' THEN 'Rejected'
        ELSE 'Pending'
    END,
    admin_status = CASE 
        WHEN status = 'approved' THEN 'Approved'
        WHEN status = 'rejected' THEN 'Rejected'
        ELSE 'Pending'
    END
WHERE hod_status IS NULL OR admin_status IS NULL;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_leave_applications_hod_status ON leave_applications(hod_status);
CREATE INDEX IF NOT EXISTS idx_leave_applications_admin_status ON leave_applications(admin_status);

-- Comments for documentation
COMMENT ON COLUMN leave_applications.hod_status IS 'HOD approval status: Pending, Approved, Rejected';
COMMENT ON COLUMN leave_applications.admin_status IS 'Admin approval status: Pending, Approved, Rejected';
COMMENT ON COLUMN leave_applications.hod_remark IS 'HOD comments/remarks on the leave application';
COMMENT ON COLUMN leave_applications.admin_remark IS 'Admin comments/remarks on the leave application';

-- =====================================================
-- VERIFICATION QUERIES (Optional - Run to verify)
-- =====================================================

-- Check if authorizations table exists
-- SELECT table_name FROM information_schema.tables WHERE table_name = 'authorizations';

-- Check if new columns were added to leave_applications
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'leave_applications'
-- AND column_name IN ('hod_status', 'admin_status', 'hod_remark', 'admin_remark', 'approved_by_hod', 'approved_by_admin', 'hod_approved_at', 'admin_approved_at')
-- ORDER BY column_name;

-- Check sample data
-- SELECT id, status, hod_status, admin_status, created_at 
-- FROM leave_applications 
-- LIMIT 5;








