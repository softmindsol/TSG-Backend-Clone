import express from "express";

import { verifyJWT } from "../../middleware/auth.middleware.js";
import { deleteAgentById, getAgentPaymentInfo, getAllAgentRequests, getApprovedAgents, rejectAgent } from "../../controllers/adminControllers/admin.controller.js";
import { approveAgent } from "../../controllers/agent.controller.js";

const router = express.Router();

router.get("/agent-requests", getAllAgentRequests);

router.get("/get-all-agents", getApprovedAgents);

router.delete("/delete-agent/:id", deleteAgentById);

router.patch("/approve-agent/:id", approveAgent);

router.delete("/reject-agent/:id", rejectAgent);

router.get("/agent/payment-info/:id", getAgentPaymentInfo);

export default router;