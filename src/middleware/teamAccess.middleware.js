import Client from "../models/client.model.js";
import { getTeamAgents } from "../utils/teamAccess.helper.js";

export const verifyClientAccess = async (req, res, next) => {
  try {
    const currentAgentId = req.user._id;
    const { clientId } = req.params;

    const client = await Client.findById(clientId);
    console.log("🚀 ~ verifyClientAccess ~ client:", client)
    if (!client)
      return res.status(404).json({ error: "Client not found" });

    const team = await getTeamAgents(currentAgentId);
    const teamIds = team.map((a) => a._id.toString());

    if (!teamIds.includes(client.assignedAgent.toString())) {
      return res.status(403).json({ error: "Access denied to this client" });
    }

    next();
  } catch (error) {
    console.error("verifyClientAccess error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
