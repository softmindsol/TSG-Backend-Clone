import express from "express";

import { verifyJWT, verifyAdminJWT } from "../../middleware/auth.middleware.js";
import { deleteAgentById, getAgentPaymentInfo, getAgents, loginAdmin, rejectAgent } from "../../controllers/adminControllers/admin.controller.js";
import { approveAgent } from "../../controllers/agent.controller.js";

const router = express.Router();

router.post("/login", loginAdmin);

router.get("/agents", verifyAdminJWT, getAgents);

router.delete("/delete-agent/:id", verifyAdminJWT, deleteAgentById);

router.patch("/approve-agent/:id", verifyAdminJWT, approveAgent);

router.delete("/reject-agent/:id", verifyAdminJWT, rejectAgent);

router.get("/agent/payment-info/:id", verifyAdminJWT, getAgentPaymentInfo);

export default router;