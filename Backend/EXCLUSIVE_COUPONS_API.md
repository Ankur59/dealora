# Exclusive Coupons - Google Sheet Sync System

## Overview
This system automatically syncs coupon data from a public Google Sheet into MongoDB every 24 hours.

## Features
✅ One-time sheet URL configuration
✅ Automatic 24-hour sync via cron job
✅ Manual sync trigger
✅ Upsert logic (updates existing, inserts new coupons)
✅ Comprehensive filtering, searching, and sorting
✅ Real-time days until expiry calculation
✅ Comprehensive error handling and logging

---

## 🚀 Quick Start with Postman

### 1️⃣ **Add Google Sheet URL** (One-time setup)

**Method:** `POST`  
**URL:** `http://localhost:3000/api/exclusive-coupons/add-sheet`  
**Headers:**
```
Content-Type: application/json
```
**Body (raw JSON):**
```json
{
  "sheetUrl": "https://docs.google.com/spreadsheets/d/1rm26_ul-O5w_twJGexAlKHbjVp_0EeQcVKV7E6QHUiY/edit?gid=0#gid=0"
}
```

---

### 2️⃣ **Get All Coupons** (Main Endpoint - All Operations)

**Method:** `GET`  
**URL:** `http://localhost:3000/api/exclusive-coupons`  

**Postman Params Tab:**

| Key | Value | Description |
|-----|-------|-------------|
| `brand` | `Zomato` | Single brand filter |
| `brands` | `Zomato,Swiggy,Cred` | Multiple brands (comma-separated) |
| `category` | `Food` | Filter by category |
| `search` | `cashback` | Search in all fields |
| `source` | `Grabon` | Filter by source |
| `stackable` | `yes` | Filter stackable coupons (yes/no) |
| `validity` | `expiring_this_week` | Validity filter (see options below) |
| `sortBy` | `a_to_z` | Sorting option (see options below) |
| `page` | `1` | Page number |
| `limit` | `20` | Results per page (max: 100) |

**Validity Options:**
- `valid_today` - Currently valid
- `valid_this_week` - Valid through this week
- `valid_this_month` - Valid through this month
- `expiring_today` - Expiring today
- `expiring_this_week` - Expiring within 7 days
- `expiring_this_month` - Expiring this month
- `expired` - Expired only
- `all` - All coupons

**Sorting Options:**
- `newest_first` - Newest first (default)
- `oldest_first` - Oldest first
- `expiring_soon` - Expiring soonest first
- `a_to_z` - Alphabetical A-Z
- `z_to_a` - Reverse alphabetical Z-A

**Example Postman Setups:**

**Basic Filter:**
```
GET http://localhost:3000/api/exclusive-coupons?brand=Zomato&sortBy=a_to_z
```
Params:
- brand: `Zomato`
- sortBy: `a_to_z`

**Advanced Filter:**
```
GET http://localhost:3000/api/exclusive-coupons
```
Params:
- brands: `Zomato,Swiggy,Cred`
- category: `Food`
- validity: `expiring_this_week`
- sortBy: `expiring_soon`
- search: `cashback`
- limit: `20`
- page: `1`

**Stackable Coupons Only:**
```
GET http://localhost:3000/api/exclusive-coupons?stackable=yes&sortBy=newest_first
```

---

### 3️⃣ **Get Specific Coupon by Code**

**Method:** `GET`  
**URL:** `http://localhost:3000/api/exclusive-coupons/JUPITER100`

Replace `JUPITER100` with any coupon code.

---

### 4️⃣ **Manual Sync Trigger**

**Method:** `POST`  
**URL:** `http://localhost:3000/api/exclusive-coupons/sync-now`

No body required. This triggers an immediate sync from Google Sheet.

---

### 5️⃣ **Get Filter Options** (Helper Endpoints)

**Get All Brands:**
```
GET http://localhost:3000/api/exclusive-coupons/filters/brands
```

**Get All Categories:**
```
GET http://localhost:3000/api/exclusive-coupons/filters/categories
```

**Get All Sources:**
```
GET http://localhost:3000/api/exclusive-coupons/filters/sources
```

---

### 6️⃣ **Get Statistics**

**Method:** `GET`  
**URL:** `http://localhost:3000/api/exclusive-coupons/stats`

Returns total coupons, active, expired, expiring this week, total brands, and categories.

---

### 7️⃣ **Get Sync Status**

**Method:** `GET`  
**URL:** `http://localhost:3000/api/exclusive-coupons/config/sheet`

Check last sync time, status, and total coupons synced.

---

## 📊 Response Format

All responses follow this structure:

**Success Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Exclusive coupons retrieved successfully",
  "data": {
    "count": 5,
    "total": 50,
    "page": 1,
    "pages": 10,
    "coupons": [
      {
        "_id": "6993655acc0867647fad34d2",
        "couponName": "Jupiter Card Coupon",
        "brandName": "Zomato",
        "couponCode": "JUPITER100",
        "description": "Enjoy Up to Rs 100 Cashback Using JUPITER UPI Card",
        "category": "Food",
        "expiryDate": "2026-03-16T00:00:00.000Z",
        "couponLink": "https://www.zomato.com",
        "details": "Get up to Rs 100 cashback...",
        "terms": "Valid exclusively for payments...",
        "source": "Grabon",
        "stackable": "yes",
        "daysUntilExpiry": 27,
        "createdAt": "2026-02-17T10:43:38.085Z",
        "updatedAt": "2026-02-17T10:43:38.085Z"
      }
    ]
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "statusCode": 404,
  "message": "No coupons found"
}
```

---

## 🎯 Common Postman Use Cases

### Use Case 1: Get All Active Coupons from Zomato
**Method:** GET  
**URL:** `http://localhost:3000/api/exclusive-coupons`  
**Params:**
- brand: `Zomato`

### Use Case 2: Search for "Cashback" Offers
**Method:** GET  
**URL:** `http://localhost:3000/api/exclusive-coupons`  
**Params:**
- search: `cashback`

### Use Case 3: Get Expiring Soon Coupons (Sorted)
**Method:** GET  
**URL:** `http://localhost:3000/api/exclusive-coupons`  
**Params:**
- validity: `expiring_this_week`
- sortBy: `expiring_soon`

### Use Case 4: Food Category from Multiple Brands
**Method:** GET  
**URL:** `http://localhost:3000/api/exclusive-coupons`  
**Params:**
- brands: `Zomato,Swiggy,Uber Eats`
- category: `Food`
- sortBy: `a_to_z`

### Use Case 5: Only Stackable Coupons from Grabon
**Method:** GET  
**URL:** `http://localhost:3000/api/exclusive-coupons`  
**Params:**
- source: `Grabon`
- stackable: `yes`

### Use Case 6: Pagination (Page 2, 10 per page)
**Method:** GET  
**URL:** `http://localhost:3000/api/exclusive-coupons`  
**Params:**
- page: `2`
- limit: `10`

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
## Google Sheet Requirements

### Required Columns (exact names):
1. **Coupon Name** - Display name of the coupon
2. **Brand Name** - Brand/store name
3. **Coupon Description** - Detailed description
4. **Expiry Date** - Format: YYYY-MM-DD or any standard date format
5. **Category Label** - Category (e.g., Food, Fashion, Electronics)
6. **CouponCode** - Unique identifier (REQUIRED)
7. **CouponLink** - URL to redeem the coupon
8. **Details** - Additional coupon details
9. **Terms** - Terms and conditions
10. **Stackable** - Whether coupon can be stacked (e.g., yes/no)
11. **Source** - Source of the coupon (e.g., Grabon, Official, etc.)

### Sheet Format:
- First row must be headers (column names)
- Data starts from row 2
- **Brand Name** and **Coupon Name** together must be unique
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

## API Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/exclusive-coupons/add-sheet` | Add/update sheet URL |
| GET | `/api/exclusive-coupons` | Get coupons (main endpoint with all filters) |
| GET | `/api/exclusive-coupons/:couponCode` | Get specific coupon by code |
| POST | `/api/exclusive-coupons/sync-now` | Manual sync trigger |
| GET | `/api/exclusive-coupons/config/sheet` | Get sync status |
| GET | `/api/exclusive-coupons/filters/brands` | Get all unique brands |
| GET | `/api/exclusive-coupons/filters/categories` | Get all unique categories |
| GET | `/api/exclusive-coupons/filters/sources` | Get all unique sources |
| GET | `/api/exclusive-coupons/stats` | Get coupon statistics |

---

## Tech Stack
- **Node.js** with Express
- **MongoDB** with Mongoose
- **node-cron** for scheduling
- **axios** for HTTP requests
- **csv-parse** for CSV parsing
- **Winston** for logging

---

## 🎉 You're All Set!

Your exclusive coupons system is ready to use. Start testing with Postman using the examples above!
- **Frequency:** Every 24 hours
- **Time:** 3:00 AM daily
- **Timezone:** Server timezone

### Upsert Logic
- Uses **brandName + couponName** as composite unique identifier
- If a coupon with the same `brandName` and `couponName` exists → **UPDATE** (allows editing coupon codes)
- If not exists → **INSERT**
- This ensures no duplicate coupons and allows updating coupon codes without creating duplicates

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
  couponCode: String (required, uppercase, indexed),
  couponLink: String,
  details: String (max 5000 chars),
  terms: String (max 5000 chars),
  stackable: String,
  source: String,
  createdAt: Date,
  updatedAt: Date
}
```
*Note: Composite unique index on (brandName + couponName)*

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

## Important Notes
- Only **one sheet URL** is stored at a time
- Adding a new sheet URL will replace the existing one
- The system runs sync every 24 hours automatically at 3:00 AM
- You can manually trigger sync anytime using POST `/sync-now`
- Expired coupons are filtered by default (use `validity=all` to include them)
- **Brand Name + Coupon Name** create a unique identifier (changing coupon code updates same coupon)

🎉 **Done! Your exclusive coupons system is ready to use!**
