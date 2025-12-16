//Internal Lib Import
import database from "../../config/database.js";
import { CreateError } from "../../helper/ErrorHandler.js";

/**
 * Get Department List (from departments table, with employee count)
 */
export const GetDepartmentListService = async () => {
  try {
    // Try to get from departments table first, fallback to employees table
    let result;
    try {
      result = await database.query(
        `SELECT 
          d.id,
          d.name,
          d.description,
          d.location,
          COUNT(e.employee_id) as employee_count
        FROM departments d
        LEFT JOIN employees e ON e.team = d.name
        WHERE d.is_active = true
        GROUP BY d.id, d.name, d.description, d.location
        ORDER BY d.name`
      );
    } catch (err) {
      // If departments table doesn't exist, fallback to employees table
      if (err.code === '42P01') { // Table doesn't exist
        result = await database.query(
          `SELECT 
            team as name,
            COUNT(*) as employee_count,
            location
          FROM employees 
          WHERE team IS NOT NULL AND team != ''
          GROUP BY team, location
          ORDER BY team`
        );
        
        return {
          Data: result.rows.map((row, index) => ({
            id: index + 1,
            name: row.name,
            description: `${row.name} Department`,
            employee_count: parseInt(row.employee_count),
            location: row.location
          }))
        };
      } else {
        throw err;
      }
    }
    
    return {
      Data: result.rows.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description || `${row.name} Department`,
        employee_count: parseInt(row.employee_count || 0),
        location: row.location
      }))
    };
  } catch (error) {
    console.error('GetDepartmentListService error:', error);
    throw CreateError("Failed to fetch departments", 500);
  }
};

/**
 * Create Department (saves to departments table)
 */
export const CreateDepartmentService = async (Request) => {
  const { name, description, location } = Request.body;

  if (!name) {
    throw CreateError("Department name is required", 400);
  }

  try {
    // Try to insert into departments table
    let result;
    try {
      result = await database.query(
        `INSERT INTO departments (name, description, location, is_active)
         VALUES ($1, $2, $3, true)
         RETURNING *`,
        [name, description || `${name} Department`, location || null]
      );
    } catch (err) {
      // If departments table doesn't exist, return success message
      if (err.code === '42P01') { // Table doesn't exist
        return {
          message: "Department will be available when you assign employees to this team. Please run the SQL script to create departments table.",
          data: {
            name,
            description: description || `${name} Department`,
            location: location || null
          }
        };
      } else if (err.code === '23505') { // Unique violation
        throw CreateError("Department with this name already exists", 400);
      } else {
        throw err;
      }
    }

    return {
      message: "Department created successfully",
      data: result.rows[0]
    };
  } catch (error) {
    console.error('CreateDepartmentService error:', error);
    if (error.status) throw error;
    throw CreateError("Failed to create department", 500);
  }
};

