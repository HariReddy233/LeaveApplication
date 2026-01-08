//External Lib Import
import express from "express";
const LeaveRoutes = express.Router();

//Internal Lib Import
import LeaveControllers from "../controller/Leave/LeaveControllers.js";
import { CheckEmployeeAuth, CheckAdminAuth, CheckHodAuth } from "../middleware/CheckAuthLogin.js";
import { CheckPermission, CheckMultiplePermissions, CheckAdminOrPermission } from "../middleware/CheckPermission.js";

//Leave Create
LeaveRoutes.post(
  "/LeaveCreate",
  CheckEmployeeAuth,
  LeaveControllers.LeaveCreate,
);

//LeaveList (Employee's own leaves with pagination) - Requires leave.view_own, leave.view_all, leave.apply, OR leave.create (users who can apply leave need to see their own leaves for blocked dates)
LeaveRoutes.get(
  "/LeaveList/:pageNumber/:perPage/:searchKeyword",
  CheckEmployeeAuth,
  CheckMultiplePermissions(['leave.view_own', 'leave.view_all', 'leave.apply', 'leave.create'], 'any'),
  LeaveControllers.LeaveList,
);

//LeaveAdminList (All leaves for Admin with pagination) - Requires leave.view_own or leave.view_all
LeaveRoutes.get(
  "/LeaveAdminList/:pageNumber/:perPage/:searchKeyword",
  CheckEmployeeAuth,
  CheckAdminAuth,
  CheckMultiplePermissions(['leave.view_own', 'leave.view_all'], 'any'),
  LeaveControllers.LeaveAdminList,
);

//LeaveListHod (All leaves for HOD with pagination) - Requires leave.view_own or leave.view_all
LeaveRoutes.get(
  "/LeaveListHod/:pageNumber/:perPage/:searchKeyword",
  CheckEmployeeAuth,
  CheckHodAuth,
  CheckMultiplePermissions(['leave.view_own', 'leave.view_all'], 'any'),
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

//Leave Approve/Reject (Admin) - Requires leave.approve or leave.reject
LeaveRoutes.patch(
  "/LeaveApprove/:id",
  CheckEmployeeAuth,
  CheckAdminAuth,
  CheckMultiplePermissions(['leave.approve', 'leave.reject'], 'any'),
  LeaveControllers.LeaveApprove,
);

//Leave Approve/Reject (HOD) - Requires leave.approve or leave.reject
LeaveRoutes.patch(
  "/LeaveApproveHod/:id",
  CheckEmployeeAuth,
  CheckHodAuth,
  CheckMultiplePermissions(['leave.approve', 'leave.reject'], 'any'),
  LeaveControllers.LeaveApproveHod,
);

//Leave Balance
LeaveRoutes.get(
  "/LeaveBalance",
  CheckEmployeeAuth,
  LeaveControllers.LeaveBalance,
);

//Check Overlapping Leaves
LeaveRoutes.post(
  "/CheckOverlappingLeaves",
  CheckEmployeeAuth,
  LeaveControllers.CheckOverlappingLeaves,
);

//Calculate Working Days (excludes weekends and holidays)
LeaveRoutes.post(
  "/CalculateWorkingDays",
  CheckEmployeeAuth,
  LeaveControllers.CalculateWorkingDays,
);
LeaveRoutes.get(
  "/CalculateWorkingDays",
  CheckEmployeeAuth,
  LeaveControllers.CalculateWorkingDays,
);

//Calculate Comp-Off Days (non-working days: weekends + location-specific holidays)
LeaveRoutes.post(
  "/CalculateCompOffDays",
  CheckEmployeeAuth,
  LeaveControllers.CalculateCompOffDays,
);
LeaveRoutes.get(
  "/CalculateCompOffDays",
  CheckEmployeeAuth,
  LeaveControllers.CalculateCompOffDays,
);

//Bulk Approve/Reject (Admin) - Requires leave.approve or leave.reject
LeaveRoutes.post(
  "/BulkApprove",
  CheckEmployeeAuth,
  CheckAdminAuth,
  CheckMultiplePermissions(['leave.approve', 'leave.reject'], 'any'),
  LeaveControllers.BulkApprove,
);

//Bulk Approve/Reject (HOD) - Requires leave.approve or leave.reject
LeaveRoutes.post(
  "/BulkApproveHod",
  CheckEmployeeAuth,
  CheckHodAuth,
  CheckMultiplePermissions(['leave.approve', 'leave.reject'], 'any'),
  LeaveControllers.BulkApproveHod,
);

//Email-based Approval/Rejection (Public - no auth required, token-based)
// Single endpoint: /email-action?token=xxx&action=approve or /email-action?token=xxx&action=reject
// One token per leave request, works for both approve and reject (action from query parameter)
LeaveRoutes.get(
  "/email-action",
  LeaveControllers.EmailApprove,
);

//Leave Reports (with filters) - Admin always has access, HOD needs reports.view permission
LeaveRoutes.get(
  "/Reports",
  CheckEmployeeAuth,
  CheckAdminOrPermission('reports.view'),
  LeaveControllers.LeaveReports,
);

export default LeaveRoutes;


