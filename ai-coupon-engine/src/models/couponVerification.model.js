import { Schema, model } from "mongoose";

/**
 * Tracks the verification result of a single coupon on a merchant website.
 * Also stores the recorded action macro so future verifications can skip AI.
 */
const verificationResultSchema = new Schema(
  {
    couponId: { type: Schema.Types.ObjectId, ref: "partnercoupon", required: true, index: true },
    merchantId: { type: Schema.Types.ObjectId, ref: "merchant", required: true, index: true },

    status: {
      type: String,
      enum: ["pending", "running", "verified", "failed", "partial", "skipped"],
      default: "pending",
      index: true,
    },

    // When did we last try / succeed?
    lastAttemptedAt: { type: Date },
    verifiedAt: { type: Date, index: true },

    // How many times have we retried?
    attemptCount: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 3 },

    // ─── AI-extracted T&C summary ───
    termsSummary: {
      minOrderValue: { type: Number },           // e.g. 500 (INR)
      applicableCategories: [{ type: String }],    // e.g. ["electronics", "fashion"]
      excludedProducts: [{ type: String }],      // e.g. ["iPhone 15", "Gift Cards"]
      paymentMethods: [{ type: String }],          // e.g. ["upi", "credit_card"]
      userTypes: [{ type: String }],               // e.g. ["new_user", "all_users"]
      maxDiscount: { type: Number },
      validUntil: { type: Date },
      otherRestrictions: { type: String },
    },

    // ─── Cart requirements we discovered ───
    cartRequirements: {
      needsItems: { type: Boolean, default: false },
      suggestedSearchTerms: [{ type: String }],    // AI-suggested search keywords
      requiredCategories: [{ type: String }],
      minCartValue: { type: Number },
    },

    // ─── Recorded macro for replay (keyed by couponId string) ───
    verificationMacro: [
      {
        action: { type: String, enum: ["goto", "click", "fill", "wait", "scroll", "screenshot", "otp_needed"] },
        selector: { type: String },
        value: { type: String },
        url: { type: String },
        waitMs: { type: Number },
        _meta: { type: Schema.Types.Mixed },
      },
    ],

    // ─── Result details ───
    result: {
      success: { type: Boolean },
      couponApplied: { type: Boolean },
      discountRecognized: { type: Boolean },
      errorMessage: { type: String },
      errorType: {
        type: String,
        enum: [
          "none",
          "expired",
          "minimum_order_not_met",
          "invalid_code",
          "not_applicable_to_cart",
          "user_not_eligible",
          "website_error",
          "timeout",
          "blocked",
          "unknown",
        ],
        default: "none",
      },
      screenshotUrl: { type: String },
      pageUrlAtEnd: { type: String },
    },

    // ─── Anti-detection / human-like metadata ───
    sessionFingerprint: {
      viewportW: { type: Number },
      viewportH: { type: Number },
      userAgent: { type: String },
      timezone: { type: String },
    },

    // If a human manually overrides the result from the dashboard
    manualOverride: {
      overriddenBy: { type: Schema.Types.ObjectId, ref: "DashboardUser" },
      overriddenAt: { type: Date },
      newStatus: { type: String, enum: ["verified", "failed"] },
      reason: { type: String },
    },
  },
  { timestamps: true }
);

// Compound index for fast "all pending for merchant X" lookups
verificationResultSchema.index({ merchantId: 1, status: 1, lastAttemptedAt: 1 });
verificationResultSchema.index({ couponId: 1, merchantId: 1 }, { unique: true });
verificationResultSchema.index({ verifiedAt: -1 });

const CouponVerification = model("CouponVerification", verificationResultSchema);
export default CouponVerification;
