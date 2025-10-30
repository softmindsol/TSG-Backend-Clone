import mongoose from "mongoose";

const { Schema } = mongoose;

const agentSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phoneNumber: { type: String, required: true },
    companyName: { type: String, required: true },
    operatingArea: { type: String, required: true },
    experience: { type: String },
    agentType: { type: String, enum: ["individual", "agency"], required: true },

    // Auth
    password: { type: String, default: null },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },

    // Trial info
    demoStartDate: { type: Date, default: null },
    demoEndDate: { type: Date, default: null },
    // Example schema update
    teamSize: { type: Number, default: 0 }, // Sub-agent count (0 for individual plan)
    isTeamMember: { type: Boolean, default: false }, // true if this user is a sub-agent
    captainId: { type: Schema.Types.ObjectId, ref: "Agent", default: null }, // captain (main agent)

    // Subscription info
    subscriptionStatus: {
      type: String,
      enum: ["active", "inactive", "canceled"],
      default: "inactive",
    },
    subscriptionType: {
      type: String,
      enum: ["monthly", "yearly"],
      default: null,
    },
    stripeCustomerId: { type: String, default: null },
    stripeSubscriptionId: { type: String, default: null },
    stripePriceId: { type: String, default: null },
    billingPeriodEnd: { type: Date, default: null }, // Stripe cycle end date
  },
  { timestamps: true }
);

export default mongoose.model("Agent", agentSchema);
