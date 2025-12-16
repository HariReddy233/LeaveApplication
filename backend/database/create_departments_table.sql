-- =====================================================
-- Create Departments Table
-- =====================================================
-- This table stores department information
-- =====================================================

CREATE TABLE IF NOT EXISTS departments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    location VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_departments_name ON departments(name);
CREATE INDEX IF NOT EXISTS idx_departments_location ON departments(location);
CREATE INDEX IF NOT EXISTS idx_departments_active ON departments(is_active);

-- =====================================================
-- Migration: Update employees table to reference departments
-- =====================================================
-- Note: This is optional - you can keep using 'team' field
-- or add a department_id foreign key to departments table
-- =====================================================





