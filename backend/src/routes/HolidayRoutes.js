//External Lib Import
import express from "express";
const HolidayRoutes = express.Router();

//Internal Lib Import
import HolidayControllers from "../controller/Holiday/HolidayControllers.js";
import { CheckEmployeeAuth, CheckAdminAuth } from "../middleware/CheckAuthLogin.js";

//Send Holiday Notifications (Admin only, or can be triggered by cron job)
HolidayRoutes.post(
  "/SendNotifications",
  CheckEmployeeAuth,
  CheckAdminAuth,
  HolidayControllers.SendHolidayNotifications,
);

export default HolidayRoutes;





