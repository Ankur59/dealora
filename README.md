# Dealora — Developer Documentation

> **Project Structure:** Android frontend (Kotlin/Jetpack Compose) + Node.js/Express backend + MongoDB.  
> This document covers every major feature built or integrated during this engagement, including file paths, API routes, DB schemas, and operational details.

---

## Table of Contents

1. [Project Architecture Overview](#1-project-architecture-overview)
2. [OCR Coupon Extraction](#2-ocr-coupon-extraction)
3. [Email Parsing (Gmail Sync)](#3-email-parsing-gmail-sync)
4. [ImportedCoupons — Central Coupon Store](#4-importedcoupons--central-coupon-store)
5. [Dashboard — Total Coupons & Savings Card](#5-dashboard--total-coupons--savings-card)
6. [Category Section](#6-category-section)
7. [Discover Feature (Deep Link / Web Redirect)](#7-discover-feature-deep-link--web-redirect)
8. [Explore Coupons Section](#8-explore-coupons-section)
9. [Cron Jobs — Schedule & Resource Impact](#9-cron-jobs--schedule--resource-impact)
10. [Authentication](#10-authentication)
11. [Environment Variables](#11-environment-variables)

---

## 1. Project Architecture Overview

```
dealora/
├── Backend/                  → Node.js / Express API server
│   └── src/
│       ├── app.js            → Express app, route mounting, middleware
│       ├── server.js         → HTTP server entry point
│       ├── controllers/      → Business logic per feature
│       ├── routes/           → Express routers
│       ├── models/           → Mongoose schemas
│       ├── services/         → AI extraction, Gmail sync, notifications
│       ├── cron/jobs.js      → All scheduled background jobs
│       ├── middlewares/      → Auth, validation, error handling
│       └── utils/            → Helpers, logger, response formatter
└── frontend/                 → Android app (Kotlin / Jetpack Compose)
    └── app/src/main/
        ├── java/             → Kotlin source (ViewModels, Screens, Network)
        └── res/              → Resources
```

### Route Prefix Map (`Backend/src/app.js`)

| Prefix | Router File | Purpose |
|---|---|---|
| `/api/auth` | `authRoutes.js` | User registration & login |
| `/api/coupons` | `couponRoutes.js` | Scraper / manual coupons (Coupon model) |
| `/api/private-coupons` | `privateCouponRoutes.js` | Dashboard sync — reads **ImportedCoupons** |
| `/api/features` | `featureRoutes.js` | OCR & email parsing endpoints |
| `/api/exclusive-coupons` | `exclusiveCouponRoutes.js` | Google Sheet synced coupons |
| `/api/notifications` | `notificationRoutes.js` | FCM push notifications |
| `/api/connect-email` | `connectEmailRoutes.js` | Gmail OAuth link/unlink |
| `/api/terms` | `termsRoutes.js` | Terms acceptance |

---

## 2. OCR Coupon Extraction

Users can take a screenshot of any coupon and the app sends the image to the backend, which uses Gemini Vision AI to extract coupon details and saves them to `ImportedCoupons`.

### Files Involved

| Layer | File |
|---|---|
| Route | `Backend/src/routes/featureRoutes.js` |
| Controller | `Backend/src/controllers/featureController.js` — `processScreenshot()` |
| AI Service | `Backend/src/services/aiExtractionService.js` — `extractFromOCR()` |
| Gemini Engine | `Backend/src/services/geminiExtractionService.js` |
| DB Model | `Backend/src/models/ImportedCoupons.js` |

### API Endpoint

```
POST /api/features/ocr
Content-Type: application/json

Body:
{
  "image": "<base64 encoded image string>",
  "userId": "<Firebase UID of the user>"
}
```

### Processing Flow

1. **Receive** base64 image + Firebase UID from the Android app.
2. **Lookup** the MongoDB `_id` for the given Firebase UID (`User.findOne({ uid: userId })`).
3. **Send** the image to Gemini Vision AI with a structured extraction prompt.
4. **Validate** the `confidence_score` returned by Gemini — if `< 0.70`, the coupon is rejected as invalid and a `400` is returned.
5. **Duplicate check** — if a coupon with the same `couponCode` + `brandName` already exists, a `409 Conflict` is returned.
6. **Save** the extracted data as a new `ImportedCoupon` document with `source: "OCR"`.

### Fields Extracted by AI (Gemini Prompt)

| AI Field | Maps to DB Field | Description |
|---|---|---|
| `merchant` | `brandName` | Brand / merchant name |
| `coupon_title` | `couponName`, `couponTitle` | Deal headline |
| `coupon_code` | `couponCode` | Promo code (uppercased) |
| `discount_type` | `discountType` | `percentage`, `flat`, `cashback`, `unknown` |
| `discount_value` | `discountValue` | Numeric amount |
| `minimum_order_value` | `minimumOrder` | Min cart value |
| `expiry_date` | `expireBy` | YYYY-MM-DD → Date (defaults to +30 days if null) |
| `description` | `description` | Generated description |
| `terms` | `terms` | Terms & conditions |
| `categoryLabel` | `categoryLabel` | One of the predefined categories |
| `couponVisitingLink` | `couponVisitingLink` | Redirect URL |
| `useCouponVia` | `useCouponVia` | `Coupon Code`, `Coupon Visiting Link`, `Both`, `None` |
| `user_type` | `userType` | `new`, `existing`, `both` |
| `websitelink` | `websiteLink` | Brand homepage URL |
| `confidence_score` | *(not stored)* | Threshold filter — must be ≥ 0.70 |

**Additional fields set automatically:**

| Field | Value |
|---|---|
| `source` | `"OCR"` |
| `addedMethod` | `"manual"` |
| `status` | `"active"` |
| `userId` | MongoDB ObjectId resolved from Firebase UID |
| `expiresIn` | Computed by pre-save hook (days until expiry) |

### Other OCR Endpoint

```
GET /api/features/ocr       → getOcrHistory() — returns last 50 OCR coupons (legacy, reads Coupon model)
GET /api/features/status    → AI service health check (Gemini model availability)
```

---

## 3. Email Parsing (Gmail Sync)

Users connect their Gmail account via OAuth2. The app then syncs promotional emails, sends each through Gemini AI, and saves extracted coupons to `ImportedCoupons`.

### Files Involved

| Layer | File |
|---|---|
| Routes (connect) | `Backend/src/routes/connectEmailRoutes.js` |
| Controller (connect) | `Backend/src/controllers/connectEmailController.js` |
| Route (parsing) | `Backend/src/routes/featureRoutes.js` |
| Controller (parsing) | `Backend/src/controllers/featureController.js` — `syncGmail()` |
| AI Service | `Backend/src/services/aiExtractionService.js` — `extractFromEmail()` |
| Cron Sync Service | `Backend/src/services/gmailSyncService.js` — `runDailySync()` |
| DB Model | `Backend/src/models/ImportedCoupons.js` |

### Gmail Connection Endpoints

```
POST /api/connect-email/link-gmail      → Link a Gmail account (stores OAuth refresh token)
GET  /api/connect-email/linked-emails   → List all linked email accounts for user
POST /api/connect-email/remove-email    → Unlink a Gmail account
```

### Manual Sync Endpoint (Triggered from App)

```
POST /api/features/gmail-sync
Content-Type: application/json

Body:
{
  "userId":        "<Firebase UID>",
  "selectedEmail": "<linked gmail address>",   // optional — if provided, re-uses stored refresh token
  "accessToken":   "<OAuth2 access token>"    // used if selectedEmail is not provided
}
```

### Processing Flow

1. Look up the user by Firebase UID.
2. If `selectedEmail` is provided, **exchange the stored refresh token** for a fresh access token via `https://oauth2.googleapis.com/token`.
3. **Fetch up to 20 promotional emails** from Gmail API (category: promotions, last 15 days).
4. Apply a **keyword heuristic filter** — skip emails with no coupon keywords (`discount|off|code|coupon|deal`).
5. For each remaining email:
   - Extract `From`, `Subject`, `Body` from Gmail API.
   - Send `Subject + Body` to Gemini AI for extraction.
   - Each email has a **120-second AI timeout** (hard limit).
   - If `confidence_score < 0.70` → skip as non-coupon.
   - Duplicate check by `couponCode + brandName` → skip if exists.
   - Save to `ImportedCoupons` with `source: "email-parsing"`.
6. Return summary: `{ totalFound, processedCount, extractedCount, skippedCount, errorCount, coupons[] }`.

**Server-level timeouts:** Request and response timeouts are set to **300 seconds** (`app.js` line 98–99) to accommodate sequential AI processing of multiple emails.

### Fields Saved to DB from Email Parsing

| AI Field | DB Field | Notes |
|---|---|---|
| `merchant` | `brandName` | Sender brand name |
| `coupon_title` | `couponName`, `couponTitle` | Offer headline |
| `coupon_code` | `couponCode` | Uppercased; defaults to `"N/A"` if none |
| `discount_type` | `discountType` | Lowercased enum |
| `discount_value` | `discountValue` | Numeric |
| `minimum_order_value` | `minimumOrder` | Numeric |
| `expiry_date` | `expireBy` | Date (defaults to +30 days if null) |
| `description` | `description` | AI-generated description |
| `categoryLabel` | `categoryLabel` | Predefined category |
| `couponVisitingLink` | `couponVisitingLink` | Redemption link (nullable) |
| `useCouponVia` | `useCouponVia` | Redemption method |
| `user_type` | `userType` | Target user type |
| `websitelink` | `websiteLink` | Brand homepage |

**Automatically set fields:**

| Field | Value |
|---|---|
| `source` | `"email-parsing"` |
| `fetchedEmail` | The Gmail address that was synced |
| `addedMethod` | `"manual"` (user-triggered) or `"system-cron"` (cron-triggered) |
| `status` | `"active"` |
| `userId` | MongoDB ObjectId resolved from Firebase UID |
| `expiresIn` | Computed by pre-save hook |

### Cron-Based Automatic Sync

Every **Sunday at midnight** (`0 0 * * 0`), `gmailSyncService.runDailySync()` runs automatically for **all users** with linked Gmail accounts. It:
- Fetches the last **7 days** of promotional emails (vs 15 days for manual sync).
- Removes any linked email entries whose refresh tokens have expired.
- Uses `addedMethod: "manual"` (can be changed to `"system-cron"` for tracking if needed).

---

## 4. ImportedCoupons — Central Coupon Store

`ImportedCoupons` is the **unified model** where all user-specific coupons land — whether extracted via OCR, email parsing, or any other import method.

### File
`Backend/src/models/ImportedCoupons.js`  
MongoDB collection: `importedcoupons`

### Full Schema Reference

| Field | Type | Required | Description |
|---|---|---|---|
| `userId` | ObjectId (ref: User) | ✅ | Owner of this coupon |
| `couponName` | String | ✅ | Internal coupon name (min 3, max 100 chars) |
| `brandName` | String | — | Brand name; defaults to `'General'`; indexed |
| `couponTitle` | String | — | Display title shown in UI (max 200 chars) |
| `description` | String | ✅ | Coupon description (min 10, max 1000 chars) |
| `expireBy` | Date | ✅ | Expiry date |
| `categoryLabel` | String (enum) | ✅ | One of: `Food`, `Fashion`, `Grocery`, `Wallet Rewards`, `Beauty`, `Travel`, `Entertainment`, `Other`, `Electronics`, `Health`, `Home`, `Education` |
| `websiteLink` | String | — | Brand homepage URL (used for Discover feature) |
| `fetchedEmail` | String | — | Gmail address the coupon was fetched from (email-parsing only) |
| `useCouponVia` | String (enum) | ✅ | `Coupon Code`, `Coupon Visiting Link`, `Both`, `None` |
| `discountType` | String (enum) | — | `percentage`, `flat`, `cashback`, `freebie`, `buy1get1`, `free_delivery`, `wallet_upi`, `prepaid_only`, `unknown` |
| `discountValue` | Mixed | — | Numeric discount amount |
| `minimumOrder` | Number | — | Minimum order value (default: 0) |
| `couponCode` | String | Conditional | Required when `useCouponVia` is `Coupon Code` or `Both`; auto-uppercased |
| `couponVisitingLink` | String | Conditional | Required when `useCouponVia` is `Coupon Visiting Link` or `Both`; validated as URL |
| `couponDetails` | String | — | Extended coupon details (max 2000 chars) |
| `source` | String (enum) | ✅ | `email-parsing`, `OCR`, `manual` |
| `terms` | String | — | Terms & conditions (max 2000 chars) |
| `status` | String (enum) | — | `active`, `redeemed`, `expired`; default `active` |
| `addedMethod` | String (enum) | ✅ | `system-cron`, `manual`; default `manual` |
| `userType` | String (enum) | — | `new`, `existing`, `both`; default `both` |
| `redeemedAt` | Date | — | Timestamp when redeemed |
| `expiresIn` | Number | — | Days remaining until expiry (updated by pre-save hook & daily cron) |
| `redeemed` | Boolean | — | Whether coupon has been redeemed; default `false` |
| `createdAt` | Date | Auto | Mongoose timestamp |
| `updatedAt` | Date | Auto | Mongoose timestamp |

### Pre-Save Hook Logic

Runs automatically on every `.save()`:
1. **Auto-uppercase** `couponCode`.
2. If `expireBy` is in the past and `status` is `active` → set `status = 'expired'`.
3. Compute `expiresIn = ceil((expireBy - today) / 86400000)` in days.

### Indexes

| Index | Fields | Type |
|---|---|---|
| Compound | `userId`, `status` | Standard |
| Compound | `brandName`, `status` | Standard |
| Compound | `expireBy`, `status` | Standard |
| Compound | `brandName`, `couponCode` | Sparse |
| Compound | `categoryLabel`, `status` | Standard |
| Unique | `userId`, `couponCode`, `brandName` | Unique + Sparse (deduplication) |

---

## 5. Dashboard — Total Coupons & Savings Card

The home screen displays a card showing the **total number of active coupons** and **total potential savings** for the logged-in user. This combines data from both `PrivateCoupon` (pre-seeded exclusive coupons) and `ImportedCoupons`.

### API Endpoint

```
POST /api/private-coupons/statistics
Authorization: Bearer <Firebase ID Token>
Content-Type: application/json

Body (optional):
{
  "brands": ["Swiggy", "Zomato"]   // filter by specific brands; omit for all
}
```

### File
`Backend/src/controllers/privateCouponController.js` — `getStatistics()`

### Logic Breakdown

**Active coupon count** is computed as:
1. Count `PrivateCoupon` documents where `redeemable: true` (optionally filtered by `brands`).
2. Count `ImportedCoupons` documents where `userId = req.user._id` AND `status = "active"`.
3. **Sum both** → `activeCouponsCount`.

**Total savings** is computed as:
1. **From `PrivateCoupon`:** Parse `couponTitle` with regex to find `X%` and `₹Y` patterns → calculate `(X/100) * Y` per coupon as the estimated saving.
2. **From `ImportedCoupons`:**
   - If `discountType === "flat"` → add `discountValue` directly.
   - If `discountType === "percentage"` and `minimumOrder > 0` → add `(discountValue / 100) * minimumOrder`.
3. **Combine both totals** → `totalSavings`.

### Dashboard Sync (Coupon List)

```
POST /api/private-coupons/sync
Authorization: Bearer <Firebase ID Token>
Content-Type: application/json

Body:
{
  "brands": [],          // optional brand filter
  "category": "",        // optional category filter
  "sortBy": "newest_first",
  "page": 1,
  "limit": 20
}
```

This endpoint fetches from **`ImportedCoupons`** (not `PrivateCoupon`) filtered by the authenticated user's MongoDB `_id`. It also dynamically computes `daysUntilExpiry` and maps `websiteLink → couponLink` for the Discover feature.

---

## 6. Category Section

When a user taps a category (e.g., Food, Fashion, Travel) in the app, the category filter is applied to the **sync route**, which reads from `ImportedCoupons`. This means imported coupons (from OCR and email parsing) are visible in the category view alongside any other data.

### How It Works

- The app sends `category: "<CategoryName>"` in the `POST /api/private-coupons/sync` request body.
- The backend builds a MongoDB query: `{ userId: req.user._id, categoryLabel: category }` on the `ImportedCoupons` collection.
- The result is paginated and returned with expiry info.

### Available Category Values (ImportedCoupons)

`Food`, `Fashion`, `Grocery`, `Wallet Rewards`, `Beauty`, `Travel`, `Entertainment`, `Other`, `Electronics`, `Health`, `Home`, `Education`

### Filter Options Endpoint

```
GET /api/private-coupons/filter-options
Authorization: Bearer <Firebase ID Token>
```

Returns distinct `categoryLabel` and `brandName` values from `ImportedCoupons` for the authenticated user.

```
GET /api/private-coupons/categories
```

Returns distinct `categoryLabel` values from `ImportedCoupons`.

---

## 7. Discover Feature (Deep Link / Web Redirect)

When a coupon is parsed (via OCR or email), the brand's homepage URL (`websiteLink`) is stored in `ImportedCoupons`. The Android frontend uses this to implement a "Discover" action on the coupon card.

### How It Works

1. **Backend:** `websiteLink` is extracted by Gemini AI (field: `websitelink` in prompt) and stored in `ImportedCoupons.websiteLink`.
2. **Sync response:** The `syncCoupons()` endpoint maps `websiteLink → couponLink` in the response payload so the frontend receives it as `couponLink`.
3. **Frontend (Android):** On "Discover" tap, the app:
   - First attempts to build a **deep link** URI for the associated app (e.g., `swiggy://`, `zomato://`) using the domain parsed from `couponLink`.
   - If the app is installed and the deep link resolves → opens the app directly.
   - If the app is not installed or the deep link fails → falls back to opening `couponLink` in the system browser via `Intent.ACTION_VIEW`.

### Relevant Backend Fields

| Field | Source |
|---|---|
| `websiteLink` | Gemini AI extraction (`websitelink`) |
| `couponVisitingLink` | Direct redemption link (if available) |

---

## 8. Explore Coupons Section

The home screen has an "Explore Coupons" section showing the **top 5 coupons expiring soonest**. A "View All" button leads to a full paginated list sorted by expiry.

### API Used

```
POST /api/private-coupons/sync
Authorization: Bearer <Firebase ID Token>
Content-Type: application/json

// For the top-5 expiring soon preview on home screen:
{
  "sortBy": "expiring_soon",
  "limit": 5,
  "page": 1
}

// For the "View All" screen (full list sorted by expiry):
{
  "sortBy": "expiring_soon",
  "limit": 20,
  "page": 1   // incremented for pagination
}
```

### Backend Sorting Logic

When `sortBy === "expiring_soon"`, the query runs:
```js
ImportedCoupons.find({ userId: req.user._id })
  .sort({ expireBy: 1 })   // ascending = soonest first
  .limit(limit)
  .skip(skip)
```

Each coupon in the response includes a dynamically computed `daysUntilExpiry` field (calculated at query time from current date vs `expireBy`).

### Response Shape

```json
{
  "count": 5,
  "total": 42,
  "page": 1,
  "pages": 9,
  "coupons": [
    {
      "_id": "...",
      "couponName": "...",
      "couponTitle": "...",
      "brandName": "...",
      "expireBy": "2026-04-02T00:00:00.000Z",
      "daysUntilExpiry": 3,
      "categoryLabel": "Food",
      "couponCode": "SAVE20",
      "couponLink": "https://swiggy.com",
      "websiteLink": "https://swiggy.com",
      "discountType": "percentage",
      "discountValue": 20,
      ...
    }
  ]
}
```

---

## 9. Cron Jobs — Schedule & Resource Impact

All cron jobs are initialized in `Backend/src/cron/jobs.js` and started when the server boots via `server.js`.

### Job Schedule Table

| # | Name | Cron Expression | Time (UTC) | Frequency | Resource Impact |
|---|---|---|---|---|---|
| 1 | **Daily Coupon Scraping** | `0 2 * * *` | 2:00 AM daily | Daily | 🔴 **High** — runs the web scraper, multiple HTTP requests to deal sites, Gemini AI calls |
| 2 | **Cleanup Expired Scraper Coupons** | `0 4 * * *` | 4:00 AM daily | Daily | 🟡 **Medium** — `deleteMany` on `Coupon` collection for `userId: system_scraper` |
| 3 | **PrivateCoupon Expiry Notifications** | `0 */12 * * *` | Every 12 hours | Twice daily | 🟡 **Medium** — queries `PrivateCoupon`, fetches all FCM tokens, sends multicast push, writes to `Notification` |
| 3.5 | **ImportedCoupon Expiry Notifications** | `0 0 * * *` | Midnight daily | Daily | 🟡 **Medium** — per-user loop, queries `ImportedCoupons` for each user, individual FCM push per coupon |
| 4 | **Google Sheet Sync** | `16 3 * * *` | 3:16 AM daily | Daily | 🟢 **Low** — fetches one CSV from Google Sheets, upserts `ExclusiveCoupon` documents |
| 5 | **Weekly Gmail Auto-Sync** | `0 0 * * 0` | Midnight Sunday | Weekly | 🔴 **High** — iterates all users with linked emails, fetches Gmail API for each, Gemini AI per email |
| 6 | **Mark ImportedCoupons as Expired** | `0 0 * * *` | Midnight daily | Daily | 🟢 **Low** — `updateMany` on `ImportedCoupons` where `expireBy < today` → `status: expired` |
| 8 | **Update `expiresIn` for ImportedCoupons** | `0 0 * * *` | Midnight daily | Daily | 🟡 **Medium** — fetches all `ImportedCoupons` with expiry dates, bulk writes `expiresIn` |

> **Note:** Jobs 3.5, 6, and 8 all run at midnight (`0 0 * * *`). They share the same cron slot but execute independently with their own error handling. Node-cron fires them concurrently.

### Detailed Job Descriptions

#### Job 1 — Daily Coupon Scraping (`0 2 * * *`)
- Calls `runScraper()` which scrapes deal aggregator websites.
- Saves results to the `Coupon` collection (not `ImportedCoupons`).
- **High resource usage:** multiple outbound HTTP connections + AI calls.

#### Job 2 — Cleanup Expired Coupons (`0 4 * * *`)
- Deletes all documents from `Coupon` where `expireBy < today` AND `userId = 'system_scraper'`.
- Runs 2 hours after scraping to avoid deleting freshly scraped coupons.

#### Job 3 — PrivateCoupon Expiry Notifications (`0 */12 * * *`)
- Checks `PrivateCoupon` for any coupon expiring within the next 24 hours.
- Sends a **multicast** FCM notification to **all users** (global broadcast).
- Saves one `Notification` document per coupon with an array of all `userIds`.

#### Job 3.5 — ImportedCoupon Expiry Notifications (`0 0 * * *`)
- Runs at midnight daily.
- Loops through each user with an FCM token.
- For each user, finds their `ImportedCoupons` expiring within 24 hours.
- Sends per-user **individual** push notifications (one per coupon per user).

#### Job 4 — Google Sheet Sync (`16 3 * * *`)
- Reads the Google Sheet URL from `SheetConfig` collection.
- Exports the sheet as CSV, parses it, and upserts each row into `ExclusiveCoupon`.
- Uses `brandName + couponName` as the composite upsert key.

#### Job 5 — Weekly Gmail Auto-Sync (`0 0 * * 0`)
- Runs every Sunday at midnight.
- Calls `gmailSyncService.runDailySync()` for all users with connected Gmail accounts.
- Fetches last 7 days of promotional emails per account.
- Expired refresh tokens are auto-removed from the user's `connectedEmails` array.

#### Job 6 — Mark Expired ImportedCoupons (`0 0 * * *`)
- `updateMany({ expireBy: { $lt: today }, status: 'active' }, { $set: { status: 'expired' } })`.
- Ensures expired coupons are correctly labelled even if the pre-save hook was bypassed.

#### Job 8 — Update `expiresIn` for ImportedCoupons (`0 0 * * *`)
- Fetches all `ImportedCoupons` with a non-null `expireBy`.
- Computes `expiresIn = ceil((expireBy - today) / 86400000)` for each.
- Uses `bulkWrite` with `updateOne` operations for efficiency.

---

## 10. Authentication

All protected routes use the `authenticate` middleware (`Backend/src/middlewares/authenticate.js`).

**How it works:**
1. Reads `Authorization: Bearer <token>` from the request header.
2. Verifies the token using **Firebase Admin SDK** (`firebaseAdmin.auth().verifyIdToken(token)`).
3. Looks up the user in MongoDB via `User.findByUid(uid)`.
4. Attaches `req.user` (full Mongoose document) and `req.uid` (Firebase UID string) for downstream use.

**Protected routes:** `/api/coupons`, `/api/private-coupons`, `/api/notifications`

**Unprotected routes (public):** `/api/features` (OCR/email — use `userId` in body), `/api/exclusive-coupons`, `/api/connect-email`, `/api/auth`

**Android client:** Attaches the Firebase ID token as a Bearer token via an `OkHttpClient` interceptor on every outgoing API request.

---

## 11. Environment Variables

See `Backend/.env.example` for all required variables. Key ones for the features above:

| Variable | Used By |
|---|---|
| `MONGODB_URI` | Database connection |
| `GEMINI_API_KEY` | OCR & email AI extraction |
| `GOOGLE_CLIENT_ID` | Gmail OAuth token exchange |
| `GOOGLE_CLIENT_SECRET` | Gmail OAuth token exchange |
| `FIREBASE_SERVICE_ACCOUNT` | Firebase Admin SDK (auth verification) |
| `FCM_SERVER_KEY` | Push notifications |
| `NODE_ENV` | Controls auth strictness (`development` skips Firebase verification) |
| `CORS_ORIGIN` | Allowed origins in production |

---

*Documentation generated for the Dealora project — March 2026.*
