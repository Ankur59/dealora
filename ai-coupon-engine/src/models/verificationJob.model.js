import { Schema, model } from "mongoose";

/**
 * Tracks a batch verification job (the 12-hour cycle).
 */
const verificationJobSchema = new Schema(
  {
    status: {
      type: String,
      enum: ["scheduled", "running", "completed", "failed", "cancelled"],
      default: "scheduled",
      index: true,
    },
    
    // Cycle info
    cycleStartTime: { type: Date, required: true, index: true },
    cycleEndTime: { type: Date },
    
    // Stats
    totalMerchants: { type: Number, default: 0 },
    processedMerchants: { type: Number, default: 0 },
    
    totalCoupons: { type: Number, default: 0 },
    verifiedCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },
    skippedCount: { type: Number, default: 0 },
    
    // Configuration used for this job
    config: {
      concurrency: { type: Number, default: 5 },
      maxCouponsPerMerchant: { type: Number },
      retryFailed: { type: Boolean, default: true },
    },
    
    // Any global error that stopped the whole job
    error: {
      message: { type: String },
      stack: { type: String },
    },

    // Whether this job was triggered manually or by the 12h scheduler
    triggerType: {
      type: String,
      enum: ["scheduled", "manual"],
      default: "scheduled"
    }
  },
  { timestamps: true }
);

const VerificationJob = model("VerificationJob", verificationJobSchema);
export default VerificationJob;
