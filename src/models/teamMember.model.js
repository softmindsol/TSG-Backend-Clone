const teamMemberSchema = new mongoose.Schema(
  {
    agentId: { type: mongoose.Schema.Types.ObjectId, ref: "Agent", required: true },
    name: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    role: { type: String, default: "member" },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    stripeItemId: { type: String, default: null }, // track each member billing item
  },
  { timestamps: true }
);

export default mongoose.model("TeamMember", teamMemberSchema);
