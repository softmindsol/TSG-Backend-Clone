import mongoose from "mongoose";

const documentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true }, // Name of the document
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: "Client", required: true }, // Linked to a specific client
    category: { type: String, enum: ["Contract", "Template", "Report", "ClientUpload"], required: true }, // Category
    file: {
      url: { type: String, required: true }, // File URL after upload
      public_id: { type: String, required: true }, // Public ID for file storage (e.g., Cloudinary)
      filename: { type: String, required: true }, // Filename
      size: { type: Number, required: true }, // File size
    },
    notes: { type: String }, // Optional notes
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Agent", required: true }, // Uploaded by agent
    uploadedAt: { type: Date, default: Date.now }, // Timestamp for when the document was uploaded
  },
  { timestamps: true }
);

export const Document = mongoose.model("Document", documentSchema);
