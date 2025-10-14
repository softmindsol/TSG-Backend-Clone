// models/event.model.js
import mongoose from "mongoose";

const { Schema } = mongoose;

const ParticipantSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, trim: true, lowercase: true, default: null },
    phone: { type: String, default: null },
    role: { type: String, default: null },
  },
  { _id: false }
);

const EventSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    entryType: {
      type: String,
      enum: ["meeting", "review", "call", "viewing", "other"],
      default: "other",
    },

    // Ownership & links
    agent: { type: Schema.Types.ObjectId, ref: "Agent", required: true, index: true },
    client: { type: Schema.Types.ObjectId, ref: "Client", default: null },
    deal: { type: Schema.Types.ObjectId, ref: "Deal", default: null },

    // Time
    start: { type: Date, required: true, index: true },
    end: { type: Date, required: true },
    allDay: { type: Boolean, default: false },

    address: { type: String, default: null },
    participants: { type: [ParticipantSchema], default: [] },

    notes: { type: String, default: null },
    followUpNotes: { type: String, default: null },

    status: {
      type: String,
      enum: ["scheduled", "completed", "canceled", "no-show"],
      default: "scheduled",
    },

    timeZone: { type: String, default: null }, // optional IANA zone if needed
    color: { type: String, default: null }, // optional UI color
    metadata: { type: Schema.Types.Mixed, default: {} }, // flexible
  },
  { timestamps: true }
);

// Compound index to speed up range queries by agent + start
EventSchema.index({ agent: 1, start: 1 });

export default mongoose.model("Event", EventSchema);
