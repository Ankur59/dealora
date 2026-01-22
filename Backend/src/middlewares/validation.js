const { body, validationResult } = require('express-validator');
const { errorResponse } = require('../utils/responseHandler');
const { STATUS_CODES, ERROR_MESSAGES, USER_CONSTANTS } = require('../config/constants');
const { isValidPhoneNumber, isValidUrl } = require('../utils/validators');

const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        const errorMessages = errors.array().map((error) => ({
            field: error.path || error.param,
            message: error.msg,
            value: error.value,
        }));

        return errorResponse(
            res,
            STATUS_CODES.BAD_REQUEST,
            ERROR_MESSAGES.VALIDATION_ERROR,
            errorMessages
        );
    }

    next();
};

const validateSignup = [
    body('uid')
        .trim()
        .notEmpty()
        .withMessage('Firebase UID is required')
        .isString()
        .withMessage('UID must be a string')
        .isLength({ min: 1 })
        .withMessage('UID cannot be empty'),

    body('name')
        .trim()
        .notEmpty()
        .withMessage('Name is required')
        .isLength({ min: USER_CONSTANTS.NAME_MIN_LENGTH, max: USER_CONSTANTS.NAME_MAX_LENGTH })
        .withMessage(`Name must be between ${USER_CONSTANTS.NAME_MIN_LENGTH} and ${USER_CONSTANTS.NAME_MAX_LENGTH} characters`)
        .matches(/^[a-zA-Z\s]+$/)
        .withMessage('Name must contain only alphabetic characters and spaces'),

    body('email')
        .trim()
        .notEmpty()
        .withMessage('Email is required')
        .isEmail()
        .withMessage('Invalid email format')
        .normalizeEmail(),

    body('phone')
        .trim()
        .notEmpty()
        .withMessage('Phone number is required')
        .custom((value) => {
            if (!isValidPhoneNumber(value)) {
                throw new Error('Invalid Indian phone number format. Use 10 digits starting with 6-9 or +91 followed by 10 digits');
            }
            return true;
        }),

    handleValidationErrors,
];

const validateLogin = [
    body('uid')
        .trim()
        .notEmpty()
        .withMessage('Firebase UID is required')
        .isString()
        .withMessage('UID must be a string')
        .isLength({ min: 1 })
        .withMessage('UID cannot be empty'),

    handleValidationErrors,
];

const validateProfileUpdate = [
    body('name')
        .optional()
        .trim()
        .isLength({ min: USER_CONSTANTS.NAME_MIN_LENGTH, max: USER_CONSTANTS.NAME_MAX_LENGTH })
        .withMessage(`Name must be between ${USER_CONSTANTS.NAME_MIN_LENGTH} and ${USER_CONSTANTS.NAME_MAX_LENGTH} characters`)
        .matches(/^[a-zA-Z\s]+$/)
        .withMessage('Name must contain only alphabetic characters and spaces'),

    body('email')
        .optional()
        .trim()
        .notEmpty()
        .withMessage('Email cannot be empty if provided')
        .isEmail()
        .withMessage('Invalid email format')
        .normalizeEmail(),

    body('phone')
        .optional()
        .trim()
        .notEmpty()
        .withMessage('Phone number cannot be empty if provided')
        .custom((value) => {
            if (!isValidPhoneNumber(value)) {
                throw new Error('Invalid Indian phone number format. Use 10 digits starting with 6-9 or +91 followed by 10 digits');
            }
            return true;
        }),

    body('profilePicture')
        .optional()
        .isString()
        .withMessage('Profile picture must be a string')
        .custom((value) => {
            // Accept base64 strings or null/empty
            if (value && value !== null && value !== '') {
                // Check size limit (5MB for base64 string ~ 6.7MB original due to base64 encoding overhead)
                const maxSize = 5 * 1024 * 1024; // 5MB
                if (value.length > maxSize) {
                    throw new Error('Profile picture size exceeds maximum allowed size of 5MB');
                }
                
                // Check if it's a base64 string (data URI format or raw base64)
                const base64Regex = /^data:image\/(png|jpg|jpeg|gif|webp|bmp);base64,/;
                const isDataUri = base64Regex.test(value);
                
                if (!isDataUri && value.length > 10) {
                    const base64OnlyRegex = /^[A-Za-z0-9+/=]+$/;
                    if (!base64OnlyRegex.test(value)) {
                        throw new Error('Profile picture must be a valid base64 encoded image (with or without data URI prefix)');
                    }
                }
            }
            return true;
        }),

    handleValidationErrors,
];

const couponValidationRules = [
    body('couponName')
        .trim()
        .notEmpty()
        .withMessage('Coupon name is required')
        .isLength({ min: 3, max: 100 })
        .withMessage('Coupon name must be between 3 and 100 characters'),

    body('description')
        .trim()
        .notEmpty()
        .withMessage('Description is required')
        .isLength({ min: 10, max: 500 })
        .withMessage('Description must be between 10 and 500 characters'),

    body('expireBy')
        .notEmpty()
        .withMessage('Expiry date is required')
        .isISO8601()
        .withMessage('Expiry date must be a valid ISO8601 date')
        .custom((value) => {
            const expireDate = new Date(value);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            expireDate.setHours(0, 0, 0, 0);

            if (expireDate <= today) {
                throw new Error('Expiry date must be a future date');
            }
            return true;
        }),

    body('categoryLabel')
        .trim()
        .notEmpty()
        .withMessage('Category is required')
        .isIn(['Food', 'Fashion', 'Grocery', 'Travel', 'Wallet Rewards', 'Beauty', 'Entertainment', 'All'])
        .withMessage('Category must be one of: Food, Fashion, Grocery, Travel, Wallet Rewards, Beauty, Entertainment, All'),

    body('useCouponVia')
        .trim()
        .notEmpty()
        .withMessage('Use coupon via is required')
        .isIn(['Coupon Code', 'Coupon Visiting Link', 'Both'])
        .withMessage('Use coupon via must be one of: Coupon Code, Coupon Visiting Link, Both'),

    body('couponCode')
        .optional({ checkFalsy: true })
        .trim()
        .isLength({ min: 4, max: 20 })
        .withMessage('Coupon code must be between 4 and 20 characters'),

    body('couponVisitingLink')
        .optional({ checkFalsy: true })
        .trim()
        .custom((value) => {
            if (value && !isValidUrl(value)) {
                throw new Error('Coupon visiting link must be a valid URL');
            }
            return true;
        }),

    body('couponDetails')
        .optional()
        .trim()
        .isLength({ max: 1000 })
        .withMessage('Coupon details cannot exceed 1000 characters'),

    body('minimumOrder')
        .optional()
        .isNumeric()
        .withMessage('Minimum order value must be a number')
        .custom((value) => {
            if (value !== null && value !== undefined && value < 0) {
                throw new Error('Minimum order value cannot be negative');
            }
            return true;
        }),

    body().custom((value) => {
        const useCouponVia = value.useCouponVia;

        if (useCouponVia === 'Coupon Code') {
            if (!value.couponCode || value.couponCode.trim() === '') {
                throw new Error('Coupon code is required when useCouponVia is Coupon Code');
            }
        }

        if (useCouponVia === 'Coupon Visiting Link') {
            if (!value.couponVisitingLink || value.couponVisitingLink.trim() === '') {
                throw new Error('Coupon visiting link is required when useCouponVia is Coupon Visiting Link');
            }
        }

        if (useCouponVia === 'Both') {
            const hasCouponCode = value.couponCode && value.couponCode.trim() !== '';
            const hasCouponVisitingLink = value.couponVisitingLink && value.couponVisitingLink.trim() !== '';

            if (!hasCouponCode && !hasCouponVisitingLink) {
                throw new Error('At least one of coupon code or coupon visiting link is required when useCouponVia is Both');
            }
        }

        return true;
    }),

    handleValidationErrors,
];

module.exports = {
    validateSignup,
    validateLogin,
    validateProfileUpdate,
    couponValidationRules,
    validateCoupon: couponValidationRules,
};
