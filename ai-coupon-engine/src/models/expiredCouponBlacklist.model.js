import mongoose from "mongoose";

/**
 * ExpiredCouponBlacklist — prevents re-ingestion of manually-removed expired coupons.
 *
 * When an admin manually marks a coupon as expired and removes it,
 * its code+brand are recorded here. The ingestion pipeline checks this
 * list and skips any coupon that matches a blacklisted entry.
 */

const expiredCouponBlacklistSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    brandName: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    partner: {
      type: String,
      default: null,
    },
    description: {
      type: String,
      default: null,
    },
    reason: {
      type: String,
      default: "Manually marked as expired",
    },
    sourceCouponId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
  },
  { timestamps: true }
);

// Unique compound index: same code+brand can't be blacklisted twice
expiredCouponBlacklistSchema.index(
  { code: 1, brandName: 1 },
  { unique: true }
);

const ExpiredCouponBlacklist = mongoose.model(
  "ExpiredCouponBlacklist",
  expiredCouponBlacklistSchema
);

export default ExpiredCouponBlacklist;
