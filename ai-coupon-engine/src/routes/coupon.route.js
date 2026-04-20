import express from "express";
import {
  listCoupons,
  listCouponPartners,
} from "../controllers/coupon.controller.js";

const router = express.Router();

router.get("/partners", listCouponPartners);
router.get("/", listCoupons);

export default router;
