# Dealora — Coupon Automation Pipeline

## Overview

The pipeline runs automatically every **12 hours** and follows three sequential steps:

```
Scrape  ──►  Score  ──►  Delete (below-average)
```

Each step is time-windowed to the **same 12-hour slot**, so only fresh data is processed. No historical coupons are ever re-scored or accidentally deleted.

---

## Trigger Schedule

| What | Cron Expression | Fires At (IST) |
|---|---|---|
| **Full pipeline** (scrape → score → delete) | `0 */12 * * *` | 00:00 and 12:00 every day |
| Legacy daily scrape (all adapters) | `0 2 * * *` | 02:00 daily |
| Expired coupon cleanup | `0 4 * * *` | 04:00 daily |

The pipeline cron is defined in `src/cron/jobs.js` and is completely independent from the legacy daily scrape job.

---

## Step 1 — Scrape

**File:** `src/scraper/index.js` → `runScraper()`  
**Adapters active:** `GrabOn`, `CouponDuniya` *(expandable — see [Adding More Adapters](#adding-more-adapters-to-the-pipeline))*

### What happens
1. The cron temporarily sets `process.env.SCRAPER_ADAPTERS = 'GrabOn,CouponDuniya'`.
2. `runScraper()` builds only those two adapters and runs the scraper engine.
3. Each scraped coupon is **upserted** into `rawscrapedcoupons` using the compound unique key:
   ```
   (sourceAdapter + brandName + couponTitle)
   ```
   Duplicate coupons are updated in-place, never duplicated.
4. Every upserted document gets `scrapedAt = Date.now()`.
5. `discountWeight` is computed immediately at ingestion (see [High-Value Protection](#how-high-value-coupons-are-protected)).
6. After scraping finishes, `SCRAPER_ADAPTERS` is restored to its previous value.

### Deduplication condition
A coupon is considered the **same** if it matches all three fields:

| Field | Example |
|---|---|
| `sourceAdapter` | `"GrabOn"` |
| `brandName` | `"Zomato"` |
| `couponTitle` | `"Flat ₹200 off on orders above ₹499"` |

> **Note:** `scrapedAt` is updated on every upsert, so even repeated coupons always carry a fresh timestamp after each cycle.

---

## Step 2 — Score

**File:** `scripts/scoreCoupons.js`

### Time window condition
```
Only process coupons where:  scrapedAt >= now - 12h
```

The cutoff is computed **once** before the merchant loop, ensuring a consistent boundary across all merchants in the same run.

### What happens per merchant
1. Fetch all active merchants from `rawscrapedmerchants`.
2. For each merchant, query coupons matching `brandName` **and** `scrapedAt >= cutoff`.
3. Map any missing scoring fields (e.g. `verifiedOn`, `usedByCount`) from adjacent stored fields — without modifying the originals.
4. Call `calculateCouponScore()` from the AI coupon engine.
5. **Persist three fields** back to the document:

| Field | What it stores |
|---|---|
| `couponScore` | Final numeric score (0–100) |
| `scoreCalculatedAt` | Timestamp of this scoring run *(anchor for deletion)* |
| `scoreDetails` | Component-level breakdown (if available) |

> **Important:** `scoreCalculatedAt` is the critical field that ties the scoring batch to the deletion batch. Without it, the deletion step has no safe window to operate on.

---

## Step 3 — Delete Below-Average

**File:** `scripts/filterBelowAverageCoupons.js`

### Time window condition
```
Only process coupons where:  scoreCalculatedAt >= now - 12h
                         AND  couponScore IS NOT null
```

This ensures deletion **only touches coupons scored in this same cycle** — never coupons from older runs.

### Per-merchant deletion logic

For each brand group (e.g. all Zomato coupons scored this cycle):

```
averageScore = sum(couponScore) / count
delete where couponScore < averageScore
```

Isolation is key — Zomato's average never affects Amazon's coupons and vice versa.

### Example — Zomato batch (5 coupons)

| Coupon Code | Score | Result |
|---|---|---|
| FLAT200 | 72 | ✅ Kept (above avg 61) |
| ZOMFREE | 80 | ✅ Kept |
| SAVE10 | 45 | ❌ Deleted |
| NEWNEW | 58 | ❌ Deleted |
| BIGDEAL | 50 | ❌ Deleted |
| **Average** | **61** | — |

---

## How High-Value Coupons Are Protected

This is the most important safety mechanism in the pipeline.

### The `discountWeight` field

Every coupon gets a `discountWeight` (0–100) assigned **at scrape time** — before any scoring or deletion runs. It represents the monetary value of the coupon as a normalized score.

| Discount type | Rule | Example output |
|---|---|---|
| `percentage` | `min(pct × 1.5, 100)` | 30% off → **45** |
| `flat` / `cashback` | log₁₀-scaled on ₹5000 ceiling | ₹500 off → **~54** |
| `freebie` | Fixed **60** | Buy X Get Y Free |
| `buy1get1` | Fixed **70** | BOGO deals |
| `free_delivery` | Fixed **40** | Delivery waiver |
| `wallet_upi` | Fixed **45** | PhonePe / GPay offers |
| `unknown` | **20** | Discount type unclear |
| `null` | **10** | No discount info at all |

### Scoring formula

The final score uses **5 weighted components** summing to 100:

```
Score = (
    trustscore    × 30  +   ← Platform trust / success rate
    usedByScore   × 20  +   ← Crowd usage (social proof)
    verifiedScore × 15  +   ← Platform-verified badge
    expiryScore   × 15  +   ← Urgency / freshness
    discountWeight× 20      ← Monetary value  ← HIGH-VALUE ANCHOR
) / 100
```

A coupon with `discountWeight = 70` (e.g. ₹1000 flat off) contributes **14 raw points** to its final score from discount alone, making it statistically unlikely to fall below a merchant's average unless every other signal is also poor.

### Real scenario — High-value coupon, low social proof

| Signal | Raw value | Contribution |
|---|---|---|
| `trustscore` = 50 | 50 × 0.30 | **15.0 pts** |
| `usedBy` = 0 | 0 × 0.20 | **0.0 pts** |
| Not verified | 30 × 0.15 | **4.5 pts** |
| Expiry in 5 days | 80 × 0.15 | **12.0 pts** |
| `discountWeight` = 70 (₹1000 flat) | 70 × 0.20 | **14.0 pts** |
| **Final score** | | **45.5 / 100** |

Even with zero social proof, the coupon survives in most merchant batches because of its discount anchor.

> **Tip:** If high-value coupons are being deleted unexpectedly, verify that `discountWeight` was correctly computed at scrape time. It should be non-null for all coupons with a known `discountType` and `discountValue`.

---

## Adding More Adapters to the Pipeline

In `src/cron/jobs.js`, locate:

```js
const PIPELINE_ADAPTERS = ['GrabOn', 'CouponDuniya'];
```

Add any adapter name that exists in `ADAPTER_FACTORIES` inside `src/scraper/index.js`:

```js
// Example — adding Cashkaro and CouponDekho to the 12h cycle
const PIPELINE_ADAPTERS = ['GrabOn', 'CouponDuniya', 'Cashkaro', 'CouponDekho'];
```

No other changes are needed. The scraper, scorer, and deletion scripts all operate generically on `brandName` and don't care which adapter produced a coupon.

---

## Full Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│  CRON  fires at 00:00 and 12:00 every day  (0 */12 * * *)          │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 1 — SCRAPE                                                    │
│                                                                     │
│  Adapters: GrabOn, CouponDuniya                                     │
│  Action:   Upsert into rawscrapedcoupons                            │
│  Sets:     scrapedAt = now                                          │
│            discountWeight = computed from discountType+Value        │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 2 — SCORE                                                     │
│                                                                     │
│  Filter:   scrapedAt >= now - 12h                                   │
│  Groups:   per merchant (brandName)                                 │
│  Action:   calculateCouponScore() using 5-component formula         │
│  Saves:    couponScore, scoreCalculatedAt, scoreDetails             │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 3 — DELETE BELOW-AVERAGE                                      │
│                                                                     │
│  Filter:   scoreCalculatedAt >= now - 12h  AND  couponScore != null │
│  Groups:   per merchant (brandName)                                 │
│  Computes: averageScore per brand                                   │
│  Deletes:  coupons where couponScore < averageScore                 │
│  Keeps:    all coupons >= average  (high-value coupons safe)        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Key Files Reference

| File | Role |
|---|---|
| `src/cron/jobs.js` | Cron definitions; contains `PIPELINE_ADAPTERS` list |
| `src/scraper/index.js` | `runScraper()` + adapter registry (`ADAPTER_FACTORIES`) |
| `src/scraper/engine.js` | Core scraper engine; computes `discountWeight` at ingestion |
| `src/models/RawScrapedCoupon.js` | Schema for `rawscrapedcoupons` collection |
| `scripts/scoreCoupons.js` | Step 2 — scores coupons scraped in last 12h |
| `scripts/filterBelowAverageCoupons.js` | Step 3 — deletes below-average from scored batch |
