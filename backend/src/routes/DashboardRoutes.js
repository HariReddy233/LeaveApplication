//External Lib Import
import express from "express";
const DashboardRoutes = express.Router();

//Internal Lib Import
import DashboardControllers from "../controller/Dashboard/DashboardControllers.js";
import { CheckEmployeeAuth, CheckAdminAuth, CheckHodAuth } from "../middleware/CheckAuthLogin.js";

//Dashboard Summary Employee
DashboardRoutes.get(
  "/DashboardSummaryEmployee",
  CheckEmployeeAuth,
  DashboardControllers.DashboardSummaryEmployee,
);

//Dashboard Summary HOD
DashboardRoutes.get(
  "/DashboardSummaryHod",
  CheckEmployeeAuth,
  CheckHodAuth,
  DashboardControllers.DashboardSummaryHod,
);

//Dashboard Summary Admin
DashboardRoutes.get(
  "/DashboardSummaryAdmin",
  CheckEmployeeAuth,
  CheckAdminAuth,
  DashboardControllers.DashboardSummaryAdmin,
);

export default DashboardRoutes;


