//External Lib Import
import express from "express";
const CalendarRoutes = express.Router();

//Internal Lib Import
import CalendarControllers from "../controller/Calendar/CalendarControllers.js";
import { CheckEmployeeAuth, CheckAdminAuth, CheckHodAuth } from "../middleware/CheckAuthLogin.js";
import { CheckPermission, CheckAdminOrPermission } from "../middleware/CheckPermission.js";

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

//Organization Holidays Management (Admin always, HOD with leave.update_list permission)
CalendarRoutes.post(
  "/OrganizationHoliday",
  CheckEmployeeAuth,
  CheckAdminOrPermission('leave.update_list'),
  CalendarControllers.CreateOrganizationHoliday,
);

CalendarRoutes.post(
  "/BulkOrganizationHolidays",
  CheckEmployeeAuth,
  CheckAdminOrPermission('leave.update_list'),
  CalendarControllers.BulkCreateOrganizationHolidays,
);

CalendarRoutes.get(
  "/OrganizationHolidays",
  CheckEmployeeAuth,
  CalendarControllers.GetOrganizationHolidays,
);

CalendarRoutes.put(
  "/OrganizationHoliday/:id",
  CheckEmployeeAuth,
  CheckAdminOrPermission('leave.update_list'),
  CalendarControllers.UpdateOrganizationHoliday,
);

CalendarRoutes.delete(
  "/OrganizationHoliday/:id",
  CheckEmployeeAuth,
  CheckAdminOrPermission('leave.update_list'), // Admin always, HOD with permission
  CalendarControllers.DeleteOrganizationHoliday,
);

//Employee-Specific Blocked Dates (Admin always, HOD with leave.update_list permission)
CalendarRoutes.post(
  "/BlockEmployeeDates",
  CheckEmployeeAuth,
  CheckAdminOrPermission('leave.update_list'),
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
  CheckAdminOrPermission('leave.update_list'),
  CalendarControllers.DeleteEmployeeBlockedDate,
);

//Country-Specific Holiday Management (Admin always, HOD with leave.update_list permission)
CalendarRoutes.delete(
  "/CountryHoliday/:id",
  CheckEmployeeAuth,
  CheckAdminOrPermission('leave.update_list'),
  CalendarControllers.DeleteCountryHoliday,
);

export default CalendarRoutes;
















