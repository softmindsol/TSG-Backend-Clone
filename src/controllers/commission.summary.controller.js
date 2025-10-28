import { ApiResponse } from "../utils/ApiResponse.js";
import Deal from "../models/deal.model.js";
import mongoose from "mongoose";

function buildTimeFilter(scope = "month") {
  const now = new Date();
  if (scope === "all") return { $gte: new Date("1970-01-01"), $lte: now };

  const start = new Date(now);
  switch (scope) {
    case "week":    start.setDate(start.getDate() - 7); break;
    case "month":   start.setMonth(start.getMonth() - 1); break;
    case "quarter": start.setMonth(start.getMonth() - 3); break;
    case "year":    start.setFullYear(start.getFullYear() - 1); break;
    default:        start.setMonth(start.getMonth() - 1); // fallback to month
  }
  return { $gte: start, $lte: now };
}

export const commissionSummaryController = async (req, res, next) => {
  try {
    const scope = (req.query.scope || "month").toLowerCase();
    const includeVAT = req.query.vat === "1";
    const agentId = req.user?.agentId || req.user?._id;

    const matchBase = { assignedAgent: new mongoose.Types.ObjectId(agentId) };
    const timeFilter = buildTimeFilter(scope);

    const pipeline = (stage) => ([
      { $match: { ...matchBase, stage, stageUpdatedAt: timeFilter } },
      { $group: { _id: null, net: { $sum: "$commissionComputed.net" }, vat: { $sum: "$commissionComputed.vat" } } },
    ]);

    const [agg] = await Deal.aggregate([
      { $facet: {
        expected: pipeline("Offer Accepted"),
        earned:   pipeline("Exchange"),
      }},
      { $project: {
        expected: { $ifNull: [ { $arrayElemAt: ["$expected", 0] }, { net: 0, vat: 0 } ] },
        earned:   { $ifNull: [ { $arrayElemAt: ["$earned",   0] }, { net: 0, vat: 0 } ] },
      }},
    ]);

    const eNet = agg.expected.net || 0, eVAT = agg.expected.vat || 0;
    const rNet = agg.earned.net   || 0, rVAT = agg.earned.vat   || 0;
    const totals = {
      expected: includeVAT ? eNet + eVAT : eNet,
      earned:   includeVAT ? rNet + rVAT : rNet,
    };

    return res.status(200).json(new ApiResponse(200, {
      scope, includeVAT, totals,
      breakdown: { expected: { net: eNet, vat: eVAT }, earned: { net: rNet, vat: rVAT } },
    }, "Commission summary"));
  } catch (err) { next(err); }
};

// Same logic but scoped to a client
export const clientCommissionSummary = async (req, res, next) => {
  try {
    const { clientId } = req.params;
    const scope = (req.query.scope || "month").toLowerCase();
    const includeVAT = req.query.vat === "1";
    const agentId = req.user?.agentId || req.user?._id;

    const matchBase = {
      assignedAgent: new mongoose.Types.ObjectId(agentId),
      client: new mongoose.Types.ObjectId(clientId),
    };
    const timeFilter = buildTimeFilter(scope);

    const pipeline = (stage) => ([
      { $match: { ...matchBase, stage, stageUpdatedAt: timeFilter } },
      { $group: { _id: null, net: { $sum: "$commissionComputed.net" }, vat: { $sum: "$commissionComputed.vat" } } },
    ]);

    const [agg] = await Deal.aggregate([
      { $facet: {
        expected: pipeline("Offer Accepted"),
        earned:   pipeline("Exchange"),
      }},
      { $project: {
        expected: { $ifNull: [ { $arrayElemAt: ["$expected", 0] }, { net: 0, vat: 0 } ] },
        earned:   { $ifNull: [ { $arrayElemAt: ["$earned",   0] }, { net: 0, vat: 0 } ] },
      }},
    ]);

    const eNet = agg.expected.net || 0, eVAT = agg.expected.vat || 0;
    const rNet = agg.earned.net   || 0, rVAT = agg.earned.vat   || 0;
    const totals = {
      expected: includeVAT ? eNet + eVAT : eNet,
      earned:   includeVAT ? rNet + rVAT : rNet,
    };

    return res.status(200).json(new ApiResponse(200, {
      clientId, scope, includeVAT, totals,
      breakdown: { expected: { net: eNet, vat: eVAT }, earned: { net: rNet, vat: rVAT } },
    }, "Client commission summary"));
  } catch (err) { next(err); }
};