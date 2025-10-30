import Stripe from "stripe";

import Agent from "../models/agent.model.js"

import { STRIPE_PRICES } from "../config/stripeConfig.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const createCheckoutSession = asyncHandler(async (req, res) => {
  const { agentId, planType, billingInterval } = req.body;

  if (!agentId || !planType || !billingInterval) {
    throw new ApiError(
      400,
      "agentId, planType, and billingInterval are required"
    );
  }

  // Find the agent
  const agent = await Agent.findById(agentId);
  if (!agent) {
    throw new ApiError(404, "Agent not found");
  }

  // Get Stripe price ID based on planType and billingInterval
  const priceId = STRIPE_PRICES?.[planType]?.[billingInterval];
  if (!priceId) {
    throw new ApiError(400, "Invalid planType or billingInterval");
  }

  // Create Stripe Customer if not exists
  let stripeCustomerId = agent.stripeCustomerId;
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: agent.email,
      metadata: { agentId: agent._id.toString() },
    });

    stripeCustomerId = customer.id;
    agent.stripeCustomerId = customer.id;
    await agent.save();
  }

  // Create Checkout Session
  const session = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    payment_method_types: ["card"],
    mode: "subscription",
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    metadata: {
      agentId: agent._id.toString(),
      planType,
      billingInterval,
    },
    success_url: `${process.env.FRONTEND_URL}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.FRONTEND_URL}/subscription/cancel`,
  });

  return res
    .status(200)
    .json(
      new ApiResponse(200, { url: session.url }, "Checkout session created")
    );
});
