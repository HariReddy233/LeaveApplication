//External Lib Import
import express from "express";
const DashboardRoutes = express.Router();

//Internal Lib Import
import DashboardControllers from "../controller/Dashboard/DashboardControllers.js";
import { CheckEmployeeAuth, CheckAdminAuth, CheckHodAuth } from "../middleware/CheckAuthLogin.js";
import { CheckPermission } from "../middleware/CheckPermission.js";

//Dashboard Summary Employee - Requires dashboard.view permission
DashboardRoutes.get(
  "/DashboardSummaryEmployee",
  CheckEmployeeAuth,
  CheckPermission('dashboard.view'),
  DashboardControllers.DashboardSummaryEmployee,
);

//Dashboard Summary HOD - Requires dashboard.view permission
DashboardRoutes.get(
  "/DashboardSummaryHod",
  CheckEmployeeAuth,
  CheckHodAuth,
  CheckPermission('dashboard.view'),
  DashboardControllers.DashboardSummaryHod,
);

//Dashboard Summary Admin - Admin can access without explicit permission (admin has full access)
DashboardRoutes.get(
  "/DashboardSummaryAdmin",
  CheckEmployeeAuth,
  CheckAdminAuth,
  DashboardControllers.DashboardSummaryAdmin,
);

export default DashboardRoutes;


