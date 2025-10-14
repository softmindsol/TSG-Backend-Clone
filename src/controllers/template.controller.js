import { Template } from "../models/template.model.js";
import ApiError  from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import Client from "../models/client.model.js";
import Deal from "../models/deal.model.js";
import Agent from "../models/agent.model.js"
import { replacePlaceholders } from "../utils/replacePlaceholders.js";

// ✅ GET /api/templates?category=offer
export const getTemplatesByCategory = asyncHandler(async (req, res) => {
  const { category } = req.query;

  if (!category) throw new ApiError(400, "Category is required");

  const templates = await Template.find({ category }).select(
    "name description category"
  );

  return res
    .status(200)
    .json(new ApiResponse(200, templates, "Templates fetched successfully"));
});

// ✅ GET /api/templates/:id
export const getTemplateById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const template = await Template.findById(id).select("-__v");
  if (!template) throw new ApiError(404, "Template not found");

  return res
    .status(200)
    .json(new ApiResponse(200, template, "Template details fetched successfully"));
});

// (Optional) Only for admin use — not frontend
export const createTemplate = asyncHandler(async (req, res) => {
  const { category, name, description, subject, body, placeholders, manualFields } = req.body;

  if (!category || !name || !subject || !body) {
    throw new ApiError(400, "Category, name, subject, and body are required");
  }

  const newTemplate = await Template.create({
    category,
    name,
    description,
    subject,
    body,
    placeholders,
    manualFields,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, newTemplate, "Template created successfully"));
});

export const fillTemplate = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { clientId, dealId } = req.body;
  const agentId = req.user._id;

  const template = await Template.findById(id);
  if (!template) throw new ApiError(404, "Template not found");

  const agent = await Agent.findById(agentId).lean();
  if (!agent) throw new ApiError(404, "Agent not found");

  let client = null;
  let deal = null;

  if (clientId) client = await Client.findById(clientId).lean();
  if (dealId) deal = await Deal.findById(dealId).lean();

  // Prepare data map for replacement
  const data = {
    PropertyAddress: deal?.propertyAddress || "",
    OfferAmount: deal?.offerAmount || "",
    BuyerPosition: client?.position || "",
    SellingAgentName: deal?.sellingAgentName || "",
    AgentName: agent?.name || "",
    AgentCompanyName: agent?.companyName || "",
    AgentPhoneNumber: agent?.phone || "",
    AgentEmail: agent?.email || "",
  };

  const filledSubject = replacePlaceholders(template.subject, data);
  const filledBody = replacePlaceholders(template.body, data);

  return res.status(200).json(
    new ApiResponse(200, {
      subject: filledSubject,
      body: filledBody,
      templateName: template.name,
      category: template.category,
    }, "Template auto-filled successfully")
  );
});
