require('dotenv').config();
const { connectDB } = require('./src/config/database');
const { runScraper } = require('./src/scraper');
const logger = require('./src/utils/logger');
const mongoose = require('mongoose');

const manualRun = async () => {
    try {
        logger.info('Starting manual scraper trigger...');
        await connectDB();

        await runScraper();

        logger.info('Manual scraping completed. Closing connection in 5 seconds...');
        setTimeout(() => {
            mongoose.connection.close();
            process.exit(0);
        }, 5000);
    } catch (error) {
        logger.error('Manual trigger failed:', error);
        process.exit(1);
    }
};

manualRun();
