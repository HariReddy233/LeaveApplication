//External Lib Import
import express from "express";
const SSERoutes = express.Router();

//Internal Lib Import
import SSEControllers from "../controller/SSE/SSEControllers.js";

// SSE Connection endpoint
// Note: We can't use CheckEmployeeAuth middleware here because EventSource doesn't support custom headers
// Instead, we'll verify the token in the controller using query parameter
SSERoutes.get(
  "/events",
  SSEControllers.SSEConnection
);

export default SSERoutes;

