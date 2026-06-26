import express from "express";
import {
  getCouponOverviewCounts,
  listCoupons,
  listCouponPartners,
  updateCouponProvider,
  getCouponById,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  markCouponExpired,
  listManualVerificationCoupons,
  deepResearchBatch,
  removeAndBlacklist,
} from "../controllers/coupon.controller.js";

const router = express.Router();

router.post("/deep-research-batch", deepResearchBatch);
router.get("/partners", listCouponPartners);
router.get("/overview-counts", getCouponOverviewCounts);
router.get("/manual-needed", listManualVerificationCoupons);
router.get("/", listCoupons);
router.post("/", createCoupon);
router.get("/:id", getCouponById);
router.put("/:id", updateCoupon);
router.delete("/:id", deleteCoupon);
router.put("/:id/provider", updateCouponProvider);
router.post("/:id/expire", markCouponExpired);
router.post("/:id/remove-and-blacklist", removeAndBlacklist);

export default router;
