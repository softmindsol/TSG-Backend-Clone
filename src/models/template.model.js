import mongoose from "mongoose";

const templateSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      enum: ["offer", "letter", "report", "fee_proposal"],
      required: true,
    },
    name: {
      type: String,
      required: true, // e.g. "Offer Submission"
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    subject: {
      type: String,
      required: true, // e.g. "Offer Submission – {PropertyAddress}"
    },
    body: {
      type: String,
      required: true, // HTML string with placeholders
    },
    placeholders: [
      {
        type: String,
        trim: true,
      },
    ],
    manualFields: [
      {
        type: String, // e.g. "[Add offer terms here]"
      },
    ],
  },
  { timestamps: true }
);

export const Template = mongoose.model("Template", templateSchema);
