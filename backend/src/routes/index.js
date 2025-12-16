//External Lib Import
import express from "express";
const routes = express.Router();

//Internal Lib Import
import AuthRoutes from "./AuthRoutes.js";
import LeaveRoutes from "./LeaveRoutes.js";
import CalendarRoutes from "./CalendarRoutes.js";
import DashboardRoutes from "./DashboardRoutes.js";
import UserRoutes from "./UserRoutes.js";
import AuthorizationRoutes from "./AuthorizationRoutes.js";
import LeaveTypeRoutes from "./LeaveTypeRoutes.js";
import DepartmentRoutes from "./DepartmentRoutes.js";
import SSERoutes from "./SSERoutes.js";

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

//Authorization Routes
routes.use("/Authorization", AuthorizationRoutes);

//LeaveType Routes
routes.use("/LeaveType", LeaveTypeRoutes);

//Department Routes
routes.use("/Department", DepartmentRoutes);

//SSE Routes
routes.use("/SSE", SSERoutes);

export default routes;

