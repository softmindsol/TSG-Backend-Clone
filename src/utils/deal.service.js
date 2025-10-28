// src/modules/deals/deal.service.js
import mongoose from "mongoose";
import Deal from "../models/deal.model.js"; // adjust the path to your model
import { computeCommissionFrom } from "./commission.js";
const REQUIRE_COMMISSION_FOR = new Set(["Offer Accepted","Exchange"]);
import Client from "../models/client.model.js"
const VALID_STAGES = new Set([
  "Discovery",
  "Viewings",
  "Offer Mode",
  "Offer Accepted",
  "Exchange",
  "Completion",
]);


export async function recomputeDealCommission({ dealId }) {
  const deal = await Deal.findById(dealId).lean();
  if (!deal) return null;

  // Require: client settings + accepted offer with amount
  const client = await Client.findById(deal.client).lean();
  const settings = client?.commissionSettings;
  const offer = deal?.offers;

  const isAccepted = offer?.status === "Accepted" && Number(offer?.amount) > 0;
  if (!settings || !isAccepted) {
    // Clear computed commission if prerequisites aren’t met
    await Deal.findByIdAndUpdate(dealId, { $unset: { commissionComputed: 1 } });
    return null;
  }

  const { net, vat } = computeCommissionFrom(settings, offer.amount);

  const payload = {
    net,
    vat,
    currency: settings.currency || "GBP",
    source: {
      offerId: null, // since you have one offer subdoc
      offerAmount: offer.amount,
      settingsSnapshot: {
        engagementType: settings.engagementType,
        commissionType: settings.commissionType,
        ratePct: settings.ratePct ?? null,
        fixedFee: settings.fixedFee ?? null,
      },
      computedAt: new Date(),
    },
  };

  await Deal.findByIdAndUpdate(dealId, { $set: { commissionComputed: payload } }, { new: true });
  return payload;
}
// src/modules/deals/deal.service.js (same file)
export async function recomputeAllDealsForClient({ clientId }) {
  const client = await Client.findById(clientId).lean();
  if (!client?.commissionSettings) return { matched: 0, modified: 0 };

  const deals = await Deal.find({
    client: clientId,
    "offers.status": "Accepted",
    "offers.amount": { $gt: 0 },
  }).lean();

  if (!deals.length) return { matched: 0, modified: 0 };

  const ops = deals.map((d) => {
    const { net, vat } = computeCommissionFrom(client.commissionSettings, d.offers.amount);
    const payload = {
      net,
      vat,
      currency: client.commissionSettings.currency || "GBP",
      source: {
        offerId: null,
        offerAmount: d.offers.amount,
        settingsSnapshot: {
          engagementType: client.commissionSettings.engagementType,
          commissionType: client.commissionSettings.commissionType,
          ratePct: client.commissionSettings.ratePct ?? null,
          fixedFee: client.commissionSettings.fixedFee ?? null,
        },
        computedAt: new Date(),
      },
    };

    return {
      updateOne: {
        filter: { _id: d._id },
        update: { $set: { commissionComputed: payload } },
      },
    };
  });

  const result = await Deal.bulkWrite(ops, { ordered: false });
  return { matched: deals.length, modified: result?.modifiedCount ?? 0 };
}


export async function updateDealStageService({ dealId, agentId, nextStage }) {
  // 1) Basic checks
  if (!mongoose.isValidObjectId(dealId)) {
    const e = new Error("Invalid dealId"); e.status = 400; throw e;
  }
  if (!nextStage || !VALID_STAGES.has(nextStage)) {
    const e = new Error("Invalid or missing stage"); e.status = 400; throw e;
  }

  // 2) Load deal
  const deal = await Deal.findById(dealId);
  if (!deal) { const e = new Error("Deal not found"); e.status = 404; throw e; }

  // 3) Tenancy guard (agent must own the deal unless you allow admins elsewhere)
  if (agentId && String(deal.assignedAgent) !== String(agentId)) {
    const e = new Error("Forbidden: deal not owned by this agent"); e.status = 403; throw e;
  }

  // 4) Commission guard for stages that require a computed commission
  if (REQUIRE_COMMISSION_FOR.has(nextStage)) {
    const computedNet = Number(deal?.commissionComputed?.net || 0);
    if (computedNet <= 0) {
      const e = new Error(
        `Cannot move to "${nextStage}" without a valid commission. ` +
        `Make sure the deal has an Accepted offer with amount and the client’s commission settings are configured.`
      );
      e.status = 400;
      throw e;
    }
  }

  // 5) Idempotency: if already at the target stage, return as-is
  if (deal.stage === nextStage) {
    return deal.toObject();
  }

  // 6) Update stage + stageUpdatedAt
  deal.stage = nextStage;
  deal.stageUpdatedAt = new Date();

  await deal.save();
  return deal.toObject();
}