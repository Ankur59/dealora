import Merchant from '../models/merchant.model.js';
import Coupon from '../models/coupon.model.js';
import CouponVerification from '../models/couponVerification.model.js';
import VerificationJob from '../models/verificationJob.model.js';

/**
 * Health Score Service
 * 
 * Computes health metrics for merchants and coupons:
 * - Merchant Health: login success, cookie freshness, verification throughput, block rate
 * - Coupon Health: verification success rate, recency, confidence
 * - System Health: overall verification accuracy, precision, recall
 *
 * Runs every 12 hours (called by scheduler) and stores results in DB.
 */

class HealthScoreService {
  /**
   * Compute health score for a single merchant (0-100).
   * Factors: login success, cookie age, verification rate, block frequency.
   */
  async computeMerchantHealth(merchantId) {
    try {
      const merchant = await Merchant.findById(merchantId).lean();
      if (!merchant) return null;

      const now = Date.now();
      const scores = {};

      // 1. Login Health (0-100): based on lastLoginAttempt status
      const loginStatus = merchant.lastLoginAttempt?.status || 'idle';
      const loginScoreMap = { success: 100, idle: 50, running: 60, pending_otp: 40, failed: 10 };
      scores.loginHealth = loginScoreMap[loginStatus] ?? 30;

      // 2. Cookie Freshness (0-100): how recent are saved cookies
      if (Array.isArray(merchant.cookies) && merchant.cookies.length > 0) {
        const lastLogin = merchant.lastLoginAttempt?.lastAttempted;
        if (lastLogin) {
          const ageHours = (now - new Date(lastLogin).getTime()) / (1000 * 60 * 60);
          if (ageHours <= 6) scores.cookieFreshness = 100;
          else if (ageHours <= 12) scores.cookieFreshness = 80;
          else if (ageHours <= 24) scores.cookieFreshness = 60;
          else if (ageHours <= 48) scores.cookieFreshness = 40;
          else scores.cookieFreshness = 20;
        } else {
          scores.cookieFreshness = 30; // cookies exist but no timestamp
        }
      } else {
        scores.cookieFreshness = 0; // no cookies
      }

      // 3. Verification Success Rate (0-100)
      const verifications = await CouponVerification.find({ merchantId }).lean();
      const totalV = verifications.length;
      if (totalV > 0) {
        const successV = verifications.filter(v => v.status === 'verified').length;
        const failedV = verifications.filter(v => v.status === 'failed').length;
        scores.verificationRate = Math.round((successV / totalV) * 100);
        scores.failureRate = Math.round((failedV / totalV) * 100);
      } else {
        scores.verificationRate = 0;
        scores.failureRate = 0;
      }

      // 4. Coupon Coverage (0-100): % of active coupons that have been verified
      const activeCoupons = await Coupon.countDocuments({ brandName: merchant.merchantName, status: 'active' });
      const verifiedCoupons = await CouponVerification.countDocuments({ merchantId, status: 'verified' });
      scores.couponCoverage = activeCoupons > 0 ? Math.round((verifiedCoupons / activeCoupons) * 100) : 0;

      // 5. Configuration completeness (0-100)
      let configScore = 0;
      if (merchant.website || merchant.merchantUrl || merchant.domain) configScore += 40;
      if (Array.isArray(merchant.cookies) && merchant.cookies.length > 0) configScore += 30;
      if (merchant.autoVerificationEnabled) configScore += 30;
      scores.configCompleteness = configScore;

      // Weighted final health score
      const weights = {
        loginHealth: 25,
        cookieFreshness: 20,
        verificationRate: 25,
        couponCoverage: 15,
        configCompleteness: 15,
      };

      const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
      const healthScore = Math.round(
        Object.entries(weights).reduce((sum, [key, weight]) => {
          return sum + ((scores[key] || 0) * weight);
        }, 0) / totalWeight
      );

      return {
        merchantId: merchant._id,
        merchantName: merchant.merchantName,
        healthScore,
        breakdown: scores,
        activeCoupons,
        verifiedCoupons,
        totalVerifications: totalV,
        computedAt: new Date(),
      };
    } catch (err) {
      console.error(`[HealthScore] Error for merchant ${merchantId}:`, err.message);
      return null;
    }
  }

  /**
   * Compute and PERSIST health score for a merchant.
   */
  async computeAndSaveMerchantHealth(merchantId) {
    const result = await this.computeMerchantHealth(merchantId);
    if (result) {
      try {
        await Merchant.findByIdAndUpdate(merchantId, {
          healthScore: result.healthScore,
          lastHealthCheck: result.computedAt,
          healthScoreBreakdown: result.breakdown,
        });
      } catch (err) {
        console.error(`[HealthScore] Failed to persist score for ${merchantId}:`, err.message);
      }
    }
    return result;
  }

  /**
   * Compute AI model accuracy metrics across ALL verifications.
   * Returns precision, recall, accuracy, F1 score, confidence distribution.
   */
  async computeModelMetrics() {
    try {
      const verifications = await CouponVerification.find({}).lean();
      const total = verifications.length;

      if (total === 0) {
        return {
          total: 0,
          accuracy: 0,
          precision: 0,
          recall: 0,
          f1Score: 0,
          confidenceDistribution: {},
          statusBreakdown: {},
          averageAttempts: 0,
          errorTypeBreakdown: {},
          computedAt: new Date(),
        };
      }

      // Status breakdown
      const statusBreakdown = {};
      for (const v of verifications) {
        statusBreakdown[v.status] = (statusBreakdown[v.status] || 0) + 1;
      }

      // For precision/recall we treat verified=positive, failed=negative
      // Manual overrides serve as ground truth
      const withOverride = verifications.filter(v => v.manualOverride?.newStatus);
      const withoutOverride = verifications.filter(v => !v.manualOverride?.newStatus);

      let truePositives = 0;  // AI said verified, manual confirmed verified
      let falsePositives = 0; // AI said verified, manual said failed
      let trueNegatives = 0;  // AI said failed, manual confirmed failed
      let falseNegatives = 0; // AI said failed, manual said verified

      for (const v of withOverride) {
        const aiSays = v.status;
        const humanSays = v.manualOverride.newStatus;
        if (aiSays === 'verified' && humanSays === 'verified') truePositives++;
        else if (aiSays === 'verified' && humanSays === 'failed') falsePositives++;
        else if (aiSays === 'failed' && humanSays === 'failed') trueNegatives++;
        else if (aiSays === 'failed' && humanSays === 'verified') falseNegatives++;
      }

      // If no manual overrides yet, compute from AI results alone (self-reported)
      if (withOverride.length === 0) {
        truePositives = statusBreakdown['verified'] || 0;
        trueNegatives = statusBreakdown['failed'] || 0;
        // No way to know FP/FN without ground truth
      }

      const totalClassified = truePositives + falsePositives + trueNegatives + falseNegatives;
      const accuracy = totalClassified > 0
        ? Math.round(((truePositives + trueNegatives) / totalClassified) * 10000) / 100
        : 0;
      const precision = (truePositives + falsePositives) > 0
        ? Math.round((truePositives / (truePositives + falsePositives)) * 10000) / 100
        : 0;
      const recall = (truePositives + falseNegatives) > 0
        ? Math.round((truePositives / (truePositives + falseNegatives)) * 10000) / 100
        : 0;
      const f1Score = (precision + recall) > 0
        ? Math.round((2 * precision * recall / (precision + recall)) * 100) / 100
        : 0;

      // Confidence distribution buckets
      const confidenceDistribution = { '0-20': 0, '21-40': 0, '41-60': 0, '61-80': 0, '81-100': 0 };
      for (const v of verifications) {
        // Use coupon's confidenceScore if available
        const coupon = await Coupon.findById(v.couponId).lean().catch(() => null);
        const conf = coupon?.confidenceScore || 0;
        if (conf <= 20) confidenceDistribution['0-20']++;
        else if (conf <= 40) confidenceDistribution['21-40']++;
        else if (conf <= 60) confidenceDistribution['41-60']++;
        else if (conf <= 80) confidenceDistribution['61-80']++;
        else confidenceDistribution['81-100']++;
      }

      // Error type breakdown
      const errorTypeBreakdown = {};
      for (const v of verifications) {
        if (v.result?.errorType && v.result.errorType !== 'none') {
          errorTypeBreakdown[v.result.errorType] = (errorTypeBreakdown[v.result.errorType] || 0) + 1;
        }
      }

      // Average attempts
      const avgAttempts = verifications.reduce((s, v) => s + (v.attemptCount || 1), 0) / total;

      return {
        total,
        accuracy,
        precision,
        recall,
        f1Score,
        truePositives,
        falsePositives,
        trueNegatives,
        falseNegatives,
        manualOverrideCount: withOverride.length,
        confidenceDistribution,
        statusBreakdown,
        averageAttempts: Math.round(avgAttempts * 100) / 100,
        errorTypeBreakdown,
        computedAt: new Date(),
      };
    } catch (err) {
      console.error('[HealthScore] Error computing model metrics:', err.message);
      return { error: err.message, computedAt: new Date() };
    }
  }

  /**
   * Compute health for ALL enabled merchants + model metrics.
   * Called every 12 hours by scheduler.
   */
  async computeAllHealthScores() {
    try {
      const merchants = await Merchant.find({ autoVerificationEnabled: true }).lean();
      const merchantHealthScores = [];

      for (const merchant of merchants) {
        const health = await this.computeAndSaveMerchantHealth(merchant._id);
        if (health) merchantHealthScores.push(health);
      }

      const modelMetrics = await this.computeModelMetrics();

      // System-level aggregation
      const avgHealth = merchantHealthScores.length > 0
        ? Math.round(merchantHealthScores.reduce((s, h) => s + h.healthScore, 0) / merchantHealthScores.length)
        : 0;

      const lastJob = await VerificationJob.findOne().sort({ createdAt: -1 }).lean();

      return {
        systemHealth: avgHealth,
        merchantCount: merchantHealthScores.length,
        merchantHealthScores,
        modelMetrics,
        lastJobStatus: lastJob?.status || 'none',
        lastJobTime: lastJob?.cycleStartTime || null,
        computedAt: new Date(),
      };
    } catch (err) {
      console.error('[HealthScore] Error computing all scores:', err.message);
      return { error: err.message, computedAt: new Date() };
    }
  }
}

export default new HealthScoreService();
