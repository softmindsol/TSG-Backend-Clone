import express from "express";
import { verifyJWT } from "../middleware/auth.middleware.js";
import { addAmlDocument, deleteAmlDocument, getAmlDocuments, getVerificationTimeline, updateClientAmlStatus } from "../controllers/aml.controller.js";
import { upload } from "../middleware/multer.middleware.js";


const router = express.Router();

// Update AML status
router.patch("/update-status/:clientId", verifyJWT, updateClientAmlStatus);

// Add AML document (form-data)
router.post("/aml-document/:clientId", verifyJWT, upload.single("file"), addAmlDocument);

// Get AML documents
router.get("/get-aml-documents/:clientId", verifyJWT, getAmlDocuments);

// Delete AML document
router.delete("/delete-aml-document/:clientId/:docId", verifyJWT, deleteAmlDocument);

router.get(
  "/verification-timeline/:clientId",
  verifyJWT,
  getVerificationTimeline
);


export default router;
