/**
 * MongoDB Database Connection Configuration
 * 
 * Manages MongoDB connection using Mongoose with:
 * - Automatic retry logic (max 5 retries)
 * - Connection event listeners
 * - Graceful error handling
 * - Connection timeout handling
 * 
 * @module config/database
 */

const mongoose = require('mongoose');
const logger = require('../utils/logger');
const { DB_CONFIG } = require('./constants');

let retryCount = 0;

/**
 * Connect to MongoDB database
 * 
 * Features:
 * - Reads MONGO_URI from environment variables
 * - Implements retry mechanism with exponential backoff
 * - Sets up connection event listeners
 * - Handles connection errors gracefully
 * 
 * @returns {Promise<mongoose.Connection>} MongoDB connection instance
 * @throws {Error} If connection fails after max retries
 */
const connectDB = async () => {
    try {
        const mongoUri = process.env.MONGO_URI;

        if (!mongoUri) {
            throw new Error('MONGO_URI is not defined in environment variables');
        }

        // Mongoose connection options
        const options = {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: DB_CONFIG.CONNECTION_TIMEOUT,
            socketTimeoutMS: 45000,
        };

        // Connect to MongoDB
        const conn = await mongoose.connect(mongoUri, options);

        logger.info(`✅ MongoDB Connected: ${conn.connection.host}`);
        logger.info(`📊 Database: ${conn.connection.name}`);

        // Reset retry count on successful connection
        retryCount = 0;

        return conn.connection;
    } catch (error) {
        logger.error(`❌ MongoDB Connection Error: ${error.message}`);

        // Retry logic
        if (retryCount < DB_CONFIG.MAX_RETRIES) {
            retryCount++;
            const delay = DB_CONFIG.RETRY_DELAY * retryCount;
            logger.warn(
                `🔄 Retrying connection... Attempt ${retryCount}/${DB_CONFIG.MAX_RETRIES} in ${delay / 1000}s`
            );

            await new Promise((resolve) => setTimeout(resolve, delay));
            return connectDB();
        } else {
            logger.error(
                `💥 Max retry attempts (${DB_CONFIG.MAX_RETRIES}) reached. Exiting...`
            );
            process.exit(1);
        }
    }
};

/**
 * Connection event listeners
 * Monitor database connection state changes
 */
mongoose.connection.on('connected', () => {
    logger.info('🔗 Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
    logger.error(`🚨 Mongoose connection error: ${err.message}`);
});

mongoose.connection.on('disconnected', () => {
    logger.warn('⚠️  Mongoose disconnected from MongoDB');
});

/**
 * Handle application termination
 * Gracefully close database connection
 */
process.on('SIGINT', async () => {
    try {
        await mongoose.connection.close();
        logger.info('📴 Mongoose connection closed due to application termination');
        process.exit(0);
    } catch (err) {
        logger.error(`Error closing mongoose connection: ${err.message}`);
        process.exit(1);
    }
});

module.exports = { connectDB };
