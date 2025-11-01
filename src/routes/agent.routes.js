import express from "express";
import {
  registerAgent,
  approveAgent,
  loginAgent,
  changePassword,
  getCurrentAgent,
} from "../controllers/agent.controller.js";
import { verifyJWT } from "../middleware/auth.middleware.js";

const router = express.Router();
// Agent Registration
router.post("/register-agent", registerAgent);

router.post("/login-agent", loginAgent);

router.post("/change-password", verifyJWT, changePassword);

// Get current logged in agent
router.get("/current", verifyJWT, getCurrentAgent);

// Admin Approves Agent


export default router;
