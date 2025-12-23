//External Lib Import
import express from "express";
const DepartmentRoutes = express.Router();

//Internal Lib Import
import DepartmentControllers from "../controller/Department/DepartmentControllers.js";
import { CheckEmployeeAuth } from "../middleware/CheckAuthLogin.js";
import { CheckPermission } from "../middleware/CheckPermission.js";

//Get Department List
DepartmentRoutes.get(
  "/DepartmentList",
  CheckEmployeeAuth,
  CheckPermission('department.view'),
  DepartmentControllers.DepartmentList,
);

//Create Department (Permission-based: department.create)
DepartmentRoutes.post(
  "/DepartmentCreate",
  CheckEmployeeAuth,
  CheckPermission('department.create'),
  DepartmentControllers.DepartmentCreate,
);


//Delete Department (Permission-based: department.delete)
DepartmentRoutes.delete(
  "/DepartmentDelete/:id",
  CheckEmployeeAuth,
  CheckPermission('department.delete'),
  DepartmentControllers.DepartmentDelete,
);

export default DepartmentRoutes;










