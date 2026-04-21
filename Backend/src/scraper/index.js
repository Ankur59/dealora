const ScraperEngine = require('./engine');
const GrabOnAdapter = require('./sources/GrabOnAdapter');
const CouponDuniyaAdapter = require('./sources/CouponDuniyaAdapter');
const DesidimeAdapter = require('./sources/DesidimeAdapter');
const CashkaroAdapter = require('./sources/CashkaroAdapter');
const DealivoreAdapter = require('./sources/DealivoreAdapter');
const CouponDekhoAdapter = require('./sources/CouponDekhoAdapter');
const PaisaWapasAdapter = require('./sources/PaisaWapasAdapter');
const DealsMagnetAdapter = require('./sources/DealsMagnetAdapter');
const logger = require('../utils/logger');

const ADAPTER_FACTORIES = {
    GrabOn: () => new GrabOnAdapter(),
    CouponDuniya: () => new CouponDuniyaAdapter(),
    Desidime: () => new DesidimeAdapter(),
    Cashkaro: () => new CashkaroAdapter(),
    Dealivore: () => new DealivoreAdapter(),
    CouponDekho: () => new CouponDekhoAdapter(),
    PaisaWapas: () => new PaisaWapasAdapter(),
    DealsMagnet: () => new DealsMagnetAdapter(),
};

const parseAdapterFilter = () => {
    const raw = process.env.SCRAPER_ADAPTERS;
    if (!raw) return null;

    const names = raw
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

    return names.length > 0 ? names : null;
};

const buildAdapters = () => {
    const requested = parseAdapterFilter();
    const allNames = Object.keys(ADAPTER_FACTORIES);

    if (!requested) {
        return allNames.map(name => ADAPTER_FACTORIES[name]());
    }

    const requestedLower = new Set(requested.map(n => n.toLowerCase()));
    const selectedNames = allNames.filter(name => requestedLower.has(name.toLowerCase()));

    if (selectedNames.length === 0) {
        logger.warn(
            `SCRAPER: SCRAPER_ADAPTERS was set but no matches found. Requested="${requested.join(', ')}". Valid="${allNames.join(', ')}". Running all adapters.`
        );
        return allNames.map(name => ADAPTER_FACTORIES[name]());
    }

    logger.info(`SCRAPER: Adapter filter enabled. Running: ${selectedNames.join(', ')}`);
    return selectedNames.map(name => ADAPTER_FACTORIES[name]());
};

const runScraper = async () => {
    try {
        const adapters = buildAdapters();

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

const runScraperFieldAudit = async () => {
    const adapters = buildAdapters();

    if (adapters.length === 0) {
        logger.info('SCRAPER_AUDIT: No adapters configured.');
        return;
    }

    logger.info(`SCRAPER_AUDIT: Starting startup field audit for ${adapters.length} adapters`);

    for (const adapter of adapters) {
        try {
            logger.info(`SCRAPER_AUDIT: Running provider ${adapter.sourceName}`);
            const coupons = await adapter.scrape();

            if (!coupons || coupons.length === 0) {
                logger.warn(`SCRAPER_AUDIT: ${adapter.sourceName} returned 0 coupons`);
                continue;
            }

            let trustscoreCount = 0;
            let usedByCount = 0;
            let verifiedCount = 0;

            coupons.forEach((coupon, idx) => {
                if (coupon.trustscore !== null && coupon.trustscore !== undefined) trustscoreCount++;
                if (coupon.usedBy !== null && coupon.usedBy !== undefined) usedByCount++;
                if (coupon.verified !== null && coupon.verified !== undefined) verifiedCount++;

                logger.info(
                    `SCRAPER_AUDIT_COUPON provider=${adapter.sourceName} index=${idx + 1} title="${coupon.couponTitle || 'N/A'}" trustscore=${coupon.trustscore ?? 'null'} usedBy=${coupon.usedBy ?? 'null'} verified=${coupon.verified ?? 'null'}`
                );
            });

            logger.info(
                `SCRAPER_AUDIT_SUMMARY provider=${adapter.sourceName} total=${coupons.length} trustscoreFound=${trustscoreCount} usedByFound=${usedByCount} verifiedFound=${verifiedCount}`
            );
        } catch (error) {
            logger.error(`SCRAPER_AUDIT: ${adapter.sourceName} failed - ${error.message}`);
        }
    }

    logger.info('SCRAPER_AUDIT: Completed startup field audit');
};

module.exports = { runScraper, runScraperFieldAudit };
