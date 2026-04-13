import coupon from "../../models/coupon.model.js";
import normalizeCoupon from "../../utils/helper.js";

export const syncCouponsVCom = async (coupons, countries = [], categories = []) => {

    const ops = coupons.map(c => {
        let normalized = normalizeCoupon(c);
        normalized.countries = countries
        normalized.categories = categories
        return {
            updateOne: {
                filter: {
                    partner: normalized.partner,
                    ...(normalized.couponId
                        ? { couponId: normalized.couponId }
                        : { code: normalized.code })
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
    } catch (err) {
        if (err.code !== 11000) {
            console.error("Bulk insert error:", err);
        }
        else{
            console.log(err)
        }
    }
};