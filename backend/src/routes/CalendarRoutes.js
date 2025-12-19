//External Lib Import
import express from "express";
const CalendarRoutes = express.Router();

//Internal Lib Import
import CalendarControllers from "../controller/Calendar/CalendarControllers.js";
import { CheckEmployeeAuth, CheckAdminAuth, CheckHodAuth } from "../middleware/CheckAuthLogin.js";

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

export default CalendarRoutes;













