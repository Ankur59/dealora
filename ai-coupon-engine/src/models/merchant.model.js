import { Schema, model } from "mongoose";
const merchantSchema = new Schema(
  {
    merchantName: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 200,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    description: {
      type: String,
      maxlength: 4000,
      default: "",
    },
    website: {
      type: String,
      maxlength: 500,
      default: "",
    },
    domain: {
      type: String,
      maxlength: 500,
      default: "",
    },
    merchantUrl: {
      type: String,
      maxlength: 500,
      default: "",
    },
    notes: {
      type: String,
      maxlength: 4000,
      default: "",
    },
    // Browser automation fields
    cookies: { type: Schema.Types.Mixed },
    actionMaps: { type: Map, of: String },
    automationMacros: { type: Map, of: [Schema.Types.Mixed] },
    // Global toggle for 12h verification run
    autoVerificationEnabled: { type: Boolean, default: true },
    // Cursor for batch verification (tracks which coupon index to resume from)
    _verificationCursor: { type: Number, default: 0 },
    lastLoginAttempt: {
      status: { type: String, enum: ['idle', 'running', 'pending_otp', 'success', 'failed'], default: 'idle' },
      message: String,
      lastAttempted: Date
    },
    // Health score computed every 12h
    healthScore: { type: Number, default: 0, min: 0, max: 100 },
    lastHealthCheck: { type: Date },
    healthScoreBreakdown: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

const Merchant = model("merchant", merchantSchema);
export default Merchant;
