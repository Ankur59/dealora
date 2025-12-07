/**
 * Response Handler Utility
 * 
 * Provides standardized JSON response format for all API endpoints.
 * Ensures consistency across success and error responses.
 * 
 * @module utils/responseHandler
 */

/**
 * Send standardized success response
 * 
 * @param {Object} res - Express response object
 * @param {Number} statusCode - HTTP status code
 * @param {String} message - Success message
 * @param {Object} data - Response data (optional)
 * @returns {Object} JSON response
 */
const successResponse = (res, statusCode, message, data = null) => {
    const response = {
        success: true,
        message,
    };

    if (data !== null) {
        response.data = data;
    }

    return res.status(statusCode).json(response);
};

/**
 * Send standardized error response
 * 
 * @param {Object} res - Express response object
 * @param {Number} statusCode - HTTP status code
 * @param {String} message - Error message
 * @param {Array|Object} errors - Validation errors or additional error details (optional)
 * @returns {Object} JSON response
 */
const errorResponse = (res, statusCode, message, errors = null) => {
    const response = {
        success: false,
        message,
    };

    if (errors !== null) {
        response.errors = errors;
    }

    return res.status(statusCode).json(response);
};

module.exports = {
    successResponse,
    errorResponse,
};
