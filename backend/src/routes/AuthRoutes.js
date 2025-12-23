//External Lib Import
import express from "express";
const AuthRoutes = express.Router();

//Internal Lib Import
import AuthControllers from "../controller/Auth/AuthControllers.js";
import { CheckEmployeeAuth } from "../middleware/CheckAuthLogin.js";
import { CheckPermission } from "../middleware/CheckPermission.js";

//Login User
AuthRoutes.post("/LoginUser", AuthControllers.LoginUser);

//Register User (Public - for initial registration)
AuthRoutes.post("/RegisterUser", AuthControllers.RegisterUser);

//Register User (Admin/HOD - requires employee.create permission)
AuthRoutes.post("/RegisterUserWithPermission", 
  CheckEmployeeAuth, 
  CheckPermission('employee.create'),
  AuthControllers.RegisterUser
);

//Get Current User
AuthRoutes.get("/Me", AuthControllers.GetCurrentUser);

//Forgot Password - Request OTP
AuthRoutes.post("/ForgotPassword", AuthControllers.ForgotPassword);

//Reset Password - Verify OTP and Set New Password
AuthRoutes.post("/ResetPassword", AuthControllers.ResetPassword);

//Change Password - For logged-in users (requires authentication)
AuthRoutes.post("/ChangePassword", CheckEmployeeAuth, AuthControllers.ChangePassword);

export default AuthRoutes;
