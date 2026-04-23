function getExpiryScore(expiryDateFromDB) {
    if (!expiryDateFromDB) return null;

    const today = new Date();
    const expiry = new Date(expiryDateFromDB);
    const daysLeft = (expiry - today) / (1000 * 60 * 60 * 24);

    if (daysLeft <= 0) return 0;   // expired
    if (daysLeft <= 2) return 100;
    if (daysLeft <= 7) return 80;
    if (daysLeft <= 15) return 60;
    if (daysLeft <= 30) return 40;
    return 20;
}

// Log scale: 0→0, 10→~33, 100→~66, 1000→100
function normalizeUsedBy(count) {
    if (!count || count <= 0) return 0;
    return Math.min(100, Math.round((Math.log10(count + 1) / Math.log10(1001)) * 100));
}

export const calculateCouponScore = (coupon) => {
    const weights = {
        liveSuccessRate: 25,
        recencyScore: 15,
        failureRate: 10,
        trustScore: 10,
        confidenceScore: 8,
        contextMatchScore: 8,
        usedBy: 7,
        sourceCredibilityScore: 5,
        expiryFilter: 5,
        trendVelocity: 4,
        platformVerified: 3,
    };

    // --- Raw field extraction ---
    let liveSuccessRate = coupon.liveSuccessRate || 0;
    let recencyScore = coupon.recencyScore || 0;
    let failureRate = coupon.failureRate || 0;
    let confidenceScore = coupon.confidenceScore || 0;
    let contextMatchScore = coupon.contextMatchScore || 0;
    let sourceCredibilityScore = coupon.sourceCredibilityScore || 0;
    let trendVelocity = coupon.trendVelocity || 0;
    let trustScore = coupon.trustscore ?? null;
    let usedByScore = normalizeUsedBy(coupon.usedBy);
    let expiryFilter = getExpiryScore(coupon.expiryDate);
    let platformVerifiedScore = coupon.verified ? 100 : 30;

    // --- Derived fallbacks ---

    // Live Success Rate & Failure Rate from isVerified
    if (!coupon.liveSuccessRate && coupon.isVerified) {
        liveSuccessRate = 90;
        failureRate = 10;
        confidenceScore = 80;
    } else if (!coupon.liveSuccessRate && !coupon.isVerified && coupon.verifiedOn) {
        liveSuccessRate = 10;
        failureRate = 90;
        confidenceScore = 60;
    }

    // Recency Score from verifiedOn or updatedAt
    if (!coupon.recencyScore) {
        const dateToUse = coupon.verifiedOn || coupon.updatedAt || new Date();
        const diffDays = (new Date() - new Date(dateToUse)) / (1000 * 60 * 60 * 24);
        recencyScore = Math.max(0, Math.round(100 * Math.exp(-0.1 * diffDays)));
    }

    // Source Credibility from partner name
    if (!coupon.sourceCredibilityScore && coupon.partner) {
        const p = coupon.partner.toLowerCase();
        if (p.includes("vcommission")) sourceCredibilityScore = 90;
        else if (p.includes("coupomated") || p.includes("admitad")) sourceCredibilityScore = 80;
        else sourceCredibilityScore = 50;
    }

    // Trend Velocity from usedByCount
    if (!coupon.trendVelocity) {
        trendVelocity = coupon.usedByCount > 100 ? 80 : 40;
    }

    // --- Dynamic total weight (drop expiryFilter weight if date is missing) ---
    const effectiveExpiryWeight = expiryFilter !== null ? weights.expiryFilter : 0;
    const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0)
        - weights.expiryFilter
        + effectiveExpiryWeight;

    // --- Weighted score ---
    const baseScore = (
        (liveSuccessRate * weights.liveSuccessRate) +
        (recencyScore * weights.recencyScore) +
        ((100 - failureRate) * weights.failureRate) + // inverse
        (trustScore !== null ? trustScore * weights.trustScore : 0) +
        (confidenceScore * weights.confidenceScore) +
        (contextMatchScore * weights.contextMatchScore) +
        (usedByScore * weights.usedBy) +
        (sourceCredibilityScore * weights.sourceCredibilityScore) +
        ((expiryFilter ?? 0) * effectiveExpiryWeight) +
        (trendVelocity * weights.trendVelocity) +
        (platformVerifiedScore * weights.platformVerified)
    ) / totalWeight;

    return {
        liveSuccessRate,
        recencyScore,
        failureRate,
        confidenceScore,
        contextMatchScore,
        sourceCredibilityScore,
        trendVelocity,
        trustScore,
        usedByScore,
        expiryFilter,
        platformVerifiedScore,
        finalScore: Math.round(baseScore * 100) / 100,
    };
};