//External Lib Import
import express from "express";
const DepartmentRoutes = express.Router();

//Internal Lib Import
import DepartmentControllers from "../controller/Department/DepartmentControllers.js";
import { CheckEmployeeAuth, CheckAdminAuth } from "../middleware/CheckAuthLogin.js";

//Get Department List
DepartmentRoutes.get(
  "/DepartmentList",
  CheckEmployeeAuth,
  DepartmentControllers.DepartmentList,
);

//Create Department (Admin only)
DepartmentRoutes.post(
  "/DepartmentCreate",
  CheckEmployeeAuth,
  CheckAdminAuth,
  DepartmentControllers.DepartmentCreate,
);

export default DepartmentRoutes;









