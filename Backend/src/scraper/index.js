const ScraperEngine = require('./engine');
const GrabOnAdapter = require('./sources/GrabOnAdapter');
const CouponDuniyaAdapter = require('./sources/CouponDuniyaAdapter');
const DesidimeAdapter = require('./sources/DesidimeAdapter');
const CashkaroAdapter = require('./sources/CashkaroAdapter');
const DealivoreAdapter = require('./sources/DealivoreAdapter');
const logger = require('../utils/logger');

const runScraper = async () => {
    try {
        const adapters = [
            new GrabOnAdapter(),
            new CouponDuniyaAdapter(),
            new DesidimeAdapter(),
            new CashkaroAdapter(),
            new DealivoreAdapter(),
        ];

        if (adapters.length === 0) {
            logger.info('No scrapers configured yet.');
            return;
        }

        const engine = new ScraperEngine(adapters);
        await engine.runAll();
    } catch (error) {
        logger.error('Global Scraper Error:', error);
    }
};

module.exports = { runScraper };
