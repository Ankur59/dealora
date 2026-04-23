import { calculateCouponScore } from "./ai-coupon-engine/src/services/scoring.service.js";

const fakeCoupon = {
    isVerified: true,
    partner: "Vcommission",
    verifiedOn: new Date().toISOString()
};

console.log(calculateCouponScore(fakeCoupon));
