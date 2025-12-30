//External Lib Import
import express from "express";
const PermissionRoutes = express.Router();

//Internal Lib Import
import PermissionControllers from "../controller/Permission/PermissionControllers.js";
import { CheckEmployeeAuth, CheckAdminAuth } from "../middleware/CheckAuthLogin.js";
import { CheckPermission } from "../middleware/CheckPermission.js";

//Get All Permissions (Admin only)
PermissionRoutes.get(
  "/GetAllPermissions",
  CheckEmployeeAuth,
  CheckAdminAuth,
  CheckPermission('permissions.view'),
  PermissionControllers.GetAllPermissions,
);

//Get All Users with Permissions (Admin only)
PermissionRoutes.get(
  "/GetAllUsersWithPermissions",
  CheckEmployeeAuth,
  CheckAdminAuth,
  CheckPermission('permissions.view'),
  PermissionControllers.GetAllUsersWithPermissions,
);

//Get User Permissions (Admin only)
PermissionRoutes.get(
  "/GetUserPermissions/:userId",
  CheckEmployeeAuth,
  CheckAdminAuth,
  CheckPermission('permissions.view'),
  PermissionControllers.GetUserPermissions,
);

//Assign Permission (Admin only)
PermissionRoutes.post(
  "/AssignPermission",
  CheckEmployeeAuth,
  CheckAdminAuth,
  CheckPermission('permissions.manage'),
  PermissionControllers.AssignPermission,
);

//Revoke Permission (Admin only)
PermissionRoutes.post(
  "/RevokePermission",
  CheckEmployeeAuth,
  CheckAdminAuth,
  CheckPermission('permissions.manage'),
  PermissionControllers.RevokePermission,
);

//Bulk Assign Permissions (Admin only)
PermissionRoutes.post(
  "/BulkAssignPermissions",
  CheckEmployeeAuth,
  CheckAdminAuth,
  CheckPermission('permissions.manage'),
  PermissionControllers.BulkAssignPermissions,
);

//Get My Permissions (Any authenticated user)
PermissionRoutes.get(
  "/GetMyPermissions",
  CheckEmployeeAuth,
  PermissionControllers.GetMyPermissions,
);

//Initialize Required Permissions (Admin only - for manual trigger)
PermissionRoutes.post(
  "/InitializePermissions",
  CheckEmployeeAuth,
  CheckAdminAuth,
  PermissionControllers.InitializePermissions,
);

export default PermissionRoutes;



