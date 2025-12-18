//External Lib Import
import express from "express";
const AuthorizationRoutes = express.Router();

//Internal Lib Import
import AuthorizationControllers from "../controller/Authorization/AuthorizationControllers.js";
import { CheckEmployeeAuth, CheckAdminAuth, CheckHodAuth } from "../middleware/CheckAuthLogin.js";

//Authorization Create
AuthorizationRoutes.post(
  "/AuthorizationCreate",
  CheckEmployeeAuth,
  AuthorizationControllers.AuthorizationCreate,
);

//AuthorizationList (Employee's own requests)
AuthorizationRoutes.get(
  "/AuthorizationList",
  CheckEmployeeAuth,
  AuthorizationControllers.AuthorizationList,
);

//AuthorizationAdminList (All requests for Admin/HOD)
AuthorizationRoutes.get(
  "/AuthorizationAdminList",
  CheckEmployeeAuth,
  CheckAdminAuth,
  AuthorizationControllers.AuthorizationAdminList,
);

//AuthorizationListHod (All requests for HOD)
AuthorizationRoutes.get(
  "/AuthorizationListHod",
  CheckEmployeeAuth,
  CheckHodAuth,
  AuthorizationControllers.AuthorizationAdminList,
);

//Authorization Details
AuthorizationRoutes.get(
  "/AuthorizationDetails/:id",
  CheckEmployeeAuth,
  AuthorizationControllers.AuthorizationDetails,
);

//Authorization Update
AuthorizationRoutes.patch(
  "/AuthorizationUpdate/:id",
  CheckEmployeeAuth,
  AuthorizationControllers.AuthorizationUpdate,
);

//Authorization Delete
AuthorizationRoutes.delete(
  "/AuthorizationDelete/:id",
  CheckEmployeeAuth,
  AuthorizationControllers.AuthorizationDelete,
);

//Authorization Approve/Reject
AuthorizationRoutes.patch(
  "/AuthorizationApprove/:id",
  CheckEmployeeAuth,
  CheckAdminAuth,
  AuthorizationControllers.AuthorizationApprove,
);

//Authorization Approve/Reject (HOD)
AuthorizationRoutes.patch(
  "/AuthorizationApproveHod/:id",
  CheckEmployeeAuth,
  CheckHodAuth,
  AuthorizationControllers.AuthorizationApprove,
);

//Authorization Stats
AuthorizationRoutes.get(
  "/AuthorizationStats",
  CheckEmployeeAuth,
  AuthorizationControllers.AuthorizationStats,
);

export default AuthorizationRoutes;










