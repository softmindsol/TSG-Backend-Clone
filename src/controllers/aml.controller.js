import Client from "../models/client.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { deleteFromCloudinary, uploadOnCloudinary } from "../utils/cloudinary.js";
import { v2 as cloudinary } from "cloudinary";
import mongoose from "mongoose";

const VALID_AML_STATUSES = ["verified", "pending", "flagged", "not_started"];

export const updateClientAmlStatus = asyncHandler(async (req, res) => {
  const { clientId } = req.params;
  const { amlStatus, notes } = req.body;
  const agentId = req.user._id;

  if (!clientId) throw new ApiError(400, "Client ID is required");
  if (!amlStatus) throw new ApiError(400, "amlStatus is required");
  if (!VALID_AML_STATUSES.includes(amlStatus)) {
    throw new ApiError(400, "Invalid amlStatus value");
  }

  const client = await Client.findById(clientId);
  if (!client) throw new ApiError(404, "Client not found");

  if (String(client.assignedAgent) !== String(agentId)) {
    throw new ApiError(403, "Client is not assigned to you");
  }

  // ✅ Update AML status
  client.amlStatus = amlStatus;
  client.metadata = client.metadata || {};
  client.metadata.amlStatusUpdatedAt = new Date();
  client.metadata.amlStatusUpdatedBy = agentId;

  // ✅ Log the timeline entry
  const readableStatus = amlStatus.replace("_", " ");
  client.verificationTimeline.push({
    action: `Client marked as ${readableStatus}`,
    performedBy: agentId,
    notes: notes || "Status updated manually",
  });

  await client.save();

  // ✅ Fetch the most recent entry with populated agent details
  const populatedClient = await Client.findById(client._id)
    .populate("verificationTimeline.performedBy", "firstName email")
    .select("verificationTimeline amlStatus");
  console.log("🚀 ~ populatedClient:", populatedClient)

  const lastEntry =
    populatedClient.verificationTimeline[
      populatedClient.verificationTimeline.length - 1
    ];

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        clientId: client._id,
        amlStatus: populatedClient.amlStatus,
        lastTimelineEntry: lastEntry,
      },
      "AML status updated and timeline logged successfully"
    )
  );
});


export const addAmlDocument = asyncHandler(async (req, res) => {
  const { clientId } = req.params;
  const agentId = req.user._id;

  if (!clientId) throw new ApiError(400, "Client ID is required");

  const client = await Client.findById(clientId);
  if (!client) throw new ApiError(404, "Client not found");
  if (String(client.assignedAgent) !== String(agentId)) {
    throw new ApiError(403, "Client is not assigned to you");
  }

  // ✅ Validate file
  const file = req.file || (req.files && req.files[0]);
  if (!file) throw new ApiError(400, "Document file is required");

  const { documentType, status = "pending", notes = null } = req.body;
  const allowedDocTypes = ["passport", "id_card", "utility_bill", "property_doc", "other"];
  const allowedStatuses = ["approved", "rejected", "pending"];

  if (!documentType || !allowedDocTypes.includes(documentType)) {
    throw new ApiError(400, `documentType must be one of: ${allowedDocTypes.join(", ")}`);
  }
  if (status && !allowedStatuses.includes(status)) {
    throw new ApiError(400, `status must be one of: ${allowedStatuses.join(", ")}`);
  }

  // ✅ Upload to Cloudinary
  const uploaded = await uploadOnCloudinary(file.path);
  if (!uploaded?.secure_url) throw new ApiError(500, "File upload failed");

  // ✅ Create document object
  const doc = {
    _id: new mongoose.Types.ObjectId(),
    documentType,
    status,
    notes,
    file: {
      url: uploaded.secure_url,
      public_id: uploaded.public_id,
      filename: file.originalname || uploaded.original_filename || null,
      size: file.size || uploaded.bytes || null,
      format: file.mimetype || uploaded.format || null,
    },
    uploadedBy: agentId,
    uploadedAt: new Date(),
  };

  // ✅ Add to AML documents
  client.amlDocuments.push(doc);

  // ✅ Add to verification timeline
  client.verificationTimeline.push({
    action: `Document uploaded: ${documentType} (${status})`,
    performedBy: agentId,
    notes: notes || "Document uploaded via AML module",
  });

  await client.save();

  // ✅ Return populated response with agent name
  const populatedClient = await Client.findById(client._id)
    .populate("verificationTimeline.performedBy", "firstName email")
    .select("verificationTimeline amlDocuments");

  const lastTimelineEntry =
    populatedClient.verificationTimeline[populatedClient.verificationTimeline.length - 1];

  return res.status(201).json(
    new ApiResponse(
      201,
      {
        addedDocument: doc,
        lastTimelineEntry,
      },
      "AML document added and timeline updated successfully"
    )
  );
});


export const getAmlDocuments = asyncHandler(async (req, res) => {
  const { clientId } = req.params;
  const agentId = req.user._id;
  console.log("🚀 ~ agentId:", agentId)

  if (!clientId) throw new ApiError(400, "Client ID is required");

  const client = await Client.findById(clientId).select("amlDocuments amlStatus clientName clientEmail");
  console.log("🚀 ~ client:", client)
  if (!client) throw new ApiError(404, "Client not found");
//   if (String(client.assignedAgent) !== String(agentId)) {
//     throw new ApiError(403, "Client is not assigned to you");
//   }

  return res.status(200).json(new ApiResponse(200, { amlStatus: client.amlStatus, amlDocuments: client.amlDocuments }, "AML documents fetched successfully"));
});

export const deleteAmlDocument = asyncHandler(async (req, res) => {
  const { clientId, docId } = req.params;
  const agentId = req.user._id;

  if (!clientId || !docId) {
    throw new ApiError(400, "Client ID and Document ID are required");
  }

  const client = await Client.findById(clientId);
  if (!client) throw new ApiError(404, "Client not found");

  if (String(client.assignedAgent) !== String(agentId)) {
    throw new ApiError(403, "Client is not assigned to you");
  }

  const subdoc = client.amlDocuments.id(docId);
  if (!subdoc) throw new ApiError(404, "AML document not found");

  // 🧹 Delete Cloudinary file if present
  try {
    if (subdoc.file?.public_id) {
      await deleteFromCloudinary(subdoc.file.public_id);
    }
  } catch (err) {
    console.error("⚠️ Warning: Cloudinary delete failed", err);
  }

  // 🧾 Log timeline event BEFORE deletion
  const noteText = `Deleted document (${subdoc.documentType}) - ${
    subdoc.file?.filename || "unnamed file"
  }`;

  client.verificationTimeline.push({
    action: "AML document deleted",
    performedBy: agentId,
    notes: noteText,
  });

  // ✅ Remove the document from the array
  client.amlDocuments = client.amlDocuments.filter(
    (doc) => doc._id.toString() !== docId
  );

  await client.save();

  // 🧠 Populate the agent info for response
  const populatedClient = await client.populate({
    path: "verificationTimeline.performedBy",
    select: "firstName email",
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        clientId: populatedClient._id,
        docId,
        verificationTimeline: populatedClient.verificationTimeline.slice(-1)[0], // Return latest action
      },
      "AML document deleted successfully and timeline updated"
    )
  );
});


export const getVerificationTimeline = asyncHandler(async (req, res) => {
  const { clientId } = req.params;
  const agentId = req.user._id;

  if (!clientId) throw new ApiError(400, "Client ID is required");

  const client = await Client.findById(clientId)
    .populate({
      path: "verificationTimeline.performedBy",
      select: "firstName email",
    })
    .select("verificationTimeline assignedAgent");

  if (!client) throw new ApiError(404, "Client not found");

  // ensure agent owns this client
  if (String(client.assignedAgent) !== String(agentId)) {
    throw new ApiError(403, "Client is not assigned to you");
  }

  const timeline = client.verificationTimeline || [];

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        timeline,
        timeline.length
          ? "Verification timeline fetched successfully"
          : "No timeline events found"
      )
    );
});

