-- Users table for authentication (PostgreSQL-based)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'employee', -- employee, manager, hod, admin
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Employees table (linked to users)
CREATE TABLE IF NOT EXISTS employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    location VARCHAR(100),
    team VARCHAR(100),
    manager_id UUID REFERENCES employees(id),
    role VARCHAR(50) DEFAULT 'employee', -- employee, manager, hod, admin
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Leave types
CREATE TABLE IF NOT EXISTS leave_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    max_days INTEGER,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Leave applications
CREATE TABLE IF NOT EXISTS leave_applications (
    id SERIAL PRIMARY KEY,
    employee_id UUID NOT NULL REFERENCES employees(id),
    leave_type VARCHAR(100) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT,
    status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected
    approved_by UUID REFERENCES employees(id),
    approval_comment TEXT,
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Leave balance
CREATE TABLE IF NOT EXISTS leave_balance (
    id SERIAL PRIMARY KEY,
    employee_id UUID NOT NULL REFERENCES employees(id),
    leave_type VARCHAR(100) NOT NULL,
    total_balance INTEGER DEFAULT 0,
    used_balance INTEGER DEFAULT 0,
    remaining_balance INTEGER GENERATED ALWAYS AS (total_balance - used_balance) STORED,
    year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM NOW()),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(employee_id, leave_type, year)
);

-- Blocked calendar dates
CREATE TABLE IF NOT EXISTS blocked_calendar_dates (
    id SERIAL PRIMARY KEY,
    employee_id UUID NOT NULL REFERENCES employees(id),
    blocked_date DATE NOT NULL,
    reason TEXT,
    created_by UUID REFERENCES employees(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(employee_id, blocked_date)
);

-- Approval stages (for multi-level approval)
CREATE TABLE IF NOT EXISTS approval_stages (
    id SERIAL PRIMARY KEY,
    template_name VARCHAR(255) NOT NULL,
    stage_order INTEGER NOT NULL,
    approver_role VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Refresh tokens for JWT (optional - for token refresh functionality)
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(500) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Index for refresh tokens
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token);

-- Calendar templates
CREATE TABLE IF NOT EXISTS calendar_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    geography VARCHAR(100),
    holiday_dates DATE[],
    created_at TIMESTAMP DEFAULT NOW()
);

-- Employee calendar assignments
CREATE TABLE IF NOT EXISTS employee_calendar_assignments (
    id SERIAL PRIMARY KEY,
    employee_id UUID NOT NULL REFERENCES employees(id),
    calendar_template_id INTEGER REFERENCES calendar_templates(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_employees_user ON employees(user_id);
CREATE INDEX idx_leave_applications_employee ON leave_applications(employee_id);
CREATE INDEX idx_leave_applications_status ON leave_applications(status);
CREATE INDEX idx_leave_applications_dates ON leave_applications(start_date, end_date);
CREATE INDEX idx_leave_balance_employee ON leave_balance(employee_id);
CREATE INDEX idx_blocked_dates_employee ON blocked_calendar_dates(employee_id);
CREATE INDEX idx_employees_location ON employees(location);
CREATE INDEX idx_employees_team ON employees(team);
CREATE INDEX idx_employees_manager ON employees(manager_id);

