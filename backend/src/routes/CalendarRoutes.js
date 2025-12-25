//External Lib Import
import express from "express";
const CalendarRoutes = express.Router();

//Internal Lib Import
import CalendarControllers from "../controller/Calendar/CalendarControllers.js";
import { CheckEmployeeAuth, CheckAdminAuth, CheckHodAuth } from "../middleware/CheckAuthLogin.js";
import { CheckPermission } from "../middleware/CheckPermission.js";

//Calendar View
CalendarRoutes.get(
  "/CalendarView",
  CheckEmployeeAuth,
  CalendarControllers.CalendarView,
);

//Block Calendar Dates
CalendarRoutes.post(
  "/BlockCalendar",
  CheckEmployeeAuth,
  CheckAdminAuth,
  CalendarControllers.BlockCalendar,
);

//Block Calendar Dates (HOD)
CalendarRoutes.post(
  "/BlockCalendarHod",
  CheckEmployeeAuth,
  CheckHodAuth,
  CalendarControllers.BlockCalendar,
);

//Get Blocked Dates
CalendarRoutes.get(
  "/BlockedDates",
  CheckEmployeeAuth,
  CalendarControllers.BlockedDates,
);

//Get All Blocked Dates for Calendar (organization holidays + employee-specific)
CalendarRoutes.get(
  "/AllBlockedDates",
  CheckEmployeeAuth,
  CalendarControllers.AllBlockedDates,
);

//Organization Holidays Management (Admin/HOD with permission)
CalendarRoutes.post(
  "/OrganizationHoliday",
  CheckEmployeeAuth,
  CheckPermission('calendar.block_dates'),
  CalendarControllers.CreateOrganizationHoliday,
);

CalendarRoutes.get(
  "/OrganizationHolidays",
  CheckEmployeeAuth,
  CalendarControllers.GetOrganizationHolidays,
);

CalendarRoutes.put(
  "/OrganizationHoliday/:id",
  CheckEmployeeAuth,
  CheckPermission('calendar.block_dates'),
  CalendarControllers.UpdateOrganizationHoliday,
);

CalendarRoutes.delete(
  "/OrganizationHoliday/:id",
  CheckEmployeeAuth,
  CheckAdminAuth, // Only Admin can delete organization holidays
  CalendarControllers.DeleteOrganizationHoliday,
);

//Employee-Specific Blocked Dates (Admin/HOD with permission)
CalendarRoutes.post(
  "/BlockEmployeeDates",
  CheckEmployeeAuth,
  CheckPermission('calendar.block_dates'),
  CalendarControllers.BlockEmployeeDates,
);

CalendarRoutes.get(
  "/EmployeeBlockedDates",
  CheckEmployeeAuth,
  CalendarControllers.GetEmployeeBlockedDates,
);

CalendarRoutes.delete(
  "/EmployeeBlockedDate/:id",
  CheckEmployeeAuth,
  CheckPermission('calendar.block_dates'),
  CalendarControllers.DeleteEmployeeBlockedDate,
);

export default CalendarRoutes;
















