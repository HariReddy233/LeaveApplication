//Internal Lib Import
import database from "../../config/database.js";
import { CreateError } from "../../helper/ErrorHandler.js";
import { VerifyPassword, HashPassword } from "../../utility/BcryptHelper.js";

/**
 * Change Password Service
 * Allows logged-in users to change their password by verifying current password
 */
export const ChangePasswordService = async (Request) => {
  const { current_password, new_password } = Request.body;
  const UserId = Request.UserId;

  if (!current_password || !new_password) {
    throw CreateError("Current password and new password are required", 400);
  }

  if (new_password.length < 6) {
    throw CreateError("New password must be at least 6 characters", 400);
  }

  if (current_password === new_password) {
    throw CreateError("New password must be different from current password", 400);
  }

  // Get user from database
  let userResult;
  try {
    userResult = await database.query(
      `SELECT user_id, email, password_hash 
       FROM users 
       WHERE user_id = $1 
       AND (status = 'Active' OR status IS NULL)
       LIMIT 1`,
      [UserId]
    );
  } catch (dbError) {
    throw CreateError("Database error", 500);
  }

  if (userResult.rows.length === 0) {
    throw CreateError("User not found", 404);
  }

  const user = userResult.rows[0];

  // Verify current password
  let isPasswordValid = false;
  const passwordHash = user.password_hash;
  
  // Check if password_hash looks like a bcrypt hash
  const isBcryptHash = passwordHash && /^\$2[aby]\$/.test(passwordHash);
  
  if (isBcryptHash) {
    // It's a bcrypt hash, compare properly
    isPasswordValid = await VerifyPassword(current_password, passwordHash);
  } else {
    // It's plaintext, compare directly
    isPasswordValid = current_password === String(passwordHash);
  }

  if (!isPasswordValid) {
    throw CreateError("Current password is incorrect", 400);
  }

  // Hash new password
  const newPasswordHash = await HashPassword(new_password);

  // Update password
  try {
    await database.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE user_id = $2',
      [newPasswordHash, UserId]
    );
  } catch (updateError) {
    throw CreateError("Failed to update password", 500);
  }

  return {
    message: "Password changed successfully"
  };
};



