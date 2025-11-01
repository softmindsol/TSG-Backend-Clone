
import Agent from "../models/agent.model.js";
import { sendSubAgentInviteEmail } from "../utils/emailService.js";
import { addSubAgentToStripe } from "./subscription.controller.js";


// Controller to add a sub-agent (team member)
export const addTeamMember = async (req, res) => {
  try {
    const { agentId, newSubAgent } = req.body; // new sub-agent details (name, email, etc.)

    // Step 1: Find the main agent (captain)
    const captain = await Agent.findById(agentId);
    if (!captain || captain.agentType !== "agency") {
      return res.status(400).json({ error: "Only agencies can add team members" });
    }

    // Step 2: Check if sub-agent email already exists
    const existingAgent = await Agent.findOne({ email: newSubAgent.email });
    if (existingAgent) {
      return res.status(400).json({ error: "Email already exists as an agent" });
    }

    // Step 3: Create new team member (Agent)
    const teamMember = new Agent({
      ...newSubAgent, // name, email, etc.
      isTeamMember: true,
      captainId: captain._id,
      agentType: "individual",
      subscriptionStatus: "active", // ✅ inherits captain’s active subscription
      stripeCustomerId: captain.stripeCustomerId,
      stripeSubscriptionId: captain.stripeSubscriptionId,
      stripePriceId: captain.stripePriceId,
      subscriptionType: captain.subscriptionType,
      status: "pending", // admin will approve
    });

    await teamMember.save();

    // Step 4: Increase team size for the captain
    captain.teamSize += 1;
    await captain.save();

    // Step 5: Update Stripe subscription to include sub-agent seats
    await addSubAgentToStripe(captain.stripeSubscriptionId, captain.teamSize);

    // Step 6: Send email invite (optional)
     await sendSubAgentInviteEmail(newSubAgent.email, captain.firstName || captain.name, newSubAgent.name);


    // Step 7: Respond with success
    return res.status(200).json({
      success: true,
      message: "Sub-agent added successfully",
      teamSize: captain.teamSize,
      teamMemberId: teamMember._id,
    });
  } catch (error) {
    console.error("Error adding sub-agent:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};


export const getTeamMembers = async (req, res) => {
  try {
    const { captainId } = req.params;

    // Verify captain exists
    const captain = await Agent.findById(captainId);
    console.log("🚀 ~ getTeamMembers ~ captain:", captain)
    if (!captain || captain.agentType !== "agency") {
      return res.status(400).json({ error: "Invalid captain or not an agency" });
    }

    // Get all team members linked to captain
    const teamMembers = await Agent.find({ captainId }).select("-password"); // exclude password

    return res.status(200).json({
      success: true,
      teamSize: teamMembers.length,
      teamMembers,
    });
  } catch (error) {
    console.error("Error fetching team members:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};


export const deleteTeamMember = async (req, res) => {
  try {
    const { memberId } = req.params;

    // Step 1: Find the team member
    const member = await Agent.findById(memberId);
    if (!member || !member.isTeamMember) {
      return res.status(404).json({ error: "Team member not found" });
    }

    // Step 2: Find captain
    const captain = await Agent.findById(member.captainId);
    if (!captain) {
      return res.status(400).json({ error: "Captain not found" });
    }

    // Step 3: Delete team member
    await member.deleteOne();

    // Step 4: Decrease team size & update Stripe
    captain.teamSize -= 1;
    await captain.save();

    await addSubAgentToStripe(captain.stripeSubscriptionId, captain.teamSize);

    return res.status(200).json({
      success: true,
      message: "Team member deleted successfully",
      updatedTeamSize: captain.teamSize,
    });
  } catch (error) {
    console.error("Error deleting team member:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const getTeamMemberDetails = async (req, res) => {
  try {
    const { memberId } = req.params;
    console.log("🚀 ~ getTeamMemberDetails ~ memberId:", memberId)

    const member = await Agent.findById(memberId).select("-password");
    console.log("🚀 ~ getTeamMemberDetails ~ member:", member)
    if (!member || !member.isTeamMember) {
      return res.status(404).json({ error: "Team member not found" });
    }

    return res.status(200).json({
      success: true,
      member,
    });
  } catch (error) {
    console.error("Error fetching team member details:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

