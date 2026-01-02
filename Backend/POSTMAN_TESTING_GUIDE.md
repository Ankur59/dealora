# Postman Testing Guide for Dealora API

## 📋 Table of Contents
- [Setup Instructions](#setup-instructions)
- [Environment Variables](#environment-variables)
- [API Endpoints](#api-endpoints)
- [Testing Workflow](#testing-workflow)
- [Sample Payloads](#sample-payloads)

---

## 🚀 Setup Instructions

### 1. Import Collection
1. Open Postman
2. Click **Import** button
3. Select `Postman_Collection.json` file
4. Collection will be imported with all endpoints

### 2. Configure Environment Variables
The collection uses the following variables:

| Variable | Default Value | Description |
|----------|---------------|-------------|
| `BASE_URL` | `http://localhost:3000` | Your server URL |
| `USER_UID` | `test-user-123` | User ID for testing (dev mode) |
| `AUTH_TOKEN` | *(empty)* | Firebase ID token (production) |

**To set variables:**
1. Click on the collection name
2. Go to **Variables** tab
3. Update the **Current Value** column
4. Click **Save**

---

## 🔐 Authentication

### Development Mode (No Firebase)
- The server runs in development mode when Firebase is not configured
- Simply pass `uid` as a query parameter: `?uid=test-user-123`
- No Bearer token required

### Production Mode (With Firebase)
- Get Firebase ID token from your frontend
- Add to headers: `Authorization: Bearer YOUR_TOKEN_HERE`
- Update `AUTH_TOKEN` variable in Postman

---

## 📡 API Endpoints

### Health Check
**GET** `/health`
- No authentication required
- Returns server status and database connection

**Expected Response:**
```json
{
  "success": true,
  "message": "Server is running",
  "timestamp": "2026-01-02T09:00:00.000Z",
  "uptime": 123.456,
  "environment": "development",
  "database": "connected",
  "version": "1.0.0"
}
```

---

### Authentication Endpoints

#### 1. Signup
**POST** `/api/auth/signup`

**Request Body:**
```json
{
  "uid": "test-user-123",
  "name": "John Doe",
  "email": "john.doe@example.com",
  "phone": "+919876543210"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "_id": "...",
      "uid": "test-user-123",
      "name": "John Doe",
      "email": "john.doe@example.com",
      "phone": "+919876543210",
      "isActive": true,
      "createdAt": "2026-01-02T09:00:00.000Z"
    }
  }
}
```

**Error Response (409 - Conflict):**
```json
{
  "success": false,
  "message": "Email already exists"
}
```

---

#### 2. Login
**POST** `/api/auth/login`

**Request Body:**
```json
{
  "uid": "test-user-123"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "_id": "...",
      "uid": "test-user-123",
      "name": "John Doe",
      "email": "john.doe@example.com",
      "isActive": true
    }
  }
}
```

---

#### 3. Get Profile
**GET** `/api/auth/profile?uid=test-user-123`

**Headers:**
- `Authorization: Bearer {{AUTH_TOKEN}}` (production)

**Success Response (200):**
```json
{
  "success": true,
  "message": "Profile fetched successfully",
  "data": {
    "user": {
      "_id": "...",
      "uid": "test-user-123",
      "name": "John Doe",
      "email": "john.doe@example.com",
      "phone": "+919876543210",
      "profilePicture": null,
      "isActive": true
    }
  }
}
```

---

#### 4. Update Profile
**PUT** `/api/auth/profile?uid=test-user-123`

**Request Body:**
```json
{
  "name": "John Doe Updated",
  "profilePicture": "https://example.com/profile.jpg"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "user": {
      "_id": "...",
      "uid": "test-user-123",
      "name": "John Doe Updated",
      "profilePicture": "https://example.com/profile.jpg"
    }
  }
}
```

---

### Coupon Endpoints

#### 1. Create Coupon
**POST** `/api/coupons?uid=test-user-123`

**Request Body:**
```json
{
  "couponName": "50% OFF on Electronics",
  "description": "Get 50% discount on all electronic items",
  "expireBy": "2026-12-31T23:59:59.000Z",
  "categoryLabel": "Electronics",
  "useCouponVia": "code",
  "couponCode": "ELEC50",
  "couponVisitingLink": "https://example.com/deals/electronics",
  "couponDetails": "Valid on purchases above $100. Cannot be combined with other offers."
}
```

**Field Descriptions:**
- `couponName` (required): Name of the coupon
- `description` (required): Coupon description
- `expireBy` (required): Expiration date in ISO format
- `categoryLabel` (required): Category (e.g., Electronics, Fashion, Food)
- `useCouponVia` (required): How to use - `"code"` or `"link"`
- `couponCode` (optional): Coupon code if useCouponVia is "code"
- `couponVisitingLink` (optional): URL if useCouponVia is "link"
- `couponDetails` (optional): Additional details

**Success Response (201):**
```json
{
  "success": true,
  "message": "Coupon created successfully",
  "data": {
    "coupon": {
      "_id": "...",
      "userId": "...",
      "couponName": "50% OFF on Electronics",
      "description": "Get 50% discount on all electronic items",
      "expireBy": "2026-12-31T23:59:59.000Z",
      "categoryLabel": "Electronics",
      "useCouponVia": "code",
      "couponCode": "ELEC50",
      "status": "active",
      "displayExpireBy": "31 Dec 2026",
      "daysRemaining": 364
    },
    "couponImageBase64": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
  }
}
```

---

#### 2. Get All User Coupons
**GET** `/api/coupons?uid=test-user-123&page=1&limit=10&status=active&sortBy=createdAt&order=desc`

**Query Parameters:**
- `uid` (dev mode): User ID
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `status` (optional): Filter by status - `active`, `redeemed`, `expired`
- `category` (optional): Filter by category
- `sortBy` (optional): Sort field (default: createdAt)
- `order` (optional): Sort order - `asc` or `desc` (default: desc)

**Success Response (200):**
```json
{
  "success": true,
  "message": "Coupons fetched successfully",
  "data": {
    "coupons": [
      {
        "_id": "...",
        "couponName": "50% OFF on Electronics",
        "description": "Get 50% discount on all electronic items",
        "status": "active",
        "displayExpireBy": "31 Dec 2026",
        "daysRemaining": 364
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalCoupons": 47,
      "limit": 10
    }
  }
}
```

---

#### 3. Get Coupon By ID
**GET** `/api/coupons/:couponId?uid=test-user-123`

Replace `:couponId` with actual MongoDB ObjectId

**Success Response (200):**
```json
{
  "success": true,
  "message": "Coupon fetched successfully",
  "data": {
    "coupon": {
      "_id": "...",
      "couponName": "50% OFF on Electronics",
      "description": "Get 50% discount on all electronic items",
      "status": "active",
      "displayExpireBy": "31 Dec 2026",
      "daysRemaining": 364
    }
  }
}
```

---

#### 4. Update Coupon
**PUT** `/api/coupons/:couponId?uid=test-user-123`

**Request Body:**
```json
{
  "couponName": "60% OFF on Electronics",
  "description": "Updated: Get 60% discount on all electronic items",
  "expireBy": "2026-12-31T23:59:59.000Z",
  "categoryLabel": "Electronics",
  "useCouponVia": "code",
  "couponCode": "ELEC60"
}
```

**Note:** Only active coupons can be updated. Redeemed or expired coupons cannot be modified.

**Success Response (200):**
```json
{
  "success": true,
  "message": "Coupon updated successfully",
  "data": {
    "coupon": {
      "_id": "...",
      "couponName": "60% OFF on Electronics",
      "status": "active"
    }
  }
}
```

---

#### 5. Redeem Coupon
**PATCH** `/api/coupons/:couponId/redeem?uid=test-user-123`

No request body required.

**Success Response (200):**
```json
{
  "success": true,
  "message": "Coupon redeemed successfully",
  "data": {
    "coupon": {
      "_id": "...",
      "couponName": "50% OFF on Electronics",
      "status": "redeemed",
      "redeemedAt": "2026-01-02T09:00:00.000Z"
    }
  }
}
```

**Error Response (400):**
```json
{
  "success": false,
  "message": "Coupon already redeemed"
}
```

---

#### 6. Delete Coupon
**DELETE** `/api/coupons/:couponId?uid=test-user-123`

**Success Response (200):**
```json
{
  "success": true,
  "message": "Coupon deleted successfully",
  "data": {
    "deletedCouponId": "..."
  }
}
```

---

## 🧪 Testing Workflow

### Complete Test Sequence

1. **Check Server Health**
   - Run: `GET /health`
   - Verify: Database is connected

2. **Create User Account**
   - Run: `POST /api/auth/signup`
   - Save the `uid` from response
   - Update `USER_UID` variable in Postman

3. **Login**
   - Run: `POST /api/auth/login`
   - Verify: User data is returned

4. **Get Profile**
   - Run: `GET /api/auth/profile`
   - Verify: Profile data matches signup data

5. **Update Profile**
   - Run: `PUT /api/auth/profile`
   - Verify: Changes are reflected

6. **Create Coupon**
   - Run: `POST /api/coupons`
   - Save the `_id` from response
   - Check: `couponImageBase64` is returned

7. **Get All Coupons**
   - Run: `GET /api/coupons`
   - Verify: Created coupon appears in list

8. **Get Specific Coupon**
   - Run: `GET /api/coupons/:couponId`
   - Replace `:couponId` with saved ID
   - Verify: Correct coupon is returned

9. **Update Coupon**
   - Run: `PUT /api/coupons/:couponId`
   - Verify: Updates are saved

10. **Redeem Coupon**
    - Run: `PATCH /api/coupons/:couponId/redeem`
    - Verify: Status changes to "redeemed"

11. **Delete Coupon**
    - Run: `DELETE /api/coupons/:couponId`
    - Verify: Coupon is deleted

---

## 🔍 Common Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "message": "Validation error message"
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "message": "No token provided. Please include Bearer token in Authorization header."
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "Coupon not found"
}
```

### 409 Conflict
```json
{
  "success": false,
  "message": "Email already exists"
}
```

### 429 Too Many Requests
```json
{
  "success": false,
  "message": "Too many requests, please try again later"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Internal server error"
}
```

---

## 💡 Tips

1. **Use Collection Variables**: Store frequently used values like `USER_UID` and `BASE_URL`
2. **Save Responses**: Use Postman's test scripts to automatically save IDs from responses
3. **Test Edge Cases**: Try invalid data, missing fields, expired tokens
4. **Check Logs**: Monitor server logs for detailed error information
5. **Rate Limiting**: Be aware of rate limits (100 requests per 15 minutes)

---

## 🐛 Troubleshooting

### Connection Refused
- Ensure server is running: `npm start`
- Check `BASE_URL` is correct (default: `http://localhost:3000`)

### Database Disconnection Fixed
- The MongoDB connection now stays persistent
- Removed `maxIdleTimeMS` that was causing disconnections
- Auto-reconnection logic added

### Authentication Errors
- **Dev Mode**: Pass `uid` as query parameter
- **Production**: Include valid Firebase token in Authorization header

### Validation Errors
- Check all required fields are present
- Verify data types match expected format
- Ensure dates are in ISO 8601 format

---

## 📝 Notes

- Server runs on port **3000** by default
- Rate limit: **100 requests per 15 minutes**
- Request timeout: **30 seconds**
- Max request body size: **10MB**
- All timestamps are in **UTC**
- MongoDB connection is now **persistent** (no more disconnections!)

---

**Happy Testing! 🚀**
