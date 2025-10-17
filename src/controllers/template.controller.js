import { Template } from "../models/template.model.js";
import ApiError from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import Client from "../models/client.model.js";
import Deal from "../models/deal.model.js";
import Agent from "../models/agent.model.js";
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
    .json(
      new ApiResponse(200, template, "Template details fetched successfully")
    );
});

// (Optional) Only for admin use — not frontend
export const createTemplate = asyncHandler(async (req, res) => {
  const {
    category,
    name,
    description,
    subject,
    body,
    placeholders,
    manualFields,
  } = req.body;

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
  console.log("🚀 ~ client:", client);
  if (dealId)
    deal = await Deal.findById(dealId).populate("assignedAgent").lean();
  console.log("🚀 ~ deal:", deal);

  // Prepare data map for replacement
  const data = {
    PropertyAddress: deal?.propertyAddress || "",
    OfferAmount: deal?.offers?.amount || "",
    BuyerPosition: client?.currentPosition || "",
    SellingAgentName: deal?.assignedAgent?.firstName || "",
    AgentName: agent?.firstName || "",
    AgentCompanyName: agent?.companyName || "",
    AgentPhoneNumber: agent?.phoneNumber || "",
    AgentEmail: agent?.email || "",
    SolicitorName: deal?.buyerDetails?.buyerSolicitorName || "",
    ClientFirstName: client?.clientName,
    MortgageBrokerName: deal?.buyerDetails?.mortgageBrokerName || "",
    PropertyCategory: client?.buyingPreference?.propertyType,
    ClientType: client?.clientType,
    ReasonForPurchase: client?.buyingPreference?.reasonForMove,
    BudgetMin: client?.buyingPreference?.budget.min,
    BudgetMax: client?.buyingPreference?.budget.max,
    Timeframe: client?.buyingPreference?.timeframe,
    DesignStyle: client?.buyingPreference?.designStyle,

    

  };

  const filledSubject = replacePlaceholders(template.subject, data);
  const filledBody = replacePlaceholders(template.body, data);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        subject: filledSubject,
        body: filledBody,
        templateName: template.name,
        category: template.category,
      },
      "Template auto-filled successfully"
    )
  );
});


export const getAllTemplates = asyncHandler(async (req, res) => {
  // Fetch all templates and group them by category
  const templates = await Template.aggregate([
    {
      $group: {
        _id: "$category", // Group by category
        templates: {
          $push: {
            _id: "$_id",
            name: "$name",
            description: "$description",
            subject: "$subject",
            body: "$body",
          },
        },
      },
    },
    {
      $project: {
        category: "$_id", // Show category as field
        templates: 1,
        _id: 0, // Exclude the _id field for clarity
      },
    },
    {
      $sort: { category: 1 }, // Sort by category name
    },
  ]);

  return res.status(200).json(new ApiResponse(200, templates, "Templates fetched successfully"));
});