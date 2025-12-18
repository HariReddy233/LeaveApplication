//External Lib Import
import express from "express";
const LeaveTypeRoutes = express.Router();

//Internal Lib Import
import LeaveTypeControllers from "../controller/LeaveType/LeaveTypeControllers.js";
import { CheckEmployeeAuth, CheckAdminAuth } from "../middleware/CheckAuthLogin.js";

//Get Leave Type List
LeaveTypeRoutes.get(
  "/LeaveTypeList",
  CheckEmployeeAuth,
  LeaveTypeControllers.LeaveTypeList,
);

//Create Leave Type (Admin only)
LeaveTypeRoutes.post(
  "/LeaveTypeCreate",
  CheckEmployeeAuth,
  CheckAdminAuth,
  LeaveTypeControllers.LeaveTypeCreate,
);

//Update Leave Type (Admin only)
LeaveTypeRoutes.patch(
  "/LeaveTypeUpdate/:id",
  CheckEmployeeAuth,
  CheckAdminAuth,
  LeaveTypeControllers.LeaveTypeUpdate,
);

//Delete Leave Type (Admin only)
LeaveTypeRoutes.delete(
  "/LeaveTypeDelete/:id",
  CheckEmployeeAuth,
  CheckAdminAuth,
  LeaveTypeControllers.LeaveTypeDelete,
);

export default LeaveTypeRoutes;








