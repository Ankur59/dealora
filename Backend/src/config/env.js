const logger = require('../utils/logger');

const requiredEnvVars = ['MONGO_URI'];
const optionalEnvVars = ['GEMINI_API_KEY'];

const validateEnv = () => {
    const missing = requiredEnvVars.filter((key) => !process.env[key]);

    if (missing.length > 0) {
        logger.error(`Missing required environment variables: ${missing.join(', ')}`);
        process.exit(1);
    }

    // Check optional environment variables and warn if missing
    if (!process.env.GEMINI_API_KEY) {
        logger.warn('GEMINI_API_KEY is not set. Gemini extraction will be disabled. Coupon field segregation will use basic normalization.');
    }

    if (process.env.NODE_ENV === 'production') {
        if (!process.env.CORS_ORIGIN || process.env.CORS_ORIGIN === '*') {
            logger.warn('CORS_ORIGIN should be set to specific domain in production');
        }
    }

    logger.info('Environment variables validated');
};

module.exports = { validateEnv };

