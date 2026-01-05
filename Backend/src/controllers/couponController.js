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

        // Filter Logic
        if (brand) query.brandName = new RegExp(brand, 'i');
        if (category) query.categoryLabel = category; // Exact match for category
        if (discountType) query.discountType = discountType;

        // Validity Filter (screenshot matching)
        if (req.query.validity) {
            const now = new Date();
            const todayEnd = new Date();
            todayEnd.setHours(23, 59, 59, 999);

            const weekEnd = new Date();
            weekEnd.setDate(weekEnd.getDate() + (7 - weekEnd.getDay())); // End of current week
            weekEnd.setHours(23, 59, 59, 999);

            const monthEnd = new Date();
            monthEnd.setMonth(monthEnd.getMonth() + 1);
            monthEnd.setDate(0); // Last day of current month
            monthEnd.setHours(23, 59, 59, 999);

            if (req.query.validity === 'today') {
                query.expireBy = { $gte: now, $lte: todayEnd };
            } else if (req.query.validity === 'week') {
                query.expireBy = { $gte: now, $lte: weekEnd };
            } else if (req.query.validity === 'month') {
                query.expireBy = { $gte: now, $lte: monthEnd };
            } else if (req.query.validity === 'expired') {
                query.status = 'expired'; // Override status if explicit expired filter
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

        // Sort Logic
        let sortOption = { createdAt: -1 }; // Default: newest
        if (sortBy === 'oldest') sortOption = { createdAt: 1 };
        else if (sortBy === 'expiring_soon') sortOption = { expireBy: 1 };
        else if (sortBy === 'highest_discount') sortOption = { discountValue: -1 }; // Best effort
        else if (sortBy === 'a_z') sortOption = { brandName: 1 };
        else if (sortBy === 'z_a') sortOption = { brandName: -1 };

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
                    categoryLabel: coupon.categoryLabel
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

        // Filter Logic
        if (brand) query.brandName = new RegExp(brand, 'i');
        if (category) query.categoryLabel = category;
        if (discountType) query.discountType = discountType;

        // Validity Filter
        if (req.query.validity) {
            const now = new Date();
            const todayEnd = new Date();
            todayEnd.setHours(23, 59, 59, 999);

            const weekEnd = new Date();
            weekEnd.setDate(weekEnd.getDate() + (7 - weekEnd.getDay()));
            weekEnd.setHours(23, 59, 59, 999);

            const monthEnd = new Date();
            monthEnd.setMonth(monthEnd.getMonth() + 1);
            monthEnd.setDate(0);
            monthEnd.setHours(23, 59, 59, 999);

            if (req.query.validity === 'today') {
                query.expireBy = { $gte: now, $lte: todayEnd };
            } else if (req.query.validity === 'week') {
                query.expireBy = { $gte: now, $lte: weekEnd };
            } else if (req.query.validity === 'month') {
                query.expireBy = { $gte: now, $lte: monthEnd };
            } else if (req.query.validity === 'expired') {
                query.status = 'expired';
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

        // Sort Logic
        let sortOption = { createdAt: -1 }; // Default: newest
        if (sortBy === 'oldest') sortOption = { createdAt: 1 };
        else if (sortBy === 'expiring_soon') sortOption = { expireBy: 1 };
        else if (sortBy === 'highest_discount') sortOption = { discountValue: -1 };
        else if (sortBy === 'a_z') sortOption = { brandName: 1 };
        else if (sortBy === 'z_a') sortOption = { brandName: -1 };

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
                        categoryLabel: coupon.categoryLabel
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
                        categoryLabel: coupon.categoryLabel
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
        const categories = ['Food', 'Fashion', 'Electronics', 'Travel', 'Health', 'Beauty', 'Payment', 'Other'];
        return successResponse(res, STATUS_CODES.OK, 'Categories fetched successfully', {
            categories
        });
    } catch (error) {
        logger.error('Get categories error:', error);
        next(error);
    }
};

module.exports = {
    createCoupon,
    getUserCoupons,
    getUserCouponsTest,
    getCouponById,
    updateCoupon,
    deleteCoupon,
    redeemCoupon,
    getExpiringSoon,
    getCouponsByBrand,
    getCategories
};
