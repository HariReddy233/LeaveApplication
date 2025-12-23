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
    // Create a single token (action_type is null - action comes from query parameter)
    await database.query(
      `INSERT INTO approval_tokens (leave_id, approver_email, approver_role, token, action_type, expires_at)
       VALUES ($1, $2, $3, $4, NULL, $5)
       ON CONFLICT (token) DO NOTHING`,
      [leaveId, approverEmail.toLowerCase().trim(), approverRole.toLowerCase(), token, expiresAt]
    );
    
    return token;
  } catch (error) {
    console.error('Error creating approval token:', error);
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
 * Get base URL for email links
 */
export const getBaseUrl = () => {
  return process.env.FRONTEND_URL || process.env.BASE_URL || 'http://localhost:3000';
};






