//Internal Lib Import
import database from "../../config/database.js";
import { CreateError } from "../../helper/ErrorHandler.js";

/**
 * Get Leave Type List
 */
export const GetLeaveTypeListService = async () => {
  try {
    const result = await database.query(
      'SELECT id, name, code, max_days, carry_forward, description, is_active, created_at FROM leave_types WHERE is_active = true ORDER BY name'
    );
    
    return {
      Data: result.rows
    };
  } catch (error) {
    console.error('GetLeaveTypeListService error:', error);
    throw CreateError("Failed to fetch leave types", 500);
  }
};

/**
 * Create Leave Type
 */
export const CreateLeaveTypeService = async (Request) => {
  const { name, code, max_days, carry_forward, description } = Request.body;

  if (!name) {
    throw CreateError("Leave type name is required", 400);
  }

  try {
    const result = await database.query(
      `INSERT INTO leave_types (name, code, max_days, carry_forward, description, is_active)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING *`,
      [name, code || null, max_days || null, carry_forward || false, description || null]
    );

    return result.rows[0];
  } catch (error) {
    console.error('CreateLeaveTypeService error:', error);
    if (error.code === '23505') { // Unique violation
      throw CreateError("Leave type with this name or code already exists", 400);
    }
    throw CreateError("Failed to create leave type", 500);
  }
};

/**
 * Update Leave Type
 */
export const UpdateLeaveTypeService = async (Request) => {
  const { id } = Request.params;
  const { name, code, max_days, carry_forward, description, is_active } = Request.body;

  if (!id) {
    throw CreateError("Leave type ID is required", 400);
  }

  try {
    const result = await database.query(
      `UPDATE leave_types 
       SET name = COALESCE($1, name),
           code = COALESCE($2, code),
           max_days = COALESCE($3, max_days),
           carry_forward = COALESCE($4, carry_forward),
           description = COALESCE($5, description),
           is_active = COALESCE($6, is_active)
       WHERE id = $7
       RETURNING *`,
      [name, code, max_days, carry_forward, description, is_active, id]
    );

    if (result.rows.length === 0) {
      throw CreateError("Leave type not found", 404);
    }

    return result.rows[0];
  } catch (error) {
    console.error('UpdateLeaveTypeService error:', error);
    throw CreateError("Failed to update leave type", 500);
  }
};

/**
 * Delete Leave Type
 */
export const DeleteLeaveTypeService = async (Request) => {
  const { id } = Request.params;

  if (!id) {
    throw CreateError("Leave type ID is required", 400);
  }

  try {
    // Get leave type name first
    const leaveTypeResult = await database.query(
      'SELECT name FROM leave_types WHERE id = $1',
      [id]
    );

    if (leaveTypeResult.rows.length === 0) {
      throw CreateError("Leave type not found", 404);
    }

    const leaveTypeName = leaveTypeResult.rows[0].name;

    // Check if leave type is being used in leave_applications
    const applicationsCheck = await database.query(
      'SELECT COUNT(*) as count FROM leave_applications WHERE leave_type = $1',
      [leaveTypeName]
    );

    // Check if leave type is being used in leave_balance
    const balanceCheck = await database.query(
      'SELECT COUNT(*) as count FROM leave_balance WHERE leave_type = $1',
      [leaveTypeName]
    );

    const applicationsCount = parseInt(applicationsCheck.rows[0].count || 0);
    const balanceCount = parseInt(balanceCheck.rows[0].count || 0);

    if (applicationsCount > 0 || balanceCount > 0) {
      throw CreateError(
        `Cannot delete leave type "${leaveTypeName}" because it is being used in ${applicationsCount} leave application(s) and ${balanceCount} leave balance record(s). Please remove or update these records first.`,
        400
      );
    }

    // Delete the leave type
    const result = await database.query(
      'DELETE FROM leave_types WHERE id = $1 RETURNING *',
      [id]
    );

    return { message: "Leave type deleted successfully" };
  } catch (error) {
    console.error('DeleteLeaveTypeService error:', error);
    if (error.status) throw error;
    throw CreateError("Failed to delete leave type", 500);
  }
};

