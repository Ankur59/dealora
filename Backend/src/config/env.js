const logger = require('../utils/logger');

const requiredEnvVars = ['MONGO_URI'];

const validateEnv = () => {
    const missing = requiredEnvVars.filter((key) => !process.env[key]);

    if (missing.length > 0) {
        logger.error(`Missing required environment variables: ${missing.join(', ')}`);
        process.exit(1);
    }

    if (process.env.NODE_ENV === 'production') {
        if (!process.env.CORS_ORIGIN || process.env.CORS_ORIGIN === '*') {
            logger.warn('CORS_ORIGIN should be set to specific domain in production');
        }
    }

    logger.info('Environment variables validated');
};

module.exports = { validateEnv };

