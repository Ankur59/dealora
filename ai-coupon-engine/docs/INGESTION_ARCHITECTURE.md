# Partner Ingestion Architecture

> **Version:** 2.0 — Adapter Pattern  
> **Last updated:** April 2026  
> **Author:** Dealora Engineering

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Directory Structure](#2-directory-structure)
3. [Shared Utilities](#3-shared-utilities)
   - [Auth: API Key](#31-auth-api-key)
   - [Auth: OAuth2](#32-auth-oauth2)
   - [Paginators](#33-paginators)
   - [Chunked Write](#34-chunked-write)
4. [Provider Flows](#4-provider-flows)
   - [vCommission](#41-vcommission)
   - [Coupomated](#42-coupomated)
   - [Admitad](#43-admitad)
5. [Adding a New Partner](#5-adding-a-new-partner)
6. [API Reference — Sync Routes](#6-api-reference--sync-routes)
7. [Environment Variables](#7-environment-variables)

---

## 1. Architecture Overview

The ingestion system uses the **Adapter Pattern**. Every partner is a self-contained module (adapter) that implements a standard interface. A shared set of utilities handles all the repetitive infrastructure — auth, pagination, chunked DB writes. The adapter **only** contains what is unique to that partner: endpoint URLs, auth credentials, and a normalizer function.

```
HTTP Route (POST /sync/:partnerName/:targetSchema)
        │
        ▼
normalization.service.js
  └── fetchAndNormalizePartnerData(partnerName, targetSchema)
        │
        ▼
adapters/index.js  ←── adapter registry
  └── adapters[partnerName].syncXxx()
        │
        ├── getAuth()          ←── shared/auth/apiKey.js or oauth2.js
        ├── paginateXxx()      ←── shared/paginator.js
        │     └── onBatch(items)
        │           └── bulkWriteChunked()  ←── shared/chunkedWrite.js
        │                 └── normalize(raw) → Mongoose bulkWrite
        │
        ▼
MongoDB (campaign / partnercoupon collections)
```

### Key Design Decisions

| Decision | Reason |
|---|---|
| Adapters are self-contained files | Debug one partner → open one file |
| Shared utilities handle all boilerplate | No copy-pasted pagination loops |
| Normalizers stay in the adapter (or imported from helpers/) | Partner-specific conditional logic can't be expressed as config |
| `adapters/index.js` is the only file to edit on partner add | One change, no risk to other partners |
| Old providers kept with `@deprecated` notice | Preserve git history, avoid breaking anything during transition |

---

## 2. Directory Structure

```
src/
├── adapters/
│   ├── index.js                  ← Partner registry — edit this when adding a partner
│   ├── _template.adapter.js      ← Copy-paste starting point for new partners
│   ├── vcommission.adapter.js
│   ├── coupomated.adapter.js
│   └── admitad.adapter.js
│
├── shared/
│   ├── utils.js                  ← getNestedValue(obj, 'a.b.c')
│   ├── auth/
│   │   ├── apiKey.js             ← API key → query param
│   │   └── oauth2.js             ← OAuth2 client-credentials + refresh
│   ├── paginator.js              ← paginateOffset / paginateCursor / paginatePage / paginateNone
│   └── chunkedWrite.js           ← normalize → filter → bulkWrite
│
├── services/
│   ├── normalization.service.js  ← Routes sync requests to adapter registry
│   ├── vcommission/
│   │   └── helpers/ (normalizer files — still used by adapter)
│   ├── coupomated/
│   │   └── helpers/normalize.js  ← Still used by coupomated adapter
│   └── admitad/
│       └── helpers/normalize.js  ← Still used by admitad adapter
│
├── providers/                    ← @deprecated — kept for git history only
│   ├── trackier.js
│   ├── coupomated.js
│   └── admitad.js
│
└── utils/
    └── helper.js                 ← vCommission coupon normalizer (still active)
```

---

## 3. Shared Utilities

### 3.1 Auth: API Key

**File:** `src/shared/auth/apiKey.js`

Injects an API key from an environment variable into query parameters with every request.

```js
import { apiKeyAuth } from '../shared/auth/apiKey.js';

const getAuth = apiKeyAuth({
    envVar:    'COUPO_MATED_API_KEY',   // Name of env var (not the value)
    paramName: 'apikey',                // Query param the partner API expects
});

// Returns: async () => { headers: {}, params: { apikey: 'Bp9X...' } }
```

**Compatible with:** Coupomated, vCommission

---

### 3.2 Auth: OAuth2

**File:** `src/shared/auth/oauth2.js`

Manages the full OAuth2 `client_credentials` lifecycle:
- Fetches initial access token (Basic auth)
- Caches it in memory with expiry tracking
- Auto-refreshes using `refresh_token` before expiry
- Falls back to full re-auth if refresh fails

Token caches are keyed by `partnerName` — multiple partners can use OAuth2 independently.

```js
import { createOAuth2Manager } from '../shared/auth/oauth2.js';

const oauth2 = createOAuth2Manager({
    partnerName:     'admitad',                       // Cache key
    tokenUrl:        'https://api.admitad.com/token/',
    clientIdEnv:     'ADMITAD_CLIENT_ID',             // Name of env var
    clientSecretEnv: 'ADMITAD_CLIENT_SECRET',
    scopes:          'advcampaigns_for_website coupons_for_website websites',
});

// Two ways to use:
const token            = await oauth2.getToken();   // raw string
const { headers, _ }   = await oauth2.getAuth();    // { headers: { Authorization: 'Bearer ...' }, params: {} }
```

**Token lifecycle:**

```
getAuth() called
    │
    ├── Token valid (not expired)? ──→ return cached token
    │
    ├── Refresh token exists? ──→ POST /token/ with refresh_token grant
    │         │
    │         ├── Success ──→ update cache, return new token
    │         └── Failure ──→ fall through to full re-auth
    │
    └── Full re-auth ──→ POST /token/ with client_credentials grant
                  └── Cache access_token + refresh_token + expiry
```

**Compatible with:** Admitad

---

### 3.3 Paginators

**File:** `src/shared/paginator.js`

All paginators share the same contract:

```js
paginateXxx({
    endpoint,      // string — full API URL
    getAuth,       // async () => { headers, params } — from auth helpers above
    params,        // object — static extra query params (merged with auth params)
    itemsPath,     // dot-path to items array in response body (e.g. 'data.campaigns', 'results')
    batchSize,     // number — records per request (default: 100)
    onBatch,       // async (items[]) => void — called once per page
    // ... pagination-specific options below
})
```

#### `paginateOffset` — Admitad

Uses `offset + limit`. Stops when `offset >= total` (total read from `totalPath`).

```js
await paginateOffset({
    endpoint:  'https://api.admitad.com/coupons/website/2932232/',
    getAuth:   oauth2.getAuth,
    itemsPath: 'results',     // response.data.results
    totalPath: 'count',       // response.data.count
    batchSize: 100,
    onBatch:   async (items) => { /* write to DB */ },
});
```

#### `paginateCursor` — vCommission Coupons

Uses a cursor token (`pageToken`) that advances with each response. Stops when cursor is empty or unchanged.

```js
await paginateCursor({
    endpoint:    'https://api.trackier.com/v2/publishers/coupons',
    getAuth,
    params:      { campaign_id: '12345' },
    itemsPath:   'coupons',
    cursorField: 'pageToken',   // sent as request param AND read from response
    batchSize:   100,
    onBatch:     async (items) => { /* write to DB */ },
});
```

#### `paginatePage` — vCommission Campaigns

Increments a numeric page parameter. Stops when the response returns an empty array.

```js
await paginatePage({
    endpoint:  'https://api.trackier.com/v2/publisher/campaigns',
    getAuth,
    itemsPath: 'data.campaigns',   // response.data.data.campaigns
    pageParam: 'page',
    batchSize: 100,
    onBatch:   async (items) => { /* write to DB */ },
});
```

#### `paginateNone` — Coupomated

Single request. If `itemsPath` is empty and `response.data` is an array, uses it directly.

```js
await paginateNone({
    endpoint: 'https://api.coupomated.com/coupons/all',
    getAuth,
    // itemsPath omitted — response.data IS the array
    onBatch:  async (items) => { /* write to DB */ },
});
```

---

### 3.4 Chunked Write

**File:** `src/shared/chunkedWrite.js`

Normalizes items, filters nulls, and issues a single `bulkWrite` to MongoDB.

```js
import { bulkWriteChunked } from '../shared/chunkedWrite.js';

await bulkWriteChunked({
    items,                    // raw items from paginator
    normalize,                // (rawItem) => normalizedDoc | null
    Model,                    // Mongoose model (Campaign or Coupon)
    getFilter,                // (normalizedDoc) => MongoDB filter for upsert
    useSetOnInsert: false,    // true = $setOnInsert (never overwrite), false = $set (always update)
});
```

**Error handling:**
- Normalizer errors per-item are caught and logged — one bad item doesn't fail the whole batch
- `DuplicateKeyError (11000)` on the unique code index is treated as non-fatal (logged as warning)
- All other errors are re-thrown

---

## 4. Provider Flows

---

### 4.1 vCommission

**Adapter:** `src/adapters/vcommission.adapter.js`  
**Auth type:** API Key (`apiKey` query param)  
**Base URL:** `https://api.trackier.com`

#### Campaign Sync Flow

```
syncCampaigns()
    │
    └── paginatePage(GET /v2/publisher/campaigns)
            params: { apiKey: V_COMMISSION_API_KEY, page: 1, limit: 100 }
            itemsPath: 'data.campaigns'
            │
            ├── Page 1 → [ ...campaigns ] → bulkWriteChunked(Campaign, $setOnInsert)
            ├── Page 2 → [ ...campaigns ] → bulkWriteChunked(Campaign, $setOnInsert)
            └── Empty page → STOP

Upsert key: { partner: 'vcommission', campaignId }
Strategy:   $setOnInsert — existing campaigns are never overwritten
```

**Campaign field mapping:**

| API field | Internal field |
|---|---|
| `id` | `campaignId` |
| `title` | `title` |
| `tracking_link` | `trackingLink` |
| `categories` | `categories` |
| `countries` | `countries` |
| `score` | `score` |
| `currency`, `model` | `meta.currency`, `meta.model` |

---

#### Coupon Sync Flow

vCommission coupons are grouped per campaign. All campaigns are fetched from DB first, then their coupons are fetched concurrently (max 5 in-flight).

```
syncCoupons()
    │
    ├── Campaign.find({ partner: 'vcommission' })  ← reads from DB
    │         → [ { campaignId, countries, categories }, ... ]
    │
    └── pLimit(5) — max 5 campaigns at once
            │
            └── For each campaign:
                  paginateCursor(GET /v2/publishers/coupons)
                      params: { campaign_id, apikey, pageToken }
                      itemsPath: 'coupons'
                      cursorField: 'pageToken'
                      │
                      ├── Page 1 → buffer → bulkWriteChunked(Coupon, $set)
                      ├── Page 2 → buffer → bulkWriteChunked(Coupon, $set)
                      └── Empty / same cursor → STOP

Upsert key: { partner: 'vcommission', couponId } OR { code } if no couponId
Strategy:   $set — updates existing coupons on re-sync
```

> ⚠️ **Important:** `syncCoupons()` requires campaigns to exist in the DB first.  
> Always call `syncCampaigns()` before `syncCoupons()` for a fresh setup.

**Coupon field mapping** (via `src/utils/helper.js`):

| API field | Internal field | Notes |
|---|---|---|
| `id` | `couponId` | |
| `code` | `code` | uppercased, trimmed |
| `campaign_id` | `campaignId` | |
| `campaign_name` | `brandName` | first word only |
| `description` | `description` | |
| `type` | `type` | |
| `status` | `status` | |
| `start` | `start` | parsed as Date |
| `end` | `end` | parsed as Date |
| (from campaign) | `countries` | inherited |
| (from campaign) | `categories` | inherited |

---

### 4.2 Coupomated

**Adapter:** `src/adapters/coupomated.adapter.js`  
**Auth type:** API Key (`apikey` query param)  
**Base URL:** `https://api.coupomated.com`

#### Coupon Sync Flow

Coupomated returns all coupons in a single response — no pagination.

```
syncCoupons()
    │
    └── paginateNone(GET /coupons/all)
            params: { apikey: COUPO_MATED_API_KEY }
            response.data → array directly (no itemsPath)
            │
            └── Single batch → bulkWriteChunked(Coupon, $set)

Upsert key:  { partner: 'coupomated', couponId }
Strategy:    $set — updates on every sync
Normalizer:  src/services/coupomated/helpers/normalize.js
```

**Coupon field mapping** (via `src/services/coupomated/helpers/normalize.js`):

| API field | Internal field | Notes |
|---|---|---|
| `coupon_id` | `couponId` | |
| `coupon_code` | `code` | |
| `description` | `description` | |
| `discount` | `discount` | |
| `start_date` | `start` | dd-mm-yyyy parsed |
| `end_date` | `end` | dd-mm-yyyy parsed |
| `affiliate_link` | `trackingLink` | |
| `plain_link` | `couponVisitingLink` | |
| `merchant_name` | `brandName` | |
| `verified_at` | `verifiedOn` | |
| `category_names` | `categories` | |
| `category_ids` | `categoriesId` | |

> ℹ️ Coupomated uses `dd-mm-yyyy` date format. The normalizer handles this conversion.

#### Category Sync Flow

```
syncCategories()
    │
    └── paginateNone(GET /categories/coupon)
            │
            └── For each category:
                  Category.findOneAndUpdate({ apiId, partner: 'coupomated' }, $set, { upsert: true })
```

---

### 4.3 Admitad

**Adapter:** `src/adapters/admitad.adapter.js`  
**Auth type:** OAuth2 Client-Credentials  
**Base URL:** `https://api.admitad.com`  
**Website ID:** `ADMITAD_WEBSITE_ID` env var (restricts results to our publisher account)

#### OAuth2 Token Flow

```
Any API call
    │
    └── oauth2.getAuth()
              │
              ├── Token in cache + not expired → return Bearer header
              │
              ├── Refresh token exists →
              │       POST /token/ { grant_type: refresh_token, ... }
              │       ├── Success → update cache → return Bearer header
              │       └── Failure → fall through
              │
              └── Full auth →
                      POST /token/ {
                          grant_type: client_credentials,
                          client_id:  ADMITAD_CLIENT_ID,
                          scope:      'advcampaigns_for_website coupons_for_website websites'
                      }
                      Authorization: Basic base64(CLIENT_ID:CLIENT_SECRET)
                      → store { access_token, refresh_token, expires_in }
```

#### Campaign Sync Flow

```
syncCampaigns()
    │
    └── paginateOffset(GET /advcampaigns/website/{ADMITAD_WEBSITE_ID}/)
            Authorization: Bearer <token>
            params: { has_tool: 'coupons', limit: 100, offset: 0 }
            itemsPath: 'results'
            totalPath: 'count'
            │
            ├── offset=0   → [ ...100 campaigns ] → bulkWriteChunked(Campaign, $setOnInsert)
            ├── offset=100 → [ ...100 campaigns ] → bulkWriteChunked(Campaign, $setOnInsert)
            └── offset >= count → STOP

Upsert key: { partner: 'admitad', campaignId }
Strategy:   $setOnInsert — existing campaigns are never overwritten
```

**Campaign field mapping:**

| API field | Internal field |
|---|---|
| `id` | `campaignId` |
| `name` | `title` |
| `site_url` | `trackingLink` |
| `categories[].name` | `categories` |
| `status` | `meta.status` |
| `image` | `meta.image` |

---

#### Coupon Sync Flow

```
syncCoupons()
    │
    └── paginateOffset(GET /coupons/website/{ADMITAD_WEBSITE_ID}/)
            Authorization: Bearer <token>
            params: { limit: 100, offset: 0 }
            itemsPath: 'results'
            totalPath: 'count'
            │
            ├── offset=0   → [ ...100 coupons ] → bulkWriteChunked(Coupon, $set)
            ├── offset=100 → [ ...100 coupons ] → bulkWriteChunked(Coupon, $set)
            └── offset >= count → STOP

Upsert key:  { partner: 'admitad', couponId }
Strategy:    $set — updates on every sync
Normalizer:  src/services/admitad/helpers/normalize.js
```

**Coupon field mapping** (via `src/services/admitad/helpers/normalize.js`):

| API field | Internal field | Notes |
|---|---|---|
| `id` | `couponId` | |
| `species === 'promocode' → promocode` | `code` | only when species is 'promocode' |
| `species === 'action'` | `code: null` | deal/offer — no code |
| `description` | `description` | |
| `discount` | `discount` | |
| `date_start` | `start` | ISO date |
| `date_end` | `end` | ISO date |
| `goto_link` | `trackingLink` + `couponVisitingLink` | |
| `campaign.name` | `brandName` | |
| `campaign.id` | `campaignId` | |
| `categories[].name` | `categories` | |
| `categories[].id` | `categoriesId` | |
| `regions[].region` | `countries` | |

> ℹ️ Admitad `species` field determines coupon type:
> - `"promocode"` → has a `promocode` field → stored as `code`
> - `"action"` → deal/cashback, no code → `code: null`

---

## 5. Adding a New Partner

### Step-by-step

**Step 1 — Copy the template**
```bash
cp src/adapters/_template.adapter.js src/adapters/[partnerName].adapter.js
```

**Step 2 — Choose auth** (in your new adapter file)

For API key:
```js
const getAuth = apiKeyAuth({ envVar: 'YOUR_PARTNER_API_KEY', paramName: 'apikey' });
```

For OAuth2:
```js
const oauth2 = createOAuth2Manager({
    partnerName:     '[partnerName]',
    tokenUrl:        'https://api.partner.com/oauth/token',
    clientIdEnv:     'PARTNER_CLIENT_ID',
    clientSecretEnv: 'PARTNER_CLIENT_SECRET',
    scopes:          'read:coupons',
});
const getAuth = oauth2.getAuth;
```

**Step 3 — Choose paginator** (based on how the API pages)

| API paginates by | Use |
|---|---|
| `offset` + `limit` + total count | `paginateOffset` |
| Cursor / next-page token | `paginateCursor` |
| Page number (`page=1,2,3`) | `paginatePage` |
| Returns everything at once | `paginateNone` |

**Step 4 — Write your normalizer**

```js
const normalizeCoupon = (raw) => ({
    partner:      '[partnerName]',
    couponId:     String(raw.id),
    code:         raw.coupon_code ?? null,
    brandName:    raw.merchant_name,
    trackingLink: raw.affiliate_url ?? null,
    // ... all coupon schema fields
});
```

**Step 5 — Register in `src/adapters/index.js`**

```js
import myNewPartner from './myNewPartner.adapter.js';  // add this line

export const adapters = {
    vcommission,
    coupomated,
    admitad,
    myNewPartner,   // add this line
};
```

**Step 6 — Add env vars to `.env`**

```
NEW_PARTNER_API_KEY=your_key_here
```

**Done.** The sync route `POST /api/v1/partners/sync/myNewPartner/coupons` immediately works.

---

## 6. API Reference — Sync Routes

All sync operations are triggered via the partner route:

```
POST /api/v1/partners/sync/:partnerName/:targetSchema
```

| `partnerName` | `targetSchema` | Description |
|---|---|---|
| `vcommission` | `campaigns` | Sync all vCommission campaigns |
| `vcommission` | `coupons` | Sync coupons for all stored vCommission campaigns |
| `vcommission` | `categories` | Sync vCommission categories |
| `coupomated` | `coupons` | Sync all Coupomated coupons |
| `coupomated` | `categories` | Sync Coupomated categories |
| `admitad` | `campaigns` | Sync Admitad campaigns (website-scoped) |
| `admitad` | `coupons` | Sync Admitad coupons (website-scoped) |

> ℹ️ `targetSchema` accepts both singular (`coupon`) and plural (`coupons`).

**Success response:**
```json
{ "status": 200 }
```

**Error response:**
```json
{ "success": false, "message": "..." }
```

---

## 7. Environment Variables

| Variable | Partner | Description |
|---|---|---|
| `V_COMMISSION_API_KEY` | vCommission | API key for Trackier/vCommission |
| `COUPO_MATED_API_KEY` | Coupomated | API key for Coupomated |
| `ADMITAD_CLIENT_ID` | Admitad | OAuth2 client ID |
| `ADMITAD_CLIENT_SECRET` | Admitad | OAuth2 client secret |
| `ADMITAD_WEBSITE_ID` | Admitad | Publisher website ID (`2932232`) |
| `MONGODB_URI` | All | MongoDB connection string |
| `PORT` | All | Server port (default: 8000) |
