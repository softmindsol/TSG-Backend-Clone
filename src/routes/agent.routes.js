import express from "express";
import {
  registerAgent,
  approveAgent,
  loginAgent,
  changePassword,
} from "../controllers/agent.controller.js";
import { verifyJWT } from "../middleware/auth.middleware.js";

const router = express.Router();
// Agent Registration
router.post("/register-agent", registerAgent);

router.post("/login-agent", loginAgent);

router.post("/change-password", verifyJWT, changePassword);
// Admin Approves Agent


export default router;
