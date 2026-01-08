//External Lib Import
import express from "express";
const UserRoutes = express.Router();

//Internal Lib Import
import UserControllers from "../controller/User/UserControllers.js";
import { CheckEmployeeAuth, CheckAdminAuth } from "../middleware/CheckAuthLogin.js";
import { CheckPermission, CheckAdminOrPermission, CheckMultiplePermissions } from "../middleware/CheckPermission.js";

//Employee List (Permission-based: any employee permission - view, create, edit, or delete)
UserRoutes.get(
  "/EmployeeList",
  CheckEmployeeAuth,
  CheckMultiplePermissions(['employee.view', 'employee.create', 'employee.edit', 'employee.delete'], 'any'),
  UserControllers.EmployeeList,
);

//Employee List (HOD) - Keep for backward compatibility, but use permission check
//Allow access with any employee permission (view, create, edit, or delete)
UserRoutes.get(
  "/EmployeeListHod",
  CheckEmployeeAuth,
  CheckMultiplePermissions(['employee.view', 'employee.create', 'employee.edit', 'employee.delete'], 'any'),
  UserControllers.EmployeeList,
);

//User Profile
UserRoutes.get(
  "/UserProfile",
  CheckEmployeeAuth,
  UserControllers.UserProfile,
);

//Get All Users for Availability Checking (All authenticated users)
UserRoutes.get(
  "/UserListForAvailability",
  CheckEmployeeAuth,
  UserControllers.UserListForAvailability,
);

//Update User Role (Admin only)
UserRoutes.patch(
  "/UpdateRole/:userId",
  CheckEmployeeAuth,
  CheckAdminAuth,
  UserControllers.UpdateUserRole,
);

//Get All Users (Admin only)
UserRoutes.get(
  "/UserList",
  CheckEmployeeAuth,
  CheckAdminAuth,
  UserControllers.UserList,
);

//Update Employee Details (Permission-based: employee.edit)
UserRoutes.patch(
  "/UpdateEmployee/:userId",
  CheckEmployeeAuth,
  CheckPermission('employee.edit'),
  UserControllers.UpdateEmployee,
);

//Get All HODs (for HOD assignment dropdown) - Admin or HOD with employee.edit permission
UserRoutes.get(
  "/HodsList",
  CheckEmployeeAuth,
  CheckAdminOrPermission('employee.edit'),
  UserControllers.HodsList,
);

//Get All Admins (for Admin assignment dropdown) - Admin or HOD with employee.create permission
UserRoutes.get(
  "/AdminsList",
  CheckEmployeeAuth,
  CheckAdminOrPermission('employee.create'),
  UserControllers.AdminsList,
);

//Delete Employee (Permission-based: employee.delete)
UserRoutes.delete(
  "/DeleteEmployee/:userId",
  CheckEmployeeAuth,
  CheckPermission('employee.delete'),
  UserControllers.DeleteEmployee,
);

export default UserRoutes;



