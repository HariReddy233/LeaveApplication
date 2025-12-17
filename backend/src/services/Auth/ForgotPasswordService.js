//Internal Lib Import
import database from "../../config/database.js";
import { CreateError } from "../../helper/ErrorHandler.js";
import { sendPasswordResetOTPEmail } from "../../utils/emailService.js";

/**
 * Generate OTP for password reset
 * OTP is 6 digits, valid for 2 minutes
 */
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Request Password Reset - Send OTP
 */
export const RequestPasswordResetService = async (Request) => {
  const { email } = Request.body;

  if (!email || !email.trim()) {
    throw CreateError("Please enter your email address", 400);
  }

  // Check if user exists
  let userResult;
  try {
    userResult = await database.query(
      `SELECT user_id, email, 
       COALESCE(first_name || ' ' || last_name, first_name, last_name, email) as full_name
       FROM users WHERE LOWER(email) = $1 LIMIT 1`,
      [email.toLowerCase().trim()]
    );
  } catch (dbError) {
    throw CreateError("Database error", 500);
  }

  if (userResult.rows.length === 0) {
    // Don't reveal if email exists or not for security
    // Return success message even if email doesn't exist
    return {
      message: "If the email exists, an OTP has been sent to your email address"
    };
  }

  const user = userResult.rows[0];

  // Generate OTP
  const otp = generateOTP();
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 2); // Valid for 2 minutes

  // Clean up old OTPs for this email
  try {
    await database.query(
      'DELETE FROM password_reset_otp WHERE email = $1 OR expires_at < NOW()',
      [email.toLowerCase().trim()]
    );
  } catch (cleanupError) {
    console.warn('Failed to cleanup old OTPs:', cleanupError.message);
  }

  // Store OTP in database
  try {
    await database.query(
      `INSERT INTO password_reset_otp (email, otp, expires_at)
       VALUES ($1, $2, $3)`,
      [email.toLowerCase().trim(), otp, expiresAt]
    );
  } catch (insertError) {
    // If table doesn't exist, create it first
    if (insertError.code === '42P01') {
      throw CreateError("Password reset feature is not configured. Please contact administrator.", 500);
    }
    throw CreateError("Failed to generate OTP", 500);
  }

  // Send OTP email
  try {
    await sendPasswordResetOTPEmail({
      to: user.email,
      user_name: user.full_name || user.email,
      otp: otp
    });
  } catch (emailError) {
    console.error('Failed to send OTP email:', emailError);
    // Don't fail the request if email fails - OTP is still generated
  }

  return {
    message: "OTP has been sent to your email address. Please check your inbox.",
    email: user.email // Return email for frontend to use in next step
  };
};

/**
 * Verify OTP and Reset Password
 */
export const ResetPasswordService = async (Request) => {
  const { email, otp, new_password } = Request.body;

  if (!email || !otp || !new_password) {
    throw CreateError("Email, OTP, and new password are required", 400);
  }

  if (new_password.length < 6) {
    throw CreateError("Password must be at least 6 characters", 400);
  }

  // Clean up expired OTPs first (older than 2 minutes)
  try {
    await database.query(
      'DELETE FROM password_reset_otp WHERE expires_at < NOW()',
    );
  } catch (cleanupError) {
    console.warn('Failed to cleanup expired OTPs:', cleanupError.message);
  }

  // Verify OTP - Check if it exists first (to distinguish between invalid and expired)
  const otpCheckResult = await database.query(
    `SELECT * FROM password_reset_otp 
     WHERE email = $1 AND otp = $2
     ORDER BY created_at DESC LIMIT 1`,
    [email.toLowerCase().trim(), otp]
  );

  if (otpCheckResult.rows.length === 0) {
    throw CreateError("Invalid OTP. Please check the code and try again.", 400);
  }

  const otpRecord = otpCheckResult.rows[0];

  // Check if OTP is already used
  if (otpRecord.used === true) {
    throw CreateError("This OTP has already been used. Please request a new one.", 400);
  }

  // Check if OTP is expired
  const now = new Date();
  const expiresAt = new Date(otpRecord.expires_at);
  if (expiresAt < now) {
    throw CreateError("OTP has expired. Please request a new OTP.", 400);
  }

  // OTP is valid - use the record
  const otpResult = { rows: [otpRecord] };

  // Check if user exists
  let userResult;
  try {
    userResult = await database.query(
      'SELECT user_id FROM users WHERE LOWER(email) = $1 LIMIT 1',
      [email.toLowerCase().trim()]
    );
  } catch (dbError) {
    throw CreateError("Database error", 500);
  }

  if (userResult.rows.length === 0) {
    throw CreateError("User not found", 404);
  }

  const user = userResult.rows[0];

  // Hash new password
  const { HashPassword } = await import("../../utility/BcryptHelper.js");
  const passwordHash = await HashPassword(new_password);

  // Update password
  try {
    await database.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE user_id = $2',
      [passwordHash, user.user_id]
    );
  } catch (updateError) {
    throw CreateError("Failed to update password", 500);
  }

  // Mark OTP as used
  try {
    await database.query(
      'UPDATE password_reset_otp SET used = true WHERE id = $1',
      [otpRecord.id]
    );
  } catch (markError) {
    console.warn('Failed to mark OTP as used:', markError.message);
  }

  return {
    message: "Password reset successful. Please login with your new password."
  };
};

