// Utility functions

/**
 * Calculate leave days excluding holidays, Saturdays, and Sundays
 */
export const calculateLeaveDaysExcludingHolidays = async (startDate, endDate, employeeLocation, database) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Get holidays for employee's location + "All" holidays
  let holidays = [];
  try {
    if (employeeLocation) {
      // Map employee location to country_code format
      // Support both "India"/"IN" and "US"/"United States" formats
      const mapLocationToCountryCode = (location) => {
        if (!location) return [];
        const loc = location.toString().trim();
        if (loc === 'India' || loc === 'IN') return ['IN', 'India'];
        if (loc === 'US' || loc === 'United States') return ['US', 'United States'];
        return [loc]; // Return as-is if not recognized
      };
      
      const countryCodes = mapLocationToCountryCode(employeeLocation);
      
      // Build query to include location-specific holidays + "All" holidays
      const conditions = [];
      const params = [];
      let paramCount = 1;
      
      // Add location-specific country codes
      countryCodes.forEach((code) => {
        conditions.push(`country_code = $${paramCount}`);
        params.push(code);
        paramCount++;
      });
      
      // Always include "All" holidays (case-insensitive: 'All', 'ALL', 'all')
      conditions.push(`(UPPER(country_code) = 'ALL' OR country_code = 'All' OR country_code = 'all')`);
      
      const holidayQuery = `
        SELECT holiday_date, country_code 
        FROM holidays 
        WHERE is_active = true
        AND (${conditions.join(' OR ')})
        AND holiday_date >= $${paramCount} AND holiday_date <= $${paramCount + 1}
      `;
      params.push(startDate, endDate);
      
      const holidayResult = await database.query(holidayQuery, params);
      holidays = holidayResult.rows.map(row => {
        const holidayDate = new Date(row.holiday_date);
        return holidayDate.toISOString().split('T')[0]; // Format as YYYY-MM-DD
      });
    } else {
      // If no employeeLocation, only include "All" holidays (case-insensitive)
      const holidayQuery = `
        SELECT holiday_date, country_code 
        FROM holidays 
        WHERE is_active = true
        AND (UPPER(country_code) = 'ALL' OR country_code = 'All' OR country_code = 'all')
        AND holiday_date >= $1 AND holiday_date <= $2
      `;
      const holidayResult = await database.query(holidayQuery, [startDate, endDate]);
      holidays = holidayResult.rows.map(row => {
        const holidayDate = new Date(row.holiday_date);
        return holidayDate.toISOString().split('T')[0];
      });
    }
  } catch (error) {
    console.warn('Error fetching holidays:', error.message);
    // Continue without holidays if query fails
  }
  
  // Calculate working days (excluding weekends and holidays)
  let workingDays = 0;
  const currentDate = new Date(start);
  
  while (currentDate <= end) {
    const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 6 = Saturday
    const dateStr = currentDate.toISOString().split('T')[0];
    
    // Count if it's not a weekend and not a holiday
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidays.includes(dateStr)) {
      workingDays++;
    }
    
    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
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






