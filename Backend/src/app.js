/**
 * Express Application Setup
 * 
 * Configures Express middleware and routes:
 * - Security headers (helmet)
 * - CORS configuration
 * - Body parsing
 * - Request logging
 * - Rate limiting
 * - Routes mounting
 * - Error handling
 * 
 * @module app
 */

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { globalErrorHandler } = require('./middlewares/errorHandler');
const { errorResponse } = require('./utils/responseHandler');
const { STATUS_CODES, ERROR_MESSAGES, RATE_LIMIT } = require('./config/constants');
const logger = require('./utils/logger');

// Import routes
const authRoutes = require('./routes/authRoutes');

// Create Express app
const app = express();

/**
 * Security Middleware
 * Helmet sets various HTTP headers for security
 */
app.use(helmet());

/**
 * CORS Configuration
 * Allow cross-origin requests from specified origins
 */
const corsOptions = {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
    optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

/**
 * Body Parsing Middleware
 * Parse JSON and URL-encoded request bodies
 */
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

/**
 * Request Logging Middleware
 * Morgan logs HTTP requests
 * - 'dev' format in development (colorized)
 * - 'combined' format in production (standard Apache format)
 */
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
} else {
    app.use(morgan('combined', { stream: logger.stream }));
}

/**
 * Rate Limiting Middleware
 * Limit repeated requests to API endpoints
 * 
 * Default: 100 requests per 15 minutes per IP
 */
const limiter = rateLimit({
    windowMs: RATE_LIMIT.WINDOW_MS,
    max: RATE_LIMIT.MAX_REQUESTS,
    message: ERROR_MESSAGES.TOO_MANY_REQUESTS,
    standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false, // Disable `X-RateLimit-*` headers
    handler: (req, res) => {
        logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
        errorResponse(res, STATUS_CODES.TOO_MANY_REQUESTS, ERROR_MESSAGES.TOO_MANY_REQUESTS);
    },
});

// Apply rate limiting to all routes
app.use(limiter);

/**
 * Health Check Endpoint
 * 
 * @route GET /health
 * @access Public
 */
app.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Server is running',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
    });
});

/**
 * API Routes
 * Mount all route modules
 */
app.use('/api/auth', authRoutes);

/**
 * Root Endpoint
 * 
 * @route GET /
 * @access Public
 */
app.get('/', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Welcome to Dealora API',
        version: '1.0.0',
        documentation: '/api/docs', // Placeholder for future API documentation
    });
});

/**
 * 404 Handler
 * Catch all undefined routes
 */
app.use('*', (req, res) => {
    logger.warn(`404 - Route not found: ${req.method} ${req.originalUrl}`);
    errorResponse(res, STATUS_CODES.NOT_FOUND, ERROR_MESSAGES.ROUTE_NOT_FOUND);
});

/**
 * Global Error Handler
 * Must be the last middleware
 */
app.use(globalErrorHandler);

module.exports = app;
