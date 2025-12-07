const mongoose = require('mongoose');
const logger = require('../utils/logger');
const { DB_CONFIG } = require('./constants');

let retryCount = 0;

const connectDB = async () => {
    try {
        const mongoUri = process.env.MONGO_URI;

        if (!mongoUri) {
            throw new Error('MONGO_URI is not defined in environment variables');
        }

        const options = {
            serverSelectionTimeoutMS: DB_CONFIG.CONNECTION_TIMEOUT,
            socketTimeoutMS: 45000,
            maxPoolSize: 10,
            minPoolSize: 2,
            maxIdleTimeMS: 30000,
        };

        const conn = await mongoose.connect(mongoUri, options);

        logger.info(`✅ MongoDB Connected: ${conn.connection.host}`);
        retryCount = 0;
        return conn.connection;
    } catch (error) {
        logger.error(`MongoDB Connection Error: ${error.message}`);

        if (retryCount < DB_CONFIG.MAX_RETRIES) {
            retryCount++;
            const delay = DB_CONFIG.RETRY_DELAY * retryCount;
            logger.warn(`Retrying connection... Attempt ${retryCount}/${DB_CONFIG.MAX_RETRIES}`);
            await new Promise((resolve) => setTimeout(resolve, delay));
            return connectDB();
        } else {
            logger.error('Max retry attempts reached. Exiting...');
            process.exit(1);
        }
    }
};

mongoose.connection.on('connected', () => logger.info('✅ Mongoose connected'));
mongoose.connection.on('error', (err) => logger.error(`Mongoose error: ${err.message}`));
mongoose.connection.on('disconnected', () => logger.warn('Mongoose disconnected'));

process.on('SIGINT', async () => {
    try {
        await mongoose.connection.close();
        logger.info('Mongoose connection closed');
        process.exit(0);
    } catch (err) {
        logger.error(`Error closing mongoose: ${err.message}`);
        process.exit(1);
    }
});

module.exports = { connectDB };
