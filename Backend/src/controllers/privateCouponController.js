const PrivateCoupon = require('../models/PrivateCoupon');
const { successResponse, errorResponse } = require('../utils/responseHandler');
const { STATUS_CODES } = require('../config/constants');
const logger = require('../utils/logger');

/**
 * Sync private coupons based on selected brand names with filtering and sorting
 * @route POST /api/private-coupons/sync
 */
exports.syncCoupons = async (req, res) => {
    try {
        const {
            brands,
            category,
            search,
            discountType,
            price,
            minimumOrder,
            sortBy = 'newest_first',
            validity,
            page = 1,
            limit = 20
        } = req.body;

        if (!brands || !Array.isArray(brands) || brands.length === 0) {
            return errorResponse(res, STATUS_CODES.BAD_REQUEST, 'Please provide an array of brand names');
        }

        logger.info(`Syncing private coupons for brands: ${brands.join(', ')}`);

        const query = {};
        const now = new Date();

        // Brand Filter (Required)
        query.brandName = {
            $in: brands.map(b => new RegExp(`^${b.trim()}$`, 'i'))
        };

        // Category Filter
        if (category && category !== 'All' && category !== 'See all') {
            query.category = category;
        }

        // Discount Type Filter
        if (discountType) {
            if (discountType === 'percentage_off') query.discountType = 'percentage';
            else if (discountType === 'flat_discount') query.discountType = 'flat';
            else if (discountType === 'cashback') query.discountType = 'cashback';
            else if (discountType === 'buy1get1') query.discountType = 'buy1get1';
            else if (discountType === 'free_delivery') query.discountType = 'free_delivery';
            else if (discountType === 'wallet_upi') query.discountType = 'wallet_upi';
            else if (discountType === 'prepaid_only') query.discountType = 'prepaid_only';
            else query.discountType = discountType;
        }

        // Price/Minimum Order Filter
        const priceFilter = price || minimumOrder;
        if (priceFilter) {
            if (priceFilter === 'no_minimum') {
                query.$or = [
                    { minimumOrderValue: null },
                    { minimumOrderValue: '0' },
                    { minimumOrderValue: { $exists: false } }
                ];
            } else if (priceFilter === 'below_300') {
                query.minimumOrderValue = { $lt: 300 };
            } else if (priceFilter === '300_700') {
                query.minimumOrderValue = { $gte: 300, $lte: 700 };
            } else if (priceFilter === '700_1500') {
                query.minimumOrderValue = { $gte: 700, $lte: 1500 };
            } else if (priceFilter === 'above_1500') {
                query.minimumOrderValue = { $gt: 1500 };
            }
        }

        // Search Logic
        if (search) {
            const searchRegex = new RegExp(search, 'i');
            query.$and = query.$and || [];
            query.$and.push({
                $or: [
                    { couponTitle: searchRegex },
                    { brandName: searchRegex },
                    { description: searchRegex },
                    { category: searchRegex }
                ]
            });
        }

        // Validity Filter
        if (validity) {
            const todayEnd = new Date();
            todayEnd.setHours(23, 59, 59, 999);

            const weekEnd = new Date();
            weekEnd.setDate(weekEnd.getDate() + (7 - weekEnd.getDay()));
            weekEnd.setHours(23, 59, 59, 999);

            const monthEnd = new Date();
            monthEnd.setMonth(monthEnd.getMonth() + 1);
            monthEnd.setDate(0);
            monthEnd.setHours(23, 59, 59, 999);

            if (validity === 'valid_today') {
                query.expiryDate = { $gte: now, $lte: todayEnd };
            } else if (validity === 'valid_this_week') {
                query.expiryDate = { $gte: now, $lte: weekEnd };
            } else if (validity === 'valid_this_month') {
                query.expiryDate = { $gte: now, $lte: monthEnd };
            } else if (validity === 'expired') {
                query.expiryDate = { $lt: now };
            }
        }

        // Sorting
        let sortOptions = {};
        if (sortBy === 'newest_first') {
            sortOptions = { createdAt: -1 };
        } else if (sortBy === 'expiring_soon') {
            sortOptions = { expiryDate: 1 };
        } else if (sortBy === 'a_to_z') {
            sortOptions = { brandName: 1 };
        } else if (sortBy === 'z_to_a') {
            sortOptions = { brandName: -1 };
        }

        // Pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const total = await PrivateCoupon.countDocuments(query);

        const coupons = await PrivateCoupon.find(query)
            .sort(sortOptions)
            .limit(parseInt(limit))
            .skip(skip)
            .lean();

        return successResponse(res, STATUS_CODES.OK, 'Private coupons synced successfully', {
            count: coupons.length,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / parseInt(limit)),
            coupons
        });
    } catch (error) {
        logger.error(`Error syncing private coupons: ${error.message}`);
        return errorResponse(res, STATUS_CODES.INTERNAL_SERVER_ERROR, 'An error occurred while syncing coupons');
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

/**
 * Get private coupon statistics (active count and total savings)
 * @route GET /api/private-coupons/statistics
 */
exports.getStatistics = async (req, res) => {
    try {
        // Get active coupons count (redeemable = true)
        const activeCouponsCount = await PrivateCoupon.countDocuments({ redeemable: true });

        // Get all coupons to calculate savings from titles
        const allCoupons = await PrivateCoupon.find({}, { couponTitle: 1 }).lean();

        // Extract amounts from coupon titles and sum them up
        let totalSavings = 0;
        const amountPatterns = [
            /(?:rs\.?\s*|₹\s*)(\d+)/gi,           // Rs 200, Rs. 200, ₹ 200, rs200
            /(\d+)\s*(?:rs|rupees)/gi,            // 200 rs, 200 rupees
            /flat\s*(\d+)/gi,                     // flat 200
            /save\s*(?:rs\.?\s*|₹\s*)?(\d+)/gi,  // save Rs 200, save 200
            /upto\s*(?:rs\.?\s*|₹\s*)?(\d+)/gi,  // upto Rs 200, upto 200
            /get\s*(?:rs\.?\s*|₹\s*)?(\d+)/gi,   // get Rs 200, get 200
        ];

        allCoupons.forEach(coupon => {
            if (!coupon.couponTitle) return;

            const title = coupon.couponTitle.toLowerCase();
            let foundAmount = false;

            for (const pattern of amountPatterns) {
                const matches = [...title.matchAll(pattern)];
                if (matches.length > 0) {
                    // Take the first match found
                    const amount = parseInt(matches[0][1], 10);
                    if (!isNaN(amount)) {
                        totalSavings += amount;
                        foundAmount = true;
                        break; // Only count once per coupon
                    }
                }
            }

            // If no pattern matched, try to find any standalone number (last resort)
            if (!foundAmount) {
                const standaloneNumber = title.match(/\b(\d{2,4})\b/); // 2-4 digit numbers
                if (standaloneNumber) {
                    const amount = parseInt(standaloneNumber[1], 10);
                    // Only add if it looks like a reasonable discount (between 10 and 10000)
                    if (!isNaN(amount) && amount >= 10 && amount <= 10000) {
                        totalSavings += amount;
                    }
                }
            }
        });

        logger.info(`Statistics fetched: ${activeCouponsCount} active coupons, ₹${totalSavings} total savings`);

        return successResponse(res, STATUS_CODES.OK, 'Statistics fetched successfully', {
            activeCouponsCount,
            totalSavings
        });
    } catch (error) {
        logger.error(`Error fetching private coupon statistics: ${error.message}`);
        return errorResponse(res, STATUS_CODES.INTERNAL_SERVER_ERROR, 'An error occurred while fetching statistics');
    }
};
