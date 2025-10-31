import Stripe from "stripe";
import Agent from "../../models/agent.model.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import ApiError from "../../utils/ApiError.js";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Controller to get all registration requests for admin approval
export const getAllAgentRequests = asyncHandler(async (req, res) => {
  // Find all agents whose status is 'pending'
  const agentRequests = await Agent.find({ status: "pending" });

  if (!agentRequests || agentRequests.length === 0) {
    return res
      .status(404)
      .json(
        new ApiResponse(404, null, "No pending registration requests found.")
      );
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        agentRequests,
        "Pending registration requests fetched successfully."
      )
    );
});

export const getApprovedAgents = asyncHandler(async (req, res) => {
  const approvedAgents = await Agent.find({ status: "approved" });

  if (!approvedAgents || approvedAgents.length === 0) {
    return res
      .status(404)
      .json(new ApiResponse(404, null, "No approved agents found."));
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        approvedAgents,
        "Approved agents fetched successfully."
      )
    );
});

export const deleteAgentById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const agent = await Agent.findById(id);
  if (!agent) {
    return res.status(404).json(new ApiResponse(404, null, "Agent not found."));
  }

  await agent.deleteOne();

  return res
    .status(200)
    .json(new ApiResponse(200, null, "Agent deleted successfully."));
});

export const rejectAgent = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const agent = await Agent.findById(id);
  if (!agent) throw new ApiError(404, "Agent not found");

  if (agent.status === "approved") {
    throw new ApiError(400, "Cannot reject an already approved agent");
  }

  // Optionally: send rejection email before deleting
  // await sendAgentRejectionEmail(agent.email, agent.firstName);

  await Agent.findByIdAndDelete(id);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        null,
        "Agent request rejected and deleted successfully."
      )
    );
});

// payment info

export const getAgentPaymentInfo = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // 1️⃣ Find agent in DB
  const agent = await Agent.findById(id);
  console.log("🚀 ~ agent:", agent)
  if (!agent) throw new ApiError(404, "Agent not found");
  if (!agent.stripeSubscriptionId)
    throw new ApiError(400, "Agent has no active Stripe subscription");

  // 2️⃣ Fetch subscription from Stripe
  console.log("Testing00")

  const subscription = await stripe.subscriptions.retrieve(
    agent.stripeSubscriptionId
  );
  console.log("Testing")
  const invoices = await stripe.invoices.list({
    customer: agent.stripeCustomerId,
    limit: 20, // show latest 20 invoices
  });

  // 3️⃣ Calculate total paid
  const totalPaid =
    invoices.data
      .filter((inv) => inv.status === "paid")
      .reduce((sum, inv) => sum + inv.amount_paid, 0) / 100; // convert from cents

  // 4️⃣ Determine subscription details
  const subscriptionStart = new Date(subscription.start_date * 1000);
  const nextPaymentDate = new Date(subscription.current_period_end * 1000);
  const monthsActive = Math.ceil(
    (Date.now() - subscriptionStart.getTime()) / (30 * 24 * 60 * 60 * 1000)
  );

  // 5️⃣ Map payment history
  const paymentHistory = invoices.data.map((inv) => ({
    id: inv.id,
    amount: inv.amount_paid / 100,
    currency: inv.currency,
    status: inv.status,
    date: new Date(inv.created * 1000),
    period_start: inv.lines.data[0]?.period?.start
      ? new Date(inv.lines.data[0].period.start * 1000)
      : null,
    period_end: inv.lines.data[0]?.period?.end
      ? new Date(inv.lines.data[0].period.end * 1000)
      : null,
  }));

  // 6️⃣ Response data
  const data = {
    cardInfo: {
      subscriptionStatus: agent.subscriptionStatus,
      subscriptionType: agent.subscriptionType,
      totalPaid,
      subscriptionStartDate: subscriptionStart,
      nextPaymentDate,
      monthsActive,
    },
    paymentHistory,
  };

  return res
    .status(200)
    .json(
      new ApiResponse(200, data, "Agent payment info fetched successfully")
    );
});
