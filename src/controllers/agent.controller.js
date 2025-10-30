import  ApiError  from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";
import Agent from "../models/agent.model.js"
import { sendAgentApprovalEmail } from "../utils/emailService.js";
import bcrypt from "bcryptjs";
// =========================
// Register Agent
// =========================
export const registerAgent = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, phoneNumber, companyName, operatingArea, experience, agentType } = req.body;

  // Check if agent already exists
  const existingAgent = await Agent.findOne({ email });
  if (existingAgent) {
    throw new ApiError(400, "Agent already registered with this email");
  }

  const agent = await Agent.create({
    firstName,
    lastName,
    email,
    phoneNumber,
    companyName,
    operatingArea,
    experience,
    agentType,
    status: "pending",
  });

  return res.status(201).json(new ApiResponse(201, agent, "Registration submitted. Awaiting admin approval."));
});

export const approveAgent = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const agent = await Agent.findById(id);
  if (!agent) throw new ApiError(404, "Agent not found");

  if (agent.status === "approved") {
    throw new ApiError(400, "Agent already approved");
  }

  // Generate random password
  const randomPassword = Math.random().toString(36).slice(-8);
  const hashedPassword = await bcrypt.hash(randomPassword, 10);

  // Update agent fields
  agent.status = "approved";
  agent.password = hashedPassword;

  // If agent is NOT a team member, start a 10-day demo
  if (!agent.isTeamMember) {
    agent.demoStartDate = new Date();
    agent.demoEndDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
  } else {
    // ✅ Inherit captain's subscription and deactivate demo
    const captain = await Agent.findById(agent.captainId);
    if (captain) {
      agent.subscriptionStatus = captain.subscriptionStatus;
      agent.subscriptionType = captain.subscriptionType;
      agent.stripeCustomerId = captain.stripeCustomerId;
      agent.stripeSubscriptionId = captain.stripeSubscriptionId;
      agent.stripePriceId = captain.stripePriceId;
    }
  }

  await agent.save();

  // Send approval email
  await sendAgentApprovalEmail(agent.email, agent.firstName, randomPassword);

  return res
    .status(200)
    .json(
      new ApiResponse(200, agent, "Agent approved successfully. Email sent.")
    );
});


// login agent endpoint

export const loginAgent = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) throw new ApiError(400, "Email and password are required");

  const agent = await Agent.findOne({ email }).select("+password");
  if (!agent) throw new ApiError(404, "Agent not found");

  if (agent.status !== "approved") {
    throw new ApiError(403, "Your account is not approved yet");
  }

  const isMatch = await bcrypt.compare(password, agent.password);
  if (!isMatch) throw new ApiError(401, "Invalid credentials");

  // 🧩 Team Member Logic
  if (agent.isTeamMember && agent.captainId) {
    const captain = await Agent.findById(agent.captainId);

    if (!captain) throw new ApiError(403, "Captain account not found");

    // Block if captain's subscription is inactive
    if (captain.subscriptionStatus !== "active") {
      throw new ApiError(403, "Your captain’s subscription is inactive. Access denied.");
    }

    // ✅ Inherit subscription details
    agent.subscriptionStatus = captain.subscriptionStatus;
    agent.subscriptionType = captain.subscriptionType;
    agent.stripeCustomerId = captain.stripeCustomerId;
    agent.stripeSubscriptionId = captain.stripeSubscriptionId;
    agent.stripePriceId = captain.stripePriceId;
  }

  // 🔒 Normal subscription validation for non-team members
  else {
    const now = new Date();
    const demoEnd = agent.demoEndDate ? new Date(agent.demoEndDate) : null;
    const demoActive = demoEnd && now <= demoEnd;

    if (!demoActive && agent.subscriptionStatus !== "active") {
      const expiryMsg = demoEnd
        ? `Your demo expired on ${demoEnd.toISOString()}.`
        : "Your demo is not active.";
      throw new ApiError(403, `${expiryMsg} Please subscribe to continue.`);
    }
  }

  // 🔑 JWT generation
  if (!process.env.JWT_SECRET) throw new ApiError(500, "JWT secret not configured");
  const expiresIn = process.env.JWT_EXPIRES_IN || "7d";

  const token = jwt.sign({ id: agent._id.toString(), role: "agent" }, process.env.JWT_SECRET, { expiresIn });

  const agentObj = agent.toObject();
  delete agentObj.password;
  delete agentObj.__v;

  return res
    .status(200)
    .json(new ApiResponse(200, { token, expiresIn, agent: agentObj }, "Login successful"));
});


export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword, confirmNewPassword } = req.body;
  console.log("asdsadasdsadsad")

  // 1. Validate input
  if (!currentPassword || !newPassword || !confirmNewPassword) {
    throw new ApiError(400, "All fields are required");
  }

  if (newPassword !== confirmNewPassword) {
    throw new ApiError(400, "New password and confirm password do not match");
  }



  // 2. Get logged-in agent from req.user (set by verifyJWT)
  const agent = await Agent.findById(req.user._id);
  if (!agent) throw new ApiError(404, "Agent not found");

  // 3. Check if current password matches
  const isMatch = await bcrypt.compare(currentPassword, agent.password);
  if (!isMatch) {
    throw new ApiError(401, "Current password is incorrect");
  }

  // 4. Hash and save new password
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  agent.password = hashedPassword;
  await agent.save();

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"));
});