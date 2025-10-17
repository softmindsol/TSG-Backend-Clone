
import Agent from "../../models/agent.model.js"
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
// Controller to get all registration requests for admin approval
export const getAllAgentRequests = asyncHandler(async (req, res) => {
  // Find all agents whose status is 'pending'
  const agentRequests = await Agent.find({ status: "pending" });

  if (!agentRequests || agentRequests.length === 0) {
    return res.status(404).json(new ApiResponse(404, null, "No pending registration requests found."));
  }

  return res.status(200).json(new ApiResponse(200, agentRequests, "Pending registration requests fetched successfully."));
});
