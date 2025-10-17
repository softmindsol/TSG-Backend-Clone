import express from "express";
import { deleteDocument, getAllDocumentsAndReports, uploadDocument } from "../controllers/document.controller.js";
import { verifyJWT } from "../middleware/auth.middleware.js";
import { upload } from "../middleware/multer.middleware.js";

const router = express.Router();

// Route to upload a document
router.post("/upload", verifyJWT, upload.single("file"), uploadDocument); // Expecting file field as 'file'

router.get("/documents-reports",verifyJWT, getAllDocumentsAndReports);

router.delete("/delete-documents/:documentId", verifyJWT, deleteDocument);

export default router;