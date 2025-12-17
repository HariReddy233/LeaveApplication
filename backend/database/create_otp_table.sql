-- Create OTP table for password reset
CREATE TABLE IF NOT EXISTS password_reset_otp (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    otp VARCHAR(6) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_otp_email ON password_reset_otp(email);
CREATE INDEX IF NOT EXISTS idx_password_reset_otp_expires ON password_reset_otp(expires_at);

-- Clean up expired OTPs (older than 5 minutes)
CREATE OR REPLACE FUNCTION cleanup_expired_otp()
RETURNS void AS $$
BEGIN
    DELETE FROM password_reset_otp 
    WHERE expires_at < NOW() - INTERVAL '5 minutes';
END;
$$ LANGUAGE plpgsql;

