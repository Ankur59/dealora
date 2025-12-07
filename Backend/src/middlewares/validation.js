/**
 * Request Validation Middleware
 * 
 * Uses express-validator to validate incoming request data.
 * Provides validation for signup, login, and profile update requests.
 * 
 * @module middlewares/validation
 */

const { body, validationResult } = require('express-validator');
const { errorResponse } = require('../utils/responseHandler');
const { STATUS_CODES, ERROR_MESSAGES, USER_CONSTANTS } = require('../config/constants');
const { isValidPhoneNumber, isValidUrl } = require('../utils/validators');

/**
 * Handle validation errors
 * Extracts validation errors and sends formatted response
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
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

/**
 * Validation rules for user signup
 * 
 * Validates:
 * - uid: Required, non-empty string
 * - name: Required, 2-100 characters, alphabetic with spaces
 * - email: Required, valid email format
 * - phone: Required, valid Indian phone format
 */
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

/**
 * Validation rules for user login
 * 
 * Validates:
 * - uid: Required, non-empty string
 */
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

/**
 * Validation rules for profile update
 * 
 * Validates:
 * - name: Optional, 2-100 characters if provided
 * - profilePicture: Optional, valid URL if provided
 */
const validateProfileUpdate = [
    body('name')
        .optional()
        .trim()
        .isLength({ min: USER_CONSTANTS.NAME_MIN_LENGTH, max: USER_CONSTANTS.NAME_MAX_LENGTH })
        .withMessage(`Name must be between ${USER_CONSTANTS.NAME_MIN_LENGTH} and ${USER_CONSTANTS.NAME_MAX_LENGTH} characters`)
        .matches(/^[a-zA-Z\s]+$/)
        .withMessage('Name must contain only alphabetic characters and spaces'),

    body('profilePicture')
        .optional()
        .custom((value) => {
            if (value && !isValidUrl(value)) {
                throw new Error('Profile picture must be a valid URL');
            }
            return true;
        }),

    handleValidationErrors,
];

module.exports = {
    validateSignup,
    validateLogin,
    validateProfileUpdate,
};
