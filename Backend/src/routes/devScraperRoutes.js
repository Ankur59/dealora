/**
 * DEV-ONLY scraper routes — only mounted in development mode.
 *
 * Endpoints:
 *   POST /api/dev/scraper/run              → trigger a full scraper run (background)
 *   POST /api/dev/scraper/pipeline/score   → run scoring script (same as cron step 2)
 *   POST /api/dev/scraper/pipeline/delete  → run deletion script (same as cron step 3)
 *   GET  /api/dev/scraper/raw              → query rawscrapedcoupons collection
 *   GET  /api/dev/scraper/raw/stats        → signal field coverage stats per adapter
 *   GET  /api/dev/scraper/audit            → run field audit without saving to DB
 */

const path = require('path');
const { execFile } = require('child_process');
const express = require('express');
const router = express.Router();
const RawScrapedCoupon = require('../models/RawScrapedCoupon');
const logger = require('../utils/logger');

// Resolves the path to a script in /scripts the same way the cron does
const SCORE_SCRIPT  = path.resolve(__dirname, '../../scripts/scoreCoupons.js');
const DELETE_SCRIPT = path.resolve(__dirname, '../../scripts/filterBelowAverageCoupons.js');

// Runs a pipeline script as a child process and resolves with its stdout/stderr.
// Identical to the runScript() helper used inside the cron job.
function runScript(scriptPath) {
    return new Promise((resolve, reject) => {
        execFile(process.execPath, [scriptPath], { env: process.env }, (err, stdout, stderr) => {
            if (err) return reject({ exitCode: err.code, message: err.message, stderr });
            resolve({ stdout, stderr });
        });
    });
}

// ─── POST /api/dev/scraper/run ────────────────────────────────────────────────
// Triggers a full scraper run immediately (respects SCRAPER_ADAPTERS env var).
router.post('/run', async (req, res) => {
    try {
        logger.info('DEV: Manual scraper run triggered via API');

        // Run async — don't await (scraper takes minutes, return immediately)
        const { runScraper } = require('../scraper');
        runScraper()
            .then(() => logger.info('DEV: Manual scraper run completed'))
            .catch(err => logger.error('DEV: Manual scraper run failed:', err.message));

        res.json({
            success: true,
            message: 'Scraper run started in background. Watch server logs for progress.',
            tip: 'Check GET /api/dev/scraper/raw after a few minutes to see ingested data.',
            respecting: `SCRAPER_ADAPTERS=${process.env.SCRAPER_ADAPTERS || '(all adapters)'}`,
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ─── GET /api/dev/scraper/audit ───────────────────────────────────────────────
// Runs the field audit (no DB writes) and returns results in the response body.
router.get('/audit', async (req, res) => {
    try {
        logger.info('DEV: Manual field audit triggered via API');

        const { runScraperFieldAudit } = require('../scraper');

        // The audit logs to logger — capture results by monkey-patching temporarily
        const auditResults = [];
        const originalInfo = logger.info.bind(logger);
        logger.info = (...args) => {
            const msg = args[0];
            if (typeof msg === 'string' && msg.includes('SCRAPER_AUDIT')) {
                auditResults.push(msg);
            }
            originalInfo(...args);
        };

        await runScraperFieldAudit();

        // Restore logger
        logger.info = originalInfo;

        res.json({
            success: true,
            message: 'Field audit complete.',
            results: auditResults,
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ─── GET /api/dev/scraper/raw ─────────────────────────────────────────────────
// Query raw scraped coupons. Supports filters via query params:
//   ?adapter=GrabOn          filter by source adapter
//   ?brand=Amazon            filter by brand name
//   ?status=pending          filter by aiValidationStatus
//   ?hasUsedBy=true          only show coupons with usedBy != null
//   ?hasVerified=true        only show coupons with verified != null
//   ?hasTrustscore=true      only show coupons with trustscore != null
//   ?limit=20                max results (default 20, max 100)
//   ?page=1                  pagination
router.get('/raw', async (req, res) => {
    try {
        const {
            adapter,
            brand,
            status,
            hasUsedBy,
            hasVerified,
            hasTrustscore,
            limit: limitStr = '20',
            page: pageStr = '1',
        } = req.query;

        const limit = Math.min(Number(limitStr) || 20, 100);
        const skip = (Math.max(Number(pageStr) || 1, 1) - 1) * limit;

        const filter = {};
        if (adapter) filter.sourceAdapter = { $regex: adapter, $options: 'i' };
        if (brand) filter.brandName = { $regex: brand, $options: 'i' };
        if (status) filter.aiValidationStatus = status;
        if (hasUsedBy === 'true') filter.usedBy = { $ne: null };
        if (hasVerified === 'true') filter.verified = { $ne: null };
        if (hasTrustscore === 'true') filter.trustscore = { $ne: null };

        const [coupons, total] = await Promise.all([
            RawScrapedCoupon.find(filter)
                .sort({ scrapedAt: -1 })
                .skip(skip)
                .limit(limit)
                .select('-__v')
                .lean(),
            RawScrapedCoupon.countDocuments(filter),
        ]);

        res.json({
            success: true,
            total,
            page: Number(pageStr),
            limit,
            count: coupons.length,
            filters: filter,
            data: coupons,
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ─── GET /api/dev/scraper/raw/stats ───────────────────────────────────────────
// Returns signal field coverage stats per adapter — how many coupons have
// usedBy/verified/trustscore populated vs null.
router.get('/raw/stats', async (req, res) => {
    try {
        const stats = await RawScrapedCoupon.aggregate([
            {
                $group: {
                    _id: '$sourceAdapter',
                    total: { $sum: 1 },
                    withUsedBy: {
                        $sum: { $cond: [{ $ne: ['$usedBy', null] }, 1, 0] },
                    },
                    withVerified: {
                        $sum: { $cond: [{ $ne: ['$verified', null] }, 1, 0] },
                    },
                    withTrustscore: {
                        $sum: { $cond: [{ $ne: ['$trustscore', null] }, 1, 0] },
                    },
                    pendingValidation: {
                        $sum: { $cond: [{ $eq: ['$aiValidationStatus', 'pending'] }, 1, 0] },
                    },
                    lastScrapedAt: { $max: '$scrapedAt' },
                },
            },
            {
                $project: {
                    _id: 0,
                    adapter: '$_id',
                    total: 1,
                    pendingValidation: 1,
                    lastScrapedAt: 1,
                    usedBy: {
                        found: '$withUsedBy',
                        coverage: {
                            $concat: [
                                {
                                    $toString: {
                                        $round: [
                                            {
                                                $multiply: [
                                                    { $divide: ['$withUsedBy', { $max: ['$total', 1] }] },
                                                    100,
                                                ],
                                            },
                                            1,
                                        ],
                                    },
                                },
                                '%',
                            ],
                        },
                    },
                    verified: {
                        found: '$withVerified',
                        coverage: {
                            $concat: [
                                {
                                    $toString: {
                                        $round: [
                                            {
                                                $multiply: [
                                                    { $divide: ['$withVerified', { $max: ['$total', 1] }] },
                                                    100,
                                                ],
                                            },
                                            1,
                                        ],
                                    },
                                },
                                '%',
                            ],
                        },
                    },
                    trustscore: {
                        found: '$withTrustscore',
                        coverage: {
                            $concat: [
                                {
                                    $toString: {
                                        $round: [
                                            {
                                                $multiply: [
                                                    { $divide: ['$withTrustscore', { $max: ['$total', 1] }] },
                                                    100,
                                                ],
                                            },
                                            1,
                                        ],
                                    },
                                },
                                '%',
                            ],
                        },
                    },
                },
            },
            { $sort: { adapter: 1 } },
        ]);

        const grandTotal = stats.reduce((acc, s) => acc + s.total, 0);

        res.json({
            success: true,
            grandTotal,
            message: 'Signal field coverage per adapter',
            stats,
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});


// ─── POST /api/dev/scraper/pipeline/score ────────────────────────────────────
// Runs scoreCoupons.js exactly as the cron does — scores all coupons scraped
// in the last 12h and writes couponScore + scoreCalculatedAt to each document.
// The response waits for the script to finish and returns the full log output.
router.post('/pipeline/score', async (req, res) => {
    logger.info('DEV: Manual pipeline/score triggered');
    try {
        const { stdout, stderr } = await runScript(SCORE_SCRIPT);
        res.json({
            success: true,
            message: 'Scoring complete (last 12h window, same as cron).',
            output: stdout.trim().split('\n').filter(Boolean),
            warnings: stderr ? stderr.trim().split('\n').filter(Boolean) : [],
        });
    } catch (err) {
        logger.error(`DEV: pipeline/score failed — ${err.message}`);
        res.status(500).json({ success: false, error: err.message, exitCode: err.exitCode, stderr: err.stderr });
    }
});

// ─── POST /api/dev/scraper/pipeline/delete ───────────────────────────────────
// Runs filterBelowAverageCoupons.js exactly as the cron does — deletes below-
// average coupons from the batch scored in the last 12h, grouped per merchant.
// WARNING: permanently deletes documents from rawscrapedcoupons.
router.post('/pipeline/delete', async (req, res) => {
    logger.warn('DEV: Manual pipeline/delete triggered');
    try {
        const { stdout, stderr } = await runScript(DELETE_SCRIPT);
        res.json({
            success: true,
            message: 'Deletion complete (last 12h scored batch, same as cron).',
            output: stdout.trim().split('\n').filter(Boolean),
            warnings: stderr ? stderr.trim().split('\n').filter(Boolean) : [],
        });
    } catch (err) {
        logger.error(`DEV: pipeline/delete failed — ${err.message}`);
        res.status(500).json({ success: false, error: err.message, exitCode: err.exitCode, stderr: err.stderr });
    }
});

module.exports = router;
