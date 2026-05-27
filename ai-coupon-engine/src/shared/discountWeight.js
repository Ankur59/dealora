/**
 * discountWeight.js
 *
 * Computes a numeric "discount weight" from the raw discount string returned by
 * the Coupomated API (and any other partner that provides a similar field).
 *
 * The weight is designed so that higher-value offers produce a larger number,
 * enabling the frontend to sort coupons by descending discountWeight.
 *
 * ── Scoring rules ─────────────────────────────────────────────────────────────
 *  1. Percentage-based offers   → primary % is the base score.
 *       "80% Off"               → 80
 *       "Upto 80% OFF"          → 80
 *       "Get 60% OFF"           → 60
 *       "45% OFF"               → 45
 *       "Up To 40% Off"         → 40
 *
 *  2. Stacked / extra percentage offers
 *       The *first* (largest) percentage is the base; each additional
 *       percentage is added at half weight (as a secondary boost).
 *       "Up to 80% Off + 10% Extra"  → 80 + (10 × 0.5) = 85
 *       "65% Off 10%"                → 65 + (10 × 0.5) = 70
 *
 *  3. Fixed-amount (Rs./₹) offers
 *       Converted to a log-compressed score so they sit in a reasonable range
 *       without dominating percentage coupons.
 *       formula: Math.round(Math.log10(amount + 1) × 20)
 *       "Rs. 99"   → ~40   "Rs. 1499/" → ~64   "At Rs. 2499" → ~68
 *
 *  4. No recognisable value → 0
 *       "Best Offer"  → 0
 *
 * @param {string|null|undefined} discount - Raw discount string from the API
 * @returns {number} Integer weight ≥ 0
 */
export const computeDiscountWeight = (discount) => {
    if (!discount || typeof discount !== 'string') return 0;

    const text = discount.trim();

    // ── 1 & 2: Extract all percentage values ─────────────────────────────────
    const percentMatches = [...text.matchAll(/(\d+(?:\.\d+)?)\s*%/g)];

    if (percentMatches.length > 0) {
        // Sort descending so the largest % is always treated as the primary value
        const percents = percentMatches
            .map((m) => parseFloat(m[1]))
            .sort((a, b) => b - a);

        const [primary, ...rest] = percents;

        // Each additional % adds half its value (stacked discount boost)
        const bonus = rest.reduce((sum, p) => sum + p * 0.5, 0);

        return Math.round(primary + bonus);
    }

    // ── 3: Fixed-amount Rs./₹ offers ─────────────────────────────────────────
    // Matches patterns like "Rs. 1499/", "Rs 99", "₹ 2499", "At Rs. 2499"
    const rsMatch = text.match(/(?:Rs\.?\s*|₹\s*)(\d+(?:,\d{3})*(?:\.\d+)?)/i);

    if (rsMatch) {
        // Remove commas from numbers like "1,499"
        const amount = parseFloat(rsMatch[1].replace(/,/g, ''));
        if (!isNaN(amount) && amount > 0) {
            return Math.round(Math.log10(amount + 1) * 20);
        }
    }

    // ── 4: No recognisable discount value ────────────────────────────────────
    return 0;
};
