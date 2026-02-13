/**
 * Quick test of scraping with fallback cleaner
 * Scrapes just 5 coupons from GrabOn to test the cleaning
 */

require('dotenv').config();
const { connectDB } = require('./src/config/database');
const GrabOnAdapter = require('./src/scraper/sources/GrabOnAdapter');
const ScraperEngine = require('./src/scraper/engine');
const logger = require('./src/utils/logger');
const mongoose = require('mongoose');

const quickTest = async () => {
    try {
        logger.info('===  Quick Test: Scraping 5 coupons from GrabOn ===');
        await connectDB();

        // Create adapter and limit to 5 coupons
        const adapter = new GrabOnAdapter();
        
        // Override the limit
        const originalLimit = adapter.limit;
        adapter.limit = 5;

        const engine = new ScraperEngine([adapter]);
        await engine.runAll();

        logger.info('\n=== Test completed! Check the output above for cleaned fields ===');
        logger.info('Look for: "Local cleaning applied" or "Gemini cleaned 3 fields"');

        setTimeout(() => {
            mongoose.connection.close();
            process.exit(0);
        }, 3000);
    } catch (error) {
        logger.error('Quick test failed:', error);
        process.exit(1);
    }
};

quickTest();
