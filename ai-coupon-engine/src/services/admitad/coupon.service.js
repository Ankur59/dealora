import Coupon from '../../models/coupon.model.js';
import normalizeAdmitadCoupon from './helpers/normalize.js';

/**
 * Upserts a chunk of Admitad coupons into the internal coupons collection.
 *
 * @param {Array} rawCoupons - Array of raw coupon objects from Admitad chunk
 */
export const syncAllCouponsAdmitad = async (rawCoupons) => {
    if (!rawCoupons || rawCoupons.length === 0) {
        return;
    }

    const ops = rawCoupons
        .map(normalizeAdmitadCoupon)
        // Skip coupons with no brand name
        .filter(c => c.brandName && c.brandName !== 'Unknown')
        .map(normalized => ({
            updateOne: {
                filter: {
                    partner:  normalized.partner,
                    couponId: normalized.couponId,
                },
                update: {
                    $set: normalized,
                },
                upsert: true,
            },
        }));

    if (ops.length === 0) {
        return;
    }

    try {
        const result = await Coupon.bulkWrite(ops, { ordered: false });
        console.log(
            `[Admitad] Coupon Chunk Synced — upserted: ${result.upsertedCount}, modified: ${result.modifiedCount}`
        );
        return result;
    } catch (err) {
        if (err.code !== 11000) {
            console.error('[Admitad] Bulk coupon write error:', err.message);
            throw err;
        }
        console.warn('[Admitad] Some coupon codes were duplicates (skipped).');
    }
};

