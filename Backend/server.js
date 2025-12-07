/**
 * Server Entry Point
 * 
 * Starts the Express server and handles graceful shutdown.
 * Connects to database before listening for requests.
 */

require('dotenv').config();
const app = require('./src/app');
const { connectDB } = require('./src/config/database');
const logger = require('./src/utils/logger');

// Handle uncaught exceptions (synchronous errors)
process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
    console.error(err.name, err.message);
    // In production, we might want to use a logger here, but keep it simple during crash
    process.exit(1);
});

// Port configuration
const PORT = process.env.PORT || 5000;

// Connect to Database then start server
const startServer = async () => {
    try {
        // connectDB handles retries and errors internally
        await connectDB();

        const server = app.listen(PORT, () => {
            logger.info(`
      ################################################
      🚀 Server running on port ${PORT}
      📝 Environment: ${process.env.NODE_ENV}
      🔗 URL: http://localhost:${PORT}
      ################################################
      `);
        });

        // Handle unhandled promise rejections (async errors)
        process.on('unhandledRejection', (err) => {
            logger.error('UNHANDLED REJECTION! 💥 Shutting down...');
            logger.error(`${err.name}: ${err.message}`);
            // Gracefully close server & exit
            server.close(() => {
                process.exit(1);
            });
        });

        // Handle SIGTERM (e.g. Heroku shutdown)
        process.on('SIGTERM', () => {
            logger.info('👋 SIGTERM RECEIVED. Shutting down gracefully');
            server.close(() => {
                logger.info('💥 Process terminated!');
            });
        });

    } catch (error) {
        logger.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};

startServer();
