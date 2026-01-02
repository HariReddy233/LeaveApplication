/**
 * Country Code Utility Functions
 * Helper functions for country code detection and weekend calculation
 */

/**
 * Extract country code from phone number
 * Supports formats: +1, +91, 1-xxx, 91-xxx, etc.
 * @param {string} phoneNumber - Phone number string
 * @returns {string|null} - Country code (US, IN, etc.) or null if not found
 */
export const extractCountryCodeFromPhone = (phoneNumber) => {
  if (!phoneNumber || typeof phoneNumber !== 'string') {
    return null;
  }

  // Remove all spaces, dashes, and parentheses
  const cleaned = phoneNumber.replace(/[\s\-\(\)]/g, '');
  
  // Common country code mappings (phone prefix -> country code)
  const countryCodeMap = {
    '+1': 'US', '1': 'US',
    '+91': 'IN', '91': 'IN',
    '+44': 'GB', '44': 'GB',
    '+61': 'AU', '61': 'AU',
    '+971': 'AE', '971': 'AE', // UAE
    '+966': 'SA', '966': 'SA', // Saudi Arabia
    '+65': 'SG', '65': 'SG', // Singapore
    '+86': 'CN', '86': 'CN', // China
    '+81': 'JP', '81': 'JP', // Japan
    '+82': 'KR', '82': 'KR', // South Korea
    '+33': 'FR', '33': 'FR', // France
    '+49': 'DE', '49': 'DE', // Germany
    '+39': 'IT', '39': 'IT', // Italy
    '+34': 'ES', '34': 'ES', // Spain
    '+7': 'RU', '7': 'RU', // Russia
    '+55': 'BR', '55': 'BR', // Brazil
    '+52': 'MX', '52': 'MX', // Mexico
    '+27': 'ZA', '27': 'ZA', // South Africa
  };

  // Check for + prefix first (most common)
  for (const [prefix, code] of Object.entries(countryCodeMap)) {
    if (cleaned.startsWith(prefix)) {
      return code;
    }
  }

  // Default: if starts with +1 or 1, assume US
  if (cleaned.startsWith('+1') || cleaned.startsWith('1')) {
    return 'US';
  }

  // Default: if starts with +91 or 91, assume India
  if (cleaned.startsWith('+91') || cleaned.startsWith('91')) {
    return 'IN';
  }

  return null;
};

/**
 * Get weekend days for a country
 * @param {string} countryCode - Country code (US, IN, etc.)
 * @returns {number[]} - Array of day numbers (0=Sunday, 6=Saturday)
 */
export const getWeekendDaysByCountry = (countryCode) => {
  const weekendDaysByCountry = {
    US: [0, 6], // Sunday, Saturday
    IN: [0, 6], // Sunday, Saturday
    GB: [0, 6], // Sunday, Saturday
    AU: [0, 6], // Sunday, Saturday
    CN: [0, 6], // Sunday, Saturday
    JP: [0, 6], // Sunday, Saturday
    KR: [0, 6], // Sunday, Saturday
    FR: [0, 6], // Sunday, Saturday
    DE: [0, 6], // Sunday, Saturday
    IT: [0, 6], // Sunday, Saturday
    ES: [0, 6], // Sunday, Saturday
    RU: [0, 6], // Sunday, Saturday
    BR: [0, 6], // Sunday, Saturday
    MX: [0, 6], // Sunday, Saturday
    ZA: [0, 6], // Sunday, Saturday
    // Middle East countries (Friday + Saturday)
    AE: [5, 6], // Friday, Saturday
    SA: [5, 6], // Friday, Saturday
    SG: [0, 6], // Sunday, Saturday
  };

  // Default to US/India weekend (Saturday + Sunday) if country not found
  return weekendDaysByCountry[countryCode] || [0, 6];
};

/**
 * Check if a date is a weekend for a specific country
 * @param {Date} date - Date to check
 * @param {string} countryCode - Country code (US, IN, etc.)
 * @returns {boolean} - True if weekend, false otherwise
 */
export const isWeekendForCountry = (date, countryCode) => {
  const weekendDays = getWeekendDaysByCountry(countryCode);
  const dayOfWeek = date.getDay();
  return weekendDays.includes(dayOfWeek);
};





