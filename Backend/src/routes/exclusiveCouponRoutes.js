const express = require('express');
const router = express.Router();
const {
    addSheet,
    getExclusiveCoupons,
    getExclusiveCouponByCode,
    syncNow,
    getSheetConfig,
    getUniqueBrands,
    getUniqueCategories,
    getUniqueSources,
    getCouponStats,
} = require('../controllers/exclusiveCouponController');

/**
 * @route   POST /api/exclusive-coupons/add-sheet
 * @desc    Add or update Google Sheet URL for exclusive coupons
 * @access  Public (you can add authentication later if needed)
 */
router.post('/add-sheet', addSheet);

/**
 * @route   POST /api/exclusive-coupons/sync-now
 * @desc    Manually trigger Google Sheet sync
 * @access  Public (you can add authentication later if needed)
 */
router.post('/sync-now', syncNow);

/**
 * @route   GET /api/exclusive-coupons/config/sheet
 * @desc    Get current sheet configuration and sync status
 * @access  Public
 */
router.get('/config/sheet', getSheetConfig);

/**
 * @route   GET /api/exclusive-coupons/filters/brands
 * @desc    Get unique brand names for filter options
 * @access  Public
 */
router.get('/filters/brands', getUniqueBrands);

/**
 * @route   GET /api/exclusive-coupons/filters/categories
 * @desc    Get unique categories for filter options
 * @access  Public
 */
router.get('/filters/categories', getUniqueCategories);

/**
 * @route   GET /api/exclusive-coupons/filters/sources
 * @desc    Get unique sources for filter options
 * @access  Public
 */
router.get('/filters/sources', getUniqueSources);

/**
 * @route   GET /api/exclusive-coupons/stats
 * @desc    Get coupon statistics (total, active, expired, etc.)
 * @access  Public
 */
router.get('/stats', getCouponStats);

/**
 * @route   GET /api/exclusive-coupons
 * @desc    Get all exclusive coupons with advanced filters and sorting
 * @query   brands, brand, category, search, source, stackable, validity, sortBy, limit, page
 * @access  Public
 */
router.get('/', getExclusiveCoupons);

/**
 * @route   GET /api/exclusive-coupons/:couponCode
 * @desc    Get exclusive coupon by coupon code
 * @access  Public
 */
router.get('/:couponCode', getExclusiveCouponByCode);

module.exports = router;
