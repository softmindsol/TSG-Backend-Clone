import Agent from "../models/agent.model.js";

/**
 * Get full team for an agent (captain + members)
 * Works for both captains and members.
 */
export const getTeamAgents = async (agentId) => {
  const agent = await Agent.findById(agentId);
  if (!agent) throw new Error("Agent not found");

  // If member → get their captain's id
  const captainId = agent.isTeamMember ? agent.captainId : agent._id;

  // Captain + all members
  const team = await Agent.find({
    $or: [{ _id: captainId }, { captainId }],
  }).select("_id firstName lastName email agentType isTeamMember captainId");

  return team;
};

/**
 * Returns true if two agents belong to the same team.
 */
export const isSameTeam = async (agentAId, agentBId) => {
  const [teamA, teamB] = await Promise.all([
    getTeamAgents(agentAId),
    getTeamAgents(agentBId),
  ]);

  const teamAIds = teamA.map((a) => a._id.toString());
  return teamAIds.includes(agentBId.toString());
};
