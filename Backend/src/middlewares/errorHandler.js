const logger = require('../utils/logger');
const { errorResponse } = require('../utils/responseHandler');
const { STATUS_CODES, ERROR_MESSAGES } = require('../config/constants');

class AppError extends Error {
    constructor(message, statusCode, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        Error.captureStackTrace(this, this.constructor);
    }
}

class ValidationError extends AppError {
    constructor(message = ERROR_MESSAGES.VALIDATION_ERROR) {
        super(message, STATUS_CODES.BAD_REQUEST);
    }
}

class NotFoundError extends AppError {
    constructor(message = ERROR_MESSAGES.NOT_FOUND) {
        super(message, STATUS_CODES.NOT_FOUND);
    }
}

class UnauthorizedError extends AppError {
    constructor(message = ERROR_MESSAGES.UNAUTHORIZED) {
        super(message, STATUS_CODES.UNAUTHORIZED);
    }
}

class ConflictError extends AppError {
    constructor(message = ERROR_MESSAGES.USER_ALREADY_EXISTS) {
        super(message, STATUS_CODES.CONFLICT);
    }
}

class ForbiddenError extends AppError {
    constructor(message = 'Access forbidden') {
        super(message, STATUS_CODES.FORBIDDEN);
    }
}

const handleCastError = (err) => {
    const message = `Invalid ${err.path}: ${err.value}`;
    return new ValidationError(message);
};

const handleValidationError = (err) => {
    const errors = Object.values(err.errors).map((el) => el.message);
    const message = `Invalid input data. ${errors.join('. ')}`;
    return new ValidationError(message);
};

const handleDuplicateKeyError = (err) => {
    const field = Object.keys(err.keyValue)[0];
    const value = err.keyValue[field];
    const message = `Duplicate field value: ${field} = "${value}". Please use another value.`;
    return new ConflictError(message);
};

const sendErrorDev = (err, res) => {
    errorResponse(res, err.statusCode, err.message, {
        status: err.status,
        error: err,
        stack: err.stack,
    });
};

const sendErrorProd = (err, res) => {
    if (err.isOperational) {
        errorResponse(res, err.statusCode, err.message);
    } else {
        logger.error('💥 NON-OPERATIONAL ERROR:', err);
        errorResponse(
            res,
            STATUS_CODES.INTERNAL_SERVER_ERROR,
            ERROR_MESSAGES.INTERNAL_SERVER_ERROR
        );
    }
};

const globalErrorHandler = (err, req, res, next) => {
    err.statusCode = err.statusCode || STATUS_CODES.INTERNAL_SERVER_ERROR;
    err.status = err.status || 'error';

    logger.error(`[${err.statusCode}] ${err.message}`, {
        path: req.path,
        method: req.method,
        ip: req.ip,
        stack: err.stack,
    });

    let error = { ...err };
    error.message = err.message;

    if (err.name === 'CastError') {
        error = handleCastError(err);
    }

    if (err.name === 'ValidationError') {
        error = handleValidationError(err);
    }

    if (err.code === 11000) {
        error = handleDuplicateKeyError(err);
    }

    if (err.name === 'JsonWebTokenError') {
        error = new UnauthorizedError(ERROR_MESSAGES.INVALID_TOKEN);
    }

    if (err.name === 'TokenExpiredError') {
        error = new UnauthorizedError(ERROR_MESSAGES.TOKEN_EXPIRED);
    }

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
