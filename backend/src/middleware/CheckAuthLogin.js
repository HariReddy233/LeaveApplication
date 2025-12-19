//Internal Lib Import
import { CreateError } from "../helper/ErrorHandler.js";
import DecodedToken from "../utility/DecodedToken.js";
import database from "../config/database.js";

/**
 * @desc CheckEmployeeAuth
 * @access private
 * @method POST/GET/PATCH/DELETE
 */
export const CheckEmployeeAuth = async (req, res, next) => {
  try {
    const { authorization } = req.headers;
    
    if (!authorization) {
      throw CreateError("Authorization header required", 401);
    }
    
    let token = authorization.split(" ")[1];
    
    if (!token) {
      throw CreateError("Token required", 401);
    }
    
    const decoded = await DecodedToken(token);

    // Get user from database - handle both schema types
    let userResult;
    try {
      // Try new schema first (user_id, first_name, last_name)
      userResult = await database.query(
        `SELECT user_id, email, role, status, password_hash
         FROM users 
         WHERE user_id = $1 
         AND (status = 'Active' OR status IS NULL)
         LIMIT 1`,
        [decoded.id]
      );
      
      // If no result, try with id column (old schema)
      if (userResult.rows.length === 0) {
        userResult = await database.query(
          'SELECT id, email, role, password_hash FROM users WHERE id = $1 AND (is_active = true OR is_active IS NULL) LIMIT 1',
          [decoded.id]
        );
      }
    } catch (dbError) {
      console.error('Auth middleware database error:', dbError);
      throw CreateError("Database error", 500);
    }

    if (userResult.rows.length === 0) {
      throw CreateError("Invalid Credentials", 401);
    }

    const user = userResult.rows[0];
    req.Email = user.email;
    req.UserId = user.user_id || user.id;
    req.Password = user.password_hash;
    req.Role = user.role || 'employee';

    // Get employee_id if exists
    try {
      const empResult = await database.query(
        'SELECT employee_id FROM employees WHERE user_id = $1 LIMIT 1',
        [req.UserId]
      );
      if (empResult.rows.length > 0) {
        req.EmployeeId = empResult.rows[0].employee_id;
      }
    } catch (err) {
      // Employee record might not exist, continue anyway
    }

    next();
  } catch (error) {
    res.status(error.status || 401).json({ message: error.message || "Invalid Credentials" });
  }
};

/**
 * @desc CheckHodAuth
 * @access private
 * @method POST/GET/PATCH/DELETE
 */
export const CheckHodAuth = async (req, res, next) => {
  try {
    const { Email, Role } = req;

    if (!Email) {
      throw CreateError("Authentication required", 401);
    }

    // Check if user has HOD role
    if (Role && (Role.toLowerCase() === 'hod' || Role.toLowerCase() === 'manager')) {
      req.Roles = Role;
      next();
    } else {
      throw CreateError("Invalid Credentials - HOD access required", 401);
    }
  } catch (error) {
    res.status(error.status || 401).json({ message: error.message || "Invalid Credentials" });
  }
};

/**
 * @desc CheckAdminAuth
 * @access private
 * @method POST/GET/PATCH/DELETE
 */
export const CheckAdminAuth = async (req, res, next) => {
  try {
    const { Email, Role } = req;

    if (!Email) {
      throw CreateError("Authentication required", 401);
    }

    // Check if user has ADMIN role
    if (Role && Role.toLowerCase() === 'admin') {
      req.Roles = Role;
      next();
    } else {
      throw CreateError("Invalid Credentials - Admin access required", 401);
    }
  } catch (error) {
    res.status(error.status || 401).json({ message: error.message || "Invalid Credentials" });
  }
};











