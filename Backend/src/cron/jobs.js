const cron = require('node-cron');
const path = require('path');
const { execFile } = require('child_process');
const { runScraper } = require('../scraper');
const Coupon = require('../models/Coupon');
const PrivateCoupon = require('../models/PrivateCoupon');
const User = require('../models/User');
const Notification = require('../models/Notification');
const notificationService = require('../services/notificationService');
const { syncSheet } = require('../controllers/exclusiveCouponController');
const logger = require('../utils/logger');
const ImportedCoupons = require('../models/ImportedCoupons');

// ─── Helpers for the scrape→score→delete pipeline ────────────────────────────

/**
 * Runs a Node script as a child process and resolves when it exits successfully,
 * or rejects with the exit code / stderr on failure.
 */
function runScript(scriptPath) {
    return new Promise((resolve, reject) => {
        execFile(process.execPath, [scriptPath], { env: process.env }, (err, stdout, stderr) => {
            if (stdout) logger.info(`[pipeline] ${path.basename(scriptPath)} stdout:\n${stdout.trim()}`);
            if (stderr) logger.warn(`[pipeline] ${path.basename(scriptPath)} stderr:\n${stderr.trim()}`);
            if (err) return reject(new Error(`${path.basename(scriptPath)} exited with code ${err.code}: ${err.message}`));
            resolve();
        });
    });
}

const initCronJobs = () => {
    // 1. Daily Scraping at 2:00 AM
    cron.schedule('0 2 * * *', async () => {
        logger.info('CRON: Starting daily coupon scraping job...');
        try {
            await runScraper();
            logger.info('CRON: Daily scraping job completed successfully.');
        } catch (error) {
            logger.error('CRON: Scraping job failed:', error);
        }
    });

    // 2. Cleanup expired scraper coupons at 4 AM
    cron.schedule('0 4 * * *', async () => {
        logger.info('CRON: Starting daily expired coupons cleanup...');
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const result = await Coupon.deleteMany({
                expireBy: { $lt: today },
                userId: 'system_scraper'
            });

            logger.info(`CRON: Removed ${result.deletedCount} expired coupons.`);
        } catch (error) {
            logger.error('CRON: Cleanup job failed:', error);
        }
    });

    // 3. Expiry notifications every 12 hours
    cron.schedule('0 */12 * * *', async () => {
        logger.info('CRON: Starting expiry notification job...');
        try {
            const now = new Date();
            const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

            const expiringCoupons = await PrivateCoupon.find({
                expiryDate: { $gte: now, $lte: tomorrow },
                redeemed: false
            });

            if (!expiringCoupons.length) {
                logger.info('CRON: No expiring coupons.');
                return;
            }

            const users = await User.find({ fcmToken: { $ne: null } }, '_id fcmToken');
            const tokens = users.map(u => u.fcmToken).filter(Boolean);

            if (!tokens.length) {
                logger.warn('CRON: No tokens found.');
                return;
            }

            for (const coupon of expiringCoupons) {
                const title = `Coupon Expiring Soon: ${coupon.couponTitle}`;
                const body = `Your ${coupon.brandName} coupon is about to expire.`;
                const data = {
                    couponId: coupon._id.toString(),
                    type: 'expiry_alert'
                };

                // Send push notification
                await notificationService.sendMulticastNotification(tokens, title, body, data);

                // Save ONE notification to database with array of userIds
                const userIds = users.map(user => user._id);
                await Notification.create({
                    userId: userIds, // Array of user IDs
                    title,
                    body,
                    type: 'expiry_alert',
                    data,
                    couponId: coupon._id,
                    couponModel: 'PrivateCoupon',
                    priority: 'high',
                    isSent: true,
                    sentAt: new Date(),
                });
                logger.info(`CRON: Saved notification for ${userIds.length} users for coupon: ${coupon.couponTitle}`);
            }

            logger.info('CRON: Expiry notifications sent.');
        } catch (error) {
            logger.error('CRON: Expiry notification job failed:', error);
        }
    });


    // 3.5 Imported Coupon Expiry Notifications Every 24 Hours
    cron.schedule('0 0 * * *', async () => {
        logger.info('CRON: Starting imported coupon notification job...');
        try {
            const now = new Date();
            const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

            // 1. Fetch users with valid FCM tokens
            const users = await User.find({ fcmToken: { $ne: null, $exists: true } }, '_id fcmToken');

            if (!users.length) {
                logger.info('CRON: No users with FCM tokens found.');
                return;
            }

            let totalNotificationsSent = 0;

            // 2. Loop on the list of these users
            for (const user of users) {
                // 3. For each user query the imported coupon schema
                const expiringCoupons = await ImportedCoupons.find({
                    userId: user._id,
                    expireBy: { $gte: now, $lte: tomorrow },
                    status: 'active'
                });

                // 4. For each coupon generate the notification and store in DB
                for (const coupon of expiringCoupons) {
                    const title = `Coupon Expiring Soon: ${coupon.couponName}`;
                    const body = `Your ${coupon.brandName} coupon is about to expire. Use it before it's gone!`;
                    const data = {
                        couponId: coupon._id.toString(),
                        type: 'expiry_alert',
                        couponModel: 'ImportedCoupon'
                    };

                    try {
                        // Send push notification to this specific user
                        await notificationService.sendMulticastNotification([user.fcmToken], title, body, data);

                        // Save notification data in the DB
                        await Notification.create({
                            userId: [user._id],
                            title,
                            body,
                            type: 'expiry_alert',
                            data,
                            couponId: coupon._id,
                            couponModel: 'ImportedCoupon',
                            priority: 'high',
                            isSent: true,
                            sentAt: new Date(),
                        });

                        totalNotificationsSent++;
                    } catch (err) {
                        logger.error(`CRON: Failed to send/save notification for user ${user._id} and coupon ${coupon._id}:`, err);
                    }
                }
            }

            logger.info(`CRON: Imported coupon notification job completed. Sent ${totalNotificationsSent} notifications.`);
        } catch (error) {
            logger.error('CRON: Imported coupon notification job failed:', error);
        }
    });
    
    // 4. Google Sheet sync at 3 AM
    cron.schedule('16 3 * * *', async () => {
        logger.info('CRON: Starting Google Sheet sync...');
        try {
            const result = await syncSheet();
            if (result.success) {
                logger.info(`CRON: Sheet sync completed. ${result.stats?.successCount || 0} synced.`);
            } else {
                logger.error(`CRON: Sheet sync failed: ${result.message}`);
            }
        } catch (error) {
            logger.error('CRON: Sheet sync job failed:', error);
        }
    });

    // 5. weekly Gmail Sync at Midnight
    cron.schedule('0 0 * * 0', async () => {
        logger.info('CRON: Starting daily Gmail sync...');
        try {
            const gmailSyncService = require('../services/gmailSyncService');
            const result = await gmailSyncService.runDailySync();
            logger.info(`CRON: Daily Gmail sync completed. Results: ${JSON.stringify(result)}`);
        } catch (error) {
            logger.error('CRON: Daily Gmail sync failed:', error);
        }
    });

    // 6. Mark coupons as expired at 1 AM
    cron.schedule('0 0 * * *', async () => {
        logger.info('CRON: Starting daily coupon expiration check (1 AM)...');
        try {
            const today = new Date();
            today.setUTCHours(0, 0, 0, 0);

            // Update all active coupons that have passed their expiry date
            const result = await ImportedCoupons.updateMany(
                {
                    expireBy: { $lt: today },
                    status: 'active'
                },
                {
                    $set: { status: 'expired' }
                }
            );

            logger.info(`CRON: Expiration check completed. Marked ${result.modifiedCount} coupons as expired.`);
        } catch (error) {
            logger.error('CRON: Expiration check job failed:', error);
        }
    });

    // 7. Update PrivateCoupon daysUntilExpiry at 1 AM
    // cron.schedule('0 1 * * *', async () => {
    //     logger.info('CRON: Starting daily PrivateCoupon expiry update (1 AM)...');
    //     try {
    //         const today = new Date();
    //         today.setUTCHours(0, 0, 0, 0);

    //         const coupons = await PrivateCoupon.find({ expiryDate: { $ne: null } });

    //         let updateCount = 0;
    //         for (const coupon of coupons) {
    //             const expiry = new Date(coupon.expiryDate);
    //             expiry.setUTCHours(0, 0, 0, 0);

    //             const diffTime = expiry.getTime() - today.getTime();
    //             const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    //             if (coupon.daysUntilExpiry !== diffDays) {
    //                 coupon.daysUntilExpiry = diffDays;
    //                 await coupon.save();
    //                 updateCount++;
    //             }
    //         }

    //         logger.info(`CRON: PrivateCoupon expiry update completed. Updated ${updateCount} coupons.`);
    //     } catch (error) {
    //         logger.error('CRON: PrivateCoupon expiry update failed:', error);
    //     }
    // });

    // 8. Update expiresIn for all ImportedCoupons daily at midnight
    cron.schedule('0 0 * * *', async () => {
        logger.info('CRON: Starting daily expiresIn update for ImportedCoupons...');
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // Fetch all coupons that have an expiry date
            const coupons = await ImportedCoupons.find(
                { expireBy: { $ne: null } },
                { _id: 1, expireBy: 1 }
            ).lean();

            if (!coupons.length) {
                logger.info('CRON: No ImportedCoupons with expiry dates found.');
                return;
            }

            // Build bulk update operations
            const bulkOps = coupons.map(coupon => {
                const expireDate = new Date(coupon.expireBy);
                expireDate.setHours(0, 0, 0, 0);
                const diffTime = expireDate.getTime() - today.getTime();
                const expiresIn = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                return {
                    updateOne: {
                        filter: { _id: coupon._id },
                        update: { $set: { expiresIn } }
                    }
                };
            });

            const result = await ImportedCoupons.bulkWrite(bulkOps);
            logger.info(`CRON: expiresIn update complete. Modified ${result.modifiedCount} out of ${coupons.length} coupons.`);
        } catch (error) {
            logger.error('CRON: expiresIn update job failed:', error);
        }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // PIPELINE: Scrape → Score → Delete  (every 12 hours at 00:00 and 12:00)
    //
    // Adapters currently active: GrabOn, CouponDuniya
    // To add more later, push their names into PIPELINE_ADAPTERS.
    // ─────────────────────────────────────────────────────────────────────────
    const PIPELINE_ADAPTERS = ['GrabOn', 'CouponDuniya'];
    const SCORE_SCRIPT  = path.resolve(__dirname, '../../scripts/scoreCoupons.js');
    const DELETE_SCRIPT = path.resolve(__dirname, '../../scripts/filterBelowAverageCoupons.js');

    cron.schedule('0 */12 * * *', async () => {
        logger.info('PIPELINE: ▶ Starting 12h scrape → score → delete cycle');
        logger.info(`PIPELINE: Adapters: ${PIPELINE_ADAPTERS.join(', ')}`);

        try {
            // ── Step 1: Scrape ─────────────────────────────────────────────
            logger.info('PIPELINE: [1/3] Running scrapers...');
            const savedAdapters = process.env.SCRAPER_ADAPTERS;
            process.env.SCRAPER_ADAPTERS = PIPELINE_ADAPTERS.join(',');
            try {
                await runScraper();
                logger.info('PIPELINE: [1/3] Scraping complete.');
            } finally {
                // Always restore the original env var even if scraping fails
                if (savedAdapters !== undefined) {
                    process.env.SCRAPER_ADAPTERS = savedAdapters;
                } else {
                    delete process.env.SCRAPER_ADAPTERS;
                }
            }

            // ── Step 2: Score ──────────────────────────────────────────────
            logger.info('PIPELINE: [2/3] Running scoring script...');
            await runScript(SCORE_SCRIPT);
            logger.info('PIPELINE: [2/3] Scoring complete.');

            // ── Step 3: Delete below-average ──────────────────────────────
            logger.info('PIPELINE: [3/3] Running deletion script...');
            await runScript(DELETE_SCRIPT);
            logger.info('PIPELINE: [3/3] Deletion complete.');

            logger.info('PIPELINE: ✅ Cycle finished successfully.');
        } catch (error) {
            logger.error(`PIPELINE: ❌ Cycle failed — ${error.message}`);
        }
    });

    logger.info('Cron jobs initialized successfully');
}

module.exports = { initCronJobs };
