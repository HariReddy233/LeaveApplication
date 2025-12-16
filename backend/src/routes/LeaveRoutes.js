//External Lib Import
import express from "express";
const LeaveRoutes = express.Router();

//Internal Lib Import
import LeaveControllers from "../controller/Leave/LeaveControllers.js";
import { CheckEmployeeAuth, CheckAdminAuth, CheckHodAuth } from "../middleware/CheckAuthLogin.js";

//Leave Create
LeaveRoutes.post(
  "/LeaveCreate",
  CheckEmployeeAuth,
  LeaveControllers.LeaveCreate,
);

//LeaveList (Employee's own leaves with pagination)
LeaveRoutes.get(
  "/LeaveList/:pageNumber/:perPage/:searchKeyword",
  CheckEmployeeAuth,
  LeaveControllers.LeaveList,
);

//LeaveAdminList (All leaves for Admin with pagination)
LeaveRoutes.get(
  "/LeaveAdminList/:pageNumber/:perPage/:searchKeyword",
  CheckEmployeeAuth,
  CheckAdminAuth,
  LeaveControllers.LeaveAdminList,
);

//LeaveListHod (All leaves for HOD with pagination)
LeaveRoutes.get(
  "/LeaveListHod/:pageNumber/:perPage/:searchKeyword",
  CheckEmployeeAuth,
  CheckHodAuth,
  LeaveControllers.LeaveListHod,
);

//LeaveListAdminByStatus (Filter by Admin Status)
LeaveRoutes.post(
  "/LeaveListAdminByStatus/:pageNumber/:perPage/:searchKeyword",
  CheckEmployeeAuth,
  CheckAdminAuth,
  LeaveControllers.LeaveListAdminByStatus,
);

//LeaveListHodByStatus (Filter by HOD Status)
LeaveRoutes.post(
  "/LeaveListHodByStatus/:pageNumber/:perPage/:searchKeyword",
  CheckEmployeeAuth,
  CheckHodAuth,
  LeaveControllers.LeaveListHodByStatus,
);

//Leave Details
LeaveRoutes.get(
  "/LeaveDetails/:id",
  CheckEmployeeAuth,
  LeaveControllers.LeaveDetails,
);

//Leave Update
LeaveRoutes.patch(
  "/LeaveUpdate/:id",
  CheckEmployeeAuth,
  LeaveControllers.LeaveUpdate,
);

//Leave Delete
LeaveRoutes.delete(
  "/LeaveDelete/:id",
  CheckEmployeeAuth,
  LeaveControllers.LeaveDelete,
);

//Leave Approve/Reject
LeaveRoutes.patch(
  "/LeaveApprove/:id",
  CheckEmployeeAuth,
  CheckAdminAuth,
  LeaveControllers.LeaveApprove,
);

//Leave Approve/Reject (HOD)
LeaveRoutes.patch(
  "/LeaveApproveHod/:id",
  CheckEmployeeAuth,
  CheckHodAuth,
  LeaveControllers.LeaveApproveHod,
);

//Leave Balance
LeaveRoutes.get(
  "/LeaveBalance",
  CheckEmployeeAuth,
  LeaveControllers.LeaveBalance,
);

export default LeaveRoutes;


