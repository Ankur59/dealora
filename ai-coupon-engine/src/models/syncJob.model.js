import { Schema, model } from "mongoose";

const syncJobSchema = new Schema(
  {
    status: {
      type: String,
      enum: ["running", "completed", "failed"],
      default: "running",
      index: true,
    },
    syncStartTime: { type: Date, required: true, index: true },
    syncEndTime: { type: Date },
    error: {
      message: { type: String },
      stack: { type: String },
    },
  },
  { timestamps: true }
);

export default model("SyncJob", syncJobSchema);