-- =====================================================
-- Authorization Management System - Database Table
-- =====================================================

-- authorizations - Authorization Requests
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







