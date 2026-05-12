# Dealora — Developer Notes

> **Audience:** New engineers joining the Dealora backend or Android team.
> **Last updated:** 2026-05-01
> **Covers:** Scraper internals, the scoring/filtering pipeline, and the Fleet Engine (user feedback loop).

---

## Table of Contents

1. [High-Level Architecture](#1-high-level-architecture)
2. [Scrapers](#2-scrapers)
   - [2.1 GrabOn Adapter](#21-grabon-adapter)
   - [2.2 CouponDuniya Adapter](#22-couponduniya-adapter)
   - [2.3 How to Add a New Source](#23-how-to-add-a-new-source)
3. [The Scrape → Score → Delete Pipeline](#3-the-scrape--score--delete-pipeline)
   - [3.1 Step 1 — Scraping](#31-step-1--scraping)
   - [3.2 Step 2 — Discount Weight and Scoring](#32-step-2--discount-weight-and-scoring)
   - [3.3 Step 3 — Below-Average Deletion](#33-step-3--below-average-deletion)
   - [3.4 Cron Schedule](#34-cron-schedule)
4. [Fleet Engine — User Feedback Loop](#4-fleet-engine--user-feedback-loop)
   - [4.1 What It Is](#41-what-it-is)
   - [4.2 Backend: Collections and Routes](#42-backend-collections-and-routes)
   - [4.3 Frontend: Recording Interactions](#43-frontend-recording-interactions)
   - [4.4 Frontend: The Feedback Popup](#44-frontend-the-feedback-popup-home-screen)
   - [4.5 Deduplication Rules](#45-deduplication-rules)
   - [4.6 Stat Accounting](#46-stat-accounting-avoid-double-counting)
5. [Key Files Reference](#5-key-files-reference)

---

## 1. High-Level Architecture

```
     ┌─────────────────────────────────────────────┐
     │              Node.js Backend                 │
     │                                              │
     │  GrabOnAdapter ──┐                           │
     │                  ├──► ScraperEngine ────────► MongoDB: rawscrapedcoupons
     │  CouponDuniya ───┘    (upsert dedup)         │
     │                                              │
     │  scoreCoupons.js ──────────────────────────► │ writes couponScore fields
     │  filterBelowAverageCoupons.js ─────────────► │ deletes low-quality docs
     │                                              │
     │  /api/fleet routes ────────────────────────► │ MongoDB: couponinteractions
     └─────────────────────────────────────────────┘
                     ^         |
                     |         v
              Android App (Kotlin / Compose)

  CouponDetailsScreen  ──►  recordInteraction("copy" | "discover" | "redeem")
  HomeScreen           ──►  MultiFleetFeedbackPopup  (on every app open)
```

---

## 2. Scrapers

Both adapters extend `GenericAdapter` which provides `fetchHtml()` (axios GET) and `saveToDatabase()` (MongoDB upsert). Results land in the `rawscrapedcoupons` collection.

### 2.1 GrabOn Adapter

**File:** `Backend/src/scraper/sources/GrabOnAdapter.js`
**Base URL:** `https://www.grabon.in`
**Tech:** Cheerio (HTML parse) + optional Puppeteer (deep-scrape mode)

#### Step-by-step

| Step | What happens |
|---|---|
| 1. Brand list | Hardcoded array: `{ brand, path, category }`. Inactive brands are commented out — uncomment to re-enable. |
| 2. Browser init | If `enableDeepScraping = true`, Puppeteer starts via `browserManager`. On failure → falls back to Cheerio-only mode. |
| 3. Listing parse | For each brand, `fetchHtml(path)` → Cheerio loads HTML → iterates `div.gc-box` cards. |
| 4. Coupon code | Read from `data-code`, `data-inner-text`, or `span[data-type="cpn-code-text"]` — **no JS click needed**. Sanitised: length 3–20, known labels discarded. |
| 5. Verified flag | `data-cpn-verified="True"` attribute on the card div. |
| 6. Uses today | `span[data-type="views"][data-uses="N"]` attribute. |
| 7. Expiry date | `span[aria-label="Expiry"]` → parsed to `Date`. Falls back to +1 month if missing. |
| 8. Terms / min order | `ul li` / `p` inside `.cpn-det-v2`. Min order detected via regex `minimum.*₹(\d+)`. |
| 9. Trust score | Store-level star rating on the page, normalised to 0–100. |
| 10. Coupon link | `grabon.in/coupon-codes/<data-cid>/` (specific) OR brand homepage fallback. |
| 11. Deep-scrape | If `data-cid` available, Puppeteer visits detail page for richer terms. Max `maxDetailPagesPerBrand = 10`. |
| 12. Upsert | `GenericAdapter.saveToDatabase()` → `findOneAndUpdate(upsert:true)` keyed on `(sourceAdapter, brandName, couponTitle)`. |

**Currently active brands:** Zomato, Swiggy (rest commented out).

---

### 2.2 CouponDuniya Adapter

**File:** `Backend/src/scraper/sources/CouponDuniyaAdapter.js`
**Base URL:** `https://www.coupondunia.in`
**Tech:** Cheerio only (site renders server-side HTML — no Puppeteer needed)

#### Step-by-step

| Step | What happens |
|---|---|
| 1. Brand list | Same `{ brand, category }` pattern. URL slug auto-generated via `brandToSlug()`: `"Rebel foods"` → `/rebel-foods`. |
| 2. 2-second delay | Added between brands to avoid rate-limiting. |
| 3. Page-level terms | `.desc-txt.more-desc span`, `.more-desc-text` — extracted once per page, shared across all coupons. Junk filtered (< 20 chars, nav items, "COPY CODE"). |
| 4. Card parse | Selectors: `.offer-list-item`, `.coupon-tile`, `.cd-offer-card`, `[class*="offer-card"]`. |
| 5. Coupon code (3-source priority) | 1. `data-offer-key="couponCode"` data attribute. 2. `.p1-code` visible text. 3. `.coupon-code`, `.code`, `.promo-code`. Same sanitisation as GrabOn. |
| 6. Title | `.store-title-block .long-title`, `.short-title`, `.coupon-title`, `h3/h4`. |
| 7. Discount | `.discount`, `.badge`, `[class*="discount"]`. |
| 8. Used-by | `.used-tag`, `.used-count`. |
| 9. Upsert | Same `GenericAdapter.saveToDatabase()` as GrabOn. |

**Currently active brands:** Zomato, Swiggy, Box8, Eatsure, Freshmenu, Amazon, Flipkart, Snapdeal, PhonePe, Paytm, Cred, Dhani, Freo, Blinkit, BigBasket, Nykaa, Myntra, MakeMyTrip.

---

### 2.3 How to Add a New Source

1. Create `Backend/src/scraper/sources/NewSourceAdapter.js` extending `GenericAdapter`.
2. Implement `async scrape()` → fetch pages → parse → call `this.saveToDatabase(coupons)`.
3. Register the adapter in `Backend/src/scraper/index.js`.
4. Add its name to `PIPELINE_ADAPTERS` in `src/cron/jobs.js` to auto-include it in the 12h pipeline.

---

## 3. The Scrape → Score → Delete Pipeline

Runs **every 12 hours** (`0 */12 * * *`). Steps run sequentially — if one fails, the next does not run.

```
[1] Scrape          [2] Score             [3] Delete below-average
GrabOn +     ────►  scoreCoupons.js  ────►  filterBelowAverageCoupons.js
CouponDuniya        writes couponScore      removes low-quality docs
```

### 3.1 Step 1 — Scraping

- Sets `process.env.SCRAPER_ADAPTERS = "GrabOn,CouponDuniya"` temporarily.
- Calls `runScraper()` — instantiates each adapter, calls `scrape()`, results upserted.
- Restores original `SCRAPER_ADAPTERS` in a `finally` block (safe even if scraping throws).

### 3.2 Step 2 — Discount Weight and Scoring

**File:** `Backend/scripts/scoreCoupons.js`

Assigns a composite **quality score (0–100)** to each coupon from the latest batch and writes `couponScore`, `discountWeight`, `scoreCalculatedAt`, `scoreDetails`.

#### discountWeight formula

| Discount type | How weight is calculated |
|---|---|
| `percentage` | `min(percentage × 1.5, 100)` — e.g. 30% → 45 |
| `flat` / `cashback` | log10-scaled on ₹5000 ceiling — e.g. ₹500 → ~54 |
| `freebie` | Fixed 60 |
| `buy1get1` | Fixed 70 |
| `free_delivery` | Fixed 40 |
| `unknown` | Fixed 20 |
| null / missing | Fixed 10 |

#### Final couponScore — weighted signal mix

| Signal | Source field |
|---|---|
| Monetary value | `discountWeight` |
| Platform reliability | `liveSuccessRate` / `isVerified` |
| Recency | `recencyScore` (from `scrapedAt` / `verifiedOn`) |
| Failure rate | `failureRate` (inverse — higher = lower score) |
| Source trust | `sourceCredibilityScore` |
| Social proof | `trendVelocity` / `usedByCount` |
| Category match | `contextMatchScore` |

### 3.3 Step 3 — Below-Average Deletion

**File:** `Backend/scripts/filterBelowAverageCoupons.js`

- Only touches coupons from the **most recent scoring batch** (matched by `scoreCalculatedAt`).
- Groups by `brandName`.
- Per merchant: computes mean `couponScore` across all its coupons.
- Deletes any coupon scoring **below that merchant's mean**.

> **Why relative, not absolute?** A merchant with 10 mediocre coupons won't have all of them deleted — only the worst half. Thresholds self-calibrate per brand.
>
> **Safety:** Never touches older batches retroactively.

### 3.4 Cron Schedule

| Cron | Job |
|---|---|
| `0 2 * * *` | Standalone daily scrape (all adapters) |
| `0 4 * * *` | Delete expired system-scraper Coupons |
| `0 */12 * * *` | **Scrape → Score → Delete pipeline** |
| `16 3 * * *` | Google Sheets sync (exclusive coupons) |
| `0 0 * * 0` | Weekly Gmail sync |
| `0 0 * * *` | Mark ImportedCoupons as expired + update `expiresIn` |
| `0 */12 * * *` | Push notifications — PrivateCoupon expiry |
| `0 0 * * *` | Push notifications — ImportedCoupon expiry |

---

## 4. Fleet Engine — User Feedback Loop

### 4.1 What It Is

The Fleet Engine tracks what users actually do with exclusive (scraped) coupons — copy, discover, redeem — and then asks them on the next app open whether it worked. Their answers feed back into `totalUsage`, `totalSuccess`, and `totalFailure` on the coupon document.

**Goal:** Build a community-driven quality signal on top of scraper data so low-performing coupons surface to the bottom over time.

### 4.2 Backend: Collections and Routes

#### `couponinteractions` collection

Defined in `Backend/src/models/CouponInteraction.js`.

| Field | Type | Notes |
|---|---|---|
| `userId` | `String` | Firebase UID |
| `couponId` | `ObjectId` → `RawScrapedCoupon` | Which coupon |
| `brandName` | `String` | Denormalised — shown directly in popup |
| `couponCode` | `String?` | The code that was copied |
| `couponLink` | `String?` | Brand URL that was visited |
| `action` | `"copy" \| "discover" \| "redeem"` | What the user did |
| `outcome` | `"pending" \| "success" \| "failure" \| "skipped"` | Feedback state |
| `resolvedAt` | `Date?` | Set when feedback is given |

Compound index on `(userId, outcome, createdAt)` powers the pending-fetch query.

#### Fleet counters on `rawscrapedcoupons`

| Field | Meaning |
|---|---|
| `totalUsage` | Total feedback-resolved interactions |
| `totalSuccess` | User-confirmed it worked |
| `totalFailure` | User-confirmed it failed (or assumed failure on Redeem) |

#### API Routes — `Backend/src/routes/fleetRoutes.js` — mounted at `/api/fleet`

| Method | Path | What it does |
|---|---|---|
| `POST` | `/interactions` | Record a copy / discover / redeem action |
| `GET` | `/interactions/pending?userId=UID` | Fetch all pending interactions (max 20) |
| `PATCH` | `/interactions/:id/resolve` | Resolve with `success`, `failure`, or `skipped` |
| `POST` | `/coupons/:couponId/redeem` | Admin-use standalone stat bump |

### 4.3 Frontend: Recording Interactions

**File:** `CouponDetailsViewModel.kt`

Only fires for **exclusive coupons** (`isPrivate = false`). Private coupons are never tracked.

| User action | Call |
|---|---|
| Taps Copy Code | `recordInteraction("copy")` |
| Taps Open Link and Copy Code | `recordInteraction("copy")` + `recordInteraction("discover")` |
| Taps Discover (bottom bar) | `recordInteraction("discover")` |
| Taps Redeem (bottom bar) | `redeemRawCoupon()` → `recordInteraction("redeem")` internally |

#### Session-level dedup — `recordedInteractionKeys`

```kotlin
private val recordedInteractionKeys = mutableSetOf<String>()

fun recordInteraction(action: String) {
    val sessionKey = "$couponId:$action"
    if (!recordedInteractionKeys.add(sessionKey)) return  // already recorded
    // ... fire API call
}
```

- `MutableSet.add()` returns `false` if key already present → call is dropped.
- Spamming Copy Code 100 times = exactly **1 DB entry** per session.
- The Set lives on the ViewModel instance — navigating away and back resets it.

### 4.4 Frontend: The Feedback Popup (Home Screen)

**Component:** `MultiFleetFeedbackPopup.kt`
**Trigger:** `HomeViewModel.init {}` → `fetchPendingInteractions()` → if list non-empty, popup renders.

**What the user sees:**
- Dialog card: "How were these deals? 🏷️"
- Up to **5 rows** (one per unique coupon — deduplicated)
- Each row: brand name + coupon code + ❌ / ✅ icon buttons
- One shared **"Maybe later"** button at the bottom

**Full flow:**

```
App opens
  └──► HomeViewModel.init
         └──► fetchPendingInteractions(userId)
                └──► GET /api/fleet/interactions/pending?userId=…
                       └──► groups by couponId → takes first per group
                              └──► pendingInteractions = deduplicated list
                                     └──► MultiFleetFeedbackPopup renders

User taps ✅ on a coupon row
  └──► onResolve(couponId, "success")
         └──► HomeViewModel.resolveInteraction(couponId, "success")
                └──► finds all sibling IDs (same couponId in the deduplicated list)
                       └──► PATCH /api/fleet/interactions/:id/resolve  × N siblings
                              └──► DB: outcome = "success", resolvedAt = now
                              └──► DB: rawscrapedcoupons.$inc(totalUsage, totalSuccess)
                └──► removes coupon row from UI state

User taps "Maybe later"
  └──► HomeViewModel.skipAllInteractions()
         └──► resolves every ID in allPendingInteractionIds as "skipped"
         └──► clears pendingInteractions and allPendingInteractionIds
```

### 4.5 Deduplication Rules

Two independent dedup layers prevent noise in both directions:

| Layer | Location | Mechanism |
|---|---|---|
| **Recording dedup** | `CouponDetailsViewModel` | `recordedInteractionKeys` Set: one DB entry per `couponId:action` per ViewModel session |
| **Popup dedup** | `HomeViewModel.fetchPendingInteractions()` | Groups raw interactions by `couponId`, shows only first per group |

`HomeUiState` holds both:
- `pendingInteractions` — deduplicated list shown in popup (max 5)
- `allPendingInteractionIds` — all raw IDs, used for bulk-skip

### 4.6 Stat Accounting (Avoid Double-Counting)

Redeem presses bump stats immediately at record time. Other actions wait for user feedback.

| Scenario | `totalUsage` | `totalSuccess` | `totalFailure` |
|---|---|---|---|
| Redeem recorded | +1 | — | +1 (assume failure) |
| Redeem → user says "success" | no change | +1 | -1 (corrects assumption) |
| Redeem → user says "failure" | no change | — | no change (already counted) |
| Copy/Discover → "success" | +1 | +1 | — |
| Copy/Discover → "failure" | +1 | — | +1 |
| Any → "skipped" | no change | — | — |

> **Why Redeem is pessimistic:** The user definitely attempted to use the coupon. Assuming failure until corrected prevents inflated success rates for coupons whose users never return to give feedback.

---

## 5. Key Files Reference

### Backend

| File | Purpose |
|---|---|
| `src/scraper/sources/GrabOnAdapter.js` | GrabOn scraper — Cheerio + optional Puppeteer |
| `src/scraper/sources/CouponDuniyaAdapter.js` | CouponDuniya scraper — Cheerio only |
| `src/scraper/sources/GenericAdapter.js` | Base class: `fetchHtml()`, `saveToDatabase()` |
| `src/scraper/index.js` | Instantiates adapters, orchestrates `scrape()` |
| `scripts/scoreCoupons.js` | Scores latest batch, writes `couponScore` + `discountWeight` |
| `scripts/filterBelowAverageCoupons.js` | Deletes below-average coupons per merchant |
| `src/cron/jobs.js` | All cron schedules + the 12h Scrape→Score→Delete pipeline |
| `src/models/RawScrapedCoupon.js` | Main scraped coupon schema (includes fleet counters) |
| `src/models/CouponInteraction.js` | Fleet Engine interaction schema |
| `src/routes/fleetRoutes.js` | `/api/fleet/*` endpoints |
| `src/app.js` | Mounts all routes (`/api/fleet` added here) |

### Android (Frontend)

| File | Purpose |
|---|---|
| `data/api/FleetApiService.kt` | Retrofit interface for `/api/fleet` |
| `data/api/models/FleetModels.kt` | Request / response Kotlin data classes |
| `data/repository/FleetRepository.kt` | Repository wrapping all fleet API calls |
| `di/NetworkModule.kt` | Hilt provides `FleetApiService` |
| `ui/.../coupondetails/CouponDetailsViewModel.kt` | Records interactions; `recordedInteractionKeys` dedup |
| `ui/.../coupondetails/CouponDetailsScreen.kt` | Calls `recordInteraction()` on copy / discover / redeem |
| `ui/presentation/home/HomeUiState.kt` | Holds `pendingInteractions` + `allPendingInteractionIds` |
| `ui/presentation/home/HomeViewModel.kt` | Fetches, deduplicates, and resolves interactions |
| `ui/presentation/home/HomeScreen.kt` | Renders `MultiFleetFeedbackPopup` when interactions pending |
| `ui/presentation/home/components/MultiFleetFeedbackPopup.kt` | "How were these deals?" Dialog UI |

