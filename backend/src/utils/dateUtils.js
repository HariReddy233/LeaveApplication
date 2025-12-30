/**
 * Date Utility Functions
 * Helper functions for date calculations and validations
 */

import { isWeekendForCountry, getWeekendDaysByCountry } from './countryCodeUtils.js';

/**
 * Check if a date is a weekend (Saturday or Sunday)
 * @param {Date} date - Date to check
 * @param {string} countryCode - Optional country code for country-specific weekends
 * @returns {boolean} - True if weekend, false otherwise
 */
export const isWeekend = (date, countryCode = null) => {
  if (countryCode) {
    return isWeekendForCountry(date, countryCode);
  }
  // Default: Saturday or Sunday
  const day = date.getDay();
  return day === 0 || day === 6; // 0 = Sunday, 6 = Saturday
};

/**
 * Calculate number of days between two dates, excluding weekends
 * @param {Date|string} startDate - Start date
 * @param {Date|string} endDate - End date
 * @param {string} countryCode - Optional country code for country-specific weekends
 * @returns {number} - Number of days excluding weekends
 */
export const calculateDaysExcludingWeekends = (startDate, endDate, countryCode = null) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Reset time to midnight for accurate day calculation
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  
  let count = 0;
  const current = new Date(start);
  
  // Get weekend days for country (if provided)
  const weekendDays = countryCode ? getWeekendDaysByCountry(countryCode) : [0, 6]; // Default: Sunday, Saturday
  
  while (current <= end) {
    const dayOfWeek = current.getDay();
    if (!weekendDays.includes(dayOfWeek)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  
  return count;
};

/**
 * Get all dates in a range (inclusive)
 * @param {Date|string} startDate - Start date
 * @param {Date|string} endDate - End date
 * @returns {Date[]} - Array of dates
 */
export const getDatesInRange = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  
  const dates = [];
  const current = new Date(start);
  
  while (current <= end) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  
  return dates;
};

/**
 * Format date to YYYY-MM-DD string
 * @param {Date|string} date - Date to format
 * @returns {string} - Formatted date string
 */
export const formatDateString = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};


