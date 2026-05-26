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
} from "../controllers/coupon.controller.js";

const router = express.Router();

router.get("/partners", listCouponPartners);
router.get("/overview-counts", getCouponOverviewCounts);
router.get("/", listCoupons);
router.post("/", createCoupon);
router.get("/:id", getCouponById);
router.put("/:id", updateCoupon);
router.delete("/:id", deleteCoupon);
router.put("/:id/provider", updateCouponProvider);

export default router;
