/**
 * Error Handler Middleware
 * 
 * Centralized error handling for the application.
 * Includes custom error classes and global error handler middleware.
 * 
 * Features:
 * - Custom error classes (AppError, ValidationError, NotFoundError, etc.)
 * - Mongoose error handling (CastError, ValidationError, Duplicate Key)
 * - Environment-based error responses (dev vs production)
 * - Error logging
 * 
 * @module middlewares/errorHandler
 */

const logger = require('../utils/logger');
const { errorResponse } = require('../utils/responseHandler');
const { STATUS_CODES, ERROR_MESSAGES } = require('../config/constants');

/**
 * Base Application Error Class
 * All custom errors extend from this class
 */
class AppError extends Error {
    constructor(message, statusCode, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Validation Error (400)
 * Used for request validation failures
 */
class ValidationError extends AppError {
    constructor(message = ERROR_MESSAGES.VALIDATION_ERROR) {
        super(message, STATUS_CODES.BAD_REQUEST);
    }
}

/**
 * Not Found Error (404)
 * Used when a resource is not found
 */
class NotFoundError extends AppError {
    constructor(message = ERROR_MESSAGES.NOT_FOUND) {
        super(message, STATUS_CODES.NOT_FOUND);
    }
}

/**
 * Unauthorized Error (401)
 * Used for authentication failures
 */
class UnauthorizedError extends AppError {
    constructor(message = ERROR_MESSAGES.UNAUTHORIZED) {
        super(message, STATUS_CODES.UNAUTHORIZED);
    }
}

/**
 * Conflict Error (409)
 * Used for duplicate resource errors
 */
class ConflictError extends AppError {
    constructor(message = ERROR_MESSAGES.USER_ALREADY_EXISTS) {
        super(message, STATUS_CODES.CONFLICT);
    }
}

/**
 * Forbidden Error (403)
 * Used when user doesn't have permission
 */
class ForbiddenError extends AppError {
    constructor(message = 'Access forbidden') {
        super(message, STATUS_CODES.FORBIDDEN);
    }
}

/**
 * Handle Mongoose CastError
 * Occurs when invalid ID is provided
 * 
 * @param {Error} err - Mongoose CastError
 * @returns {AppError} Formatted AppError
 */
const handleCastError = (err) => {
    const message = `Invalid ${err.path}: ${err.value}`;
    return new ValidationError(message);
};

/**
 * Handle Mongoose ValidationError
 * Occurs when model validation fails
 * 
 * @param {Error} err - Mongoose ValidationError
 * @returns {AppError} Formatted AppError
 */
const handleValidationError = (err) => {
    const errors = Object.values(err.errors).map((el) => el.message);
    const message = `Invalid input data. ${errors.join('. ')}`;
    return new ValidationError(message);
};

/**
 * Handle Mongoose Duplicate Key Error (E11000)
 * Occurs when unique constraint is violated
 * 
 * @param {Error} err - Mongoose Duplicate Key Error
 * @returns {AppError} Formatted AppError
 */
const handleDuplicateKeyError = (err) => {
    const field = Object.keys(err.keyValue)[0];
    const value = err.keyValue[field];
    const message = `Duplicate field value: ${field} = "${value}". Please use another value.`;
    return new ConflictError(message);
};

/**
 * Send error response in development mode
 * Includes full error details and stack trace
 * 
 * @param {Error} err - Error object
 * @param {Object} res - Express response object
 */
const sendErrorDev = (err, res) => {
    errorResponse(res, err.statusCode, err.message, {
        status: err.status,
        error: err,
        stack: err.stack,
    });
};

/**
 * Send error response in production mode
 * Hides sensitive error details from client
 * 
 * @param {Error} err - Error object
 * @param {Object} res - Express response object
 */
const sendErrorProd = (err, res) => {
    // Operational, trusted error: send message to client
    if (err.isOperational) {
        errorResponse(res, err.statusCode, err.message);
    }
    // Programming or unknown error: don't leak error details
    else {
        logger.error('💥 NON-OPERATIONAL ERROR:', err);
        errorResponse(
            res,
            STATUS_CODES.INTERNAL_SERVER_ERROR,
            ERROR_MESSAGES.INTERNAL_SERVER_ERROR
        );
    }
};

/**
 * Global Error Handler Middleware
 * 
 * Must be the last middleware in the chain.
 * Catches all errors and sends appropriate response.
 * 
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const globalErrorHandler = (err, req, res, next) => {
    err.statusCode = err.statusCode || STATUS_CODES.INTERNAL_SERVER_ERROR;
    err.status = err.status || 'error';

    // Log error
    logger.error(`[${err.statusCode}] ${err.message}`, {
        path: req.path,
        method: req.method,
        ip: req.ip,
        stack: err.stack,
    });

    // Handle specific error types
    let error = { ...err };
    error.message = err.message;

    // Mongoose CastError
    if (err.name === 'CastError') {
        error = handleCastError(err);
    }

    // Mongoose ValidationError
    if (err.name === 'ValidationError') {
        error = handleValidationError(err);
    }

    // Mongoose Duplicate Key Error
    if (err.code === 11000) {
        error = handleDuplicateKeyError(err);
    }

    // JWT Errors
    if (err.name === 'JsonWebTokenError') {
        error = new UnauthorizedError(ERROR_MESSAGES.INVALID_TOKEN);
    }

    if (err.name === 'TokenExpiredError') {
        error = new UnauthorizedError(ERROR_MESSAGES.TOKEN_EXPIRED);
    }

    // Send error response based on environment
    if (process.env.NODE_ENV === 'development') {
        sendErrorDev(error, res);
    } else {
        sendErrorProd(error, res);
    }
};

module.exports = {
    AppError,
    ValidationError,
    NotFoundError,
    UnauthorizedError,
    ConflictError,
    ForbiddenError,
    globalErrorHandler,
};
