//Internal Lib Import
import CreateToken from "../../utility/CreateToken.js";
import { CreateError } from "../../helper/ErrorHandler.js";
import { VerifyPassword } from "../../utility/BcryptHelper.js";
import database from "../../config/database.js";

const LoginService = async (Request) => {
  const { email, password } = Request.body;

  if (!email || !password) {
    throw CreateError("Invalid Data", 400);
  }

  // Find user - handle both schema types
  let userResult;
  try {
    // Try new schema first (user_id, first_name, last_name)
    userResult = await database.query(
      `SELECT user_id as id, first_name, last_name, 
       COALESCE(first_name || ' ' || last_name, first_name, last_name, email) as full_name,
       email, password_hash, role, status, department, designation
       FROM users WHERE LOWER(email) = $1 LIMIT 1`,
      [email.toLowerCase()]
    );
    
    // If no result, try old schema (id, full_name)
    if (userResult.rows.length === 0) {
      userResult = await database.query(
        'SELECT * FROM users WHERE LOWER(email) = $1 LIMIT 1',
        [email.toLowerCase()]
      );
    }
  } catch (dbError) {
    console.error('Database query error:', dbError);
    throw CreateError(`Database error: ${dbError.message}`, 500);
  }

  if (userResult.rows.length === 0) {
    throw CreateError("User Not found", 404);
  }

  const user = userResult.rows[0];

  // Check if account is inactive
  if (user.status && user.status.toLowerCase() !== 'active') {
    throw CreateError("Account is inactive", 403);
  }

  // Verify password: check if it's a bcrypt hash or plaintext
  let isPasswordValid = false;
  const passwordHash = user.password_hash;
  
  // Check if password_hash looks like a bcrypt hash (starts with $2a$, $2b$, or $2y$)
  const isBcryptHash = passwordHash && /^\$2[aby]\$/.test(passwordHash);
  
  if (isBcryptHash) {
    // It's a bcrypt hash, compare properly
    isPasswordValid = await VerifyPassword(password, passwordHash);
  } else {
    // It's plaintext, compare directly
    isPasswordValid = password === String(passwordHash);
  }

  if (!isPasswordValid) {
    throw CreateError("Unauthorized Credentials", 401);
  }

  const userId = user.id || user.user_id;
  const fullName = user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email;

  const payLoad = {
    id: userId,
  };

  const token = await CreateToken(payLoad);

  return {
    AccessToken: token,
    UserDetails: {
      id: userId,
      email: user.email,
      full_name: fullName,
      role: user.role || 'employee',
      department: user.department,
      designation: user.designation,
    },
  };
};

export default LoginService;










