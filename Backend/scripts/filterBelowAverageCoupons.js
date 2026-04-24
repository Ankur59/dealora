require('dotenv').config();
require('../src/config/database');
const Coupon = require('../src/models/Coupon');

/**
 * Scores a scraped coupon using available signal fields.
 * Adapted from ai-coupon-engine scoring logic.
 */
function calculateCouponScore(coupon) {
    const weights = {
        trustscore: 35,
        usedBy: 25,
        verified: 20,
        expiry: 20,
    };

    let trustscore = coupon.trustscore ?? 0;
    let usedByScore = normalizeUsedBy(coupon.usedBy);
    let verifiedScore = coupon.verified ? 100 : 30;
    let expiryScore = getExpiryScore(coupon.expireBy);

    const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);

    const baseScore = (
        (trustscore * weights.trustscore) +
        (usedByScore * weights.usedBy) +
        (verifiedScore * weights.verified) +
        (expiryScore * weights.expiry)
    ) / totalWeight;

    return Math.round(baseScore * 100) / 100;
}

function normalizeUsedBy(count) {
    if (!count || count <= 0) return 0;
    return Math.min(100, Math.round((Math.log10(count + 1) / Math.log10(1001)) * 100));
}

function getExpiryScore(expiryDate) {
    if (!expiryDate) return 50;
    const today = new Date();
    const expiry = new Date(expiryDate);
    const daysLeft = (expiry - today) / (1000 * 60 * 60 * 24);

    if (daysLeft <= 0) return 0;
    if (daysLeft <= 2) return 100;
    if (daysLeft <= 7) return 80;
    if (daysLeft <= 15) return 60;
    if (daysLeft <= 30) return 40;
    return 20;
}

async function filterBelowAverageCoupons() {
    try {
        // Fetch all scraped coupons (adjust filter as needed)
        const coupons = await Coupon.find({ addedMethod: 'scraper' }).lean();

        if (coupons.length === 0) {
            console.log('No scraped coupons found.');
            process.exit(0);
        }

        // Group coupons by brandName
        const byMerchant = {};
        for (const coupon of coupons) {
            const merchant = coupon.brandName || 'Unknown';
            if (!byMerchant[merchant]) byMerchant[merchant] = [];
            byMerchant[merchant].push({
                id: coupon._id.toString(),
                title: coupon.couponTitle || coupon.couponName,
                score: calculateCouponScore(coupon),
            });
        }

        let totalDeleted = 0;

        for (const [merchant, merchantCoupons] of Object.entries(byMerchant)) {
            if (merchantCoupons.length === 0) continue;

            const scores = merchantCoupons.map(c => c.score);
            const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
            const roundedAvg = Math.round(averageScore * 100) / 100;

            console.log(`\n📊 ${merchant}: ${merchantCoupons.length} coupons, average score = ${roundedAvg}`);

            const toDelete = merchantCoupons.filter(c => c.score < roundedAvg);

            if (toDelete.length === 0) {
                console.log(`   ✅ All coupons are above average for ${merchant}.`);
                continue;
            }

            const idsToDelete = toDelete.map(c => c.id);

            // Log each deleted coupon
            for (const item of toDelete) {
                console.log(`   🗑️  DELETED — ID: ${item.id} | Score: ${item.score} | Avg: ${roundedAvg} | Title: ${item.title}`);
            }

            const result = await Coupon.deleteMany({ _id: { $in: idsToDelete } });
            totalDeleted += result.deletedCount;

            console.log(`   ✅ Deleted ${result.deletedCount} below-average coupon(s) for ${merchant}`);
        }

        console.log(`\n🏁 Finished. Total deleted: ${totalDeleted}`);
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

filterBelowAverageCoupons();
