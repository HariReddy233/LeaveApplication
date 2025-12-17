//External Lib Import
import express from "express";
const UserRoutes = express.Router();

//Internal Lib Import
import UserControllers from "../controller/User/UserControllers.js";
import { CheckEmployeeAuth, CheckAdminAuth, CheckHodAuth } from "../middleware/CheckAuthLogin.js";

//Employee List
UserRoutes.get(
  "/EmployeeList",
  CheckEmployeeAuth,
  CheckAdminAuth,
  UserControllers.EmployeeList,
);

//Employee List (HOD)
UserRoutes.get(
  "/EmployeeListHod",
  CheckEmployeeAuth,
  CheckHodAuth,
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

//Update Employee Details (Admin only)
UserRoutes.patch(
  "/UpdateEmployee/:userId",
  CheckEmployeeAuth,
  CheckAdminAuth,
  UserControllers.UpdateEmployee,
);

//Get All HODs (for HOD assignment dropdown) - Admin only
UserRoutes.get(
  "/HodsList",
  CheckEmployeeAuth,
  CheckAdminAuth,
  UserControllers.HodsList,
);

//Get All Admins (for Admin assignment dropdown) - Admin only
UserRoutes.get(
  "/AdminsList",
  CheckEmployeeAuth,
  CheckAdminAuth,
  UserControllers.AdminsList,
);

export default UserRoutes;



