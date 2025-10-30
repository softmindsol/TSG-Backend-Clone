import express from "express";

import { verifyJWT } from "../middleware/auth.middleware.js";
import { addTeamMember, deleteTeamMember, getTeamMemberDetails, getTeamMembers } from "../controllers/addTeamMember.controller.js";
const router = express.Router();

// Route to add a sub-agent (team member)
router.post("/add-member", verifyJWT, addTeamMember);

router.get("/get-all-member/:captainId", verifyJWT, getTeamMembers);

router.delete("/delete-member/:memberId", verifyJWT, deleteTeamMember);

router.get("/get-single-member/:memberId", verifyJWT, getTeamMemberDetails);




export default router;
