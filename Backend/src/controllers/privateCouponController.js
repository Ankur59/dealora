const PrivateCoupon = require('../models/PrivateCoupon');
const { successResponse, errorResponse } = require('../utils/responseHandler');
const { STATUS_CODES } = require('../config/constants');
const logger = require('../utils/logger');

/**
 * Sync private coupons based on selected brand names
 * @route POST /api/private-coupons/sync
 */
exports.syncCoupons = async (req, res) => {
    try {
        const { brands } = req.body;

        if (!brands || !Array.isArray(brands) || brands.length === 0) {
            return errorResponse(res, STATUS_CODES.BAD_REQUEST, 'Please provide an array of brand names');
        }

        logger.info(`Syncing private coupons for brands: ${brands.join(', ')}`);

       
        const coupons = await PrivateCoupon.find({
            brandName: { $in: brands.map(b => new RegExp(`^${b}$`, 'i')) }
        });

        return successResponse(res, STATUS_CODES.OK, 'Private coupons synced successfully', {
            count: coupons.length,
            coupons
        });
    } catch (error) {
        logger.error(`Error syncing private coupons: ${error.message}`);
        return errorResponse(res, STATUS_CODES.INTERNAL_SERVER_ERROR, 'An error occurred while syncing coupons');
    }
};

/**
 * Get all private coupons (Optional, for debugging or admin)
 */
exports.getAllPrivateCoupons = async (req, res) => {
    try {
        const coupons = await PrivateCoupon.find();
        return successResponse(res, STATUS_CODES.OK, 'Private coupons fetched successfully', {
            count: coupons.length,
            coupons
        });
    } catch (error) {
        logger.error(`Error fetching private coupons: ${error.message}`);
        return errorResponse(res, STATUS_CODES.INTERNAL_SERVER_ERROR, 'An error occurred while fetching coupons');
    }
};
