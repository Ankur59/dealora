import express from "express";
import {
    saveMerchantCookies,
    getMerchantCookies,
    getMerchantCookieById,
} from "../controllers/merchantCookie.controller.js";

const router = express.Router();

/**
 * @route   POST /api/v1/merchant-cookies
 * @desc    Save cookies captured by the Chrome extension
 * @access  Internal (called by extension)
 */
router.post("/", saveMerchantCookies);

/**
 * @route   GET /api/v1/merchant-cookies
 * @desc    List all saved merchant cookie sessions (cookies payload excluded)
 * @query   ?merchant=AmazonIndia  (optional, case-insensitive filter)
 * @access  Internal
 */
router.get("/", getMerchantCookies);

/**
 * @route   GET /api/v1/merchant-cookies/:id
 * @desc    Get a single record including full cookies array
 * @access  Internal
 */
router.get("/:id", getMerchantCookieById);

export default router;
