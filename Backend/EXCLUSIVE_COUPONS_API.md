# Exclusive Coupons - Google Sheet Sync System

## Overview
This system automatically syncs coupon data from a public Google Sheet into MongoDB every 24 hours.

## Features
✅ One-time sheet URL configuration
✅ Automatic 24-hour sync via cron job
✅ Manual sync trigger
✅ Upsert logic (updates existing, inserts new coupons)
✅ Comprehensive error handling and logging
✅ Filter and pagination support

---

## API Endpoints

### 1. Add/Update Google Sheet URL
**Endpoint:** `POST /api/exclusive-coupons/add-sheet`

**Description:** Configure the Google Sheet URL and trigger an immediate sync.

**Request Body:**
```json
{
  "sheetUrl": "https://docs.google.com/spreadsheets/d/1rm26_ul-O5w_twJGexAlKHbjVp_0EeQcVKV7E6QHUiY/edit?gid=0#gid=0"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Sheet URL added successfully and initial sync completed",
  "data": {
    "config": {
      "_id": "...",
      "sheetUrl": "...",
      "sheetId": "1rm26_ul-O5w_twJGexAlKHbjVp_0EeQcVKV7E6QHUiY",
      "syncStatus": "success",
      "lastSyncedAt": "2026-02-16T10:30:00.000Z",
      "totalCouponsSynced": 10
    },
    "syncResult": {
      "success": true,
      "message": "Sheet sync completed",
      "stats": {
        "totalRows": 10,
        "successCount": 10,
        "failCount": 0,
        "errors": []
      }
    }
  }
}
```

**Example cURL:**
```bash
curl -X POST http://localhost:3000/api/exclusive-coupons/add-sheet \
  -H "Content-Type: application/json" \
  -d '{"sheetUrl": "https://docs.google.com/spreadsheets/d/1rm26_ul-O5w_twJGexAlKHbjVp_0EeQcVKV7E6QHUiY/edit?gid=0#gid=0"}'
```

---

### 2. Get All Exclusive Coupons (Advanced Filtering)
**Endpoint:** `GET /api/exclusive-coupons`

**Description:** Retrieve exclusive coupons with comprehensive filtering, searching, and sorting options.

**Query Parameters:**
- `brands` (optional): Array or comma-separated list of brands (e.g., `?brands=Zomato,Swiggy`)
- `brand` (optional): Single brand filter (case-insensitive)
- `category` (optional): Filter by category (case-insensitive)
- `search` (optional): Search across coupon name, brand, description, code, details, terms
- `source` (optional): Filter by source (e.g., Grabon, Official)
- `stackable` (optional): Filter by stackable status (yes/no)
- `validity` (optional): Validity filter
  - `valid_today` - Currently valid coupons
  - `valid_this_week` - Valid through this week
  - `valid_this_month` - Valid through this month
  - `expiring_today` - Expiring today
  - `expiring_this_week` - Expiring within 7 days
  - `expiring_this_month` - Expiring this month
  - `expired` - Expired coupons only
  - `all` - All coupons (including expired)
- `sortBy` (optional): Sorting option
  - `newest_first` (default) - Newest coupons first
  - `oldest_first` - Oldest coupons first
  - `expiring_soon` - Expiring soonest first
  - `a_to_z` - Alphabetical by brand/name (A-Z)
  - `z_to_a` - Reverse alphabetical (Z-A)
- `limit` (optional, default: 20, max: 100): Number of results per page
- `page` (optional, default: 1): Page number

**Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Exclusive coupons retrieved successfully",
  "data": {
    "count": 5,
    "total": 10,
    "page": 1,
    "pages": 2,
    "coupons": [
      {
        "_id": "...",
        "couponName": "Jupiter Card Coupon",
        "brandName": "Zomato",
        "description": "Enjoy Up to Rs 100 Cashback",
        "expiryDate": "2026-03-16T00:00:00.000Z",
        "category": "Food",
        "couponCode": "JUPITER100",
        "couponLink": "https://www.zom",
        "details": "...",
        "terms": "...",
        "stackable": "yes",
        "source": "Grabon",
        "daysUntilExpiry": 27,
        "createdAt": "2026-02-17T00:00:00.000Z",
        "updatedAt": "2026-02-17T00:00:00.000Z"
      }
    ]
  }
}
```

**Example Usage:**
```bash
# Get all active coupons (default)
curl http://localhost:3000/api/exclusive-coupons

# Filter by multiple brands
curl "http://localhost:3000/api/exclusive-coupons?brands=Zomato,Swiggy,Amazon"

# Filter by category
curl "http://localhost:3000/api/exclusive-coupons?category=Food"

# Search for specific text
curl "http://localhost:3000/api/exclusive-coupons?search=cashback"

# Filter by source
curl "http://localhost:3000/api/exclusive-coupons?source=Grabon"

# Filter stackable coupons only
curl "http://localhost:3000/api/exclusive-coupons?stackable=yes"

# Get coupons expiring this week
curl "http://localhost:3000/api/exclusive-coupons?validity=expiring_this_week"

# Sort by expiring soon
curl "http://localhost:3000/api/exclusive-coupons?sortBy=expiring_soon"

# Complex filter: Food category, Zomato brand, expiring this month, sorted A-Z
curl "http://localhost:3000/api/exclusive-coupons?brands=Zomato&category=Food&validity=expiring_this_month&sortBy=a_to_z"

# Pagination: page 2, 10 items per page
curl "http://localhost:3000/api/exclusive-coupons?page=2&limit=10"

# Search with pagination
curl "http://localhost:3000/api/exclusive-coupons?search=discount&page=1&limit=20"
```

---

### 3. Get Unique Brands (Filter Options)
**Endpoint:** `GET /api/exclusive-coupons/filters/brands`

**Description:** Get list of all unique brands for filter dropdown/options.

**Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Brands retrieved successfully",
  "data": {
    "count": 5,
    "brands": ["Amazon", "Flipkart", "Swiggy", "Uber", "Zomato"]
  }
}
```

**Example:**
```bash
curl http://localhost:3000/api/exclusive-coupons/filters/brands
```

---

### 4. Get Unique Categories (Filter Options)
**Endpoint:** `GET /api/exclusive-coupons/filters/categories`

**Description:** Get list of all unique categories for filter dropdown/options.

**Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Categories retrieved successfully",
  "data": {
    "count": 4,
    "categories": ["Electronics", "Fashion", "Food", "Travel"]
  }
}
```

**Example:**
```bash
curl http://localhost:3000/api/exclusive-coupons/filters/categories
```

---

### 5. Get Unique Sources (Filter Options)
**Endpoint:** `GET /api/exclusive-coupons/filters/sources`

**Description:** Get list of all unique sources for filter dropdown/options.

**Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Sources retrieved successfully",
  "data": {
    "count": 3,
    "sources": ["Grabon", "Official", "Retailmenot"]
  }
}
```

**Example:**
```bash
curl http://localhost:3000/api/exclusive-coupons/filters/sources
```

---

### 6. Get Coupon Statistics
**Endpoint:** `GET /api/exclusive-coupons/stats`

**Description:** Get overview statistics of all exclusive coupons.

**Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Statistics retrieved successfully",
  "data": {
    "totalCoupons": 50,
    "activeCoupons": 42,
    "expiredCoupons": 8,
    "expiringThisWeek": 5,
    "totalBrands": 12,
    "totalCategories": 6
  }
}
```

**Example:**
```bash
curl http://localhost:3000/api/exclusive-coupons/stats
```

---

### 7. Get Coupon by Coupon Code
**Endpoint:** `GET /api/exclusive-coupons/:couponCode`

**Description:** Retrieve a specific coupon by its code.

**Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Exclusive coupon retrieved successfully",
  "data": {
    "_id": "...",
    "couponName": "Jupiter Card Coupon",
    "brandName": "Zomato",
    "couponCode": "JUPITER100",
    ...
  }
}
```

**Example cURL:**
```bash
curl http://localhost:3000/api/exclusive-coupons/JUPITER100
```

---

### 4. Trigger Manual Sync
**Endpoint:** `POST /api/exclusive-coupons/sync-now`

**Description:** Manually trigger Google Sheet sync (useful for testing or immediate updates).

**Response:**
```json
{
  "success": true,
  "message": "Sheet sync completed",
  "data": {
    "success": true,
    "message": "Sheet sync completed",
    "stats": {
      "totalRows": 10,
      "successCount": 10,
      "failCount": 0,
      "errors": []
    }
  }
}
```

**Example cURL:**
```bash
curl -X POST http://localhost:3000/api/exclusive-coupons/sync-now
```

---

### 5. Get Sheet Configuration
**Endpoint:** `GET /api/exclusive-coupons/config/sheet`

**Description:** Retrieve current sheet configuration and sync status.

**Response:**
```json
{
  "success": true,
  "message": "Sheet configuration retrieved",
  "data": {
    "_id": "...",
    "sheetUrl": "https://docs.google.com/spreadsheets/d/...",
    "sheetId": "1rm26_ul-O5w_twJGexAlKHbjVp_0EeQcVKV7E6QHUiY",
    "lastSyncedAt": "2026-02-16T10:30:00.000Z",
    "syncStatus": "success",
    "totalCouponsSynced": 10,
    "lastSyncError": null,
    "createdAt": "2026-02-16T10:00:00.000Z",
    "updatedAt": "2026-02-16T10:30:00.000Z"
  }
}
```

**Example cURL:**
```bash
curl http://localhost:3000/api/exclusive-coupons/config/sheet
```

---

## Google Sheet Requirements

### Required Columns (exact names):
1. **Coupon Name** - Display name of the coupon
2. **Brand Name** - Brand/store name
3. **Coupon Description** - Detailed description
4. **Expiry Date** - Format: YYYY-MM-DD or any standard date format
5. **Category Label** - Category (e.g., Food, Fashion, Electronics)
6. **CouponCode** - Unique identifier (REQUIRED, must be unique)
7. **CouponLink** - URL to redeem the coupon
8. **Details** - Additional coupon details
9. **Terms** - Terms and conditions
10. **Stackable** - Whether coupon can be stacked (e.g., yes/no)
11. **Source** - Source of the coupon (e.g., Grabon, Official, etc.)

### Sheet Format:
- First row must be headers (column names)
- Data starts from row 2
- CouponCode column is mandatory and must be unique
- Make the sheet **publicly accessible** (Anyone with the link can view)

### Example Sheet Structure:
```
| Coupon Name         | Brand Name | Coupon Description              | Expiry Date | Category Label | CouponCode  | CouponLink      | Details        | Terms            | Stackable | Source |
|---------------------|------------|---------------------------------|-------------|----------------|-------------|-----------------|----------------|------------------|-----------|--------|
| Jupiter Card Coupon | Zomato     | Enjoy Up to Rs 100 Cashback...  | 2026-03-16  | Food           | JUPITER100  | https://www.zom | Get up to Rs..| Valid exclusively| yes       | Grabon |
```

---

## Automatic Sync

### Cron Job Schedule
The system automatically syncs data from Google Sheets:
- **Frequency:** Every 24 hours
- **Time:** 3:00 AM daily
- **Timezone:** Server timezone

### Upsert Logic
- Uses **brandName + couponName** as composite unique identifier
- If a coupon with the same `brandName` and `couponName` exists → **UPDATE** (allows editing coupon codes)
- If not exists → **INSERT**
- This ensures no duplicate coupons and allows updating coupon codes without creating duplicates

---

## How to Use

### Step 1: Prepare Your Google Sheet
1. Create a Google Sheet with the required columns (see above)
2. Fill in your coupon data
3. Make the sheet public:
   - Click "Share" → "Get link" → "Anyone with the link can view"

### Step 2: Configure the Sheet URL
```bash
curl -X POST http://localhost:3000/api/exclusive-coupons/add-sheet \
  -H "Content-Type: application/json" \
  -d '{"sheetUrl": "YOUR_GOOGLE_SHEET_URL_HERE"}'
```

### Step 3: Verify Sync
```bash
# Check sync status
curl http://localhost:3000/api/exclusive-coupons/config/sheet

# View coupons
curl http://localhost:3000/api/exclusive-coupons
```

### Step 4: Frontend Integration
Your frontend can now fetch coupons from MongoDB:
```javascript
// Fetch all coupons
const response = await fetch('http://localhost:3000/api/exclusive-coupons');
const data = await response.json();
console.log(data.data.coupons);

// Filter by brand
const zomatoCoupons = await fetch('http://localhost:3000/api/exclusive-coupons?brand=Zomato');
```

---

## Error Handling

The system handles:
- Invalid Google Sheet URLs
- Network errors when fetching CSV
- Missing required fields (couponCode, brandName, couponName)
- Duplicate coupon codes (updates existing)
- Date parsing errors
- MongoDB connection issues

All errors are logged using Winston logger.

---

## Database Models

### ExclusiveCoupon Schema
```javascript
{
  couponName: String (required),
  brandName: String (required, indexed),
  description: String,
  expiryDate: Date,
  category: String (indexed),
  couponCode: String (required, unique, uppercase, indexed),
  couponLink: String,
  details: String (max 5000 chars),
  terms: String (max 5000 chars),
  stackable: String,
  source: String,
  createdAt: Date,
  updatedAt: Date
}
```

### SheetConfig Schema
```javascript
{
  sheetUrl: String (required),
  sheetId: String (required),
  lastSyncedAt: Date,
  syncStatus: String (pending/syncing/success/failed),
  lastSyncError: String,
  totalCouponsSynced: Number,
  createdAt: Date,
  updatedAt: Date
}
```

---

## Testing

### 1. Test Adding Sheet URL
```bash
curl -X POST http://localhost:3000/api/exclusive-coupons/add-sheet \
  -H "Content-Type: application/json" \
  -d '{"sheetUrl": "https://docs.google.com/spreadsheets/d/1rm26_ul-O5w_twJGexAlKHbjVp_0EeQcVKV7E6QHUiY/edit?gid=0#gid=0"}'
```

### 2. Check Sync Status
```bash
curl http://localhost:3000/api/exclusive-coupons/config/sheet
```

### 3. Verify Coupons Were Imported
```bash
curl http://localhost:3000/api/exclusive-coupons
```

### 4. Test Manual Sync
```bash
curl -X POST http://localhost:3000/api/exclusive-coupons/sync-now
```

---

## Logs

All sync activities are logged:
- Sync start/completion
- Number of coupons synced
- Errors during sync
- Individual row processing errors

Check logs in your console or log files (configured via Winston).

---

## Tech Stack
- **Node.js** with Express
- **MongoDB** with Mongoose
- **node-cron** for scheduling
- **axios** for HTTP requests
- **csv-parse** for CSV parsing
- **Winston** for logging

---

## Notes
- Only **one sheet URL** is stored at a time
- Adding a new sheet URL will replace the existing one
- The system runs sync every 24 hours automatically
- You can manually trigger sync anytime using `/sync-now` endpoint
- Expired coupons are filtered by default in GET requests (use `includeExpired=true` to include them)

---

## Your Current Sheet
Your Google Sheet URL:
```
https://docs.google.com/spreadsheets/d/1rm26_ul-O5w_twJGexAlKHbjVp_0EeQcVKV7E6QHUiY/edit?gid=0#gid=0
```

To start using it, run:
```bash
curl -X POST http://localhost:3000/api/exclusive-coupons/add-sheet \
  -H "Content-Type: application/json" \
  -d '{"sheetUrl": "https://docs.google.com/spreadsheets/d/1rm26_ul-O5w_twJGexAlKHbjVp_0EeQcVKV7E6QHUiY/edit?gid=0#gid=0"}'
```

🎉 **Done! Your exclusive coupons system is ready to use!**
