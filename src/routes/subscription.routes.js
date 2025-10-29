import express from 'express';
import { handleSubscriptionSuccess } from '../controllers/subscription.controller.js';

const router = express.Router();

router.post('/webhook', handleSubscriptionSuccess);

export default router;