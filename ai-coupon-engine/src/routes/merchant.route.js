import express from "express";
import {
    getMerchants,
    upsertMerchant,
    updateMerchant,
    deleteMerchant
} from "../controllers/merchant.controller.js";

const router = express.Router();

/**
 * @route   GET /api/v1/merchants
 * @desc    Get all merchants for extension cookie sync list
 * @access  Internal/Admin
 */
router.get("/", getMerchants);

/**
 * @route   POST /api/v1/merchants
 * @desc    Create or upsert a merchant
 * @access  Internal/Admin
 */
router.post("/", upsertMerchant);

/**
 * @route   PUT /api/v1/merchants/:id
 * @desc    Update a merchant (e.g. adding domain from extension)
 * @access  Internal/Admin
 */
router.put("/:id", updateMerchant);

/**
 * @route   DELETE /api/v1/merchants/:id
 * @desc    Delete a merchant
 * @access  Internal/Admin
 */
router.delete("/:id", deleteMerchant);

export default router;
