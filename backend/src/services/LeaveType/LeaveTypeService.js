//Internal Lib Import
import database from "../../config/database.js";
import { CreateError } from "../../helper/ErrorHandler.js";

/**
 * Get Leave Type List
 */
export const GetLeaveTypeListService = async (Request) => {
  try {
    // Get employee location if available (for filtering)
    // Request can be undefined, an object with query/body, or have query params
    const employeeLocation = Request?.query?.location || Request?.body?.location || null;
    
    // Try to select location column, but handle if it doesn't exist
    let query = 'SELECT id, name, code, max_days, carry_forward, description, is_active, created_at FROM leave_types WHERE is_active = true';
    const params = [];
    
    // Try to include location column if it exists
    try {
      const testQuery = await database.query('SELECT location FROM leave_types LIMIT 1');
      // If query succeeds, location column exists - add it to SELECT
      query = 'SELECT id, name, code, max_days, carry_forward, description, is_active, COALESCE(location, \'IN\') as location, created_at FROM leave_types WHERE is_active = true';
      
      // If location is provided, filter by location (show matching location or "All")
      if (employeeLocation) {
        // Show leave types where:
        // 1. location matches employee location (e.g., 'IN' or 'US')
        // 2. location is 'All' (shared leave types)
        // 3. location is NULL (defaults to 'IN' via COALESCE, so treat as matching)
        query += ' AND (COALESCE(location, \'IN\') = $1 OR location = $2)';
        params.push(employeeLocation, 'All');
        console.log(`🔍 Filtering leave types by location: ${employeeLocation}`);
      } else {
        console.log('ℹ️ No location provided, returning all active leave types');
      }
    } catch (colError) {
      // Location column doesn't exist - use query without location
      // Don't filter by location, return all active leave types
      console.log('⚠️ Location column does not exist in leave_types table, returning all leave types (treating all as IN)');
    }
    
    query += ' ORDER BY name';
    
    const result = await database.query(query, params.length > 0 ? params : undefined);
    
    // Ensure all rows have location, default to 'IN' if null or missing
    const rowsWithLocation = result.rows.map(row => {
      if (!row.hasOwnProperty('location') || row.location === null || row.location === '') {
        return { ...row, location: 'IN' }; // Default to India
      }
      return row;
    });
    
    return {
      Data: rowsWithLocation
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
  const { name, code, max_days, carry_forward, description, location } = Request.body;

  if (!name) {
    throw CreateError("Leave type name is required", 400);
  }

  // Validate location if provided, default to 'IN' if empty
  let normalizedLocation = 'IN'; // Default to India
  if (location && location.trim() !== '') {
    const locUpper = location.toUpperCase().trim();
    if (locUpper === 'IN' || locUpper === 'US' || locUpper === 'ALL') {
      normalizedLocation = locUpper === 'ALL' ? 'All' : locUpper;
    } else {
      throw CreateError("Invalid location. Must be IN, US, or All", 400);
    }
  }

  try {
    const result = await database.query(
      `INSERT INTO leave_types (name, code, max_days, carry_forward, description, location, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       RETURNING *`,
      [name, code || null, max_days || null, carry_forward || false, description || null, normalizedLocation]
    );

    return result.rows[0];
  } catch (error) {
    console.error('CreateLeaveTypeService error:', error);
    if (error.code === '23505') { // Unique violation
      throw CreateError("Leave type with this name or code already exists", 400);
    }
    if (error.code === '42703') { // Column doesn't exist
      // Fallback: try without location column
      console.log('⚠️ Location column does not exist, creating leave type without location (defaults to IN)');
      try {
        const result = await database.query(
          `INSERT INTO leave_types (name, code, max_days, carry_forward, description, is_active)
           VALUES ($1, $2, $3, $4, $5, true)
           RETURNING *`,
          [name, code || null, max_days || null, carry_forward || false, description || null]
        );
        // Add default location to response
        if (result.rows[0]) {
          result.rows[0].location = normalizedLocation || 'IN'; // Use provided or default to India
        }
        return result.rows[0];
      } catch (fallbackError) {
        throw CreateError("Failed to create leave type", 500);
      }
    }
    throw CreateError("Failed to create leave type", 500);
  }
};

/**
 * Update Leave Type
 */
export const UpdateLeaveTypeService = async (Request) => {
  const { id } = Request.params;
  const { name, code, max_days, carry_forward, description, is_active, location } = Request.body;

  console.log(`\n🔵 ========== UPDATE LEAVE TYPE START ==========`);
  console.log(`🔵 Leave Type ID: ${id}`);
  console.log(`🔵 Received location: ${location} (type: ${typeof location}, value: ${JSON.stringify(location)})`);
  console.log(`🔵 Request body keys:`, Object.keys(Request.body));

  if (!id) {
    throw CreateError("Leave type ID is required", 400);
  }

  // Validate and normalize location - always process if provided
  let normalizedLocation = 'IN'; // Default to India
  let shouldUpdateLocation = false;
  
  // If location is provided in request, always update it
  if (location !== undefined && location !== null && location !== '') {
    shouldUpdateLocation = true;
    const locUpper = String(location).toUpperCase().trim();
    if (locUpper === 'IN' || locUpper === 'US' || locUpper === 'ALL') {
      normalizedLocation = locUpper === 'ALL' ? 'All' : locUpper;
    } else if (locUpper === 'ALL LOCATIONS' || location === 'All Locations') {
      normalizedLocation = 'All';
    } else {
      // Invalid location - default to IN but still update
      console.warn(`⚠️ Invalid location value "${location}", defaulting to 'IN'`);
      normalizedLocation = 'IN';
    }
    console.log(`📝 Updating location to: ${normalizedLocation} (original: ${location})`);
  } else {
    // Location not provided - don't update location field
    console.log('ℹ️ Location not provided in update request, keeping existing location');
  }

  try {
    // Check if location column exists first
    let locationColumnExists = false;
    try {
      await database.query('SELECT location FROM leave_types LIMIT 1');
      locationColumnExists = true;
    } catch (colCheckError) {
      if (colCheckError.code === '42703') {
        locationColumnExists = false;
        console.log('⚠️ Location column does not exist in leave_types table, updating without location');
      } else {
        throw colCheckError;
      }
    }

    // Build UPDATE query based on whether location column exists
    let result;
    if (locationColumnExists) {
      if (shouldUpdateLocation) {
        // Update with location - always update location when provided
        console.log(`✅ Updating leave type ${id} with location: ${normalizedLocation}`);
        result = await database.query(
          `UPDATE leave_types 
           SET name = COALESCE($1, name),
               code = COALESCE($2, code),
               max_days = COALESCE($3, max_days),
               carry_forward = COALESCE($4, carry_forward),
               description = COALESCE($5, description),
               location = $6,
               is_active = COALESCE($7, is_active)
           WHERE id = $8
           RETURNING *`,
          [name, code, max_days, carry_forward, description, normalizedLocation, is_active, id]
        );
      } else {
        // Update without location (keep existing location)
        console.log(`ℹ️ Updating leave type ${id} without changing location`);
        result = await database.query(
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
      }
    } else {
      // Location column doesn't exist - update without it
      console.log('⚠️ Location column does not exist, updating leave type without location');
      result = await database.query(
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
      // Add default location to response
      if (result.rows[0]) {
        result.rows[0].location = normalizedLocation; // Use provided or default to India
      }
    }

    if (result.rows.length === 0) {
      throw CreateError("Leave type not found", 404);
    }

    // Ensure location is always present in response, default to 'IN' if null
    const updatedRow = result.rows[0];
    if (locationColumnExists && (!updatedRow.location || updatedRow.location === null || updatedRow.location === '')) {
      updatedRow.location = 'IN'; // Default to India
    } else if (!locationColumnExists) {
      updatedRow.location = normalizedLocation || 'IN'; // Use provided or default to India
    }

    // Verify location was updated correctly
    if (locationColumnExists && shouldUpdateLocation) {
      const verifyResult = await database.query(
        'SELECT location FROM leave_types WHERE id = $1',
        [id]
      );
      if (verifyResult.rows.length > 0) {
        const savedLocation = verifyResult.rows[0].location;
        console.log(`✅ Location update verified: saved="${savedLocation}", expected="${normalizedLocation}"`);
        if (savedLocation !== normalizedLocation) {
          console.warn(`⚠️ Location mismatch! Saved: "${savedLocation}", Expected: "${normalizedLocation}"`);
        }
      }
    }

    console.log(`✅ Leave type updated successfully: ID=${id}, Location=${updatedRow.location}`);
    return updatedRow;
  } catch (error) {
    console.error('UpdateLeaveTypeService error:', error);
    if (error.status) throw error;
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

