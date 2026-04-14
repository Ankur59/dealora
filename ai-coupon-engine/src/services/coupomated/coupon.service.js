import { getAllCoupons } from "../../providers/coupomated.js"
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
