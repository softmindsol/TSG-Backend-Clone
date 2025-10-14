// models/client.model.js
import mongoose from "mongoose";
import crypto from "crypto";

const { Schema } = mongoose;

const DocumentSchema = new Schema(
  {
    url: { type: String, required: true },
    public_id: { type: String, required: true },
    filename: { type: String },
    size: { type: Number },
    format: { type: String },
  },
  { _id: false }
);

const BuyingPreferenceSchema = new Schema(
  {
    budget: {
      min: { type: Number, default: null },
      max: { type: Number, default: null },
    },
    propertyType: { type: String, default: null }, // e.g. "apartment", "villa"
    bedrooms: { type: Number, default: null },
    bathrooms: { type: Number, default: null },
    reasonForMove: { type: String, default: null },
    timeframe: { type: String, default: null }, // e.g. "6-9 months"
    designStyle: { type: String, default: null },
    dealBreakers: { type: [String], default: [] },
    purchaseMethod: { type: String, default: null }, // e.g. "mortgage", "cash"
    preferredLocation: { type: String, default: null },
    quickNotes: { type: String, default: null },
  },
  { _id: false }
);

const ExtraContactSchema = new Schema(
  {
    contactType: { type: String, required: true },
    name: { type: String, required: true },
    companyName: { type: String, default: null },
    email: { type: String, trim: true, lowercase: true, default: null },
    phoneNumber: { type: String, default: null },
    address: { type: String, default: null },
    jobTitle: { type: String, default: null },
    notes: { type: String, default: null },
  },
  { timestamps: true, _id: true }
);

// models/client.model.js  (add these near top with other sub-schemas)

const AmlDocumentSchema = new Schema(
  {
    documentType: {
      type: String,
      enum: ["passport", "id_card", "utility_bill", "property_doc", "other"],
      required: true,
    },
    status: {
      type: String,
      enum: ["approved", "rejected", "pending"],
      default: "pending",
    },
    notes: { type: String, default: null },

    // file metadata (same shape as your DocumentSchema)
    file: {
      url: { type: String, required: true },
      public_id: { type: String, required: true },
      filename: { type: String, default: null },
      size: { type: Number, default: null },
      format: { type: String, default: null },
    },

    uploadedBy: { type: Schema.Types.ObjectId, ref: "Agent", default: null },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true } // each AML doc gets its own _id
);

const VerificationTimelineSchema = new Schema(
  {
    action: { type: String, required: true, trim: true },
    performedBy: { type: Schema.Types.ObjectId, ref: "Agent", required: true },
    notes: { type: String, default: null, trim: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const ClientSchema = new Schema(
  {
    clientCode: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },

    clientName: { type: String, required: true, trim: true },

    clientEmail: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"],
      default: null,
    },

    phoneNumber: { type: String, trim: true, default: null },

    // agent who is responsible for this client
    assignedAgent: {
      type: Schema.Types.ObjectId,
      ref: "Agent",
      required: true,
      index: true,
    },

    clientType: {
      type: String,
      enum: ["individual", "business"],
      default: "individual",
    },
    amlStatus: {
      type: String,
      enum: ["verified", "pending", "flagged", "not_started"],
      default: "not_started",
    },
    amlDocuments: {
      type: [AmlDocumentSchema],
      default: [],
    },

    address: { type: String, default: null }, // Home / Business address
    currentPosition: { type: String, default: null }, // job / role

    extraContacts: { type: [ExtraContactSchema], default: [] },
    verificationTimeline: { type: [VerificationTimelineSchema], default: [] },
    buyingPreference: {
      type: BuyingPreferenceSchema,
      default: () => ({}),
    },

    documents: {
      type: [DocumentSchema],
      default: [],
    },
    journal: [
      {
        note: { type: String, required: true },
        status: {
          type: String,
          enum: ["General", "Follow-up", "Call", "Meeting", "Closed"],
          default: "General",
        },
        createdAt: { type: Date, default: Date.now },
      },
    ],

    // who created the record (usually same as assignedAgent but kept for audit)
    createdBy: { type: Schema.Types.ObjectId, ref: "Agent", default: null },

    // flexible metadata
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

/**
 * Pre-validate hook: generate a clientCode if not provided.
 * Format example: CLT-ks9a3f2b (uses timestamp + random hex to reduce collisions)
 */
ClientSchema.pre("validate", function (next) {
  if (!this.clientCode) {
    const t = Date.now().toString(36);
    const r = crypto.randomBytes(3).toString("hex");
    this.clientCode = `CLT-${t}-${r}`.toUpperCase();
  }
  next();
});

export default mongoose.model("Client", ClientSchema);
