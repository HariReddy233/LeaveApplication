//Internal Lib Import
import crypto from 'crypto';
import database from '../config/database.js';

/**
 * Generate a secure random token for email approval
 */
export const generateApprovalToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Create a single approval token for a leave request
 * One token works for both approve and reject actions (action determined by query parameter)
 * Token can only be used once
 */
export const createApprovalToken = async (leaveId, approverEmail, approverRole) => {
  const token = generateApprovalToken();
  
  // Tokens expire in 7 days
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);
  
  try {
    // First, ensure the table exists (create if not exists)
    await database.query(`
      CREATE TABLE IF NOT EXISTS approval_tokens (
        id SERIAL PRIMARY KEY,
        leave_id INTEGER NOT NULL,
        approver_email VARCHAR(255) NOT NULL,
        approver_role VARCHAR(50) NOT NULL,
        token VARCHAR(255) NOT NULL UNIQUE,
        action_type VARCHAR(50) NULL,
        used BOOLEAN DEFAULT FALSE,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `).catch(() => {
      // Table might already exist, ignore error
    });
    
    // Fix existing table: Allow NULL in action_type (if table already exists with NOT NULL constraint)
    await database.query(`
      ALTER TABLE approval_tokens 
      ALTER COLUMN action_type DROP NOT NULL
    `).catch((alterError) => {
      // Column might already allow NULL or constraint doesn't exist, ignore error
      if (alterError.code !== '42804' && alterError.code !== '42704') {
        console.warn('Warning: Could not alter action_type column:', alterError.message);
      }
    });
    
    // Create indexes if they don't exist
    await database.query(`
      CREATE INDEX IF NOT EXISTS idx_approval_tokens_token ON approval_tokens(token)
    `).catch(() => {});
    
    // Create a single token (action_type is null - action comes from query parameter)
    console.log(`🔑 Attempting to create approval token for leave_id: ${leaveId}, approver: ${approverEmail}, role: ${approverRole}`);
    console.log(`🔑 Generated token (first 10 chars): ${token.substring(0, 10)}...`);
    console.log(`🔑 Expires at: ${expiresAt}`);
    
    const result = await database.query(
      `INSERT INTO approval_tokens (leave_id, approver_email, approver_role, token, action_type, expires_at)
       VALUES ($1, $2, $3, $4, NULL, $5)
       ON CONFLICT (token) DO NOTHING
       RETURNING token, id`,
      [leaveId, approverEmail.toLowerCase().trim(), approverRole.toLowerCase(), token, expiresAt]
    );
    
    if (result.rows.length === 0) {
      // Token conflict (very rare), generate a new one
      console.warn('⚠️ Token conflict detected, generating new token');
      return await createApprovalToken(leaveId, approverEmail, approverRole);
    }
    
    const createdToken = result.rows[0].token;
    const tokenId = result.rows[0].id;
    console.log(`✅ Approval token created successfully!`);
    console.log(`✅ Token ID: ${tokenId}, leave_id: ${leaveId}, approver: ${approverEmail}, role: ${approverRole}`);
    console.log(`✅ Token (first 10 chars): ${createdToken.substring(0, 10)}...`);
    return createdToken;
  } catch (error) {
    console.error('❌ Error creating approval token:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      leaveId,
      approverEmail,
      approverRole
    });
    throw error;
  }
};

/**
 * Verify and use an approval token
 * Returns the token details if valid, null if invalid/used/expired
 */
export const verifyAndUseToken = async (token) => {
  try {
    // Clean up expired tokens first
    await database.query('DELETE FROM approval_tokens WHERE expires_at < NOW()');
    
    // Find the token
    const result = await database.query(
      `SELECT * FROM approval_tokens 
       WHERE token = $1 AND used = false AND expires_at > NOW()`,
      [token]
    );
    
    if (result.rows.length === 0) {
      return null; // Token not found, used, or expired
    }
    
    const tokenRecord = result.rows[0];
    
    // Mark token as used (one-time use)
    await database.query(
      `UPDATE approval_tokens SET used = true WHERE id = $1`,
      [tokenRecord.id]
    );
    
    return tokenRecord;
  } catch (error) {
    console.error('Error verifying token:', error);
    return null;
  }
};

/**
 * Get base URL for email links (Backend API URL for email approvals)
 */
export const getBaseUrl = () => {
  // CRITICAL: Always use BACKEND_URL for API endpoints, NEVER FRONTEND_URL
  // Email buttons must point to backend API, not frontend Next.js
  return process.env.BACKEND_URL || process.env.API_URL || 'http://localhost:3001';
};

/**
 * Get HR Portal URL for email links
 */
export const getHRPortalUrl = () => {
  return process.env.HR_PORTAL_URL || 'https://hrportal.consultare.io/';
};






