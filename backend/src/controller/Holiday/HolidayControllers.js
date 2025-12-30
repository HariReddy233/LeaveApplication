//Internal Lib Import
import { SendHolidayNotificationsService } from "../../services/Holiday/HolidayNotificationService.js";

/**
 * @desc Send Holiday Notifications
 * @access private
 * @route /api/v1/Holiday/SendNotifications
 * @method POST
 */
export const SendHolidayNotifications = async (req, res, next) => {
  try {
    const result = await SendHolidayNotificationsService();
    res.json({
      message: result.message || 'Holiday notifications processed',
      data: {
        sent: result.sent || 0,
        holidays_processed: result.holidays_processed || 0
      }
    });
  } catch (error) {
    next(error);
  }
};

export default {
  SendHolidayNotifications,
};





