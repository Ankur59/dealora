import { getAllCoupons, getUpdatedCoupons, getExpiredCoupons } from "../../providers/coupomated.js"
import normalizeCoupomatedCoupon from "./helpers/normalize.js"
import coupon from "../../models/coupon.model.js"

export const syncAllCoupons = async () => {
    const allCoupons = await getAllCoupons();
    console.log(allCoupons.length, "length of coupons")
    const ops = allCoupons.map((item) => {
        const normalized = normalizeCoupomatedCoupon(item);
        return {
            updateOne: {
                filter: {
                    partner: normalized.partner,
                    couponId: normalized.couponId
                },
                update: {
                    $set: normalized
                },
                upsert: true
            }
        };
    });

    if (ops.length === 0) return;

    try {
        await coupon.bulkWrite(ops, { ordered: false });
        console.log(`Coupomated: ${ops.length} coupons synced successfully.`);
    } catch (err) {
        if (err.code !== 11000) {
            console.error("Coupomated bulkWrite error:", err);
        } else {
            console.log("Coupomated: duplicate key skipped during sync.", err);
        }
    }
};

export const syncUpdatedCoupons = async () => {
    const updatedCoupons = await getUpdatedCoupons();
    console.log(updatedCoupons.length, "length of updated coupons")
    const ops = updatedCoupons.map((item) => {
        const normalized = normalizeCoupomatedCoupon(item);
        return {
            updateOne: {
                filter: {
                    partner: normalized.partner,
                    couponId: normalized.couponId
                },
                update: {
                    $set: normalized
                },
                upsert: false
            }
        };
    });

    if (ops.length === 0) return;

    try {
        await coupon.bulkWrite(ops, { ordered: false });
        console.log(`Coupomated: ${ops.length} coupons updated successfully.`);
    } catch (err) {
        console.error("Coupomated bulkWrite error (update):", err);
    }
};

export const deleteExpiredCoupons = async () => {
    const expiredCoupons = await getExpiredCoupons();
    console.log(expiredCoupons.length, "length of expired coupons to delete");

    if (expiredCoupons.length === 0) return;

    // Build { partner, couponId } pairs from the API response
    const filters = expiredCoupons.map((item) => ({
        partner: "coupomated",
        couponId: String(item.coupon_id)
    }));

    try {
        const result = await coupon.deleteMany({ $or: filters });
        console.log(`Coupomated: ${result.deletedCount} expired coupons deleted.`);
    } catch (err) {
        console.error("Coupomated deleteMany error (expired):", err);
    }
};
