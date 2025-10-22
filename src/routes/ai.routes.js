import express from "express";
import { verifyJWT } from "../middleware/auth.middleware.js";
import {
  deleteSession,
  getSession,
  listSessions,
  sendMessage,
  startSession,
} from "../controllers/ai.controllers.js";

const router = express.Router();

router.post("/start", verifyJWT, startSession);
router.get("/history", verifyJWT, listSessions);
router.get("/history/:sessionId", verifyJWT, getSession);
router.delete("/:sessionId", verifyJWT, deleteSession);
router.post("/message", verifyJWT, sendMessage);

export default router;
