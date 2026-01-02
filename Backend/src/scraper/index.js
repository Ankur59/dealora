const ScraperEngine = require('./engine');
const GrabOnAdapter = require('./sources/GrabOnAdapter');
const logger = require('../utils/logger');

const runScraper = async () => {
    try {
        const adapters = [
            new GrabOnAdapter(),
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
