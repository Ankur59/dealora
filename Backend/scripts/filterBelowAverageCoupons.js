const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { connectDB } = require('../src/config/database.js');
const RawScrapedCoupon = require('../src/models/RawScrapedCoupon.js');
const logger = require('../src/utils/logger');

/**
 * filterBelowAverageCoupons
 *
 * Operates exclusively on RawScrapedCoupon documents that were SCORED in the
 * last DELETION_WINDOW_HOURS hours (i.e. the most recent scoring batch).
 *
 * Per-merchant logic:
 *   1. Collect all coupons whose scoreCalculatedAt >= cutoff.
 *   2. Group by brandName.
 *   3. For each brand, compute the average couponScore.
 *   4. Delete documents below the average.
 *
 * This keeps the deletion window tightly coupled to the scoring window so the
 * full pipeline is: scrape (12h) → score (12h window) → delete (12h window).
 */

const DELETION_WINDOW_HOURS = 12;

async function filterBelowAverageCoupons() {
    try {
        console.log('Connecting to database...');
        await connectDB();
        console.log('Connected to database.');

        const cutoffTime = new Date(Date.now() - DELETION_WINDOW_HOURS * 60 * 60 * 1000);
        console.log(`\nDeletion window: coupons scored after ${cutoffTime.toISOString()} (last ${DELETION_WINDOW_HOURS}h)`);

        // Fetch only coupons that were scored in this cycle and have a valid score
        const coupons = await RawScrapedCoupon.find({
            scoreCalculatedAt: { $gte: cutoffTime },
            couponScore: { $ne: null },
        }).lean();

        if (coupons.length === 0) {
            console.log('No scored coupons found in the last 12h. Nothing to delete.');
            process.exit(0);
        }

        console.log(`Found ${coupons.length} scored coupon(s) in the last ${DELETION_WINDOW_HOURS}h.`);

        // ── Group by brandName ───────────────────────────────────────────────
        const byMerchant = {};
        for (const coupon of coupons) {
            const brand = coupon.brandName || 'Unknown';
            if (!byMerchant[brand]) byMerchant[brand] = [];
            byMerchant[brand].push({
                id: coupon._id.toString(),
                title: coupon.couponTitle || '(no title)',
                score: coupon.couponScore,
                discountWeight: coupon.discountWeight || 0,
            });
        }

        let totalDeleted = 0;

        // ── Per-merchant deletion ────────────────────────────────────────────
        for (const [merchant, merchantCoupons] of Object.entries(byMerchant)) {
            if (merchantCoupons.length === 0) continue;

            const scores = merchantCoupons.map(c => c.score);
            const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
            const roundedAvg = Math.round(averageScore * 100) / 100;

            console.log(`\n📊 ${merchant}: ${merchantCoupons.length} coupon(s), average score = ${roundedAvg}`);

            const toDelete = merchantCoupons.filter(c => c.score < roundedAvg);

            if (toDelete.length === 0) {
                console.log(`   ✅ All coupons are above average for ${merchant}.`);
                continue;
            }

            const idsToDelete = toDelete.map(c => c.id);

            for (const item of toDelete) {
                console.log(
                    `   🗑️  DELETING — Score: ${item.score} | Avg: ${roundedAvg} | DW: ${item.discountWeight} | Title: ${item.title}`
                );
            }

            const result = await RawScrapedCoupon.deleteMany({ _id: { $in: idsToDelete } });
            totalDeleted += result.deletedCount;

            console.log(`   ✅ Deleted ${result.deletedCount} below-average coupon(s) for ${merchant}`);
        }

        console.log(`\n🏁 Finished. Total deleted: ${totalDeleted}`);
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        logger.error(`Filter Below Average Error: ${error.message}`);
        process.exit(1);
    }
}

filterBelowAverageCoupons();
