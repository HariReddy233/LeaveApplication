//External Lib Import
import express from "express";
const routes = express.Router();

//Internal Lib Import
import AuthRoutes from "./AuthRoutes.js";
import LeaveRoutes from "./LeaveRoutes.js";
import CalendarRoutes from "./CalendarRoutes.js";
import DashboardRoutes from "./DashboardRoutes.js";
import UserRoutes from "./UserRoutes.js";
import LeaveTypeRoutes from "./LeaveTypeRoutes.js";
import DepartmentRoutes from "./DepartmentRoutes.js";
import SSERoutes from "./SSERoutes.js";
import PermissionRoutes from "./PermissionRoutes.js";

//Auth Routes
routes.use("/Auth", AuthRoutes);

//Leave Routes
routes.use("/Leave", LeaveRoutes);

//Calendar Routes
routes.use("/Calendar", CalendarRoutes);

//Dashboard Routes
routes.use("/Dashboard", DashboardRoutes);

//User Routes
routes.use("/User", UserRoutes);

//LeaveType Routes
routes.use("/LeaveType", LeaveTypeRoutes);

//Department Routes
routes.use("/Department", DepartmentRoutes);

//SSE Routes
routes.use("/SSE", SSERoutes);

//Permission Routes
routes.use("/Permission", PermissionRoutes);

export default routes;

