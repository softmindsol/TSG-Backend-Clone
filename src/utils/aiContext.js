import Client from "../models/client.model.js";
import Deal from "../models/deal.model.js"
import {Report} from "../models/report.model.js"
import {Document} from "../models/document.model.js"
export async function getClientContext(agentId, clientId) {
  if (!clientId) return "";

  // Pull only what we need (saves tokens + bandwidth)
  const client = await Client.findOne(
    { _id: clientId, assignedAgent: agentId },
    "clientName amlStatus currentPosition searchArea buyingPreference " +
      "budgetMin budgetMax" // if you still keep these legacy fields
  ).lean();
  if (!client) return ""; // not owned or not found

  // Convenience accessors
  const bp = client.buyingPreference || {};
  const fmt = (v) => (v === null || v === undefined || v === "" ? "N/A" : String(v));
  const fmtList = (arr) =>
    Array.isArray(arr) && arr.length ? arr.filter(Boolean).join(", ") : "N/A";
  const fmtGBP = (n) =>
    typeof n === "number" && !Number.isNaN(n) ? `£${n.toLocaleString()}` : "N/A";
  const dstr = (d) =>
    d ? new Date(d).toLocaleDateString("en-GB", { timeZone: "Asia/Karachi" }) : "N/A";

  // Prefer new buyingPreference budget if present; fall back to legacy
  const budgetMin =
    typeof bp?.budget?.min === "number" ? bp.budget.min : client.budgetMin ?? null;
  const budgetMax =
    typeof bp?.budget?.max === "number" ? bp.budget.max : client.budgetMax ?? null;

  // Deals, Reports, Docs
  const deals = await Deal.find({ client: clientId })
    .select("propertyAddress dealType stage offers.amount updatedAt")
    .sort({ updatedAt: -1 })
    .limit(3)
    .lean();

  const reports = await Report.find({ clientId })
    .select("reportType additionalNotes createdAt")
    .sort({ createdAt: -1 })
    .limit(3)
    .lean();

  const docs = await Document.find({ clientId })
    .select("name category uploadedAt")
    .sort({ uploadedAt: -1 })
    .limit(5)
    .lean();

  const dealLines = deals
    .map((d) => {
      const offer = d?.offers?.amount ? ` | offer: £${Number(d.offers.amount).toLocaleString()}` : "";
      return `• ${fmt(d.propertyAddress)} | ${fmt(d.dealType)} | stage: ${fmt(d.stage)}${offer}`;
    })
    .join("\n");

  const reportLines = reports
    .map((r) => `• ${fmt(r.reportType)} (${dstr(r.createdAt)})`)
    .join("\n");

  const docLines = docs
    .map((d) => `• ${fmt(d.name)} [${fmt(d.category)}] (${dstr(d.uploadedAt)})`)
    .join("\n");

  // Buying Preference summary (null-safe)
  const buyingPrefBlock = [
    `Budget: ${fmtGBP(budgetMin)} – ${fmtGBP(budgetMax)}`,
    `Property Type: ${fmt(bp.propertyType)}`,
    `Beds/Baths: ${bp.bedrooms ?? "N/A"}/${bp.bathrooms ?? "N/A"}`,
    `Purchase Method: ${fmt(bp.purchaseMethod)}`,
    `Timeframe: ${fmt(bp.timeframe)}`,
    `Design Style: ${fmt(bp.designStyle)}`,
    `Preferred Location: ${fmt(bp.preferredLocation || client.searchArea)}`,
    `Must-Haves: ${fmtList(bp.mustHaves)}`,
    `Avoids: ${fmtList(bp.avoids)}`,
    `Quick Notes: ${fmt(bp.quickNotes)}`
  ].join("\n");

  return `
TSG CONTEXT (use only if relevant)

Client: ${fmt(client.clientName)}
AML Status: ${fmt(client.amlStatus)}
Current Position: ${fmt(client.currentPosition)}

Buying Preferences:
${buyingPrefBlock}

Recent Deals:
${dealLines || "• none"}

Recent Reports:
${reportLines || "• none"}

Recent Documents:
${docLines || "• none"}

Guidance:
- Ground answers in this context when relevant.
- If data is missing, say so and suggest next steps.
- Be concise; do not invent facts.
  `.trim();
}

