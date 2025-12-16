//External Lib Import
import express from "express";
const AuthRoutes = express.Router();

//Internal Lib Import
import AuthControllers from "../controller/Auth/AuthControllers.js";

//Login User
AuthRoutes.post("/LoginUser", AuthControllers.LoginUser);

//Register User
AuthRoutes.post("/RegisterUser", AuthControllers.RegisterUser);

//Get Current User
AuthRoutes.get("/Me", AuthControllers.GetCurrentUser);

export default AuthRoutes;
