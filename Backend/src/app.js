const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { globalErrorHandler } = require('./middlewares/errorHandler');
const { errorResponse } = require('./utils/responseHandler');
const { STATUS_CODES, ERROR_MESSAGES, RATE_LIMIT } = require('./config/constants');
const logger = require('./utils/logger');
const authRoutes = require('./routes/authRoutes');

const app = express();

app.use(helmet());

const corsOptions = {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
    optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

app.use(express.json({ limit: '10mb', strict: true }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use((req, res, next) => {
    req.setTimeout(30000);
    res.setTimeout(30000);
    next();
});

if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
} else {
    app.use(morgan('combined', { stream: logger.stream }));
}

const limiter = rateLimit({
    windowMs: RATE_LIMIT.WINDOW_MS,
    max: RATE_LIMIT.MAX_REQUESTS,
    message: ERROR_MESSAGES.TOO_MANY_REQUESTS,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        logger.warn(`Rate limit exceeded from IP: ${req.ip}`);
        errorResponse(res, STATUS_CODES.TOO_MANY_REQUESTS, ERROR_MESSAGES.TOO_MANY_REQUESTS);
    },
});

app.use(limiter);

app.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Server is running',
        timestamp: new Date().toISOString(),
    });
});

app.use('/api/auth', authRoutes);

app.get('/', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Welcome to Dealora API',
        version: '1.0.0',
    });
});

app.use('*', (req, res) => {
    logger.warn(`404: ${req.method} ${req.originalUrl}`);
    errorResponse(res, STATUS_CODES.NOT_FOUND, ERROR_MESSAGES.ROUTE_NOT_FOUND);
});

app.use(globalErrorHandler);

module.exports = app;
