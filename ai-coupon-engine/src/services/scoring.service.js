export const calculateCouponScore = (coupon) => {
    // Determine weights
    const weights = {
        liveSuccessRate: 35,
        recencyScore: 20,
        failureRate: 15,
        confidenceScore: 10,
        contextMatchScore: 10,
        sourceCredibilityScore: 5,
        trendVelocity: 5,
    };

    let totalWeight = 100;
    
    // Simulate current parameters from existing features
    let liveSuccessRate = coupon.liveSuccessRate || 0;
    let recencyScore = coupon.recencyScore || 0;
    let failureRate = coupon.failureRate || 0;
    let confidenceScore = coupon.confidenceScore || 0;
    let contextMatchScore = coupon.contextMatchScore || 0;
    let sourceCredibilityScore = coupon.sourceCredibilityScore || 0;
    let trendVelocity = coupon.trendVelocity || 0;

    // Derived logic from existing features if fields are 0
    // Live Success Rate & Failure Rate based on isVerified
    if (!coupon.liveSuccessRate && coupon.isVerified) {
        liveSuccessRate = 90; // Verified coupons are highly successful
        failureRate = 10;
        confidenceScore = 80; // High confidence due to verification
    } else if (!coupon.liveSuccessRate && !coupon.isVerified && coupon.verifiedOn) {
        liveSuccessRate = 10;
        failureRate = 90;
        confidenceScore = 60; 
    }

    // Recency Score based on verifiedOn or updatedAt
    if (!coupon.recencyScore) {
        const dateToUse = coupon.verifiedOn || coupon.updatedAt || new Date();
        const diffDays = (new Date() - new Date(dateToUse)) / (1000 * 60 * 60 * 24);
        // Exponential decay: e^(-0.1 * diffDays)
        recencyScore = Math.max(0, Math.round(100 * Math.exp(-0.1 * diffDays)));
    }

    // Source Credibility Score based on Partner
    if (!coupon.sourceCredibilityScore && coupon.partner) {
        const partnerName = coupon.partner.toLowerCase();
        if (partnerName.includes("vcommission")) {
            sourceCredibilityScore = 90;
        } else if (partnerName.includes("coupomated") || partnerName.includes("admitad")) {
            sourceCredibilityScore = 80;
        } else {
            sourceCredibilityScore = 50;
        }
    }

    // Trend Velocity - maybe random or based on usedByCount if available
    if (!coupon.trendVelocity) {
        trendVelocity = coupon.usedByCount > 100 ? 80 : 40;
    }

    // Base Score
    const baseScore = (
        (liveSuccessRate * weights.liveSuccessRate) +
        (recencyScore * weights.recencyScore) +
        ((100 - failureRate) * weights.failureRate) + // inverse failure rate
        (confidenceScore * weights.confidenceScore) +
        (contextMatchScore * weights.contextMatchScore) +
        (sourceCredibilityScore * weights.sourceCredibilityScore) +
        (trendVelocity * weights.trendVelocity)
    ) / totalWeight;

    // Coverage Factor: since we are estimating all of them right now, coverage is ~1.0.
    // If a coupon had absolutely no data, coverage would be lower.
    const coverageFactor = 1.0; 

    const finalScore = baseScore * coverageFactor;

    return {
        liveSuccessRate,
        recencyScore,
        failureRate,
        confidenceScore,
        contextMatchScore,
        sourceCredibilityScore,
        trendVelocity,
        finalScore: Math.round(finalScore * 100) / 100
    };
};
