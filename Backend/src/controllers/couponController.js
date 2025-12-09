const Coupon = require('../models/Coupon');
const { successResponse, errorResponse } = require('../utils/responseHandler');
const { STATUS_CODES, ERROR_MESSAGES } = require('../config/constants');
const { ConflictError, NotFoundError, ValidationError } = require('../middlewares/errorHandler');
const { addDisplayFields, addDisplayFieldsToArray } = require('../utils/couponHelpers');
const logger = require('../utils/logger');

const createCoupon = async (req, res, next) => {
    try {
        const userId = req.uid;
        const {
            couponName,
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

        const newCoupon = await Coupon.create(couponData);

        const couponWithDisplay = addDisplayFields(newCoupon);

        logger.info(`Coupon created successfully: ${newCoupon._id} for user: ${userId}`);

        return successResponse(res, STATUS_CODES.CREATED, 'Coupon created successfully', {
            coupon: couponWithDisplay,
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
        const { status, category, sortBy, order, page, limit } = req.query;

        logger.info(`Fetching coupons for user: ${userId}`);

        const query = { userId };

        if (status) {
            query.status = status;
        }

        if (category) {
            query.categoryLabel = category;
        }

        const sortOptions = {};
        if (sortBy) {
            const sortOrder = order === 'asc' ? 1 : -1;
            sortOptions[sortBy] = sortOrder;
        } else {
            sortOptions.createdAt = -1;
        }

        const pageNumber = parseInt(page) || 1;
        const limitNumber = parseInt(limit) || 10;
        const skip = (pageNumber - 1) * limitNumber;

        const coupons = await Coupon.find(query)
            .sort(sortOptions)
            .skip(skip)
            .limit(limitNumber)
            .lean();

        const totalCoupons = await Coupon.countDocuments(query);

        const couponsWithDisplay = addDisplayFieldsToArray(coupons);

        const totalPages = Math.ceil(totalCoupons / limitNumber);

        logger.info(`Fetched ${coupons.length} coupons for user: ${userId}`);

        return successResponse(res, STATUS_CODES.OK, 'Coupons fetched successfully', {
            coupons: couponsWithDisplay,
            pagination: {
                currentPage: pageNumber,
                totalPages,
                totalCoupons,
                limit: limitNumber,
            },
        });
    } catch (error) {
        logger.error('Get user coupons error:', error);
        next(error);
    }
};

const getCouponById = async (req, res, next) => {
    try {
        const userId = req.uid;
        const { id } = req.params;

        logger.info(`Fetching coupon: ${id} for user: ${userId}`);

        const coupon = await Coupon.findOne({ _id: id, userId }).lean();

        if (!coupon) {
            logger.warn(`Coupon not found: ${id} for user: ${userId}`);
            throw new NotFoundError('Coupon not found');
        }

        const couponWithDisplay = addDisplayFields(coupon);

        logger.info(`Coupon fetched successfully: ${id}`);

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
        const {
            couponName,
            description,
            expireBy,
            categoryLabel,
            useCouponVia,
            couponCode,
            couponVisitingLink,
            couponDetails,
        } = req.body;

        logger.info(`Updating coupon: ${id} for user: ${userId}`);

        const coupon = await Coupon.findOne({ _id: id, userId });

        if (!coupon) {
            logger.warn(`Coupon not found: ${id} for user: ${userId}`);
            throw new NotFoundError('Coupon not found');
        }

        if (coupon.status !== 'active') {
            logger.warn(`Cannot update coupon with status: ${coupon.status}`);
            throw new ValidationError('Cannot update redeemed or expired coupons');
        }

        const allowedFields = [
            'couponName',
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

        logger.info(`Coupon updated successfully: ${id}`);

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

        logger.info(`Redeeming coupon: ${id} for user: ${userId}`);

        const coupon = await Coupon.findOne({ _id: id, userId });

        if (!coupon) {
            logger.warn(`Coupon not found: ${id} for user: ${userId}`);
            throw new NotFoundError('Coupon not found');
        }

        if (coupon.status === 'redeemed') {
            logger.warn(`Coupon already redeemed: ${id}`);
            throw new ValidationError('Coupon already redeemed');
        }

        if (coupon.status === 'expired') {
            logger.warn(`Cannot redeem expired coupon: ${id}`);
            throw new ValidationError('Cannot redeem expired coupon');
        }

        coupon.status = 'redeemed';
        coupon.redeemedAt = new Date();

        await coupon.save();

        const couponWithDisplay = addDisplayFields(coupon);

        logger.info(`Coupon redeemed successfully: ${id}`);

        return successResponse(res, STATUS_CODES.OK, 'Coupon redeemed successfully', {
            coupon: couponWithDisplay,
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

        logger.info(`Deleting coupon: ${id} for user: ${userId}`);

        const coupon = await Coupon.findOneAndDelete({ _id: id, userId });

        if (!coupon) {
            logger.warn(`Coupon not found: ${id} for user: ${userId}`);
            throw new NotFoundError('Coupon not found');
        }

        logger.info(`Coupon deleted successfully: ${id}`);

        return successResponse(res, STATUS_CODES.OK, 'Coupon deleted successfully', {
            deletedCouponId: id,
        });
    } catch (error) {
        logger.error('Delete coupon error:', error);
        next(error);
    }
};

module.exports = {
    createCoupon,
    getUserCoupons,
    getCouponById,
    updateCoupon,
    redeemCoupon,
    deleteCoupon,
};

