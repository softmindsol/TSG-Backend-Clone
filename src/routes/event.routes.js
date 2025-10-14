import express from "express";
import { verifyJWT } from "../middleware/auth.middleware.js";

import { upload } from "../middleware/multer.middleware.js";
import { createEvent, deleteEvent, getEventById, getEventsRange, updateEvent } from "../controllers/event.controller.js";

const router = express.Router();
router.post("/create-event", verifyJWT, createEvent);

router.get("/get-event-range", verifyJWT, getEventsRange);

router.get("/get-event/:id", verifyJWT, getEventById);

router.delete("/delete-event/:id", verifyJWT, deleteEvent);

router.put("/update/:id", verifyJWT, updateEvent);





export default router;