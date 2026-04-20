import express from "express";
import {
  getCouponOverviewCounts,
  listCoupons,
  listCouponPartners,
  updateCouponProvider,
} from "../controllers/coupon.controller.js";

const router = express.Router();

router.get("/partners", listCouponPartners);
router.get("/overview-counts", getCouponOverviewCounts);
router.get("/", listCoupons);
router.put("/:id/provider", updateCouponProvider);

export default router;
