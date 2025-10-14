import mongoose from "mongoose";

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
    experience: { type: String }, // background experience
    agentType: { type: String, enum: ["individual", "agency"], required: true },

    // Auth-related
    password: { type: String, default: null }, // set by admin
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },

    // Subscription
    demoStartDate: { type: Date, default: null },
    demoEndDate: { type: Date, default: null },
    subscriptionStatus: {
      type: String,
      enum: ["active", "inactive"],
      default: "inactive",
    },
    subscriptionId: { type: String, default: null }, // Stripe ref if needed
  },
  { timestamps: true }
);

export default mongoose.model("Agent", agentSchema);
