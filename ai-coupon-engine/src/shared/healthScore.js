/**
 * healthScore.js — Shared Health Score Calculation Engine
 *
 * Single source of truth for all coupon health score signals within the
 * ai-coupon-engine. Mirrors the formula in Backend/src/cron/healthScoreCron.js.
 *
 * Because the Backend and ai-coupon-engine can be deployed independently,
 * each service owns its own copy of these pure calculation functions.
 * Formula changes must be applied in BOTH places:
 *   - Backend:          src/cron/healthScoreCron.js
 *   - ai-coupon-engine: src/shared/healthScore.js   ← this file
 */

// ─── Individual Signal Calculators ───────────────────────────────────────────

/**
 * Laplace-smoothed reliability score from community votes.
 *
 * Formula: ((successCount + 7) / (successCount + failedCount + 10)) × 100
 *
 * Why Laplace smoothing (+7, +10)?
 * - New coupons (0 votes) start at a fair 70% baseline instead of 0 or 100.
 * - Prevents a single vote from dominating the score on fresh coupons.
 *
 * @param {number} successCount - Number of successful user votes
 * @param {number} failedCount  - Number of failed user votes
 * @returns {number} reliabilityScore 0–100
 */
export function calculateReliabilityScore(successCount = 0, failedCount = 0) {
    const score = ((successCount + 7) / (successCount + failedCount + 10)) * 100;
    return Math.round(score * 100) / 100;
}

/**
 * Freshness score based on coupon age.
 *
 * Formula: 100 / (1 + daysOld)
 *
 * Brand-new coupons score 100. Score decays rapidly:
 *   1 day → 50,  3 days → 25,  7 days → 12.5,  30 days → ~3.2
 *
 * @param {Date|string} createdAt - Coupon creation date
 * @param {Date}        now       - Reference time (injectable for testing)
 * @returns {number} freshnessScore 0–100
 */
export function calculateFreshnessScore(createdAt, now = new Date()) {
    const daysOld = (now - new Date(createdAt)) / (1000 * 60 * 60 * 24);
    return 100 / (1 + daysOld);
}

/**
 * Trend score from recent discover activity.
 *
 * Formula: Min(discoverCount / (1 + hoursSinceLastDiscover), 100)
 *
 * Coupons with no discover activity score 0. Score decays over time as
 * the gap between now and lastDiscoverAt grows.
 *
 * @param {number}    discoverCount   - Total number of discovers
 * @param {Date|null} lastDiscoverAt  - Last discover timestamp (null if never)
 * @param {Date}      now             - Reference time (injectable for testing)
 * @returns {number} trendScore 0–100 (clamped)
 */
export function calculateTrendScore(discoverCount = 0, lastDiscoverAt = null, now = new Date()) {
    if (!lastDiscoverAt || discoverCount === 0) return 0;
    const hours = (now - new Date(lastDiscoverAt)) / (1000 * 60 * 60);
    return Math.round(Math.min(discoverCount / (1 + hours), 100) * 100) / 100;
}

// ─── Central Health Score Calculator ─────────────────────────────────────────

/**
 * Calculate overall health score — the single source of truth.
 *
 * Formula (additive weighted sum, all signals 0–100):
 *   healthScore = (reliabilityScore × 0.55)
 *               + (freshnessScore   × 0.30)
 *               + (trendScore       × 0.15)
 *
 * Weight rationale:
 *  - Reliability (55%): Strongest signal — driven by real user votes with
 *    Laplace smoothing applied. Most objective quality indicator.
 *  - Freshness  (30%): Ensures newly-added coupons surface fairly and
 *    old coupons gradually lose ranking advantage.
 *  - Trend      (15%): Discover/engagement activity. Kept lower because
 *    brand-new coupons start at 0 and should not be unfairly penalised.
 *
 * discountWeight is intentionally excluded — it is used only as a sort
 * field, not as a ranking signal. Health score must reflect coupon quality
 * and community trust, not discount size.
 *
 * Result is in the range 0–100. No single signal dominates.
 *
 * @param {number} reliabilityScore - Community trust score (0–100)
 * @param {number} freshnessScore   - Age-based freshness score (0–100)
 * @param {number} trendScore       - Recent engagement score (0–100)
 * @returns {number} healthScore 0–100
 */
export function calculateHealthScore(reliabilityScore = 0, freshnessScore = 0, trendScore = 0) {
    const score = (reliabilityScore * 0.55)
        + (freshnessScore * 0.30)
        + (trendScore * 0.15);
    return Math.round(score * 100) / 100;
}
