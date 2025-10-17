import express from "express";

import { verifyJWT } from "../../middleware/auth.middleware.js";
import { getAllAgentRequests } from "../../controllers/adminControllers/admin.controller.js";
import { approveAgent } from "../../controllers/agent.controller.js";

const router = express.Router();

router.get("/agent-requests", getAllAgentRequests);

router.patch("/approve-agent/:id", approveAgent);

export default router;