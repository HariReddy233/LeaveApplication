-- =====================================================
-- Update leave_applications table to match HR Portal structure
-- Multi-level approval: HOD Status + Admin Status
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






