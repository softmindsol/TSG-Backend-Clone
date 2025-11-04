import Stripe from "stripe";
import Agent from "../../models/agent.model.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import ApiError from "../../utils/ApiError.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Admin login
export const loginAdmin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) throw new ApiError(400, "Email and password are required");

  const admin = await Agent.findOne({ email, role: "admin" }).select("+password");
  if (!admin) throw new ApiError(404, "Admin not found");

  const isMatch = await bcrypt.compare(password, admin.password);
  if (!isMatch) throw new ApiError(401, "Invalid credentials");

  const token = jwt.sign({ id: admin._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

  return res
    .status(200)
    .json(new ApiResponse(200, { token, admin: { id: admin._id, email: admin.email, name: `${admin.firstName} ${admin.lastName}` } }, "Login successful"));
});

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

// Get agents with status filter
export const getAgents = asyncHandler(async (req, res) => {
  const { status } = req.query;

  // Build query based on status filter
  const query = {};
  if (status) {
    if (status === 'all') {
      // No filter for 'all'
    } else {
      query.status = status;
    }
  } else {
    // Default to pending if no status specified
    query.status = 'pending';
  }

  const agents = await Agent.find(query);

  if (!agents || agents.length === 0) {
    return res
      .status(404)
      .json(new ApiResponse(404, null, `No agents found${status ? ` with status '${status}'` : ''}.`));
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        agents,
        `Agents${status ? ` with status '${status}'` : ''} fetched successfully.`
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

  // 3️⃣ Get monthly rate
  const price = await stripe.prices.retrieve(subscription.items.data[0].price.id);
  const monthlyRate = price.unit_amount / 100; // in dollars

  // 4️⃣ Calculate total paid
  const totalPaid =
    invoices.data
      .filter((inv) => inv.status === "paid")
      .reduce((sum, inv) => sum + inv.amount_paid, 0) / 100; // convert from cents

  // 5️⃣ Determine subscription details
  const subscriptionStart = new Date(subscription.start_date * 1000);
  const nextPaymentDate = new Date(subscription.current_period_end * 1000);
  const monthsActive = Math.ceil(
    (Date.now() - subscriptionStart.getTime()) / (30 * 24 * 60 * 60 * 1000)
  );

  // 6️⃣ Map payment history with method
  const paymentHistory = await Promise.all(
    invoices.data.map(async (inv) => {
      let method = "N/A";
      if (inv.payment_intent) {
        try {
          const paymentIntent = await stripe.paymentIntents.retrieve(inv.payment_intent);
          if (paymentIntent.charges.data.length > 0) {
            method = paymentIntent.charges.data[0].payment_method_details?.type || "card";
          }
        } catch (error) {
          console.log("Error fetching payment method:", error.message);
        }
      }
      return {
        date: new Date(inv.created * 1000),
        amount: inv.amount_paid / 100,
        method,
        status: inv.status,
        invoiceId: inv.id,
      };
    })
  );

  // 7️⃣ Response data
  const data = {
    subscriptionStatus: subscription.status,
    nextPaymentDate,
    totalPaid,
    monthlyRate,
    paymentHistory,
  };

  return res
    .status(200)
    .json(
      new ApiResponse(200, data, "Agent payment info fetched successfully")
    );
});
