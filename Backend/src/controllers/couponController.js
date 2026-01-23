const Coupon = require('../models/Coupon');
const { successResponse, errorResponse } = require('../utils/responseHandler');
const { STATUS_CODES, ERROR_MESSAGES } = require('../config/constants');
const { ConflictError, NotFoundError, ValidationError } = require('../middlewares/errorHandler');
const { addDisplayFields } = require('../utils/couponHelpers');
const { generateCouponImage } = require('../services/couponImageService');
const logger = require('../utils/logger');

const createCoupon = async (req, res, next) => {
    try {
        const userId = req.uid;
        const {
            couponName,
            brandName,
            description,
            expireBy,
            categoryLabel,
            useCouponVia,
            couponCode,
            couponVisitingLink,
            couponDetails,
            minimumOrder,
        } = req.body;

        logger.info(`Creating coupon for user: ${userId}, coupon: ${couponName}`);

        const couponData = {
            userId,
            couponName,
            brandName: brandName || 'General',
            description,
            expireBy,
            categoryLabel,
            useCouponVia,
            couponDetails: couponDetails || null,
            minimumOrder: minimumOrder || null,
            addedMethod: 'manual',
        };

        if (couponCode) {
            couponData.couponCode = couponCode.toUpperCase().trim();
        }

        if (couponVisitingLink) {
            couponData.couponVisitingLink = couponVisitingLink.trim();
        }

        const couponWithDisplay = addDisplayFields(couponData);

        // Generate base64 image
        const imageBase64 = await generateCouponImage(couponWithDisplay);
        couponData.base64ImageUrl = `data:image/png;base64,${imageBase64}`;

        const newCoupon = await Coupon.create(couponData);

        logger.info(`Coupon created successfully: ${newCoupon._id} for user: ${userId}`);

        return successResponse(res, STATUS_CODES.CREATED, 'Coupon created successfully', {
            id: newCoupon._id,
            couponImageBase64: newCoupon.base64ImageUrl
        });
    } catch (error) {
        logger.error('Create coupon error:', error);

        if (error.code === 11000) {
            return next(new ConflictError('Coupon with this information already exists'));
        }

        if (error.message.includes('required')) {
            return next(new ValidationError(error.message));
        }

        next(error);
    }
};

const getUserCoupons = async (req, res, next) => {
    try {
        const userId = req.uid;
        const {
            brand,
            category,
            discountType,
            status = 'active',
            search,
            sortBy = 'newest',
            page = 1,
            limit = 20
        } = req.query;

        // Build query object
        const query = {
            $or: [
                { userId: userId },
                { userId: 'system_scraper' }
            ],
            status
        };

        // Filter Logic - Brand
        if (brand) {
            query.brandName = new RegExp(brand, 'i');
        }

        // Filter Logic - Category
        if (category && category !== 'All' && category !== 'See all') {
            query.categoryLabel = category; // Exact match for category
        }

        // Filter Logic - Discount Type (matching screenshot options)
        if (discountType) {
            if (discountType === 'Saved Coupons') {
                query.userId = userId;
                delete query.$or;
            } else if (discountType === 'percentage_off' || discountType === 'Percentage Off') {
                query.discountType = 'percentage';
            } else if (discountType === 'flat_discount' || discountType === 'Flat Discount') {
                query.discountType = 'flat';
            } else if (discountType === 'cashback' || discountType === 'Cashback') {
                query.discountType = 'cashback';
            } else if (discountType === 'buy1get1' || discountType === 'Buy 1 Get 1') {
                query.discountType = 'buy1get1';
            } else if (discountType === 'free_delivery' || discountType === 'Free Delivery') {
                query.discountType = 'free_delivery';
            } else if (discountType === 'wallet_upi' || discountType === 'Wallet/UPI Offers') {
                query.discountType = 'wallet_upi';
            } else if (discountType === 'prepaid_only' || discountType === 'Prepaid Only Offers') {
                query.discountType = 'prepaid_only';
            } else {
                // Direct match for standard discount types
                query.discountType = discountType;
            }
        }

        // Filter Logic - Price/Minimum Order (matching screenshot options)
        if (req.query.minimumOrder || req.query.price) {
            const priceFilter = req.query.minimumOrder || req.query.price;

            if (priceFilter === 'no_minimum' || priceFilter === 'No Minimum Order') {
                // Use $and to combine with existing $or query
                if (!query.$and) query.$and = [];
                query.$and.push({
                    $or: [
                        { minimumOrder: null },
                        { minimumOrder: 0 },
                        { minimumOrder: { $exists: false } }
                    ]
                });
            } else if (priceFilter === 'below_300' || priceFilter === 'Minimum Order Below ₹300') {
                query.minimumOrder = { $lt: 300 };
            } else if (priceFilter === '300_700' || priceFilter === '₹300-₹700') {
                query.minimumOrder = { $gte: 300, $lte: 700 };
            } else if (priceFilter === '700_1500' || priceFilter === '₹700-₹1500') {
                query.minimumOrder = { $gte: 700, $lte: 1500 };
            } else if (priceFilter === 'above_1500' || priceFilter === 'Above ₹1500') {
                query.minimumOrder = { $gt: 1500 };
            }
        }

        // Filter Logic - Validity (matching screenshot options)
        if (req.query.validity) {
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

            if (req.query.validity === 'valid_today' || req.query.validity === 'Valid Today') {
                query.expireBy = { $gte: now, $lte: todayEnd };
                query.status = 'active';
            } else if (req.query.validity === 'valid_this_week' || req.query.validity === 'Valid This Week') {
                query.expireBy = { $gte: now, $lte: weekEnd };
                query.status = 'active';
            } else if (req.query.validity === 'valid_this_month' || req.query.validity === 'Valid This Month') {
                query.expireBy = { $gte: now, $lte: monthEnd };
                query.status = 'active';
            } else if (req.query.validity === 'expired' || req.query.validity === 'Expired') {
                query.status = 'expired';
            } else if (req.query.validity === 'today') {
                // Legacy support
                query.expireBy = { $gte: now, $lte: todayEnd };
            } else if (req.query.validity === 'week') {
                // Legacy support
                query.expireBy = { $gte: now, $lte: weekEnd };
            } else if (req.query.validity === 'month') {
                // Legacy support
                query.expireBy = { $gte: now, $lte: monthEnd };
            }
        }

        // Search Logic
        if (search) {
            const searchRegex = new RegExp(search, 'i');
            query.$and = [
                {
                    $or: [
                        { couponName: searchRegex },
                        { brandName: searchRegex },
                        { description: searchRegex },
                        { couponTitle: searchRegex },
                        { categoryLabel: searchRegex }
                    ]
                }
            ];
        }

        logger.info(`Fetching coupons. Filters: brand=${brand}, category=${category}, discountType=${discountType}, search=${search}, sortBy=${sortBy}`);

        // Sort Logic - matching screenshot options
        let sortOption = {};
        if (sortBy === 'none' || sortBy === 'None') {
            // No sorting - return in natural order
            sortOption = {};
        } else if (sortBy === 'newest' || sortBy === 'newest_first') {
            sortOption = { createdAt: -1 };
        } else if (sortBy === 'oldest') {
            sortOption = { createdAt: 1 };
        } else if (sortBy === 'expiring_soon' || sortBy === 'expiring_soon_first') {
            sortOption = { expireBy: 1 };
        } else if (sortBy === 'highest_discount') {
            // Sort by discount value descending (highest first)
            sortOption = { discountValue: -1 };
        } else if (sortBy === 'lowest_minimum_order') {
            // Sort by minimum order ascending (lowest first)
            sortOption = { minimumOrder: 1 };
        } else if (sortBy === 'a_z' || sortBy === 'a_to_z') {
            sortOption = { brandName: 1 };
        } else if (sortBy === 'z_a' || sortBy === 'z_to_a') {
            sortOption = { brandName: -1 };
        } else {
            // Default: newest first
            sortOption = { createdAt: -1 };
        }

        const pageNumber = parseInt(page) || 1;
        const limitNumber = parseInt(limit) || 20;
        const skip = (pageNumber - 1) * limitNumber;

        const coupons = await Coupon.find(query)
            .sort(sortOption)
            .skip(skip)
            .limit(limitNumber);

        const total = await Coupon.countDocuments(query);

        // Use stored base64 images or generate if missing
        const couponsWithImages = await Promise.all(
            coupons.map(async (coupon) => {
                let imageBase64 = coupon.base64ImageUrl;

                // Generate base64 image if not stored
                if (!imageBase64) {
                    try {
                        const couponWithDisplay = addDisplayFields(coupon);
                        const generatedBase64 = await generateCouponImage(couponWithDisplay);
                        imageBase64 = `data:image/png;base64,${generatedBase64}`;

                        // Store the generated image in the database for future use
                        coupon.base64ImageUrl = imageBase64;
                        await coupon.save();
                    } catch (error) {
                        logger.error(`Failed to generate image for coupon ${coupon._id}:`, error);
                        imageBase64 = null;
                    }
                }

                return {
                    id: coupon._id,
                    brandName: coupon.brandName,
                    couponTitle: coupon.couponTitle || coupon.couponName,
                    couponImageBase64: imageBase64,
                    expireBy: coupon.expireBy,
                    discountType: coupon.discountType,
                    discountValue: coupon.discountValue,
                    categoryLabel: coupon.categoryLabel,
                    minimumOrder: coupon.minimumOrder || null
                };
            })
        );

        return successResponse(res, STATUS_CODES.OK, 'Coupons fetched successfully', {
            total,
            page: pageNumber,
            limit: limitNumber,
            coupons: couponsWithImages
        });
    } catch (error) {
        logger.error('Get user coupons error:', error);
        next(error);
    }
};

// Test version - accepts uid from query parameter (no auth required)
const getUserCouponsTest = async (req, res, next) => {
    try {
        const { uid } = req.query;

        if (!uid) {
            return errorResponse(res, STATUS_CODES.BAD_REQUEST, 'uid query parameter is required');
        }

        const {
            brand,
            category,
            discountType,
            status = 'active',
            search,
            sortBy = 'newest',
            page = 1,
            limit = 20
        } = req.query;

        const query = {
            $or: [
                { userId: uid },
                { userId: 'system_scraper' }
            ],
            status
        };

        // Filter Logic - Brand
        if (brand) {
            query.brandName = new RegExp(brand, 'i');
        }

        // Filter Logic - Category
        if (category && category !== 'All' && category !== 'See all') {
            query.categoryLabel = category;
        }

        // Filter Logic - Discount Type (matching screenshot options)
        if (discountType) {
            if (discountType === 'Saved Coupons') {
                query.userId = uid;
                delete query.$or;
            } else if (discountType === 'percentage_off' || discountType === 'Percentage Off') {
                query.discountType = 'percentage';
            } else if (discountType === 'flat_discount' || discountType === 'Flat Discount') {
                query.discountType = 'flat';
            } else if (discountType === 'cashback' || discountType === 'Cashback') {
                query.discountType = 'cashback';
            } else if (discountType === 'buy1get1' || discountType === 'Buy 1 Get 1') {
                query.discountType = 'buy1get1';
            } else if (discountType === 'free_delivery' || discountType === 'Free Delivery') {
                query.discountType = 'free_delivery';
            } else if (discountType === 'wallet_upi' || discountType === 'Wallet/UPI Offers') {
                query.discountType = 'wallet_upi';
            } else if (discountType === 'prepaid_only' || discountType === 'Prepaid Only Offers') {
                query.discountType = 'prepaid_only';
            } else {
                query.discountType = discountType;
            }
        }

        // Filter Logic - Price/Minimum Order (matching screenshot options)
        if (req.query.minimumOrder || req.query.price) {
            const priceFilter = req.query.minimumOrder || req.query.price;

            if (priceFilter === 'no_minimum' || priceFilter === 'No Minimum Order') {
                // Use $and to combine with existing $or query
                if (!query.$and) query.$and = [];
                query.$and.push({
                    $or: [
                        { minimumOrder: null },
                        { minimumOrder: 0 },
                        { minimumOrder: { $exists: false } }
                    ]
                });
            } else if (priceFilter === 'below_300' || priceFilter === 'Minimum Order Below ₹300') {
                query.minimumOrder = { $lt: 300 };
            } else if (priceFilter === '300_700' || priceFilter === '₹300-₹700') {
                query.minimumOrder = { $gte: 300, $lte: 700 };
            } else if (priceFilter === '700_1500' || priceFilter === '₹700-₹1500') {
                query.minimumOrder = { $gte: 700, $lte: 1500 };
            } else if (priceFilter === 'above_1500' || priceFilter === 'Above ₹1500') {
                query.minimumOrder = { $gt: 1500 };
            }
        }

        // Filter Logic - Validity (matching screenshot options)
        if (req.query.validity) {
            const now = new Date();
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            const todayEnd = new Date();
            todayEnd.setHours(23, 59, 59, 999);

            const weekEnd = new Date();
            weekEnd.setDate(weekEnd.getDate() + (7 - weekEnd.getDay()));
            weekEnd.setHours(23, 59, 59, 999);

            const monthEnd = new Date();
            monthEnd.setMonth(monthEnd.getMonth() + 1);
            monthEnd.setDate(0);
            monthEnd.setHours(23, 59, 59, 999);

            if (req.query.validity === 'valid_today' || req.query.validity === 'Valid Today') {
                query.expireBy = { $gte: now, $lte: todayEnd };
                query.status = 'active';
            } else if (req.query.validity === 'valid_this_week' || req.query.validity === 'Valid This Week') {
                query.expireBy = { $gte: now, $lte: weekEnd };
                query.status = 'active';
            } else if (req.query.validity === 'valid_this_month' || req.query.validity === 'Valid This Month') {
                query.expireBy = { $gte: now, $lte: monthEnd };
                query.status = 'active';
            } else if (req.query.validity === 'expired' || req.query.validity === 'Expired') {
                query.status = 'expired';
            } else if (req.query.validity === 'today') {
                query.expireBy = { $gte: now, $lte: todayEnd };
            } else if (req.query.validity === 'week') {
                query.expireBy = { $gte: now, $lte: weekEnd };
            } else if (req.query.validity === 'month') {
                query.expireBy = { $gte: now, $lte: monthEnd };
            }
        }

        // Search Logic
        if (search) {
            const searchRegex = new RegExp(search, 'i');
            query.$and = [
                {
                    $or: [
                        { couponName: searchRegex },
                        { brandName: searchRegex },
                        { description: searchRegex },
                        { couponTitle: searchRegex },
                        { categoryLabel: searchRegex }
                    ]
                }
            ];
        }

        logger.info(`[TEST] Fetching coupons for uid: ${uid}. Filters: brand=${brand}, category=${category}, search=${search}, sortBy=${sortBy}`);

        // Sort Logic - matching screenshot options
        let sortOption = {};
        if (sortBy === 'none' || sortBy === 'None') {
            // No sorting - return in natural order
            sortOption = {};
        } else if (sortBy === 'newest' || sortBy === 'newest_first') {
            sortOption = { createdAt: -1 };
        } else if (sortBy === 'oldest') {
            sortOption = { createdAt: 1 };
        } else if (sortBy === 'expiring_soon' || sortBy === 'expiring_soon_first') {
            sortOption = { expireBy: 1 };
        } else if (sortBy === 'highest_discount') {
            // Sort by discount value descending (highest first)
            sortOption = { discountValue: -1 };
        } else if (sortBy === 'lowest_minimum_order') {
            // Sort by minimum order ascending (lowest first)
            sortOption = { minimumOrder: 1 };
        } else if (sortBy === 'a_z' || sortBy === 'a_to_z') {
            sortOption = { brandName: 1 };
        } else if (sortBy === 'z_a' || sortBy === 'z_to_a') {
            sortOption = { brandName: -1 };
        } else {
            // Default: newest first
            sortOption = { createdAt: -1 };
        }

        const pageNumber = parseInt(page) || 1;
        const limitNumber = parseInt(limit) || 20;
        const skip = (pageNumber - 1) * limitNumber;

        const coupons = await Coupon.find(query)
            .sort(sortOption)
            .skip(skip)
            .limit(limitNumber);

        const total = await Coupon.countDocuments(query);

        const couponsWithImages = await Promise.all(
            coupons.map(async (coupon) => {
                const couponWithDisplay = addDisplayFields(coupon);
                try {
                    const imageBase64 = await generateCouponImage(couponWithDisplay);
                    return {
                        id: coupon._id,
                        brandName: coupon.brandName,
                        couponTitle: coupon.couponTitle || coupon.couponName,
                        couponImageBase64: `data:image/png;base64,${imageBase64}`,
                        expireBy: coupon.expireBy,
                        discountType: coupon.discountType,
                        discountValue: coupon.discountValue,
                        description: coupon.description,
                        categoryLabel: coupon.categoryLabel,
                        minimumOrder: coupon.minimumOrder || null
                    };
                } catch (error) {
                    logger.error(`Failed to generate image for coupon ${coupon._id}:`, error);
                    return {
                        id: coupon._id,
                        brandName: coupon.brandName,
                        couponTitle: coupon.couponTitle || coupon.couponName,
                        couponImageBase64: null,
                        expireBy: coupon.expireBy,
                        discountType: coupon.discountType,
                        discountValue: coupon.discountValue,
                        categoryLabel: coupon.categoryLabel,
                        minimumOrder: coupon.minimumOrder || null
                    };
                }
            })
        );

        return successResponse(res, STATUS_CODES.OK, 'Coupons fetched successfully', {
            total,
            page: pageNumber,
            limit: limitNumber,
            coupons: couponsWithImages
        });
    } catch (error) {
        logger.error('[TEST] Get user coupons error:', error);
        next(error);
    }
};

const getExpiringSoon = async (req, res, next) => {
    try {
        const userId = req.uid;
        const sevenDaysFromNow = new Date();
        sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

        const query = {
            $or: [
                { userId: userId },
                { userId: 'system_scraper' }
            ],
            status: 'active',
            expireBy: {
                $gte: new Date(),
                $lte: sevenDaysFromNow
            }
        };

        const coupons = await Coupon.find(query).sort({ expireBy: 1 });

        const minimalCoupons = coupons.map(c => ({
            id: c._id,
            brandName: c.brandName,
            couponTitle: c.couponTitle || c.couponName,
            expireBy: c.expireBy
        }));

        return successResponse(res, STATUS_CODES.OK, 'Expiring soon coupons fetched', {
            count: coupons.length,
            coupons: minimalCoupons
        });
    } catch (error) {
        next(error);
    }
};

const getCouponsByBrand = async (req, res, next) => {
    try {
        const { brandName } = req.params;
        const userId = req.uid;

        const query = {
            $or: [
                { userId: userId },
                { userId: 'system_scraper' }
            ],
            brandName: new RegExp(`^${brandName}$`, 'i'),
            status: 'active'
        };

        const coupons = await Coupon.find(query).sort({ createdAt: -1 });

        return successResponse(res, STATUS_CODES.OK, `Coupons for ${brandName} fetched`, {
            count: coupons.length,
            coupons: coupons.map(c => ({
                id: c._id,
                brandName: c.brandName,
                couponTitle: c.couponTitle || c.couponName
            }))
        });
    } catch (error) {
        next(error);
    }
};

const getCouponById = async (req, res, next) => {
    try {
        const userId = req.uid;
        const { id } = req.params;

        logger.info(`Fetching coupon: ${id} for user: ${userId}`);

        const coupon = await Coupon.findOne({
            _id: id,
            $or: [{ userId: userId }, { userId: 'system_scraper' }]
        }).lean();

        if (!coupon) {
            logger.warn(`Coupon not found: ${id}`);
            throw new NotFoundError('Coupon not found');
        }

        const couponWithDisplay = addDisplayFields(coupon);

        return successResponse(res, STATUS_CODES.OK, 'Coupon fetched successfully', {
            coupon: couponWithDisplay,
        });
    } catch (error) {
        logger.error('Get coupon by id error:', error);
        next(error);
    }
};

// Test version - accepts uid from query parameter (no auth required)
const getCouponByIdTest = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { uid } = req.query;

        if (!uid) {
            return errorResponse(res, STATUS_CODES.BAD_REQUEST, 'uid query parameter is required');
        }

        logger.info(`[TEST] Fetching coupon: ${id} for uid: ${uid}`);

        const coupon = await Coupon.findOne({
            _id: id,
            $or: [{ userId: uid }, { userId: 'system_scraper' }]
        }).lean();

        if (!coupon) {
            logger.warn(`[TEST] Coupon not found: ${id}`);
            throw new NotFoundError('Coupon not found');
        }

        const couponWithDisplay = addDisplayFields(coupon);

        return successResponse(res, STATUS_CODES.OK, 'Coupon fetched successfully', {
            coupon: couponWithDisplay,
        });
    } catch (error) {
        logger.error('[TEST] Get coupon by id error:', error);
        next(error);
    }
};

const updateCoupon = async (req, res, next) => {
    try {
        const userId = req.uid;
        const { id } = req.params;

        logger.info(`Updating coupon: ${id} for user: ${userId}`);

        const coupon = await Coupon.findOne({ _id: id, userId });

        if (!coupon) {
            logger.warn(`Coupon not found or unauthorized: ${id}`);
            throw new NotFoundError('Coupon not found or unauthorized');
        }

        if (coupon.status !== 'active') {
            throw new ValidationError('Cannot update redeemed or expired coupons');
        }

        const allowedFields = [
            'couponName',
            'brandName',
            'description',
            'expireBy',
            'categoryLabel',
            'useCouponVia',
            'couponCode',
            'couponVisitingLink',
            'couponDetails',
            'minimumOrder',
        ];

        allowedFields.forEach((field) => {
            if (req.body[field] !== undefined) {
                if (field === 'couponCode' && req.body[field]) {
                    coupon[field] = req.body[field].toUpperCase().trim();
                } else {
                    coupon[field] = req.body[field];
                }
            }
        });

        await coupon.save();

        const couponWithDisplay = addDisplayFields(coupon);

        return successResponse(res, STATUS_CODES.OK, 'Coupon updated successfully', {
            coupon: couponWithDisplay,
        });
    } catch (error) {
        logger.error('Update coupon error:', error);
        next(error);
    }
};

const redeemCoupon = async (req, res, next) => {
    try {
        const userId = req.uid;
        const { id } = req.params;

        const coupon = await Coupon.findOne({ _id: id, userId });

        if (!coupon) {
            throw new NotFoundError('Coupon not found or unauthorized');
        }

        if (coupon.status === 'redeemed') {
            throw new ValidationError('Coupon already redeemed');
        }

        if (coupon.status === 'expired') {
            throw new ValidationError('Cannot redeem expired coupon');
        }

        coupon.status = 'redeemed';
        coupon.redeemedAt = new Date();

        await coupon.save();

        return successResponse(res, STATUS_CODES.OK, 'Coupon redeemed successfully', {
            coupon: addDisplayFields(coupon),
        });
    } catch (error) {
        logger.error('Redeem coupon error:', error);
        next(error);
    }
};

const deleteCoupon = async (req, res, next) => {
    try {
        const userId = req.uid;
        const { id } = req.params;

        const coupon = await Coupon.findOneAndDelete({ _id: id, userId });

        if (!coupon) {
            throw new NotFoundError('Coupon not found or unauthorized');
        }

        return successResponse(res, STATUS_CODES.OK, 'Coupon deleted successfully', {
            id,
        });
    } catch (error) {
        logger.error('Delete coupon error:', error);
        next(error);
    }
};

const getCategories = async (req, res, next) => {
    try {
        // Categories matching screenshot
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
        return successResponse(res, STATUS_CODES.OK, 'Categories fetched successfully', {
            categories
        });
    } catch (error) {
        logger.error('Get categories error:', error);
        next(error);
    }
};

const getSortOptions = async (req, res, next) => {
    try {
        // Sort options matching the screenshot exactly
        const sortOptions = [
            { value: 'none', label: 'None' },
            { value: 'newest_first', label: 'Newest First' },
            { value: 'expiring_soon', label: 'Expiring Soon' },
            { value: 'highest_discount', label: 'Highest Discount' },
            { value: 'lowest_minimum_order', label: 'Lowest Minimum Order' },
            { value: 'a_to_z', label: 'A-Z (Brand Name)' },
            { value: 'z_to_a', label: 'Z-A (Brand Name)' }
        ];

        return successResponse(res, STATUS_CODES.OK, 'Sort options fetched successfully', {
            sortOptions
        });
    } catch (error) {
        logger.error('Get sort options error:', error);
        next(error);
    }
};

const getFilterOptions = async (req, res, next) => {
    try {
        // Discount Type options matching screenshot
        const discountTypes = [
            { value: 'percentage_off', label: 'Percentage Off (% Off)' },
            { value: 'flat_discount', label: 'Flat Discount' },
            { value: 'cashback', label: 'Cashback' },
            { value: 'buy1get1', label: 'Buy 1 Get 1' },
            { value: 'free_delivery', label: 'Free Delivery' },
            { value: 'wallet_upi', label: 'Wallet/UPI Offers' },
            { value: 'prepaid_only', label: 'Prepaid Only Offers' },
            { value: 'saved_coupons', label: 'Saved Coupons' }
        ];

        // Price/Minimum Order options matching screenshot
        const priceOptions = [
            { value: 'no_minimum', label: 'No Minimum Order' },
            { value: 'below_300', label: 'Minimum Order Below ₹300' },
            { value: '300_700', label: '₹300-₹700' },
            { value: '700_1500', label: '₹700-₹1500' },
            { value: 'above_1500', label: 'Above ₹1500' }
        ];

        // Validity options matching screenshot
        const validityOptions = [
            { value: 'valid_today', label: 'Valid Today' },
            { value: 'valid_this_week', label: 'Valid This Week' },
            { value: 'valid_this_month', label: 'Valid This Month' },
            { value: 'expired', label: 'Expired' }
        ];

        // Get unique brands from database
        const brands = await Coupon.distinct('brandName', {
            $or: [
                { userId: req.uid },
                { userId: 'system_scraper' }
            ]
        });

        const brandOptions = brands
            .filter(b => b && b.trim() !== '')
            .sort()
            .map(brand => ({ value: brand, label: brand }));

        // Category options (already have this, but include here for completeness)
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

        return successResponse(res, STATUS_CODES.OK, 'Filter options fetched successfully', {
            discountTypes,
            priceOptions,
            validityOptions,
            brandOptions,
            categoryOptions
        });
    } catch (error) {
        logger.error('Get filter options error:', error);
        next(error);
    }
};

module.exports = {
    createCoupon,
    getUserCoupons,
    getUserCouponsTest,
    getCouponById,
    getCouponByIdTest,
    updateCoupon,
    deleteCoupon,
    redeemCoupon,
    getExpiringSoon,
    getCouponsByBrand,
    getCategories,
    getSortOptions,
    getFilterOptions
};
