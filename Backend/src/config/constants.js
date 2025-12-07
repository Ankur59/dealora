const STATUS_CODES = {
    OK: 200,
    CREATED: 201,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    UNPROCESSABLE_ENTITY: 422,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
    SERVICE_UNAVAILABLE: 503,
};

const SUCCESS_MESSAGES = {
    SIGNUP_SUCCESS: 'Signup successful',
    LOGIN_SUCCESS: 'Login successful',
    LOGOUT_SUCCESS: 'Logout successful',
    PROFILE_UPDATED: 'Profile updated successfully',
    USER_ALREADY_REGISTERED: 'User already registered',
};

const ERROR_MESSAGES = {
    USER_NOT_FOUND: 'User not found',
    USER_ALREADY_EXISTS: 'User already exists',
    EMAIL_ALREADY_EXISTS: 'Email already registered',
    PHONE_ALREADY_EXISTS: 'Phone number already registered',
    INVALID_CREDENTIALS: 'Invalid credentials',
    UNAUTHORIZED: 'Unauthorized access',
    TOKEN_EXPIRED: 'Token has expired',
    INVALID_TOKEN: 'Invalid token',
    VALIDATION_ERROR: 'Validation failed',
    INVALID_INPUT: 'Invalid input provided',
    INVALID_EMAIL: 'Invalid email format',
    INVALID_PHONE: 'Invalid phone number format',
    INVALID_UID: 'Invalid Firebase UID',
    INTERNAL_SERVER_ERROR: 'Internal server error',
    DATABASE_ERROR: 'Database operation failed',
    SERVICE_UNAVAILABLE: 'Service temporarily unavailable',
    NOT_FOUND: 'Resource not found',
    ROUTE_NOT_FOUND: 'Route not found',
    TOO_MANY_REQUESTS: 'Too many requests, please try again later',
};

const USER_CONSTANTS = {
    NAME_MIN_LENGTH: 2,
    NAME_MAX_LENGTH: 100,
    PASSWORD_MIN_LENGTH: 8,
};

const RATE_LIMIT = {
    WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
};

const DB_CONFIG = {
    MAX_RETRIES: 5,
    RETRY_DELAY: 5000,
    CONNECTION_TIMEOUT: 30000,
};

module.exports = {
    STATUS_CODES,
    SUCCESS_MESSAGES,
    ERROR_MESSAGES,
    USER_CONSTANTS,
    RATE_LIMIT,
    DB_CONFIG,
};
