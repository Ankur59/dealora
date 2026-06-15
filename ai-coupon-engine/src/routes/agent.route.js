import express from "express";
import Coupon from "../models/coupon.model.js";
import Merchant from "../models/merchant.model.js";
import MerchantCredential from "../models/merchantCredential.model.js";
import CouponVerification from "../models/couponVerification.model.js";
import { requireDashboardAuth } from "../middleware/requireDashboardAuth.middleware.js";

const router = express.Router();

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// GET pending tasks for the extension to verify
router.get("/pending-tasks", requireDashboardAuth, async (req, res) => {
  try {
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const coupons = await Coupon.find({
      isVerified: false,
      offerType: "Coupon",
      code: { $ne: null, $gt: "" },
      isNewUser: { $ne: true },
      isInStore: { $ne: true },
      $or: [
        { status: "active" },
        { status: "pending" },
        { status: { $exists: false } },
        { status: null },
      ],
      $and: [
        {
          $or: [
            { end: { $gt: todayEnd } },
            { end: null },
            { end: { $exists: false } },
          ],
        },
      ],
    }).limit(200);

    const tasks = coupons.map((c) => ({
      id: c._id.toString(),
      _id: c._id.toString(),
      url: c.couponVisitingLink || c.trackingLink || "",
      code: c.code || c.couponCode || "",
      brand: c.brandName || "",
      description: c.description || "",
      status: "pending",
      type: "verify",
    }));

    res.status(200).json({ success: true, coupons: tasks });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET automation login map for a domain
router.get("/automation-map/:domain/login", requireDashboardAuth, async (req, res) => {
  try {
    const { domain } = req.params;
    const merchant = await Merchant.findOne({ domain: new RegExp(escapeRegex(domain), "i") });
    if (merchant && merchant.automationMacros && merchant.automationMacros.has("login")) {
      res.status(200).json({ success: true, map: { steps: merchant.automationMacros.get("login") } });
    } else {
      res.status(200).json({ success: true, map: null });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET automation verify map for a domain
router.get("/automation-map/:domain/verify", requireDashboardAuth, async (req, res) => {
  try {
    const { domain } = req.params;
    const merchant = await Merchant.findOne({ domain: new RegExp(escapeRegex(domain), "i") });
    if (merchant && merchant.automationMacros && merchant.automationMacros.has("verify")) {
      res.status(200).json({ success: true, map: { steps: merchant.automationMacros.get("verify") } });
    } else {
      res.status(200).json({ success: true, map: null });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST automation login map
router.post("/automation-map", requireDashboardAuth, async (req, res) => {
  try {
    const { domain, flowType, steps } = req.body;
    if (!domain) {
      return res.status(400).json({ success: false, message: "domain is required" });
    }

    const merchant = await Merchant.findOne({ domain: new RegExp(escapeRegex(domain), "i") });
    if (!merchant) {
      return res.status(404).json({ success: false, message: "Merchant not found" });
    }

    if (!merchant.automationMacros) {
      merchant.automationMacros = new Map();
    }

    merchant.automationMacros.set(flowType || "login", steps || []);
    await merchant.save();

    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET credentials for a domain
router.get("/credentials/:domain", requireDashboardAuth, async (req, res) => {
  try {
    const { domain } = req.params;
    const merchant = await Merchant.findOne({ domain: new RegExp(escapeRegex(domain), "i") });
    const globalId = "000000000000000000000000";
    const merchantId = merchant ? merchant._id : null;

    // 1. Fetch merchant-specific credentials
    let merchantCreds = [];
    if (merchantId) {
      merchantCreds = await MerchantCredential.find({ merchantId });
    }
    const merchantEmail = merchantCreds.find((c) => c.credentialType === "email_password");

    // 2. Fetch global credentials as fallback
    const globalCreds = await MerchantCredential.find({ merchantId: globalId });
    const globalEmail = globalCreds.find((c) => c.credentialType === "email_password");

    // 3. Resolve hierarchy: merchant-specific -> global -> defaults
    const email = merchantEmail?.login ?? globalEmail?.login ?? "Nobentadeal@gmail.com";
    const password = merchantEmail?.password ?? globalEmail?.password ?? "Mumbai@123";

    res.status(200).json({
      success: true,
      credentials: { username: email, password },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST report verification result
router.post("/tasks/:taskId/result", requireDashboardAuth, async (req, res) => {
  try {
    const { taskId } = req.params;
    const { status, reason } = req.body;

    const coupon = await Coupon.findById(taskId);
    if (!coupon) {
      return res.status(404).json({ success: false, message: "Coupon not found" });
    }

    // Update Coupon
    coupon.isVerified = status === "valid";
    coupon.verifiedAt = new Date();
    coupon.verifiedOn = new Date();
    if (status === "valid") {
      coupon.status = "active";
      coupon.isInValid = false;
    } else if (status === "reset") {
      coupon.status = "pending";
      coupon.isInValid = false;
      coupon.isVerified = false;
    } else {
      coupon.status = "expired";
      coupon.isInValid = true;
      coupon.isVerified = false;
    }
    await coupon.save();

    // Find Merchant
    const merchant = await Merchant.findOne({
      merchantName: new RegExp(escapeRegex(coupon.brandName || ""), "i"),
    });
    const merchantId = merchant ? merchant._id : "000000000000000000000000";

    const statusMap = {
      valid: "verified",
      invalid: "failed",
      expired: "failed",
      reset: "pending",
    };

    const errorTypeMap = {
      valid: "none",
      invalid: "invalid_code",
      expired: "expired",
      reset: "none",
    };

    await CouponVerification.findOneAndUpdate(
      { couponId: coupon._id, merchantId },
      {
        couponId: coupon._id,
        merchantId,
        status: statusMap[status] || "failed",
        lastAttemptedAt: new Date(),
        verifiedAt: status === "valid" ? new Date() : null,
        $inc: { attemptCount: 1 },
        result: {
          success: status === "valid",
          couponApplied: status === "valid",
          discountRecognized: status === "valid",
          errorMessage: reason || "",
          errorType: errorTypeMap[status] || "unknown",
          pageUrlAtEnd: coupon.couponVisitingLink || coupon.trackingLink || "",
        },
      },
      { upsert: true, new: true }
    );

    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
