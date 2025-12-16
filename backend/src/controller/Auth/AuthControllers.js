//Internal Lib Import
import RegistrationService from "../../services/Auth/RegistrationService.js";
import LoginService from "../../services/Auth/LoginService.js";
import database from "../../config/database.js";
import DecodedToken from "../../utility/DecodedToken.js";

/**
 * @desc Login User
 * @access public
 * @route /api/v1/Auth/LoginUser
 * @method POST
 */
export const LoginUser = async (req, res, next) => {
  try {
    const result = await LoginService(req);
    // Return format that matches frontend expectations
    res.json({
      token: result.AccessToken,
      user: result.UserDetails,
      message: "Login successful"
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Register User
 * @access public
 * @route /api/v1/Auth/RegisterUser
 * @method POST
 */
export const RegisterUser = async (req, res, next) => {
  try {
    console.log('📝 RegisterUser called with data:', {
      email: req.body?.email,
      role: req.body?.role,
      department: req.body?.department,
      hod_id: req.body?.hod_id
    });
    const result = await RegistrationService(req);
    // Return format that matches frontend expectations
    res.status(201).json({
      token: result.AccessToken,
      user: result.UserDetails,
      message: "Registration successful"
    });
  } catch (error) {
    console.error('❌ RegisterUser error:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      detail: error.detail
    });
    next(error);
  }
};

/**
 * @desc Get Current User
 * @access private
 * @route /api/v1/Auth/Me
 * @method GET
 */
export const GetCurrentUser = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    let decoded;
    try {
      decoded = await DecodedToken(token);
    } catch (error) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Get user from database - handle both schema types
    let userResult;
    try {
      // Try new schema first (user_id, first_name, last_name)
      userResult = await database.query(
        `SELECT user_id, first_name, last_name, 
         COALESCE(first_name || ' ' || last_name, first_name, last_name, email) as full_name,
         email, role, status, department, designation
         FROM users 
         WHERE user_id = $1 
         AND (status = 'Active' OR status IS NULL)
         LIMIT 1`,
        [decoded.id]
      );
      
      // If no result, try with id column (old schema)
      if (userResult.rows.length === 0) {
        userResult = await database.query(
          'SELECT id, email, full_name, role FROM users WHERE id = $1 LIMIT 1',
          [decoded.id]
        );
      }
    } catch (dbError) {
      console.error('Database query error:', dbError);
      return res.status(500).json({ error: 'Database error', message: dbError.message });
    }

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];
    const userId = user.user_id || user.id;
    
    res.json({ 
      user: {
        id: userId,
        email: user.email,
        full_name: user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email,
        role: user.role || 'employee',
        department: user.department,
        designation: user.designation,
      }
    });
  } catch (error) {
    next(error);
  }
};

export default {
  LoginUser,
  RegisterUser,
  GetCurrentUser,
};

