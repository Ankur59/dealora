import coupon from "../../models/coupon.model.js";

export const syncCouponsVCom = async (coupons) => {

    const ops = coupons.map(c => {
        const normalized = normalizeCoupon(c);

        return {
            insertOne: {
                document: normalized
            }
        };
    });

    if (ops.length === 0) return;

    try {
        await coupon.bulkWrite(ops, { ordered: false });
    } catch (err) {
        if (err.code !== 11000) {
            console.error("Bulk insert error:", err);
        }
    }
};