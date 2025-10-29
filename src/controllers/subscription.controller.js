import Stripe from "stripe";
import Agent from "../models/agent.model.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const handleCheckoutCompleted = async (session) => {
  try {
    console.log("✅ Checkout completed for:", session.customer_email);

    const agentId = session.metadata?.agentId;
    if (!agentId) {
      console.warn("⚠️ No agentId found in session metadata");
      return;
    }

    const subscriptionId = session.subscription;
    const customerId = session.customer;

    await Agent.findByIdAndUpdate(agentId, {
      subscriptionId,
      subscriptionStatus: "active",
    });

    console.log(`Agent ${agentId} subscription activated ✅`);
  } catch (err) {
    console.error("❌ Error in handleCheckoutCompleted:", err);
  }
};

const handlePaymentSucceeded = async (invoice) => {
  try {
    const subscriptionId = invoice.subscription;
    const email = invoice.customer_email;
    console.log(`💰 Payment succeeded for ${email}`);

    await Agent.findOneAndUpdate(
      { subscriptionId },
      { subscriptionStatus: "active" }
    );

    console.log(`Subscription ${subscriptionId} marked active ✅`);
  } catch (err) {
    console.error("❌ Error in handlePaymentSucceeded:", err);
  }
};

const handlePaymentFailed = async (invoice) => {
  try {
    const subscriptionId = invoice.subscription;
    const email = invoice.customer_email;
    console.log(`⚠️ Payment failed for ${email}`);

    await Agent.findOneAndUpdate(
      { subscriptionId },
      { subscriptionStatus: "inactive" }
    );

    console.log(`Subscription ${subscriptionId} marked inactive ⚠️`);
  } catch (err) {
    console.error("❌ Error in handlePaymentFailed:", err);
  }
};
const handleSubscriptionUpdated = async (subscription) => {
  try {
    const subscriptionId = subscription.id;
    const status = subscription.status;
    const customerId = subscription.customer;

    console.log(`🔄 Subscription updated: ${subscriptionId} → ${status}`);

    await Agent.findOneAndUpdate(
      { subscriptionId },
      {
        subscriptionStatus: status === "active" ? "active" : "inactive",
      }
    );

    console.log(`Agent subscription updated to ${status} ✅`);
  } catch (err) {
    console.error("❌ Error in handleSubscriptionUpdated:", err);
  }
};

/**
 * 🧨 Fired when subscription is canceled (manually or automatically)
 */
const handleSubscriptionCanceled = async (subscription) => {
  try {
    const subscriptionId = subscription.id;
    console.log(`🧨 Subscription canceled: ${subscriptionId}`);

    await Agent.findOneAndUpdate(
      { subscriptionId },
      { subscriptionStatus: "inactive" }
    );

    console.log(
      `Agent subscription ${subscriptionId} canceled and marked inactive`
    );
  } catch (err) {
    console.error("❌ Error in handleSubscriptionCanceled:", err);
  }
};

export const handleSubscriptionSuccess = async (req, res) => {
  console.log("🚀 Stripe webhook received");

  try {
    const sig = req.headers["stripe-signature"];
    if (!sig) {
      console.log("❌ Missing Stripe signature");
      return res.status(400).send("No Stripe signature found");
    }

    let event;
    try {
      // ⚠️ ensure `req.body` is raw buffer in your route
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
      console.log("✅ Webhook verified successfully");
    } catch (err) {
      console.error("❌ Invalid webhook signature:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object);
        break;

      case "invoice.payment_succeeded":
        await handlePaymentSucceeded(event.data.object);
        break;

      case "invoice.payment_failed":
        await handlePaymentFailed(event.data.object);
        break;

      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionCanceled(event.data.object);
        break;

      default:
        console.log(`⚠️ Unhandled event type: ${event.type}`);
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("❌ Webhook processing error:", error);
    return res.status(500).json({ error: "Webhook handler failed" });
  }
};
