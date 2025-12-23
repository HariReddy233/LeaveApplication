//External Lib Import
import express from "express";
const LeaveTypeRoutes = express.Router();

//Internal Lib Import
import LeaveTypeControllers from "../controller/LeaveType/LeaveTypeControllers.js";
import { CheckEmployeeAuth } from "../middleware/CheckAuthLogin.js";
import { CheckPermission, CheckMultiplePermissions } from "../middleware/CheckPermission.js";

//Get Leave Type List (Permission-based: leavetype.view OR leave.apply OR leave.create - users who can apply leave need to see leave types)
LeaveTypeRoutes.get(
  "/LeaveTypeList",
  CheckEmployeeAuth,
  CheckMultiplePermissions(['leavetype.view', 'leave.apply', 'leave.create'], 'any'),
  LeaveTypeControllers.LeaveTypeList,
);

//Create Leave Type (Permission-based: leavetype.create)
LeaveTypeRoutes.post(
  "/LeaveTypeCreate",
  CheckEmployeeAuth,
  CheckPermission('leavetype.create'),
  LeaveTypeControllers.LeaveTypeCreate,
);

//Update Leave Type (Permission-based: leavetype.edit)
LeaveTypeRoutes.patch(
  "/LeaveTypeUpdate/:id",
  CheckEmployeeAuth,
  CheckPermission('leavetype.edit'),
  LeaveTypeControllers.LeaveTypeUpdate,
);

//Delete Leave Type (Permission-based: leavetype.delete)
LeaveTypeRoutes.delete(
  "/LeaveTypeDelete/:id",
  CheckEmployeeAuth,
  CheckPermission('leavetype.delete'),
  LeaveTypeControllers.LeaveTypeDelete,
);

export default LeaveTypeRoutes;












