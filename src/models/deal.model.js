// models/deal.model.js
import mongoose from "mongoose";

const { Schema } = mongoose;
import { COMMISSION_ENGAGEMENTS, COMMISSION_TYPES } from "./client.model.js";
// ===== Subschemas placeholders =====

// Key Dates



const KeyDatesSchema = new Schema(
  {
    targetExchangeDate: { type: Date, default: null },
    targetCompletionDate: { type: Date, default: null },
  },
  { _id: false }
);

// Buyer Details
const BuyerDetailsSchema = new Schema(
  {
    // 1️⃣ Linked Clients (multiple clients can be linked to this deal)
    linkedClients: [{ type: Schema.Types.ObjectId, ref: "Client" }],

    // 2️⃣ Buyer’s Solicitor Info
    buyerSolicitorName: { type: String, default: null },
    buyerSolicitorFirm: { type: String, default: null },
    buyerEmailAddress: { type: String, default: null },
    buyerPhoneNumber: { type: String, default: null },

    // 3️⃣ Mortgage Broker Info
    mortgageBrokerName: { type: String, default: null },
    mortgageBrokerFirm: { type: String, default: null },
    mortgageEmailAddress: { type: String, default: null },
    mortgagePhoneNumber: { type: String, default: null },

    // 4️⃣ Lender
    lender: { type: String, default: null },
  },
  { _id: false }
);

// Seller Details
const SellerDetailsSchema = new Schema(
  {
    // 1️⃣ Vendor / Seller Info
    vendorsName: { type: String, default: null },
    vendorsEstateAgentName: { type: String, default: null },
    vendorsEstateAgentFirm: { type: String, default: null },
    vendorsEmailAddress: { type: String, default: null },
    vendorsPhoneNumber: { type: String, default: null },

    // 2️⃣ Seller’s Solicitor Info
    sellersSolicitorName: { type: String, default: null },
    sellersSolicitorFirm: { type: String, default: null },
    sellersSolicitorEmail: { type: String, default: null },
    sellersSolicitorPhoneNumber: { type: String, default: null },

    // 3️⃣ Other Stakeholders
    otherStakeholders: { type: String, default: null },
  },
  { _id: false }
);

// Property Details
const PropertyDetailsSchema = new Schema(
  {
    guidePrice: { type: Number, default: null }, // Guide / Asking Price (£)
    portalLink: { type: String, default: null },
    propertyAddress: { type: String, default: null },
    propertyType: { type: String, default: null }, // e.g. Apartment, Villa
    tenure: { type: String, default: null }, // e.g. Freehold, Leasehold
    designStyle: { type: String, default: null }, // e.g. Modern, Classic
    bedrooms: { type: Number, default: null },
    bathrooms: { type: Number, default: null },
    parkingSpaces: { type: Number, default: null },
    epcRating: { type: String, default: null },
    listedBuilding: { type: Boolean, default: false },
    conservationArea: { type: Boolean, default: false },

    // 🧾 Leasehold Details (optional)
    leaseTerm: { type: String, default: null },
    groundRent: { type: String, default: null },
    serviceCharge: { type: String, default: null },
    reviewClauses: { type: String, default: null },

    // 🧩 Other
    titleReference: { type: String, default: null },
    chainPosition: { type: String, default: null },
    chainNotes: { type: String, default: null },
  },
  { _id: false }
);

// Offers
const OffersSchema = new Schema(
  {
    offerNumber: {
      type: String,
      required: true,
      unique: true,
      default: () =>
        `OFF-${new Date()
          .toISOString()
          .slice(0, 10)
          .replace(/-/g, "")}-${Math.floor(10000 + Math.random() * 90000)}`,
    },
    date: {
      type: Date,
      default: null,
    },
    amount: {
      type: Number,
      default: null,
    },
    conditions: {
      type: String,
    },
    expiryDate: {
      type: Date,
    },
    proofOfFundsAttached: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["Pending", "Accepted", "Rejected", "Withdrawn"],
      default: "Pending",
    },
    currentPosition: {
      type: String,
    },
  },
  { timestamps: true }
);

// Quick Notes
const QuickNotesSchema = new Schema(
  {
    notes: { type: String, default: null },
  },
  { _id: false }
);

// Documents
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

// Financial Details
const FinancialDetailsSchema = new Schema(
  {
    agreedPrice: { type: Number, default: null },
    estimatedSDLT: { type: Number, default: null }, // Stamp Duty Land Tax
  },
  { _id: false, timestamps: true }
);

// Due Diligence & Surveys
const DueDiligenceSchema = new Schema(
  {
    ricsSurvey: { type: Boolean, default: false },
    searchesLocalAuthority: { type: Boolean, default: false },
    titleReview: { type: Boolean, default: false },
    planning: { type: Boolean, default: false },
    epcCertificate: { type: Boolean, default: false },
    defects: { type: Boolean, default: false },
    insuranceConsiderations: { type: Boolean, default: false },
  },
  { _id: false }
);

// Conveyancing Milestones
// In your Deal model
const ConveyancingMilestonesSchema = new Schema(
  {
    milestone: { type: String, required: true }, // e.g. "Contracts Exchanged", "Searches Completed"
    status: {
      type: String,
      enum: ["pending", "in-progress", "completed"],
      default: "pending",
    },
    ownerName: { type: String, default: null },
    date: { type: Date, default: null },
    file: {
      url: { type: String, default: null },
      public_id: { type: String, default: null },
      filename: { type: String, default: null },
      size: { type: Number, default: null },
      format: { type: String, default: null },
    },
    notes: { type: String, default: null },
  },
  { _id: false }
);

// Optional Milestones
const OptionalMilestonesSchema = new Schema(
  {
    milestone: { type: String, default: null },
    status: { type: String, default: null },
    ownerName: { type: String, default: null },
    date: { type: Date, default: null },
    file: {
      url: { type: String, default: null },
      public_id: { type: String, default: null },
      filename: { type: String, default: null },
      size: { type: Number, default: null },
      format: { type: String, default: null },
    },
    notes: { type: String, default: null },
  },
  { _id: false, timestamps: true }
);

const DealTrackerSchema = new Schema({
  stage: {
    type: String,
    enum: [
      "Discovery",
      "Viewings",
      "Offer Mode",
      "Offer Accepted",
      "Exchange",
      "Completion",
    ],
    default: "Discovery",
  },
  updatedAt: { type: Date, default: Date.now },
});

const CommissionSettingsSnapshotSchema = new Schema(
  {
    engagementType: { type: String, enum: COMMISSION_ENGAGEMENTS },
    commissionType: { type: String, enum: COMMISSION_TYPES },
    ratePct: { type: Number, default: null },
    fixedFee: { type: Number, default: null },
  },
  { _id: false }
);

const CommissionComputedSchema = new Schema(
  {
    net: { type: Number, default: 0 }, // excludes VAT
    vat: { type: Number, default: 0 }, // 20% of net (configurable later)
    currency: { type: String, default: "GBP" },

    source: {
      offerId: { type: Schema.Types.ObjectId, default: null }, // optional if offers ever become an array
      offerAmount: { type: Number, default: 0 },
      settingsSnapshot: {
        type: CommissionSettingsSnapshotSchema,
        default: undefined,
      },
      computedAt: { type: Date, default: null },
    },
  },
  { _id: false }
);

// ===== Main Deal Schema =====
const DealSchema = new Schema(
  {
    // dealName: { type: String, required: true, trim: true },
    propertyAddress: { type: String, default: null },
    dealType: {
      type: String,
      enum: ["Buyer Rep", "Seller Rep", "Development", "Investment"],
      required: true, // Ensure dealType is always provided
    },
    stage: {
      type: String,
      enum: [
        "Discovery",
        "Viewings",
        "Offer Mode",
        "Offer Accepted",
        "Exchange",
        "Completion",
      ],
      required: true, // Ensure the stage is always provided
    },

    client: { type: Schema.Types.ObjectId, ref: "Client", required: true },
    assignedAgent: {
      type: Schema.Types.ObjectId,
      ref: "Agent",
      required: true,
    },

    keyDates: { type: KeyDatesSchema, default: () => ({}) },
    buyerDetails: { type: BuyerDetailsSchema, default: () => ({}) },
    dealTracker: { type: DealTrackerSchema, default: () => ({}) },
    sellerDetails: { type: SellerDetailsSchema, default: () => ({}) },
    propertyDetails: { type: PropertyDetailsSchema, default: () => ({}) },
    offers: { type: OffersSchema, default: () => ({}) },
    quickNotes: { type: QuickNotesSchema, default: () => ({}) },
    documents: { type: [DocumentSchema], default: [] },
    financialDetails: { type: FinancialDetailsSchema, default: () => ({}) },
    dueDiligence: { type: DueDiligenceSchema, default: () => ({}) },
    conveyancingMilestones: {
      type: [ConveyancingMilestonesSchema],
      default: [],
    },
    optionalMilestones: { type: [OptionalMilestonesSchema], default: [] },
    commissionComputed: {
      type: CommissionComputedSchema,
      default: () => ({}),
    },
    
    stageUpdatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);
DealSchema.index({ assignedAgent: 1, stage: 1, stageUpdatedAt: -1 });
DealSchema.index({ client: 1, createdAt: -1 });

// Recompute commission when commission block changes
// DealSchema.methods.recomputeCommission = function () {
//   const VAT_RATE = 0.2;
//   const c = this.commission || {};
//   let net = 0;

//   if (c.engagementType === "Sourcing") {
//     if (c.sourcing?.commissionType === "Percentage") {
//       const base = Number(c.sourcing?.offerPrice || 0);
//       const rate = Number(c.sourcing?.ratePct || 0) / 100;
//       net = base * rate;
//     } else if (c.sourcing?.commissionType === "Fixed") {
//       net = Number(c.sourcing?.fixedFee || 0);
//     }
//   } else if (c.engagementType === "Rental") {
//     const rent = Number(c.rental?.monthlyRent || 0);
//     const months = Number(c.rental?.months || 0);
//     net = rent * months;
//   }

//   c.net = Math.max(0, Number(net.toFixed(2)));
//   c.vat = Number((c.net * VAT_RATE).toFixed(2));
//   this.commission = c;
// };

DealSchema.pre("save", function (next) {
  // bump stageUpdatedAt when stage changes (used later by dashboard)
  if (this.isModified("stage")) this.stageUpdatedAt = new Date();

  // keep commission in sync
  if (this.isModified("commission")) this.recomputeCommission();
  next();
});

export default mongoose.model("Deal", DealSchema);
