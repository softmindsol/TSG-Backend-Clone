// src/modules/deals/deal.service.js
import mongoose from "mongoose";
import Deal from "../models/deal.model.js"; // adjust the path to your model
const REQUIRE_COMMISSION_FOR = new Set(["Offer Accepted","Exchange"]);

export async function upsertDealCommissionService({ dealId, agentId, payload }) {
  if (!mongoose.isValidObjectId(dealId)) {
    const err = new Error("Invalid dealId");
    err.status = 400;
    throw err;
  }

  const deal = await Deal.findById(dealId);
  if (!deal) {
    const err = new Error("Deal not found");
    err.status = 404;
    throw err;
  }

  // tenancy guard: only the assigned agent (or admins via your auth) can edit
  if (agentId && String(deal.assignedAgent) !== String(agentId)) {
    const err = new Error("Forbidden: deal not owned by this agent");
    err.status = 403;
    throw err;
  }

  // Apply commission block
  const { engagementType, sourcing, rental, currency = "GBP" } = payload;
  deal.commission = { engagementType, sourcing, rental, currency };

  // Recompute net/vat via model method (also runs in pre('save') if modified)
  deal.recomputeCommission();
  await deal.save();

  // Return lean for smaller payload if you prefer:
  return deal.toObject();
}

export async function updateDealStageService({ dealId, agentId, nextStage }) {
  if (!mongoose.isValidObjectId(dealId)) {
    const err = new Error("Invalid dealId"); err.status = 400; throw err;
  }

  const deal = await Deal.findById(dealId);
  if (!deal) { const e = new Error("Deal not found"); e.status = 404; throw e; }

  // tenancy guard
  if (agentId && String(deal.assignedAgent) !== String(agentId)) {
    const e = new Error("Forbidden: deal not owned by this agent"); e.status = 403; throw e;
  }

  // require commission before these stages
  if (REQUIRE_COMMISSION_FOR.has(nextStage)) {
    const net = Number(deal?.commission?.net || 0);
    if (net <= 0) {
      const e = new Error(`Cannot move to "${nextStage}" without a configured commission`);
      e.status = 400; throw e;
    }
  }

  // idempotent
  if (deal.stage === nextStage) return deal.toObject();

  deal.stage = nextStage;        // pre('save') will refresh stageUpdatedAt
  await deal.save();
  return deal.toObject();
}
