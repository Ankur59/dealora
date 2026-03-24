const PrivateCoupon = require('../models/PrivateCoupon');
const { successResponse, errorResponse } = require('../utils/responseHandler');
const { STATUS_CODES } = require('../config/constants');
const logger = require('../utils/logger');
const ImportedCoupons = require('../models/ImportedCoupons');

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
            status,
            page = 1,
            limit = 20
        } = req.body;

        /* 
           MODIFICATION: Made brands optional to allow dashboard to show all coupons 
           even when no apps are linked yet. 
           To revert, uncomment the validation block below.
        */
        /*
        if (!brands || !Array.isArray(brands) || brands.length === 0) {
            return errorResponse(res, STATUS_CODES.BAD_REQUEST, 'Please provide an array of brand names');
        }
        */

        logger.info(`Syncing private coupons for brands: ${brands?.join(', ') || 'ALL'}`);

        const query = {};

        // Brand Filter (Now Optional)
        if (brands && Array.isArray(brands) && brands.length > 0) {
            query.brandName = {
                $in: brands.map(b => new RegExp(`^${b.trim()}$`, 'i'))
            };
        }

        // Category Filter
        if (category && category !== 'All' && category !== 'See all') {
            query.categoryLabel = category;
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
                    { minimumOrderValue: 0 },//Had minimum order value in string in private coupon bun number in new one 
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
            const now = new Date();
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            const todayEnd = new Date();
            todayEnd.setHours(23, 59, 59, 999);

            const weekEnd = new Date();
            weekEnd.setDate(weekEnd.getDate() + (7 - weekEnd.getDay())); // End of current week
            weekEnd.setHours(23, 59, 59, 999);

            const monthEnd = new Date();
            monthEnd.setMonth(monthEnd.getMonth() + 1);
            monthEnd.setDate(0); // Last day of current month
            monthEnd.setHours(23, 59, 59, 999);

            if (validity === 'valid_today' || validity === 'Valid Today') {
                // Coupons that are currently valid (not expired)
                query.expiryDate = { $gte: now };
            } else if (validity === 'valid_this_week' || validity === 'Valid This Week') {
                // Coupons that are currently valid (not expired)
                query.expiryDate = { $gte: now };
            } else if (validity === 'valid_this_month' || validity === 'Valid This Month') {
                // Coupons that are currently valid (not expired)
                query.expiryDate = { $gte: now };
            } else if (validity === 'expiring_today' || validity === 'Expiring Today') {
                // Coupons that expire today specifically
                query.expiryDate = { $gte: now, $lte: todayEnd };
            } else if (validity === 'expiring_this_week' || validity === 'Expiring This Week') {
                // Coupons that expire within this week
                query.expiryDate = { $gte: now, $lte: weekEnd };
            } else if (validity === 'expiring_this_month' || validity === 'Expiring This Month') {
                // Coupons that expire within this month
                query.expiryDate = { $gte: now, $lte: monthEnd };
            } else if (validity === 'expired' || validity === 'Expired') {
                query.expiryDate = { $lt: now };
            } else if (validity === 'today') {
                // Legacy support
                query.expiryDate = { $gte: now, $lte: todayEnd };
            } else if (validity === 'week') {
                // Legacy support
                query.expiryDate = { $gte: now, $lte: weekEnd };
            } else if (validity === 'month') {
                // Legacy support
                query.expiryDate = { $gte: now, $lte: monthEnd };
            }
        }

        // Status Filter
        if (status === 'active') {
            query.status = "active";
            query.expireBy = { $gte: new Date() };
        } else if (status === 'expired') {
            query.status = "expired";
            query.expireBy = { $lt: new Date() };
        } else if (status === 'redeemed') {
            query.status = "redeemed";
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
        const total = await ImportedCoupons.countDocuments(query);

        const coupons = await ImportedCoupons.find(query)
            .sort(sortOptions)
            .limit(parseInt(limit))
            .skip(skip)
            .lean();

        // Calculate daysUntilExpiry dynamically based on current date
        const currentDate = new Date();
        currentDate.setHours(0, 0, 0, 0); // Reset time to start of day for accurate day calculation

        const couponsWithDynamicExpiry = coupons.map(coupon => {
            // Ensure couponTitle always has a value — fallback to couponName
            // (OCR/email-parsed coupons may not have couponTitle set)
            const couponTitle = coupon.couponTitle || coupon.couponName || 'Coupon';

            // NOTE: ImportedCoupons schema uses `expireBy` (not `expiryDate`)
            const expiryField = coupon.expireBy || coupon.expiryDate;

            if (expiryField) {
                const expiryDate = new Date(expiryField);
                expiryDate.setHours(0, 0, 0, 0);

                // Calculate difference in days
                const timeDiff = expiryDate.getTime() - currentDate.getTime();
                const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

                return {
                    ...coupon,
                    couponTitle,
                    daysUntilExpiry: daysDiff,
                    couponLink: coupon.websiteLink || null
                };
            }
            return { ...coupon, couponTitle, couponLink: coupon.websiteLink || null };
        });

        return successResponse(res, STATUS_CODES.OK, 'Private coupons synced successfully', {
            count: couponsWithDynamicExpiry.length,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / parseInt(limit)),
            coupons: couponsWithDynamicExpiry
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
        const uid = req.uid || req.body.uid; // Get UID from auth or body (optional)
        const { brands } = req.body; // Optional: brands to recalculate statistics

        const coupon = await ImportedCoupons.findById(id);

        if (!coupon) {
            return errorResponse(res, STATUS_CODES.NOT_FOUND, 'Private coupon not found');
        }

        if (coupon.redeemedAt) {
            return errorResponse(res, STATUS_CODES.BAD_REQUEST, 'Coupon is already redeemed or not redeemable');
        }

        // Update coupon status
        coupon.status = "redeemed";
        // coupon.redeemed = true;
        // coupon.redeemedBy = uid || null; // Optional: store uid if available
        coupon.redeemedAt = new Date();

        await coupon.save();

        logger.info(`Private coupon ${id} redeemed${uid ? ` by user ${uid}` : ''}`);

        // Calculate updated statistics
        const query = {};
        if (brands && Array.isArray(brands) && brands.length > 0) {
            query.brandName = {
                $in: brands.map(b => new RegExp(`^${b.trim()}$`, 'i'))
            };
        }

        const activeCouponsQuery = { ...query, status: "active" };
        const activeCoupons = await ImportedCoupons.find(activeCouponsQuery, { couponTitle: 1 }).lean();
        const activeCouponsCount = activeCoupons.length;

        // Calculate total savings
        let totalSavings = 0;

        if (brands && Array.isArray(brands) && brands.length > 0) {
            activeCoupons.forEach(c => {
                if (!c.discountValue) return;


                if (c.discountType === "flat") {
                    let flatAmount = c.discountValue > 0 ? c.discountValue : 0
                    totalSavings += flatAmount
                }
                // Commented because i don't thing we can calculate the disount if we don't know what it the spent amount 
                // else if (c.discountType === "percentage") {
                //     const amount = c.discountValue > 0 ? c.discountValue : 0
                //     const percentage = parseInt(amount, 10);
                //     const discount = Math.round((percentage / 100) * amount);
                //     totalSavings += discount;

                // }
            });

            if (totalSavings > 999) {
                totalSavings = 999;
            }
        }

        return successResponse(res, STATUS_CODES.OK, 'Coupon redeemed successfully', {
            coupon,
            updatedStatistics: {
                activeCouponsCount,
                totalSavings
            }
        });
    } catch (error) {
        logger.error(`Error redeeming private coupon: ${error.message}`);
        return errorResponse(res, STATUS_CODES.INTERNAL_SERVER_ERROR, 'An error occurred while redeeming the coupon');
    }
};

/**
 * Get private coupon statistics (active count and total savings)
 * @route GET /api/private-coupons/statistics
 * @body { brands?: string[] } - Optional array of brand names to filter statistics
 */
exports.getStatistics = async (req, res) => {
    try {
        const { brands } = req.body;

        const query = {};

        if (brands && Array.isArray(brands) && brands.length > 0) {
            query.brandName = {
                $in: brands.map(b => new RegExp(`^${b.trim()}$`, 'i'))
            };
            logger.info(`Fetching statistics for brands: ${brands.join(', ')}`);
        } else {
            logger.info('Fetching statistics for all brands');
        }

        // Get active coupons (redeemable = true) to calculate count and potential savings
        const activeCouponsQuery = { ...query, redeemable: true };
        const activeCoupons = await PrivateCoupon.find(activeCouponsQuery, { couponTitle: 1, description: 1 }).lean();
        let activeCouponsCount = activeCoupons.length;

        // Calculate total savings
        let totalSavings = 0;

        // If no brands provided, return hardcoded value
        if (!brands || !Array.isArray(brands) || brands.length === 0) {
            totalSavings = 0;
        } else {
            // Extract percentage and amount from each coupon, calculate actual discount
            activeCoupons.forEach(coupon => {
                if (!coupon.couponTitle) return;

                // Extract percentage (e.g., "20%" → 20)
                const percentMatch = coupon.couponTitle.match(/(\d+)%/);
                // Extract amount with rupee symbol (e.g., "₹1000" → 1000)
                const amountMatch = coupon.couponTitle.match(/₹\s*(\d+)/);

                if (percentMatch && amountMatch) {
                    const percentage = parseInt(percentMatch[1], 10);
                    const amount = parseInt(amountMatch[1], 10);

                    if (!isNaN(percentage) && !isNaN(amount)) {
                        // Calculate actual discount: percentage of amount
                        const discount = Math.round((percentage / 100) * amount);
                        totalSavings += discount;
                    }
                }
            });
        }


        const importedCoupon = await ImportedCoupons.find({ status: "active" }).lean()

        activeCouponsCount += importedCoupon.length
        

        let importedCouponSavings = 0

        importedCoupon.forEach((coupon) => {
            if (coupon.discountType === "flat") {
                importedCouponSavings += coupon.discountValue
            }
            else if (coupon.discountType === "percentage" && parseInt(coupon.minimumOrder) > 0) {
                importedCouponSavings += Math.round(((coupon.discountValue) / 100) * coupon.minimumOrder)
            }
        })


        // Combine savings
        totalSavings += importedCouponSavings

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

/**
 * Get unique categories for private coupons
 * @route GET /api/private-coupons/categories
 */
exports.getPrivateCategories = async (req, res) => {
    try {
        const categories = await ImportedCoupons.distinct('categoryLabel');
        return successResponse(res, STATUS_CODES.OK, 'Categories fetched successfully', categories);
    } catch (error) {
        logger.error(`Error fetching private categories: ${error.message}`);
        return errorResponse(res, STATUS_CODES.INTERNAL_SERVER_ERROR, 'Failed to fetch categories');
    }
};

/**
 * Get sort options for private coupons
 * @route GET /api/private-coupons/sort-options
 */
exports.getPrivateSortOptions = async (req, res) => {
    const sortOptions = [
        { label: 'Newest First', value: 'newest_first' },
        { label: 'Expiring Soon', value: 'expiring_soon' },
        { label: 'Brand (A-Z)', value: 'a_to_z' },
        { label: 'Brand (Z-A)', value: 'z_to_a' }
    ];
    return successResponse(res, STATUS_CODES.OK, 'Sort options fetched successfully', sortOptions);
};

/**
 * Get filter options for private coupons
 * @route GET /api/private-coupons/filter-options
 */
exports.getPrivateFilterOptions = async (req, res) => {
    try {
        const categories = await ImportedCoupons.distinct('categoryLabel');
        const brands = await ImportedCoupons.distinct('brandName');

        const filters = {
            categories,
            brands,
            discountTypes: ['percentage', 'flat', 'cashback', 'buy1get1', 'free_delivery']
        };

        return successResponse(res, STATUS_CODES.OK, 'Filter options fetched successfully', filters);
    } catch (error) {
        logger.error(`Error fetching filter options: ${error.message}`);
        return errorResponse(res, STATUS_CODES.INTERNAL_SERVER_ERROR, 'Failed to fetch filter options');
    }
};

/**
 * Generic getter for private coupons with filters
 * @route GET /api/private-coupons/
 */
exports.getPrivateCoupons = async (req, res) => {
    try {
        const {
            status,
            category,
            brand,
            search,
            sortBy = 'newest_first',
            page = 1,
            limit = 20
        } = req.query;

        const query = {};

        // Status Filter
        if (status === 'active') {
            query.status = "active";
            query.expireBy = { $gte: new Date() };
        } else if (status === 'expired') {
            query.status = "expired"
            query.expireBy = { $lt: new Date() };
        } else if (status === 'redeemed') {
            query.status = "redeemed";
        }

        if (category) query.category = category;
        if (brand) query.brandName = new RegExp(`^${brand.trim()}$`, 'i');

        if (search) {
            const searchRegex = new RegExp(search, 'i');
            query.$or = [
                { couponTitle: searchRegex },
                { brandName: searchRegex },
                { description: searchRegex }
            ];
        }

        let sortOptions = { createdAt: -1 };
        if (sortBy === 'expiring_soon') sortOptions = { expiryDate: 1 };
        else if (sortBy === 'a_to_z') sortOptions = { brandName: 1 };
        else if (sortBy === 'z_to_a') sortOptions = { brandName: -1 };

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const total = await ImportedCoupons.countDocuments(query);
        const coupons = await ImportedCoupons.find(query)
            .sort(sortOptions)
            .limit(parseInt(limit))
            .skip(skip)
            .lean();

        return successResponse(res, STATUS_CODES.OK, 'Coupons fetched successfully', {
            total,
            page: parseInt(page),
            coupons
        });
    } catch (error) {
        logger.error(`Error fetching private coupons: ${error.message}`);
        return errorResponse(res, STATUS_CODES.INTERNAL_SERVER_ERROR, 'Failed to fetch coupons');
    }
};

/**
 * Get all private coupons
 * @route GET /api/private-coupons/all
 */
exports.getAllPrivateCoupons = async (req, res) => {
    req.query.status = 'all';
    return exports.getPrivateCoupons(req, res);
};
