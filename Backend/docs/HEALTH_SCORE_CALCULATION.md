# Health Score Calculation Engine

## Overview

The Dealora system uses an automated **Health Score Calculation Engine** that runs every **5 hours** to assess the quality and reliability of all active partner coupons. This score helps users discover the most trustworthy and relevant coupons.

**Schedule:** `0 */5 * * *` (Every 5 hours)  
**Scope:** All active (non-expired) partner coupons  
**Storage:** Database persisted for real-time ranking and filtering

---

## Calculation Parameters & Weights

The Health Score is an **additive weighted sum** of 3 independent scoring signals:

### 📊 Parameter Breakdown

| Parameter             | Weight  | Range | Purpose                                          |
| --------------------- | ------- | ----- | ------------------------------------------------ |
| **Reliability Score** | **55%** | 0–100 | Community feedback (success/fail votes)          |
| **Freshness Score**   | **30%** | 0–100 | Age of the coupon (newer = fresher)              |
| **Trend Score**       | **15%** | 0–100 | Recent user engagement & discover activity       |

> **Note:** `discountWeight` (the coupon's raw discount percentage) is intentionally **not** part of the health score. Sorting by discount value is available as a separate explicit sort option for users. Including it in the health score would unfairly privilege high-discount coupons regardless of their community trust or freshness.

---

## Final Health Score Formula

```
healthScore = (reliabilityScore × 0.55)
            + (freshnessScore   × 0.30)
            + (trendScore       × 0.15)
```

All three signals are already on a **0–100 scale**, so the resulting health score is also **0–100**. No normalization step is needed, and no single signal dominates.

### Weight Rationale

| Signal      | Weight | Why                                                                                                         |
|-------------|--------|-------------------------------------------------------------------------------------------------------------|
| Reliability | 55%    | Most objective signal — driven by real user votes with Laplace smoothing. Best proxy for coupon quality.   |
| Freshness   | 30%    | Prevents old coupons with accumulated votes from permanently burying new, potentially better coupons.       |
| Trend       | 15%    | Engagement signal, but new coupons start at 0 so this is kept low to avoid starving fresh listings.        |

---

## Detailed Signal Calculations

### 1. **Reliability Score (55%)**

**Purpose:** Measures community trust through actual user feedback

**Formula:**

```
Reliability Score = ((successCount + 7) / (successCount + failedCount + 10)) × 100
```

**Why Laplace Smoothing (+7 and +10)?**

- Prevents brand new coupons with 1 success vote from scoring 100%
- Fairness: Prevents division by zero and treats new coupons conservatively
- Baseline Score: Brand new coupons start with a fair default score of **70%** (0 success, 0 failed)
- More realistic for small sample sizes

**Examples:**

| Scenario                              | Calculation     | Score     |
| ------------------------------------- | --------------- | --------- |
| No feedback yet (0 success, 0 failed) | (7/10) × 100    | **70%**   |
| 1 success, 0 failed                   | (8/11) × 100    | **72.7%** |
| 10 success, 2 failed                  | (17/22) × 100   | **77.3%** |
| 50 success, 5 failed                  | (57/65) × 100   | **87.7%** |
| 100 success, 10 failed                | (107/120) × 100 | **89.2%** |

**Key Insight:** Coupons need consistently positive feedback to achieve high reliability scores.

---

### 2. **Freshness Score (30%)**

**Purpose:** Promote newer, more relevant coupons

**Formula:**

```
Freshness Score = 100 / (1 + daysOld)
```

**Important:** This score is **NOT persisted** to the database

- Calculated fresh during each cron execution
- Based on `createdAt` timestamp
- Ensures older coupons gradually lose ranking advantage

**Examples:**

| Days Old     | Calculation | Score     |
| ------------ | ----------- | --------- |
| 0 days (new) | 100 / 1     | **100%**  |
| 1 day        | 100 / 2     | **50%**   |
| 3 days       | 100 / 4     | **25%**   |
| 7 days       | 100 / 8     | **12.5%** |
| 30 days      | 100 / 31    | **3.2%**  |

**Visual Timeline:**

```
Fresh ─────────────────────→ Aged
100%  ──────↘ Gradually decreases ──→ ~0%
   Day 0              Days 1-30
```

---

### 3. **Trend Score (15%)**

**Purpose:** Boost coupons with recent user engagement

**Formula:**

```
Trend Score = Min(discoverCount / (1 + hoursSinceLastDiscover), 100)
```

**Rules:**

- If `lastDiscoverAt` is NULL or `discoverCount` is 0 → Score = 0
- Capped at maximum 100
- Decays over time (more hours since last discover = lower score)

**Examples:**

| Discovers | Hours Since | Calculation             | Score      |
| --------- | ----------- | ----------------------- | ---------- |
| 0         | N/A         | N/A                     | **0%**     |
| 5         | 1 hour      | 5 / 2 = 2.5             | **2.5%**   |
| 10        | 4 hours     | 10 / 5 = 2              | **2%**     |
| 50        | 2 hours     | 50 / 3 = 16.67          | **16.67%** |
| 100       | 1 hour      | 100 / 2 = 50            | **50%**    |
| 200       | 1 hour      | 200 / 2 = 100 (capped)  | **100%**   |

---

## Calculation Example

**Scenario:** A coupon created 3 days ago

- **Reliability Score:** 75 (good community feedback)
- **Freshness Score:** 25 (100 / 4 days)
- **Trend Score:** 8 (some recent discover activity)

**Health Score Calculation:**

```
= (75 × 0.55) + (25 × 0.30) + (8 × 0.15)
= 41.25 + 7.50 + 1.20
= 49.95
```

---

## Where Health Score is Calculated

The health score uses a **single central function** (`calculateHealthScore` in `src/cron/healthScoreCron.js`) called from three places:

| Trigger                        | Location                                | When it runs                        |
|-------------------------------|------------------------------------------|--------------------------------------|
| **Scheduled cron**            | `src/cron/healthScoreCron.js`           | Every 5 hours (batch recalculation) |
| **Vote recorded (controller)**| `src/controllers/partnerCouponController.js` → `votePartnerCoupon()` | When user votes success/failure |
| **Interaction resolved**      | `src/routes/partnerCouponInteractionRoutes.js` → `PATCH /:id/resolve` | When popup feedback is submitted |
| **Redeem pressed**            | `src/routes/partnerCouponInteractionRoutes.js` → `POST /` | When user taps Redeem (initial failedCount bump) |

---

## Cron Job Details

### Execution Flow

```
Every 5 Hours:
  ├─ 1. Fetch all active coupons (status ≠ expired, end > now)
  ├─ 2. For each coupon:
  │   ├─ Calculate Reliability Score (from DB: successCount, failedCount)
  │   ├─ Calculate Freshness Score   (from DB: createdAt)
  │   ├─ Calculate Trend Score       (from DB: trend.discoverCount, trend.lastDiscoverAt)
  │   └─ Calculate Health Score      (central function: reliability×0.55 + freshness×0.30 + trend×0.15)
  ├─ 3. Bulk update all coupons with new scores
  └─ 4. Log execution metrics
```

### Database Fields Updated

The following fields are updated in the `partnercoupons` collection:

```javascript
{
  "trend.reliabilityScore": <number>,  // 0-100
  "trend.trendScore":       <number>,  // 0-100
  "trend.healthScore":      <number>   // 0-100
}
```

### Database Fields Read (Not Modified)

- `successCount` - Community votes (success)
- `failedCount` - Community votes (failed)
- `createdAt` - Coupon creation date
- `trend.discoverCount` - Total user discovers
- `trend.lastDiscoverAt` - Most recent discover timestamp
- `status` - Coupon status
- `end` - Expiry date

---

## System Accuracy & Reliability

### Why This System is Accurate

1. **Multi-Factor Approach (55-30-15 Split)**
   - Doesn't rely on a single metric
   - Balances trust (reliability), recency (freshness), and engagement (trend)

2. **Community-Driven (55% weight)**
   - Real user feedback (success/fail votes)
   - Laplace smoothing prevents gaming by new coupons
   - Requires sustained positive feedback for high scores

3. **Freshness Factor (30% weight)**
   - Removes stale, outdated coupons from top results
   - Recalculated every 5 hours
   - Encourages current, relevant offers

4. **Trend Recognition (15% weight)**
   - Identifies coupons gaining momentum
   - Recent engagement = user satisfaction
   - Light weighting prevents gaming

5. **Automated & Transparent**
   - No manual intervention
   - Same formula applied equally to all coupons
   - Reproducible and auditable

### Preventing Fraud

- ✅ Laplace smoothing prevents fake 1-vote coupons from ranking high
- ✅ Low weight (15%) on trend prevents sudden spike gaming
- ✅ Freshness decay removes old coupons automatically
- ✅ Community votes must be consistent over time
- ✅ All scores recalculated every 5 hours (no stale cache)
- ✅ `discountWeight` excluded — coupon value does not influence health ranking

---

## Performance Metrics

### Execution Time

- Average: **200-500ms** for 1000+ coupons
- Bulk operations ensure efficiency
- Non-blocking (runs in background cron)

### Coverage

- **Scope:** All active coupons (excludes expired)
- **Frequency:** Every 5 hours = ~4.8 times per day
- **Consistency:** Same scoring logic applied to all

---

## Client Explanation Summary

> "Dealora scores every coupon on a scale of 0–100 based on three key factors:
>
> 1. **Community trust** (55% weight) — Real user success/fail feedback
> 2. **Freshness** (30% weight) — How new the coupon is
> 3. **Trending popularity** (15% weight) — Recent user engagement
>
> This system refreshes automatically every 5 hours, ensuring our results are always accurate, fair, and based on real user data. Coupons must earn high scores through consistent community feedback and proven relevance — no artificial boosting from discount size."

---

## Configuration Reference

**Cron Expression:** `0 */5 * * *`

- `0` - At minute 0
- `*/5` - Every 5th hour
- `*` - Every day of month
- `*` - Every month
- `*` - Every day of week

**Execution Times (UTC):**

- 00:00, 05:00, 10:00, 15:00, 20:00 → 5 executions per day

---

**Last Updated:** 2026-05-30  
**Version:** 2.0  
**Status:** Production Active  
**Change:** Removed `discountWeight` from health score; redistributed to reliability (55%), freshness (30%), trend (15%). Centralized into single `calculateHealthScore()` function.
