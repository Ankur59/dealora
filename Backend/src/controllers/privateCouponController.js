const PrivateCoupon = require('../models/PrivateCoupon');
const { successResponse, errorResponse } = require('../utils/responseHandler');
const { STATUS_CODES } = require('../config/constants');
const logger = require('../utils/logger');

/**
 * Get private coupon categories
 */
exports.getPrivateCategories = async (req, res, next) => {
    try {
        const categories = [
            { value: 'All', label: 'See all' },
            { value: 'Food', label: 'Food' },
            { value: 'Fashion', label: 'Fashion' },
            { value: 'Beauty', label: 'Beauty' },
            { value: 'Electronics', label: 'Electronics' },
            { value: 'Travel', label: 'Travel' },
            { value: 'Grocery', label: 'Grocery' },
            { value: 'Entertainment', label: 'Entertainment' }
        ];
        return successResponse(res, STATUS_CODES.OK, 'Private categories fetched successfully', {
            categories
        });
    } catch (error) {
        logger.error('Get private categories error:', error);
        next(error);
    }
};

/**
 * Get private coupon sort options
 */
exports.getPrivateSortOptions = async (req, res, next) => {
    try {
        const sortOptions = [
            { value: 'none', label: 'None' },
            { value: 'newest_first', label: 'Newest First' },
            { value: 'expiring_soon', label: 'Expiring Soon' },
            { value: 'a_to_z', label: 'A-Z (Brand Name)' },
            { value: 'z_to_a', label: 'Z-A (Brand Name)' }
        ];
        // Note: highest_discount and lowest_minimum_order are omitted if fields don't exist/work same way
        return successResponse(res, STATUS_CODES.OK, 'Private sort options fetched successfully', {
            sortOptions
        });
    } catch (error) {
        logger.error('Get private sort options error:', error);
        next(error);
    }
};

/**
 * Get private coupon filter options
 */
exports.getPrivateFilterOptions = async (req, res, next) => {
    try {
        // Get unique brands from private coupons
        const brands = await PrivateCoupon.distinct('brandName');
        const brandOptions = brands
            .filter(b => b && b.trim() !== '')
            .sort()
            .map(brand => ({ value: brand, label: brand }));

        const categoryOptions = [
            { value: 'All', label: 'See all' },
            { value: 'Food', label: 'Food' },
            { value: 'Fashion', label: 'Fashion' },
            { value: 'Beauty', label: 'Beauty' },
            { value: 'Electronics', label: 'Electronics' },
            { value: 'Travel', label: 'Travel' },
            { value: 'Grocery', label: 'Grocery' },
            { value: 'Entertainment', label: 'Entertainment' }
        ];

        const discountTypes = [
            { value: 'percentage_off', label: 'Percentage Off (% Off)' },
            { value: 'flat_discount', label: 'Flat Discount' },
            { value: 'cashback', label: 'Cashback' },
            { value: 'buy1get1', label: 'Buy 1 Get 1' },
            { value: 'free_delivery', label: 'Free Delivery' },
            { value: 'wallet_upi', label: 'Wallet/UPI Offers' },
            { value: 'prepaid_only', label: 'Prepaid Only Offers' }
        ];

        const priceOptions = [
            { value: 'no_minimum', label: 'No Minimum Order' },
            { value: 'below_300', label: 'Minimum Order Below ₹300' },
            { value: '300_700', label: '₹300-₹700' },
            { value: '700_1500', label: '₹700-₹1500' },
            { value: 'above_1500', label: 'Above ₹1500' }
        ];

        const validityOptions = [
            { value: 'valid_today', label: 'Valid Today' },
            { value: 'valid_this_week', label: 'Valid This Week' },
            { value: 'valid_this_month', label: 'Valid This Month' },
            { value: 'expired', label: 'Expired' }
        ];

        return successResponse(res, STATUS_CODES.OK, 'Private filter options fetched successfully', {
            brandOptions,
            categoryOptions,
            discountTypes,
            priceOptions,
            validityOptions
        });
    } catch (error) {
        logger.error('Get private filter options error:', error);
        next(error);
    }
};

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
 * Get filtered/sorted private coupons
 * @route GET /api/private-coupons
 */
exports.getPrivateCoupons = async (req, res, next) => {
    try {
        const {
            brand,
            category,
            search,
            discountType,
            price,
            minimumOrder,
            sortBy = 'newest_first',
            status = 'active', // Default to active
            validity,
            page = 1,
            limit = 20
        } = req.query;

        const query = {};
        const now = new Date();

        // Status Logic
        if (status === 'active') {
            query.redeemable = true;
            query.expiryDate = { $gte: now };
        } else if (status === 'expired') {
            query.expiryDate = { $lt: now };
            query.redeemed = { $ne: true }; // Only show expired that weren't redeemed
        } else if (status === 'redeemed') {
            query.redeemed = true;
        }

        // Brand Filter - Handle multiple brands
        if (brand) {
            // Convert brand to array if it's a string (supports comma-separated or single value)
            let brands = Array.isArray(brand) ? brand : [brand];
            
            // If it's a single string with commas, split it
            if (brands.length === 1 && brands[0].includes(',')) {
                brands = brands[0].split(',').map(b => b.trim());
            }
            
            // If multiple brands, use $in with case-insensitive regex for each brand
            if (brands.length > 1) {
                query.brandName = { 
                    $in: brands.map(b => new RegExp(`^${b.trim()}$`, 'i')) 
                };
            } else {
                // Single brand - case-insensitive match
                query.brandName = new RegExp(`^${brands[0].trim()}$`, 'i');
            }
        }

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

        // Validity Filter (Additional granular filtering within status if needed)
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

            if (validity === 'valid_today' || validity === 'Valid Today') {
                query.expiryDate = { $gte: now, $lte: todayEnd };
            } else if (validity === 'valid_this_week' || validity === 'Valid This Week') {
                query.expiryDate = { $gte: now, $lte: weekEnd };
            } else if (validity === 'valid_this_month' || validity === 'Valid This Month') {
                query.expiryDate = { $gte: now, $lte: monthEnd };
            }
        }

        // Sort Logic
        let sortOption = {};
        if (sortBy === 'none' || sortBy === 'None') {
            sortOption = {};
        } else if (sortBy === 'newest' || sortBy === 'newest_first') {
            sortOption = { createdAt: -1 };
        } else if (sortBy === 'expiring_soon' || sortBy === 'expiring_soon_first') {
            sortOption = { expiryDate: 1 };
        } else if (sortBy === 'highest_discount') {
            sortOption = { discountValue: -1 };
        } else if (sortBy === 'lowest_minimum_order') {
            sortOption = { minimumOrderValue: 1 };
        } else if (sortBy === 'a_z' || sortBy === 'a_to_z') {
            sortOption = { brandName: 1 };
        } else if (sortBy === 'z_a' || sortBy === 'z_to_a') {
            sortOption = { brandName: -1 };
        } else {
            sortOption = { createdAt: -1 };
        }

        const pageNumber = parseInt(page) || 1;
        const limitNumber = parseInt(limit) || 20;
        const skip = (pageNumber - 1) * limitNumber;

        const coupons = await PrivateCoupon.find(query)
            .sort(sortOption)
            .skip(skip)
            .limit(limitNumber);

        const total = await PrivateCoupon.countDocuments(query);

        // Map fields to match Public Coupon response for frontend consistency
        const mappedCoupons = coupons.map(coupon => ({
            id: coupon._id,
            brandName: coupon.brandName,
            couponTitle: coupon.couponTitle,
            description: coupon.description,
            expireBy: coupon.expiryDate, // Map expiryDate to expireBy
            categoryLabel: coupon.category, // Map category to categoryLabel
            discountType: coupon.discountType || 'unknown',
            discountValue: coupon.discountValue || null,
            minimumOrder: coupon.minimumOrderValue || null, // Map minimumOrderValue to minimumOrder
            couponCode: coupon.couponCode,
            couponVisitingLink: coupon.couponLink, // Map couponLink to couponVisitingLink
            redeemable: coupon.redeemable,
            redeemed: coupon.redeemed
        }));

        return successResponse(res, STATUS_CODES.OK, 'Private coupons fetched successfully', {
            total,
            page: pageNumber,
            limit: limitNumber,
            coupons: mappedCoupons
        });
    } catch (error) {
        logger.error('Get private coupons error:', error);
        next(error);
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
