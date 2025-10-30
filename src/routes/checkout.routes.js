import express from "express";
import { verifyJWT } from "../middleware/auth.middleware.js";
import { createCheckoutSession } from "../controllers/checkoutSession.controller.js";


const router = express.Router();

router.post("/create-checkout-session",verifyJWT,  createCheckoutSession);

export default router;
