import express from 'express';
import { changePlan, handleSubscriptionSuccess } from '../controllers/subscription.controller.js';
import { verifyJWT } from '../middleware/auth.middleware.js';

const router = express.Router();

router.post('/webhook', handleSubscriptionSuccess);

router.post('/change-plan', verifyJWT, changePlan);


export default router;