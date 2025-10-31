import Stripe from "stripe";
import Agent from "../models/agent.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import { STRIPE_PRICES } from "../config/stripeConfig.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const handleCheckoutCompleted = async (session) => {
  console.log("🚀 Checkout completed event received");

  try {
    console.log("✅ Checkout completed for:", session.customer_email);

    const agentId = session.metadata?.agentId;
    const planType = session.metadata?.planType; // 👈 Add this line
    if (!agentId) {
      console.warn("⚠️ No agentId found in session metadata");
      return;
    }

    const subscriptionId = session.subscription;
    console.log("🚀 ~ handleCheckoutCompleted ~ subscriptionId:", subscriptionId)
    const customerId = session.customer;

    // ✅ Fetch full subscription details
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    console.log("🚀 ~ handleCheckoutCompleted ~ subscription:", subscription);

    const priceId =
      subscription.items?.data?.[0]?.price?.id || subscription.plan?.id;
    const interval =
      subscription.items?.data?.[0]?.price?.recurring?.interval ||
      subscription.plan?.interval ||
      "month";

    // ✅ Safely determine the billing end date
    const periodEndUnix =
      subscription.current_period_end || subscription.billing_cycle_anchor;
    const billingPeriodEnd = new Date(periodEndUnix * 1000);

    // ✅ Prepare update object
    const updateData = {
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      stripePriceId: priceId,
      subscriptionType: interval === "year" ? "yearly" : "monthly",
      subscriptionStatus: "active",
      billingPeriodEnd: billingPeriodEnd,
      demoStartDate: null,
      demoEndDate: null,
      teamSize: 0, // No sub-agents initially
    };
    console.log("🚀 ~ handleCheckoutCompleted ~ updateData:", updateData)

    // ✅ Auto-upgrade to agency if planType = "agency"
    if (planType === "agency") {
      updateData.agentType = "agency";
      console.log("🏢 Auto-upgraded agentType to 'agency'");
    }

    await Agent.findByIdAndUpdate(agentId, updateData);

    console.log(
      `✅ Agent ${agentId} subscription activated (${interval}) until ${billingPeriodEnd.toDateString()}`
    );
  } catch (err) {
    console.error("❌ Error in handleCheckoutCompleted:", err);
  }
};

const handlePaymentSucceeded = async (invoice) => {
  try {
    const subscriptionId = invoice.subscription;
    console.log(
      "🚀 ~ handlePaymentSucceeded ~ subscriptionId:",
      subscriptionId
    );
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
    console.log(`🔄 Subscription updated: ${subscriptionId} → ${status}`);

    await Agent.findOneAndUpdate(
      { stripeSubscriptionId: subscriptionId },
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

// Update subscription with new seat quantity
const addSubAgentToStripe = async (subscriptionId, teamSize) => {
  try {
    // 1️⃣ Find the agent
    const agent = await Agent.findOne({ stripeSubscriptionId: subscriptionId });
    if (!agent) throw new Error("Agent not found for the given subscriptionId.");

    // 2️⃣ Choose correct price ID
    const addonPrice =
      agent.subscriptionType === "yearly"
        ? STRIPE_PRICES.subAgent.yearly
        : STRIPE_PRICES.subAgent.monthly;

    // 3️⃣ Get current subscription from Stripe
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    // 4️⃣ Find if a sub-agent price item already exists
    const addonItem = subscription.items.data.find(
      (item) => item.price.id === addonPrice
    );

    // 5️⃣ Update quantity if the item already exists
    if (addonItem) {
      await stripe.subscriptionItems.update(addonItem.id, {
        quantity: teamSize - 1, // subtract main agent
        proration_behavior: "create_prorations",
      });

      console.log(
        `✅ Updated existing sub-agent item (${addonItem.id}) with quantity ${
          teamSize - 1
        }.`
      );
    } else {
      // 6️⃣ Add a new sub-agent item cleanly (no spreading existing items)
      await stripe.subscriptions.update(subscriptionId, {
        items: [
          {
            price: addonPrice,
            quantity: teamSize - 1,
          },
        ],
        proration_behavior: "create_prorations",
      });

      console.log(
        `✅ Added new sub-agent price item with quantity ${teamSize - 1}.`
      );
    }

    console.log(
      `Subscription ${subscriptionId} updated with ${teamSize} total members (including main agent).`
    );
  } catch (error) {
    console.error("❌ Error updating subscription with sub-agent:", error);
    throw error;
  }
};


const addSubAgent = async (agentId) => {
  const agent = await Agent.findById(agentId);

  if (agent.agentType === "agency") {
    const newTeamSize = agent.teamSize + 1;

    // Update team size in DB
    agent.teamSize = newTeamSize;
    await agent.save();

    // Update subscription with new team size
    await addSubAgentToStripe(agent.stripeSubscriptionId, newTeamSize);
  }
};


export const changePlan = asyncHandler(async (req, res) => {
  const { agentId, newPlanType, billingInterval } = req.body;

  if (!agentId || !newPlanType || !billingInterval) {
    throw new ApiError(400, "agentId, newPlanType, and billingInterval are required");
  }

  // Step 1: Find the agent (captain)
  const agent = await Agent.findById(agentId);
  if (!agent) throw new ApiError(404, "Agent not found");

  if (!agent.stripeSubscriptionId) {
    throw new ApiError(400, "Agent does not have an active Stripe subscription");
  }

  // Step 2: Get the new Stripe price ID
  const newPriceId = STRIPE_PRICES?.[newPlanType]?.[billingInterval];
  if (!newPriceId) {
    throw new ApiError(400, "Invalid newPlanType or billingInterval");
  }

  // Step 3: Retrieve current subscription
  const subscription = await stripe.subscriptions.retrieve(agent.stripeSubscriptionId);
  const currentItemId = subscription.items.data[0].id;

  // Step 4: Update Stripe subscription with new plan
  const updatedSubscription = await stripe.subscriptions.update(agent.stripeSubscriptionId, {
    items: [
      {
        id: currentItemId,
        price: newPriceId,
      },
    ],
    proration_behavior: "create_prorations", // Charge or credit difference immediately
  });

  // Step 5: Update agent record in MongoDB
  agent.stripePriceId = newPriceId;
  agent.subscriptionType = billingInterval === "yearly" ? "yearly" : "monthly";
  agent.agentType = newPlanType === "team" ? "agency" : "individual";
  await agent.save();

  // ✅ Step 6: If upgraded to "team", sync team seats and sub-agent subscriptions
  if (newPlanType === "team") {
    try {
      // 🧠 Get all approved team members of this captain
      const teamMembers = await Agent.find({
        captainId: agent._id,
        isTeamMember: true,
        status: "approved",
      });

      const teamSize = teamMembers.length + 1; // captain + members

      // Sync seat count on Stripe
      await addSubAgentToStripe(agent.stripeSubscriptionId, teamSize);

      // ✅ Also propagate the subscription data to all team members
      await Agent.updateMany(
        { captainId: agent._id, isTeamMember: true },
        {
          $set: {
            subscriptionStatus: "active",
            subscriptionType: agent.subscriptionType,
            stripeCustomerId: agent.stripeCustomerId,
            stripeSubscriptionId: agent.stripeSubscriptionId,
            stripePriceId: agent.stripePriceId,
          },
        }
      );

      console.log(`✅ Synced ${teamMembers.length} sub-agents to new plan`);
    } catch (err) {
      console.error("Error syncing team members after plan change:", err.message);
      // Do not block response
    }
  }
  if (newPlanType === "individual") {
  const memberCount = await Agent.countDocuments({ captainId: agent._id, isTeamMember: true });
  if (memberCount > 0) {
    throw new ApiError(400, "You must remove all team members before switching to an individual plan");
  }
}


  // Step 7: Respond success
  return res.status(200).json(
    new ApiResponse(200, {
      message: `Subscription changed to ${newPlanType} (${billingInterval}) successfully`,
      subscription: updatedSubscription,
    })
  );
});



export { addSubAgent, addSubAgentToStripe };
