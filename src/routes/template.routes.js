import express from "express";
import {
  getTemplatesByCategory,
  getTemplateById,
  createTemplate,
  fillTemplate,
} from "../controllers/template.controller.js";
import { verifyJWT } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/get-template-category", verifyJWT,  getTemplatesByCategory);
router.get("/get-template-id/:id",verifyJWT,  getTemplateById);

// optional: Admin only
router.post("/create", createTemplate);

router.post("/fill/:id", verifyJWT, fillTemplate);

export default router;
