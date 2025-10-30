import express from "express";

import { verifyJWT } from "../middleware/auth.middleware.js";
import { addTeamMember, deleteTeamMember, getTeamMembers } from "../controllers/addTeamMember.controller.js";
const router = express.Router();

// Route to add a sub-agent (team member)
router.post("/add-member", verifyJWT, addTeamMember);

router.get("/get-all-member/:id", verifyJWT, getTeamMembers);

router.delete("/delete-member/:id", verifyJWT, deleteTeamMember);



export default router;
