// Utility functions

/**
 * Calculate leave days excluding holidays, Saturdays, and Sundays
 */
export const calculateLeaveDaysExcludingHolidays = async (startDate, endDate, employeeLocation, database) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Debug: Log the received location
  console.log(`🔍 calculateLeaveDaysExcludingHolidays: Received employeeLocation = "${employeeLocation}" (type: ${typeof employeeLocation}) for date range ${startDate} to ${endDate}`);
  
  // Get holidays for employee's location + "All" holidays
  let holidays = [];
  try {
    if (employeeLocation) {
      // Map employee location to country_code format
      // Support both "India"/"IN" and "US"/"United States"/"USA" formats
      const mapLocationToCountryCode = (location) => {
        if (!location) return [];
        const loc = location.toString().trim();
        // Normalize location to common variations
        const normalized = loc.toLowerCase();
        if (normalized === 'india' || normalized === 'in') return ['IN', 'India'];
        if (normalized === 'us' || normalized === 'usa' || normalized === 'united states' || normalized === 'u.s.' || normalized === 'u.s' || normalized.includes('miami')) {
          return ['US', 'United States', 'USA', 'U.S.', 'U.S'];
        }
        return [loc]; // Return as-is if not recognized
      };
      
      const countryCodes = mapLocationToCountryCode(employeeLocation);
      console.log(`🔍 calculateLeaveDaysExcludingHolidays: Mapped location "${employeeLocation}" to country codes:`, countryCodes);
      
      // Build query to include location-specific holidays + "All" holidays
      // Use case-insensitive matching to handle variations
      const conditions = [];
      const params = [];
      let paramCount = 1;
      
      // Add location-specific country codes with case-insensitive matching
      countryCodes.forEach((code) => {
        conditions.push(`UPPER(TRIM(country_code)) = UPPER(TRIM($${paramCount}))`);
        params.push(code);
        paramCount++;
      });
      
      // Always include "All" holidays (case-insensitive: 'All', 'ALL', 'all')
      conditions.push(`UPPER(TRIM(country_code)) = 'ALL'`);
      
      const holidayQuery = `
        SELECT holiday_date, country_code 
        FROM holidays 
        WHERE is_active = true
        AND (${conditions.join(' OR ')})
        AND holiday_date >= $${paramCount}::date AND holiday_date <= $${paramCount + 1}::date
      `;
      params.push(startDate, endDate);
      
      // Debug: Log the actual query and parameters
      console.log(`🔍 Holiday Query for location "${employeeLocation}":`, holidayQuery);
      console.log(`🔍 Query Parameters:`, params);
      console.log(`🔍 Country codes being searched:`, countryCodes);
      
      const holidayResult = await database.query(holidayQuery, params);
      holidays = holidayResult.rows.map(row => {
        // CRITICAL: Use raw date string from DB - do NOT convert to Date object
        // PostgreSQL DATE is already in YYYY-MM-DD format, avoid timezone conversion
        const holidayDateStr = row.holiday_date;
        // If it's already a string in YYYY-MM-DD format, use it directly
        if (typeof holidayDateStr === 'string') {
          return holidayDateStr.split('T')[0]; // Remove time part if present, keep YYYY-MM-DD
        }
        // If it's a Date object (shouldn't happen, but handle it), format without timezone
        const d = new Date(holidayDateStr);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      });
      
      // Debug logging to help identify issues
      if (holidayResult.rows.length > 0) {
        console.log(`✅ Found ${holidayResult.rows.length} holiday record(s) for location "${employeeLocation}" in range ${startDate} to ${endDate}:`);
        holidayResult.rows.forEach(row => {
          console.log(`   - Date: ${row.holiday_date}, Country Code: "${row.country_code}"`);
        });
        console.log(`✅ Mapped to ${holidays.length} holiday date(s) for exclusion:`, holidays);
      } else {
        console.log(`⚠️ No holidays found for location "${employeeLocation}" in range ${startDate} to ${endDate}.`);
        console.log(`⚠️ Country codes searched:`, countryCodes);
        console.log(`⚠️ This might mean:`);
        console.log(`   1. No holidays exist for this location in the date range`);
        console.log(`   2. Holiday country_code values don't match the searched codes`);
        console.log(`   3. Holidays exist but are marked as inactive (is_active = false)`);
      }
    } else {
      // If no employeeLocation, only include "All" holidays (case-insensitive)
      const holidayQuery = `
        SELECT holiday_date, country_code 
        FROM holidays 
        WHERE is_active = true
        AND UPPER(TRIM(country_code)) = 'ALL'
        AND holiday_date >= $1::date AND holiday_date <= $2::date
      `;
      const holidayResult = await database.query(holidayQuery, [startDate, endDate]);
      holidays = holidayResult.rows.map(row => {
        // CRITICAL: Use raw date string from DB - do NOT convert to Date object
        // PostgreSQL DATE is already in YYYY-MM-DD format, avoid timezone conversion
        const holidayDateStr = row.holiday_date;
        // If it's already a string in YYYY-MM-DD format, use it directly
        if (typeof holidayDateStr === 'string') {
          return holidayDateStr.split('T')[0]; // Remove time part if present, keep YYYY-MM-DD
        }
        // If it's a Date object (shouldn't happen, but handle it), format without timezone
        const d = new Date(holidayDateStr);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      });
    }
  } catch (error) {
    console.warn('Error fetching holidays:', error.message);
    // Continue without holidays if query fails
  }
  
  // Calculate working days (excluding weekends and holidays)
  // CRITICAL: This logic applies to ALL locations (India, US, etc.) - no hardcoding
  // CRITICAL: Use local date components to avoid timezone issues
  let workingDays = 0;
  const startDateObj = new Date(startDate);
  const endDateObj = new Date(endDate);
  const excludedDates = [];
  
  // Parse start and end dates to get local date components (avoid timezone)
  const startYear = startDateObj.getFullYear();
  const startMonth = startDateObj.getMonth();
  const startDay = startDateObj.getDate();
  
  const endYear = endDateObj.getFullYear();
  const endMonth = endDateObj.getMonth();
  const endDay = endDateObj.getDate();
  
  // Create date objects using local components (no timezone conversion)
  const currentDate = new Date(startYear, startMonth, startDay);
  const endDateLocal = new Date(endYear, endMonth, endDay);
  
  while (currentDate <= endDateLocal) {
    const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 6 = Saturday
    
    // CRITICAL: Format date using local components to avoid timezone shift
    // Do NOT use toISOString() as it converts to UTC and can shift dates
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`; // YYYY-MM-DD format
    
    // Exclude weekends (Saturday = 6, Sunday = 0)
    const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
    // Exclude holidays (location-specific + "All" holidays)
    // Compare strings directly - both are in YYYY-MM-DD format
    const isHoliday = holidays.includes(dateStr);
    
    // Count only if it's NOT a weekend AND NOT a holiday
    if (!isWeekend && !isHoliday) {
      workingDays++;
    } else {
      // Track excluded dates for debugging
      if (isWeekend) {
        excludedDates.push(`${dateStr} (${dayOfWeek === 0 ? 'Sunday' : 'Saturday'})`);
      }
      if (isHoliday) {
        excludedDates.push(`${dateStr} (Holiday)`);
      }
    }
    
    // Move to next day using local date
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  // Debug: Log calculation summary
  console.log(`📊 Working days calculation for location "${employeeLocation || 'N/A'}":`);
  console.log(`   - Date range: ${startDate} to ${endDate}`);
  console.log(`   - Total holidays found: ${holidays.length}`);
  console.log(`   - Excluded dates: ${excludedDates.length > 0 ? excludedDates.join(', ') : 'None'}`);
  console.log(`   - Final working days: ${workingDays}`);
  
  return workingDays;
};

export const calculateLeaveDays = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end days
  return diffDays;
};

export const formatDate = (date) => {
  if (!date) return null;
  return new Date(date).toISOString().split('T')[0];
};

export const isValidDateRange = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return end >= start;
};

/**
 * Get holidays for a date range based on employee location
 * Returns array of holiday dates as YYYY-MM-DD strings
 * Includes location-specific holidays + "All" holidays (for normal leave calculations)
 */
export const getHolidaysForDateRange = async (startDate, endDate, employeeLocation, database) => {
  let holidays = [];
  try {
    if (employeeLocation) {
      // Map employee location to country_code format
      // Support both "India"/"IN" and "US"/"United States"/"USA" formats
      // Use SAME logic as calculateLeaveDaysExcludingHolidays for consistency
      const mapLocationToCountryCode = (location) => {
        if (!location) return [];
        const loc = location.toString().trim();
        // Normalize location to common variations
        const normalized = loc.toLowerCase();
        if (normalized === 'india' || normalized === 'in') return ['IN', 'India'];
        if (normalized === 'us' || normalized === 'usa' || normalized === 'united states' || normalized === 'u.s.' || normalized === 'u.s') {
          return ['US', 'United States', 'USA', 'U.S.', 'U.S'];
        }
        return [loc]; // Return as-is if not recognized
      };
      
      const countryCodes = mapLocationToCountryCode(employeeLocation);
      
      // Build query to include location-specific holidays + "All" holidays
      // Use case-insensitive matching to handle variations
      const conditions = [];
      const params = [];
      let paramCount = 1;
      
      // Add location-specific country codes with case-insensitive matching
      countryCodes.forEach((code) => {
        conditions.push(`UPPER(TRIM(country_code)) = UPPER(TRIM($${paramCount}))`);
        params.push(code);
        paramCount++;
      });
      
      // Always include "All" holidays (case-insensitive: 'All', 'ALL', 'all')
      conditions.push(`UPPER(TRIM(country_code)) = 'ALL'`);
      
      const holidayQuery = `
        SELECT holiday_date, country_code 
        FROM holidays 
        WHERE is_active = true
        AND (${conditions.join(' OR ')})
        AND holiday_date >= $${paramCount}::date AND holiday_date <= $${paramCount + 1}::date
      `;
      params.push(startDate, endDate);
      
      const holidayResult = await database.query(holidayQuery, params);
      holidays = holidayResult.rows.map(row => {
        // CRITICAL: Use raw date string from DB - do NOT convert to Date object
        // PostgreSQL DATE is already in YYYY-MM-DD format, avoid timezone conversion
        const holidayDateStr = row.holiday_date;
        // If it's already a string in YYYY-MM-DD format, use it directly
        if (typeof holidayDateStr === 'string') {
          return holidayDateStr.split('T')[0]; // Remove time part if present, keep YYYY-MM-DD
        }
        // If it's a Date object (shouldn't happen, but handle it), format without timezone
        const d = new Date(holidayDateStr);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      });
      
      // Debug logging to help identify issues
      if (holidays.length > 0) {
        console.log(`✅ getHolidaysForDateRange: Found ${holidays.length} holiday(s) for location "${employeeLocation}" in range ${startDate} to ${endDate}:`, holidays);
      } else {
        console.log(`⚠️ getHolidaysForDateRange: No holidays found for location "${employeeLocation}" in range ${startDate} to ${endDate}. Country codes searched:`, countryCodes);
      }
    } else {
      // If no employeeLocation, only include "All" holidays (case-insensitive)
      const holidayQuery = `
        SELECT holiday_date, country_code 
        FROM holidays 
        WHERE is_active = true
        AND UPPER(TRIM(country_code)) = 'ALL'
        AND holiday_date >= $1::date AND holiday_date <= $2::date
      `;
      const holidayResult = await database.query(holidayQuery, [startDate, endDate]);
      holidays = holidayResult.rows.map(row => {
        // CRITICAL: Use raw date string from DB - do NOT convert to Date object
        // PostgreSQL DATE is already in YYYY-MM-DD format, avoid timezone conversion
        const holidayDateStr = row.holiday_date;
        // If it's already a string in YYYY-MM-DD format, use it directly
        if (typeof holidayDateStr === 'string') {
          return holidayDateStr.split('T')[0]; // Remove time part if present, keep YYYY-MM-DD
        }
        // If it's a Date object (shouldn't happen, but handle it), format without timezone
        const d = new Date(holidayDateStr);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      });
    }
  } catch (error) {
    console.warn('Error fetching holidays:', error.message);
    // Continue without holidays if query fails
  }
  
  return holidays;
};

/**
 * Get holidays for Comp-Off calculation
 * Returns array of holiday dates as YYYY-MM-DD strings
 * Includes location-specific holidays + "All" holidays (as per requirement)
 */
export const getCompOffHolidaysForDateRange = async (startDate, endDate, employeeLocation, database) => {
  let holidays = [];
  try {
    if (employeeLocation) {
      // Map employee location to country_code format
      // Support both "India"/"IN" and "US"/"United States"/"USA" formats
      const mapLocationToCountryCode = (location) => {
        if (!location) return [];
        const loc = location.toString().trim();
        // Normalize location to common variations
        const normalized = loc.toLowerCase();
        if (normalized === 'india' || normalized === 'in') return ['IN', 'India'];
        if (normalized === 'us' || normalized === 'usa' || normalized === 'united states' || normalized === 'u.s.' || normalized === 'u.s') {
          return ['US', 'United States', 'USA', 'U.S.', 'U.S'];
        }
        return [loc]; // Return as-is if not recognized
      };
      
      const countryCodes = mapLocationToCountryCode(employeeLocation);
      
      // Build query to include location-specific holidays + "All" holidays
      // Use case-insensitive matching to handle variations
      const conditions = [];
      const params = [];
      let paramCount = 1;
      
      // Add location-specific country codes with case-insensitive matching
      countryCodes.forEach((code) => {
        conditions.push(`UPPER(TRIM(country_code)) = UPPER(TRIM($${paramCount}))`);
        params.push(code);
        paramCount++;
      });
      
      // Include "All" holidays (case-insensitive: 'All', 'ALL', 'all')
      // Requirement: Holidays with country/team = "All" must apply to all locations
      conditions.push(`UPPER(TRIM(country_code)) = 'ALL'`);
      
      if (conditions.length === 0) {
        // If no location codes found, only include "All" holidays
        const holidayQuery = `
          SELECT holiday_date, country_code 
          FROM holidays 
          WHERE is_active = true
          AND UPPER(TRIM(country_code)) = 'ALL'
          AND holiday_date >= $1::date AND holiday_date <= $2::date
        `;
        const holidayResult = await database.query(holidayQuery, [startDate, endDate]);
        holidays = holidayResult.rows.map(row => {
          // CRITICAL: Use raw date string from DB - do NOT convert to Date object
          // PostgreSQL DATE is already in YYYY-MM-DD format, avoid timezone conversion
          const holidayDateStr = row.holiday_date;
          // If it's already a string in YYYY-MM-DD format, use it directly
          if (typeof holidayDateStr === 'string') {
            return holidayDateStr.split('T')[0]; // Remove time part if present, keep YYYY-MM-DD
          }
          // If it's a Date object (shouldn't happen, but handle it), format without timezone
          const d = new Date(holidayDateStr);
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        });
        return holidays;
      }
      
      const holidayQuery = `
        SELECT holiday_date, country_code 
        FROM holidays 
        WHERE is_active = true
        AND (${conditions.join(' OR ')})
        AND holiday_date >= $${paramCount}::date AND holiday_date <= $${paramCount + 1}::date
      `;
      params.push(startDate, endDate);
      
      const holidayResult = await database.query(holidayQuery, params);
      holidays = holidayResult.rows.map(row => {
        // CRITICAL: Use raw date string from DB - do NOT convert to Date object
        // PostgreSQL DATE is already in YYYY-MM-DD format, avoid timezone conversion
        const holidayDateStr = row.holiday_date;
        // If it's already a string in YYYY-MM-DD format, use it directly
        if (typeof holidayDateStr === 'string') {
          return holidayDateStr.split('T')[0]; // Remove time part if present, keep YYYY-MM-DD
        }
        // If it's a Date object (shouldn't happen, but handle it), format without timezone
        const d = new Date(holidayDateStr);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      });
    } else {
      // If no employeeLocation, only include "All" holidays
      const holidayQuery = `
        SELECT holiday_date, country_code 
        FROM holidays 
        WHERE is_active = true
        AND UPPER(TRIM(country_code)) = 'ALL'
        AND holiday_date >= $1::date AND holiday_date <= $2::date
      `;
      const holidayResult = await database.query(holidayQuery, [startDate, endDate]);
      holidays = holidayResult.rows.map(row => {
        // CRITICAL: Use raw date string from DB - do NOT convert to Date object
        // PostgreSQL DATE is already in YYYY-MM-DD format, avoid timezone conversion
        const holidayDateStr = row.holiday_date;
        // If it's already a string in YYYY-MM-DD format, use it directly
        if (typeof holidayDateStr === 'string') {
          return holidayDateStr.split('T')[0]; // Remove time part if present, keep YYYY-MM-DD
        }
        // If it's a Date object (shouldn't happen, but handle it), format without timezone
        const d = new Date(holidayDateStr);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      });
    }
  } catch (error) {
    console.warn('Error fetching Comp-Off holidays:', error.message);
    // Continue without holidays if query fails
  }
  
  return holidays;
};

/**
 * Check if a date is a non-working day (weekend or holiday)
 * @param {Date|string} date - The date to check
 * @param {Array<string>} holidays - Array of holiday dates as YYYY-MM-DD strings
 * @returns {boolean} - True if the date is a non-working day (Saturday, Sunday, or holiday)
 */
export const isNonWorkingDay = (date, holidays = []) => {
  // CRITICAL: Use local date components to avoid timezone issues
  const dateObj = new Date(date);
  const dayOfWeek = dateObj.getDay(); // 0 = Sunday, 6 = Saturday
  
  // Format date using local components (no timezone conversion)
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`; // YYYY-MM-DD format
  
  // Check if it's a weekend
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return true;
  }
  
  // Check if it's a holiday (compare strings directly)
  if (holidays.includes(dateStr)) {
    return true;
  }
  
  return false;
};

/**
 * Validate Comp-Off dates - all dates must be non-working days (weekends or location-specific holidays)
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @param {string} employeeLocation - Employee location (IN/US/India/United States)
 * @param {object} database - Database connection
 * @returns {Object} - { isValid: boolean, invalidDates: Array<string>, nonWorkingDays: number }
 */
export const validateCompOffDates = async (startDate, endDate, employeeLocation, database) => {
  // CRITICAL: Use local date components to avoid timezone issues
  const startDateObj = new Date(startDate);
  const endDateObj = new Date(endDate);
  
  // Parse dates to get local components (avoid timezone conversion)
  const startYear = startDateObj.getFullYear();
  const startMonth = startDateObj.getMonth();
  const startDay = startDateObj.getDate();
  
  const endYear = endDateObj.getFullYear();
  const endMonth = endDateObj.getMonth();
  const endDay = endDateObj.getDate();
  
  // Create date objects using local components (no timezone conversion)
  const start = new Date(startYear, startMonth, startDay);
  const end = new Date(endYear, endMonth, endDay);
  
  // Get ONLY location-specific holidays for Comp-Off (excludes "All" holidays)
  const holidays = await getCompOffHolidaysForDateRange(startDate, endDate, employeeLocation, database);
  
  const invalidDates = [];
  const validDates = [];
  const currentDate = new Date(start);
  
  while (currentDate <= end) {
    // CRITICAL: Format date using local components to avoid timezone shift
    // Do NOT use toISOString() as it converts to UTC and can shift dates
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`; // YYYY-MM-DD format
    
    const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 6 = Saturday
    
    // Check if it's a weekend (Saturday or Sunday)
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    // Check if it's a location-specific holiday (compare strings directly)
    const isHoliday = holidays.includes(dateStr);
    
    // Count as valid Comp-Off day if it's a weekend OR location-specific holiday
    if (isWeekend || isHoliday) {
      validDates.push(dateStr);
    } else {
      invalidDates.push(dateStr);
    }
    
    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return {
    isValid: invalidDates.length === 0,
    invalidDates,
    nonWorkingDays: validDates.length
  };
};






