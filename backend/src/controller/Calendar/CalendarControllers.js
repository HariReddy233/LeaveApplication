//Internal Lib Import
import {
  GetCalendarViewService,
  BlockCalendarDatesService,
  GetBlockedDatesService,
  GetAllBlockedDatesForCalendarService,
  CreateOrganizationHolidayService,
  GetOrganizationHolidaysService,
  UpdateOrganizationHolidayService,
  DeleteOrganizationHolidayService,
  BlockEmployeeDatesService,
  GetEmployeeBlockedDatesService,
  DeleteEmployeeBlockedDateService,
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

/**
 * @desc Get All Blocked Dates for Calendar
 * @access private
 * @route /api/v1/Calendar/AllBlockedDates
 * @method GET
 */
export const AllBlockedDates = async (req, res, next) => {
  try {
    const result = await GetAllBlockedDatesForCalendarService(req);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Create Organization Holiday
 * @access private
 * @route /api/v1/Calendar/OrganizationHoliday
 * @method POST
 */
export const CreateOrganizationHoliday = async (req, res, next) => {
  try {
    const result = await CreateOrganizationHolidayService(req);
    res.status(201).json({
      message: "Organization holiday created successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Get Organization Holidays
 * @access private
 * @route /api/v1/Calendar/OrganizationHolidays
 * @method GET
 */
export const GetOrganizationHolidays = async (req, res, next) => {
  try {
    const result = await GetOrganizationHolidaysService(req);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Update Organization Holiday
 * @access private
 * @route /api/v1/Calendar/OrganizationHoliday/:id
 * @method PUT
 */
export const UpdateOrganizationHoliday = async (req, res, next) => {
  try {
    const result = await UpdateOrganizationHolidayService(req);
    res.json({
      message: "Organization holiday updated successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Delete Organization Holiday
 * @access private
 * @route /api/v1/Calendar/OrganizationHoliday/:id
 * @method DELETE
 */
export const DeleteOrganizationHoliday = async (req, res, next) => {
  try {
    const result = await DeleteOrganizationHolidayService(req);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Block Employee Dates
 * @access private
 * @route /api/v1/Calendar/BlockEmployeeDates
 * @method POST
 */
export const BlockEmployeeDates = async (req, res, next) => {
  try {
    const result = await BlockEmployeeDatesService(req);
    res.status(201).json({
      message: "Employee dates blocked successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Get Employee Blocked Dates
 * @access private
 * @route /api/v1/Calendar/EmployeeBlockedDates
 * @method GET
 */
export const GetEmployeeBlockedDates = async (req, res, next) => {
  try {
    const result = await GetEmployeeBlockedDatesService(req);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Delete Employee Blocked Date
 * @access private
 * @route /api/v1/Calendar/EmployeeBlockedDate/:id
 * @method DELETE
 */
export const DeleteEmployeeBlockedDate = async (req, res, next) => {
  try {
    const result = await DeleteEmployeeBlockedDateService(req);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export default {
  CalendarView,
  BlockCalendar,
  BlockedDates,
  AllBlockedDates,
  CreateOrganizationHoliday,
  GetOrganizationHolidays,
  UpdateOrganizationHoliday,
  DeleteOrganizationHoliday,
  BlockEmployeeDates,
  GetEmployeeBlockedDates,
  DeleteEmployeeBlockedDate,
};

