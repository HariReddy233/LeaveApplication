//Internal Lib Import
import {
  GetCalendarViewService,
  BlockCalendarDatesService,
  GetBlockedDatesService,
} from "../../services/Calendar/CalendarService.js";

/**
 * @desc Get Calendar View
 * @access private
 * @route /api/v1/Calendar/CalendarView
 * @method GET
 */
export const CalendarView = async (req, res, next) => {
  try {
    const result = await GetCalendarViewService(req);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Block Calendar Dates
 * @access private
 * @route /api/v1/Calendar/BlockCalendar
 * @method POST
 */
export const BlockCalendar = async (req, res, next) => {
  try {
    const result = await BlockCalendarDatesService(req);
    res.status(201).json({
      message: "Calendar dates blocked successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Get Blocked Dates
 * @access private
 * @route /api/v1/Calendar/BlockedDates
 * @method GET
 */
export const BlockedDates = async (req, res, next) => {
  try {
    const result = await GetBlockedDatesService(req);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

export default {
  CalendarView,
  BlockCalendar,
  BlockedDates,
};

