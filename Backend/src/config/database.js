const mongoose = require('mongoose');
const logger = require('../utils/logger');
const { DB_CONFIG } = require('./constants');

let retryCount = 0;
let isReconnecting = false;

const connectDB = async () => {
    try {
        const mongoUri = process.env.MONGO_URI;

        if (!mongoUri) {
            throw new Error('MONGO_URI is not defined in environment variables');
        }

        const options = {
         
            serverSelectionTimeoutMS: 30000,
            socketTimeoutMS: 45000,
            connectTimeoutMS: 30000,

            maxPoolSize: 10,
            minPoolSize: 2,
            maxIdleTimeMS: 60000,

            retryWrites: true,
            retryReads: true,

            heartbeatFrequencyMS: 10000,

            bufferCommands: true,

            autoIndex: process.env.NODE_ENV !== 'production',

            // Use IPv4
            family: 4,

            compressors: ['zlib'],
        };

        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
        }

        const conn = await mongoose.connect(mongoUri, options);

        logger.info(`✅ MongoDB Connected: ${conn.connection.host}`);
        retryCount = 0;
        isReconnecting = false;
        return conn.connection;
    } catch (error) {
        logger.error(`MongoDB Connection Error: ${error.message}`);

        if (retryCount < DB_CONFIG.MAX_RETRIES) {
            retryCount++;
            const delay = Math.min(DB_CONFIG.RETRY_DELAY * Math.pow(2, retryCount - 1), 30000); // Exponential backoff, max 30s
            logger.warn(`Retrying connection... Attempt ${retryCount}/${DB_CONFIG.MAX_RETRIES} in ${delay / 1000}s`);
            await new Promise((resolve) => setTimeout(resolve, delay));
            return connectDB();
        } else {
            logger.error('Max retry attempts reached. Exiting...');
            process.exit(1);
        }
    }
};

mongoose.connection.on('connected', () => {
    logger.info('✅ Mongoose connected to MongoDB');
    isReconnecting = false;
});

mongoose.connection.on('error', (err) => {
    logger.error(`Mongoose connection error: ${err.message}`);
});

mongoose.connection.on('disconnected', () => {
    logger.warn('⚠️ Mongoose disconnected from MongoDB');

    if (!isReconnecting && mongoose.connection.readyState === 0) {
        isReconnecting = true;
        retryCount = 0; // Reset retry count for reconnection attempts

        logger.info('🔄 Attempting to reconnect to MongoDB in 5 seconds...');
        setTimeout(async () => {
            if (mongoose.connection.readyState === 0) {
                try {
                    await connectDB();
                } catch (err) {
                    logger.error('❌ Reconnection failed:', err.message);
                    isReconnecting = false;
                }
            } else {
                isReconnecting = false;
            }
        }, 5000);
    }
});

mongoose.connection.on('reconnected', () => {
    logger.info('✅ Mongoose reconnected to MongoDB');
    isReconnecting = false;
});

// Graceful shutdown handlers
const gracefulShutdown = async (signal) => {
    try {
        logger.info(`${signal} received. Closing MongoDB connection...`);
        await mongoose.connection.close();
        logger.info('MongoDB connection closed gracefully');
        process.exit(0);
    } catch (err) {
        logger.error(`Error closing MongoDB connection: ${err.message}`);
        process.exit(1);
    }
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

module.exports = { connectDB };
