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

/**
 * Redeem a private coupon
 * @route PATCH /api/private-coupons/:id/redeem
 */
exports.redeemPrivateCoupon = async (req, res) => {
    try {
        const { id } = req.params;
        const uid = req.uid || req.body.uid; // Get UID from auth or body

        if (!uid) {
            return errorResponse(res, STATUS_CODES.BAD_REQUEST, 'User ID (uid) is required');
        }

        const coupon = await PrivateCoupon.findById(id);

        if (!coupon) {
            return errorResponse(res, STATUS_CODES.NOT_FOUND, 'Private coupon not found');
        }

        if (!coupon.redeemable) {
            return errorResponse(res, STATUS_CODES.BAD_REQUEST, 'Coupon is already redeemed or not redeemable');
        }

        // Update coupon status
        coupon.redeemable = false;
        coupon.redeemed = true;
        coupon.redeemedBy = uid;
        coupon.redeemedAt = new Date();

        await coupon.save();

        logger.info(`Private coupon ${id} redeemed by user ${uid}`);

        return successResponse(res, STATUS_CODES.OK, 'Coupon redeemed successfully', {
            coupon
        });
    } catch (error) {
        logger.error(`Error redeeming private coupon: ${error.message}`);
        return errorResponse(res, STATUS_CODES.INTERNAL_SERVER_ERROR, 'An error occurred while redeeming the coupon');
    }
};
