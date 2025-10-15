import express from "express";
import { deleteReport, generateReport, getClientReports } from "../controllers/report.controller.js";
import { verifyJWT } from "../middleware/auth.middleware.js";

const router = express.Router();

// ✅ Generate a report for a client
router.post("/generate-report/:clientId/:reportType", verifyJWT, generateReport);

// ✅ Get all reports for a client
router.get("/get-client-report/:clientId", verifyJWT, getClientReports);

router.delete("/delete-report/:reportId", verifyJWT, deleteReport);

export default router;
