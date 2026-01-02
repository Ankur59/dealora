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
            socketTimeoutMS: 0, // Disable socket timeout to prevent disconnections
            maxPoolSize: 10,
            minPoolSize: 2,
            // Removed maxIdleTimeMS to prevent automatic disconnection
            retryWrites: true,
            retryReads: true,
            heartbeatFrequencyMS: 10000, // Check connection health every 10 seconds
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
mongoose.connection.on('disconnected', () => {
    logger.warn('Mongoose disconnected');
  
    if (mongoose.connection.readyState === 0) {
        logger.info('Attempting to reconnect to MongoDB...');
        setTimeout(() => {
            connectDB().catch(err => logger.error('Reconnection failed:', err));
        }, 5000);
    }
});

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
