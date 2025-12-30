//Internal Lib Import
import database from "../../config/database.js";
import { sendHolidayReminderEmail } from "../../utils/emailService.js";
import { getHRPortalUrl } from "../../utils/approvalToken.js";
import { extractCountryCodeFromPhone } from "../../utils/countryCodeUtils.js";

/**
 * Send Holiday Notifications
 * Checks for upcoming holidays and sends notifications:
 * - 2 days before
 * - 1 day before
 * - On the day
 */
export const SendHolidayNotificationsService = async () => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Calculate dates for notifications
    const twoDaysFromNow = new Date(today);
    twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);
    
    const oneDayFromNow = new Date(today);
    oneDayFromNow.setDate(oneDayFromNow.getDate() + 1);
    
    const currentYear = today.getFullYear();
    
    // Get all organization holidays for current year and recurring holidays
    const orgHolidaysResult = await database.query(
      `SELECT id, holiday_name, holiday_date, is_recurring, recurring_year, NULL as country_code
       FROM organization_holidays
       WHERE (
         (is_recurring = true AND (recurring_year IS NULL OR recurring_year = $1))
         OR (is_recurring = false AND EXTRACT(YEAR FROM holiday_date) = $1)
       )
       AND holiday_date >= $2
       AND holiday_date <= $3
       ORDER BY holiday_date ASC`,
      [currentYear, today, twoDaysFromNow]
    ).catch(() => ({ rows: [] }));
    
    // Get country-specific holidays
    const countryHolidaysResult = await database.query(
      `SELECT id, holiday_name, holiday_date, country_code, NULL as is_recurring, NULL as recurring_year
       FROM holidays
       WHERE is_active = true
       AND holiday_date >= $1
       AND holiday_date <= $2
       ORDER BY holiday_date ASC`,
      [today, twoDaysFromNow]
    ).catch(() => ({ rows: [] })); // Ignore if table doesn't exist yet
    
    // Combine organization and country holidays
    const allHolidays = [
      ...orgHolidaysResult.rows.map(h => ({ ...h, is_org_holiday: true })),
      ...countryHolidaysResult.rows.map(h => ({ ...h, is_org_holiday: false }))
    ];
    
    if (allHolidays.length === 0) {
      console.log('No upcoming holidays found for notifications');
      return { message: 'No upcoming holidays', sent: 0 };
    }
    
    // Get all active employees/users with country_code
    const usersResult = await database.query(
      `SELECT u.user_id, u.email, u.country_code, u.phone_number,
              COALESCE(u.first_name || ' ' || u.last_name, u.first_name, u.last_name, u.email) as full_name
       FROM users u
       WHERE u.status = 'Active' OR u.status IS NULL
       ORDER BY u.email`
    );
    
    if (usersResult.rows.length === 0) {
      console.log('No active users found for holiday notifications');
      return { message: 'No active users', sent: 0 };
    }
    
    // Auto-populate country_code from phone_number for users who don't have it
    for (const user of usersResult.rows) {
      if (!user.country_code && user.phone_number) {
        const countryCode = extractCountryCodeFromPhone(user.phone_number);
        if (countryCode) {
          await database.query(
            `UPDATE users SET country_code = $1 WHERE user_id = $2`,
            [countryCode, user.user_id]
          ).catch(() => {}); // Ignore errors
          user.country_code = countryCode;
        }
      }
    }
    
    let totalSent = 0;
    const hrPortalUrl = getHRPortalUrl();
    
    // Process each holiday
    for (const holiday of allHolidays) {
      const holidayDate = new Date(holiday.holiday_date);
      holidayDate.setHours(0, 0, 0, 0);
      
      const daysUntilHoliday = Math.ceil((holidayDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      let notificationType = null;
      let shouldSend = false;
      
      // Determine notification type
      if (daysUntilHoliday === 2) {
        notificationType = '2_days_before';
        shouldSend = true;
      } else if (daysUntilHoliday === 1) {
        notificationType = '1_day_before';
        shouldSend = true;
      } else if (daysUntilHoliday === 0) {
        notificationType = 'on_day';
        shouldSend = true;
      }
      
      if (!shouldSend || !notificationType) {
        continue;
      }
      
      // For organization holidays, send to all users
      // For country holidays, send only to users with matching country_code
      let targetUsers = usersResult.rows;
      if (!holiday.is_org_holiday && holiday.country_code) {
        targetUsers = usersResult.rows.filter(u => u.country_code === holiday.country_code);
      }
      
      if (targetUsers.length === 0) {
        console.log(`No users found for country holiday ${holiday.holiday_name} (country: ${holiday.country_code})`);
        continue;
      }
      
      // Check if notification was already sent (use holiday.id or create a unique identifier)
      const holidayId = holiday.is_org_holiday ? holiday.id : `country_${holiday.country_code}_${holiday.id}`;
      const notificationCheck = await database.query(
        `SELECT id FROM holiday_notifications
         WHERE holiday_id = $1 
         AND notification_type = $2
         AND notification_date = $3
         LIMIT 1`,
        [holiday.id, notificationType, today]
      ).catch(() => ({ rows: [] }));
      
      if (notificationCheck.rows.length > 0) {
        console.log(`Notification ${notificationType} for holiday ${holiday.holiday_name} already sent today`);
        continue;
      }
      
      // Send notifications to target users
      for (const user of targetUsers) {
        try {
          await sendHolidayReminderEmail({
            to: user.email,
            recipient_name: user.full_name,
            holiday_name: holiday.holiday_name,
            holiday_date: holiday.holiday_date,
            days_until: daysUntilHoliday,
            notification_type: notificationType,
            hrPortalUrl: hrPortalUrl
          });
          
          totalSent++;
        } catch (emailError) {
          console.error(`Failed to send holiday notification to ${user.email}:`, emailError.message);
        }
      }
      
      // Record that notification was sent (only for organization holidays with id)
      if (holiday.is_org_holiday && holiday.id) {
        await database.query(
          `INSERT INTO holiday_notifications (holiday_id, notification_type, notification_date)
           VALUES ($1, $2, $3)
           ON CONFLICT (holiday_id, notification_type, notification_date) DO NOTHING`,
          [holiday.id, notificationType, today]
        ).catch(() => {}); // Ignore errors
      }
      
      console.log(`✅ Sent ${notificationType} notifications for holiday: ${holiday.holiday_name} to ${targetUsers.length} users`);
    }
    
    return {
      message: 'Holiday notifications processed',
      sent: totalSent,
      holidays_processed: holidaysResult.rows.length
    };
  } catch (error) {
    console.error('Error in SendHolidayNotificationsService:', error);
    throw error;
  }
};


