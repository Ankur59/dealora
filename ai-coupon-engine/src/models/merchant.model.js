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
    notes: {
      type: String,
      maxlength: 4000,
      default: "",
    },
    // Browser automation fields
    cookies: { type: Schema.Types.Mixed },
    actionMaps: { type: Map, of: String },
    automationMacros: { type: Map, of: [Schema.Types.Mixed] },
    lastLoginAttempt: {
      status: { type: String, enum: ['idle', 'pending_otp', 'success', 'failed'], default: 'idle' },
      message: String,
      lastAttempted: Date
    },
  },
  { timestamps: true },
);

const Merchant = model("merchant", merchantSchema);
export default Merchant;
