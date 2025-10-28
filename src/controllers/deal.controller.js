// controllers/deal.controller.js
import Deal from "../models/deal.model.js";
import Client from "../models/client.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import {
  deleteFromCloudinary,
  uploadOnCloudinary,
} from "../utils/cloudinary.js";
import { v2 as cloudinary } from "cloudinary";

import { upsertCommissionSchema } from "../validation/dealCommission.schema.js";
import { recomputeDealCommission, updateDealStageService } from "../utils/deal.service.js";

const getDealPercentage = (stage) => {
  const stagePercentages = {
    Discovery: 0,
    Viewings: 16.67,
    "Offer Mode": 33.33,
    "Offer Accepted": 50,
    Exchange: 83.33,
    Completion: 100,
  };

  return stagePercentages[stage] || 0; // Default to 0% if stage is invalid
};



// =========================
// Create a new deal
// =========================
export const createDeal = asyncHandler(async (req, res) => {
  console.log("testing");
  const { clientId } = req.params;
  const { propertyAddress, dealType, stage } = req.body;

  // Define valid stages
  const validStages = [
    "Discovery",
    "Viewings",
    "Offer Mode",
    "Offer Accepted",
    "Exchange",
    "Completion",
  ];

  // Validate the required fields
  if (!propertyAddress || !dealType || !stage) {
    throw new ApiError(400, "All fields are required");
  }

  // Validate the stage
  if (!validStages.includes(stage)) {
    throw new ApiError(
      400,
      "Invalid deal stage. Valid stages are: Discovery, Viewings, Offer Mode, Offer Accepted, Exchange, Completion"
    );
  }

  // Check if the client exists and is assigned to the agent
  const client = await Client.findOne({
    _id: clientId,
    assignedAgent: req.user._id,
  });

  if (!client)
    throw new ApiError(404, "Client not found or not assigned to you");

  // Create a new deal
  const newDeal = new Deal({
    client: clientId,
    assignedAgent: req.user._id,
    propertyAddress,
    dealType,
    stage,
  });

  // Save the new deal
  await newDeal.save();

  return res
    .status(201)
    .json(new ApiResponse(201, newDeal, "Deal created successfully"));
});

export const deleteDeal = asyncHandler(async (req, res) => {
  try {
    const { dealId } = req.params;

    if (!dealId) throw new ApiError(400, "Deal ID is required");

    // Find the deal belonging to this agent
    const deal = await Deal.findOne({
      _id: dealId,
      assignedAgent: req.user._id,
    });

    if (!deal) throw new ApiError(404, "Deal not found or not assigned to you");

    // 🧹 Gather all Cloudinary public_ids
    const publicIds = [];

    // Documents
    if (deal.documents?.length > 0) {
      deal.documents.forEach((doc) => {
        if (doc.public_id) publicIds.push(doc.public_id);
      });
    }

    // Conveyancing file
    if (deal.conveyancingMilestones?.file?.public_id) {
      publicIds.push(deal.conveyancingMilestones.file.public_id);
    }

    // Optional milestone file
    if (deal.optionalMilestones?.file?.public_id) {
      publicIds.push(deal.optionalMilestones.file.public_id);
    }

    // Delete all files from Cloudinary
    for (const id of publicIds) {
      await deleteFromCloudinary(id);
    }

    // Finally, delete deal from MongoDB
    await Deal.deleteOne({ _id: dealId });

    return res
      .status(200)
      .json(
        new ApiResponse(200, {}, "Deal and related files deleted successfully")
      );
  } catch (error) {
    throw new ApiError(500, error.message || "Error deleting deal");
  }
});

// =========================
// Get All deal
// =========================

// GET /api/deal/by-client/:clientId?vat=0|1
export const getDealsByClient = asyncHandler(async (req, res) => {
  const { clientId } = req.params;
  const includeVAT = req.query.vat === "1"; // default false (agents don’t earn VAT)

  // 1) Guard: client exists & belongs to this agent
  const client = await Client.findOne({
    _id: clientId,
    assignedAgent: req.user._id,
  }).lean();

  if (!client) {
    throw new ApiError(404, "Client not found or not assigned to you");
  }

  // 2) Fetch deals for this client+agent
  const deals = await Deal.find({
    client: clientId,
    assignedAgent: req.user._id,
  })
    .sort({ createdAt: -1 })
    .lean();

  // 3) Map: add commission display + bucket + keep your dealPercentage
  const dealsWithExtras = deals.map((deal) => {
    const dealPercentage = getDealPercentage(deal?.dealTracker?.stage);

    const net = Number(deal?.commission?.net || 0);
    const vat = Number(deal?.commission?.vat || 0);
    const commissionDisplay = Number((includeVAT ? net + vat : net).toFixed(2));

    let bucket = null;
    if (deal.stage === "Offer Accepted") bucket = "Expected";
    else if (deal.stage === "Exchange") bucket = "Earned";

    return {
      ...deal, // already a plain object due to .lean()
      dealPercentage,
      commission: {
        ...(deal.commission || {}),
        display: commissionDisplay, // what you show in UI
      },
      bucket, // "Expected" | "Earned" | null
    };
  });

  return res
    .status(200)
    .json(new ApiResponse(200, dealsWithExtras, "Deals fetched successfully"));
});


// get deal by ID
export const getDealById = asyncHandler(async (req, res) => {
  const { dealId } = req.params;

  const deal = await Deal.findOne({
    _id: dealId,
    assignedAgent: req.user._id,
  }).populate("client", "name email phoneNumber");

  if (!deal) {
    throw new ApiError(404, "Deal not found or not assigned to you");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, deal, "Deal fetched successfully"));
});

// key dates
export const upsertKeyDates = asyncHandler(async (req, res) => {
  const { dealId } = req.params;
  const { targetExchangeDate, targetCompletionDate } = req.body;

  const deal = await Deal.findOne({
    _id: dealId,
    assignedAgent: req.user._id,
  });

  if (!deal) {
    throw new ApiError(404, "Deal not found or not assigned to you");
  }

  // 🧩 Upsert Logic
  deal.keyDates = {
    targetExchangeDate: targetExchangeDate || deal.keyDates.targetExchangeDate,
    targetCompletionDate:
      targetCompletionDate || deal.keyDates.targetCompletionDate,
  };

  await deal.save();

  return res
    .status(200)
    .json(
      new ApiResponse(200, deal.keyDates, "Key dates upserted successfully")
    );
});

// buyer details

export const upsertBuyerSideDetails = asyncHandler(async (req, res) => {
  const { dealId } = req.params;
  const data = req.body;

  const deal = await Deal.findOne({
    _id: dealId,
    assignedAgent: req.user._id,
  });

  if (!deal) throw new ApiError(404, "Deal not found or not assigned to you");

  // 🧩 Merge existing and incoming fields (upsert)
  deal.buyerDetails = {
    ...deal.buyerDetails.toObject(),
    ...data,
  };

  await deal.save();

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        deal.buyerDetails,
        "Buyer side details upserted successfully"
      )
    );
});
// seller Details
export const upsertSellerDetails = asyncHandler(async (req, res) => {
  const { dealId } = req.params;
  const data = req.body;

  const deal = await Deal.findOne({
    _id: dealId,
    assignedAgent: req.user._id,
  });

  if (!deal) throw new ApiError(404, "Deal not found or not assigned to you");

  // 🧩 Merge existing and new data
  deal.sellerDetails = {
    ...deal.sellerDetails.toObject(),
    ...data,
  };

  await deal.save();

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        deal.sellerDetails,
        "Seller details upserted successfully"
      )
    );
});

// property details

export const upsertPropertyDetails = asyncHandler(async (req, res) => {
  const { dealId } = req.params;
  const data = req.body;

  const deal = await Deal.findOne({
    _id: dealId,
    assignedAgent: req.user._id,
  });

  if (!deal) throw new ApiError(404, "Deal not found or not assigned to you");

  // 🧩 Merge data
  deal.propertyDetails = {
    ...deal.propertyDetails.toObject(),
    ...data,
  };

  await deal.save();

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        deal.propertyDetails,
        "Property details upserted successfully"
      )
    );
});

// offers(Property Details)

export const upsertOffer = asyncHandler(async (req, res) => {
  const { dealId } = req.params;
  const patch = req.body;

  const deal = await Deal.findOne({
    _id: dealId,
    assignedAgent: req.user._id, // tenancy
  });
  if (!deal) throw new ApiError(404, "Deal not found or not assigned to you");

  // Merge incoming fields into the single offers subdoc
  deal.offers = {
    ...(deal.offers?.toObject?.() ?? deal.offers ?? {}),
    ...patch,
  };

  await deal.save();

  // Compute/clear commissionComputed based on (client settings + offer Accepted)
  const computed = await recomputeDealCommission({ dealId });

  // Optional: include a quick bucket hint for the UI (Expected/Earned/null)
  let bucket = null;
  if (deal.stage === "Offer Accepted") bucket = "Expected";
  else if (deal.stage === "Exchange") bucket = "Earned";

  return res.status(200).json(
    new ApiResponse(200, {
      offers: deal.offers,
      commissionComputed: computed || null,
      bucket,
    }, "Offer upserted successfully")
  );
});

// quick notes

export const upsertQuickNotes = asyncHandler(async (req, res) => {
  try {
    const { dealId } = req.params;
    const { notes } = req.body;

    if (!notes) {
      throw new ApiError(400, "Notes field is required");
    }

    // 🔍 Find the deal that belongs to the logged-in agent
    const deal = await Deal.findOne({
      _id: dealId,
      assignedAgent: req.user._id,
    });

    if (!deal) throw new ApiError(404, "Deal not found or not assigned to you");

    // ✅ Upsert logic (create or update)
    deal.quickNotes = { notes };

    await deal.save();

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          deal.quickNotes,
          "Quick Notes updated successfully"
        )
      );
  } catch (error) {
    throw new ApiError(500, error.message || "Error updating Quick Notes");
  }
});

// Deal Document

export const uploadDealDocument = asyncHandler(async (req, res) => {
  try {
    const { dealId } = req.params;

    const deal = await Deal.findOne({
      _id: dealId,
      assignedAgent: req.user._id,
    });

    if (!deal) throw new ApiError(404, "Deal not found or not assigned to you");

    if (!req.files || req.files.length === 0) {
      throw new ApiError(400, "No files uploaded");
    }

    const uploadedDocs = [];

    for (const file of req.files) {
      const uploadedDoc = await uploadOnCloudinary(file.path);
      if (uploadedDoc) {
        const docData = {
          url: uploadedDoc.secure_url,
          public_id: uploadedDoc.public_id,
          filename: file.originalname,
          size: file.size,
          format: file.mimetype,
        };
        deal.documents.push(docData);
        uploadedDocs.push(docData);
      }
    }

    await deal.save();

    return res
      .status(200)
      .json(
        new ApiResponse(200, uploadedDocs, "Documents uploaded successfully")
      );
  } catch (error) {
    throw new ApiError(500, error.message || "Error uploading deal documents");
  }
});

//Get all document

export const getDealDocuments = asyncHandler(async (req, res) => {
  try {
    const { dealId } = req.params;

    const deal = await Deal.findOne({
      _id: dealId,
      assignedAgent: req.user._id,
    }).select("documents");

    if (!deal) throw new ApiError(404, "Deal not found or not assigned to you");

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          deal.documents,
          "Deal documents fetched successfully"
        )
      );
  } catch (error) {
    throw new ApiError(500, error.message || "Error fetching deal documents");
  }
});

//delete document

export const deleteDealDocument = asyncHandler(async (req, res) => {
  try {
    const { dealId, publicId } = req.params;

    const deal = await Deal.findOne({
      _id: dealId,
      assignedAgent: req.user._id,
    });

    if (!deal) throw new ApiError(404, "Deal not found or not assigned to you");

    // Remove from Cloudinary
    await cloudinary.uploader.destroy(publicId);

    // Remove from DB
    deal.documents = deal.documents.filter((doc) => doc.public_id !== publicId);

    await deal.save();

    return res
      .status(200)
      .json(
        new ApiResponse(200, deal.documents, "Document deleted successfully")
      );
  } catch (error) {
    throw new ApiError(500, error.message || "Error deleting deal document");
  }
});

// due delgigence

export const upsertDueDiligence = asyncHandler(async (req, res) => {
  try {
    const { dealId } = req.params;
    const updateData = req.body;

    const deal = await Deal.findOne({
      _id: dealId,
      assignedAgent: req.user._id,
    });

    if (!deal) throw new ApiError(404, "Deal not found or not assigned to you");

    // ✅ Update the due diligence fields
    deal.dueDiligence = {
      ...deal.dueDiligence.toObject(),
      ...updateData,
    };

    await deal.save();

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          deal.dueDiligence,
          "Due diligence updated successfully"
        )
      );
  } catch (error) {
    throw new ApiError(500, error.message || "Error updating due diligence");
  }
});

export const upsertConveyancingMilestones = async (req, res, next) => {
  try {
    const { dealId } = req.params;
    const { milestone, status, ownerName, date, notes } = req.body;

    if (!dealId) throw new ApiError(400, "Deal ID is required");

    const deal = await Deal.findById(dealId);
    if (!deal) throw new ApiError(404, "Deal not found");

    // Prepare milestone data
    const milestoneData = {
      milestone,
      status,
      ownerName,
      date,
      notes,
    };

    // If file uploaded, upload to Cloudinary
    if (req.file) {
      const uploadedFile = await uploadOnCloudinary(req.file.path);
      if (!uploadedFile?.secure_url)
        throw new ApiError(500, "File upload failed");

      milestoneData.file = {
        url: uploadedFile.secure_url,
        public_id: uploadedFile.public_id,
        filename: req.file.originalname,
        size: req.file.size,
        format: req.file.mimetype,
      };
    }

    // Upsert conveyancing milestone
    deal.conveyancingMilestones = milestoneData;
    await deal.save();

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          deal.conveyancingMilestones,
          "Conveyancing milestones upserted successfully"
        )
      );
  } catch (error) {
    next(error);
  }
};

export const upsertOptionalMilestones = asyncHandler(async (req, res) => {
  const { dealId } = req.params;
  const { milestone, status, ownerName, date, notes } = req.body;

  if (!dealId) throw new ApiError(400, "Deal ID is required");

  const deal = await Deal.findById(dealId);
  if (!deal) throw new ApiError(404, "Deal not found");

  let milestoneData = {
    milestone,
    status,
    ownerName,
    date,
    notes,
  };

  // 🧱 Handle file upload (if provided)
  if (req.file) {
    const uploadedFile = await uploadOnCloudinary(req.file.path);
    if (uploadedFile) {
      milestoneData.file = {
        url: uploadedFile.secure_url,
        public_id: uploadedFile.public_id,
        filename: req.file.originalname,
        size: req.file.size,
        format: req.file.mimetype,
      };
    }
  }

  // 🧱 Upsert Optional Milestones section
  deal.optionalMilestones = milestoneData;

  await deal.save();

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        deal.optionalMilestones,
        "Optional milestones upserted successfully"
      )
    );
});

export const upsertFinancialDetails = asyncHandler(async (req, res) => {
  try {
    const { dealId } = req.params;
    const { agreedPrice, estimatedSDLT } = req.body;

    if (!dealId) throw new ApiError(400, "Deal ID is required");

    // 🔍 Find the deal
    const deal = await Deal.findById(dealId);
    if (!deal) throw new ApiError(404, "Deal not found");

    // ✅ Upsert logic
    deal.financialDetails = {
      ...deal.financialDetails.toObject(),
      agreedPrice,
      estimatedSDLT,
    };

    await deal.save();

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          deal.financialDetails,
          "Financial details upserted successfully"
        )
      );
  } catch (error) {
    throw new ApiError(
      500,
      error.message || "Error upserting financial details"
    );
  }
});

//deal tracker

export const upsertDealTracker = asyncHandler(async (req, res) => {
  const { dealId } = req.params;
  const { stage, note } = req.body;

  if (!dealId) throw new ApiError(400, "Deal ID is required");
  const validStages = [
    "Discovery",
    "Viewings",
    "Offer Mode",
    "Offer Accepted",
    "Exchange",
    "Completion",
  ];
  if (!stage || !validStages.includes(stage)) {
    throw new ApiError(400, "Invalid or missing stage");
  }
 await recomputeDealCommission({ dealId });

  const updated = await updateDealStageService({
    dealId,
    agentId: req.user?.agentId, // from verifyJWT
    nextStage: stage,
  });

  // keep legacy snapshot in sync (optional but helpful for existing UI)
  const deal = await Deal.findById(dealId);
  deal.dealTracker = {
    stage: updated.stage, // mirror truth
    updatedAt: new Date(), // display for old UI
  };
  await deal.save();

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        deal.dealTracker,
        "Deal tracker (stage) updated successfully"
      )
    );
});

