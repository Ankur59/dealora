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
