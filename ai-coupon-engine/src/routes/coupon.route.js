import express from "express";
import {
    createCoupon,
    getCoupons,
    getCouponById,
    updateCoupon,
    deleteCoupon
} from "../controllers/coupon.controller.js";

const router = express.Router();

/**
 * @route   GET /api/v1/coupons
 * @desc    List all coupons (optional query filters: ?brand=Amazon&status=active&verified=true)
 * @access  Internal/Admin
 */
router.get("/", getCoupons);

/**
 * @route   GET /api/v1/coupons/:id
 * @desc    Get a single coupon by ID
 * @access  Internal/Admin
 */
router.get("/:id", getCouponById);

/**
 * @route   POST /api/v1/coupons
 * @desc    Create a new coupon (manual entry from extension)
 * @access  Internal/Admin
 */
router.post("/", createCoupon);

/**
 * @route   PUT /api/v1/coupons/:id
 * @desc    Update a coupon (used by extension to reset verification status)
 * @access  Internal/Admin
 */
router.put("/:id", updateCoupon);

/**
 * @route   DELETE /api/v1/coupons/:id
 * @desc    Delete a coupon
 * @access  Internal/Admin
 */
router.delete("/:id", deleteCoupon);

export default router;
