import { Document } from "../models/document.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { deleteFromCloudinary, uploadOnCloudinary } from "../utils/cloudinary.js";
import { Report } from "../models/report.model.js";

// ✅ Endpoint to upload document
export const uploadDocument = asyncHandler(async (req, res) => {
  const { clientId, category, notes } = req.body; // Get clientId, category, and notes from request body
  const agentId = req.user._id; // Get the agent's ID from the user making the request

  if (!clientId || !category || !req.file) {
    throw new ApiError(400, "Client ID, category, and file are required");
  }

  // Upload the document to Cloudinary (or any other file storage service)
  const uploaded = await uploadOnCloudinary(req.file.path);
  if (!uploaded?.secure_url) {
    throw new ApiError(500, "File upload failed");
  }

  // Create the document object
  const document = new Document({
    name: req.file.originalname, // Store the original file name
    clientId,
    category,
    file: {
      url: uploaded.secure_url, // URL of the uploaded file
      public_id: uploaded.public_id, // Public ID for the file (Cloudinary)
      filename: req.file.originalname, // File name
      size: req.file.size, // File size
    },
    notes: notes || "", // Store any notes if provided
    uploadedBy: agentId, // Store the agent who uploaded the document
  });

  // Save the document in the database
  await document.save();

  return res.status(201).json(
    new ApiResponse(201, document, "Document uploaded successfully")
  );
});

export const getAllDocumentsAndReports = asyncHandler(async (req, res) => {
  // Fetch all uploaded documents
  const documents = await Document.find()
    .populate("clientId", "clientName")
    .populate("category", "categoryName");

  // Fetch all reports
  const reports = await Report.find()
    .populate("clientId", "clientName")
    .populate("generatedBy", "firstName");

  return res.status(200).json(
    new ApiResponse(200, { documents, reports }, "Documents and reports fetched successfully")
  );
});

export const deleteDocument = asyncHandler(async (req, res) => {
  const { documentId } = req.params; // Get document ID from params
  const agentId = req.user._id; // Get the agent's ID from the logged-in user

  if (!documentId) {
    throw new ApiError(400, "Document ID is required");
  }

  // Find the document by ID
  const document = await Document.findById(documentId);
  if (!document) {
    throw new ApiError(404, "Document not found");
  }

  // Check if the agent who uploaded the document is the one deleting it
  if (String(document.uploadedBy) !== String(agentId)) {
    throw new ApiError(403, "You are not authorized to delete this document");
  }

  // If the document has an associated file in Cloudinary, delete it from Cloudinary
  if (document.file?.public_id) {
    try {
      await deleteFromCloudinary(document.file.public_id);
    } catch (err) {
      console.error("⚠️ Cloudinary delete failed", err);
    }
  }

  // Delete the document from the database
  await Document.findByIdAndDelete(documentId);

  return res.status(200).json(
    new ApiResponse(200, { documentId }, "Document deleted successfully")
  );
});