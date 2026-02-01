# Dealora Backend - Enterprise REST API

**Production-grade REST API for the Dealora mobile coupon and deals application**

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [System Design & Flow](#system-design--flow)
- [Project Structure](#project-structure)
- [Core Modules](#core-modules)
- [Setup Instructions](#setup-instructions)
- [Configuration](#configuration)
- [API Endpoints](#api-endpoints)
- [Data Models](#data-models)
- [Development Workflow](#development-workflow)
- [Deployment](#deployment)
- [Contribution Guidelines](#contribution-guidelines)
- [Troubleshooting](#troubleshooting)

---

## Overview

Dealora Backend is a comprehensive REST API service designed to power the Dealora mobile application, which aggregates deals and coupons from multiple sources. The system manages user authentication, coupon discovery, user-generated coupon creation, and automated coupon scraping from various third-party deal platforms.

### Key Features

- User Management: Firebase-based authentication with MongoDB persistence
- Coupon Management: Full CRUD operations for user-created coupons with image generation
- Private Coupons: Special coupon system for business users and partners
- Multi-Source Scraping: Automated aggregation from 8+ deal platforms
- Smart Filtering & Search: Advanced query capabilities with sorting and categorization
- Cron-based Automation: Scheduled jobs for scraping and data cleanup
- Enterprise Security: Helmet, CORS, request validation, and error handling
- Comprehensive Logging: Winston-based logging for debugging and monitoring
- AI-Powered Extraction: Google Generative AI integration for coupon data extraction

---

## Architecture

### High-Level System Architecture

The Dealora backend follows a layered architecture pattern with clear separation of concerns:

```
┌─────────────────────────────────────────┐
│      Mobile & Web Clients               │
└────────────────┬────────────────────────┘
                 │
        ┌────────▼──────────┐
        │  Express.js       │
        │  Server (5000)    │
        └────────┬──────────┘
                 │
    ┌────────────┼────────────┐
    │   Middleware Stack      │
    │ - Helmet (Security)     │
    │ - CORS Validation       │
    │ - Request ID            │
    │ - Sanitization          │
    │ - Morgan Logging        │
    └────────────┼────────────┘
                 │
    ┌────────────┼────────────────────────┐
    │                                     │
┌───▼────┐   ┌──────────┐   ┌─────────┐  │
│ Auth   │   │ Coupon   │   │Private  │  │
│ Routes │   │ Routes   │   │Coupon   │  │
└─┬──────┘   └─┬────────┘   │Routes   │  │
  │            │             └─┬───────┘  │
  │            │               │          │
  └────────────┼───────────────┘          │
               │                          │
    ┌──────────▼──────────┐               │
    │ Controllers Layer   │               │
    │ (Business Logic)    │               │
    └──────────┬──────────┘               │
               │                          │
    ┌──────────▼──────────┐               │
    │ Models Layer        │               │
    │ (Data Validation)   │               │
    └──────────┬──────────┘               │
               │                          │
    ┌──────────▼──────────────────────┐   │
    │  MongoDB Database Layer         │   │
    │  - Users Collection             │   │
    │  - Coupons Collection           │   │
    │  - PrivateCoupons Collection    │   │
    └────────────────────────────────┘   │
                                          │
    ┌──────────────────────────────────┐  │
    │  External Services               │  │
    │  - Firebase Auth                 │  │
    │  - Google Generative AI          │  │
    │  - Web Scrapers (Cheerio)        │  │
    │  - Image Generation Service      │  │
    └──────────────────────────────────┘  │
                                           │
    ┌──────────────────────────────────┐  │
    │ Scheduled Jobs (Cron)            │  │
    │ - Daily Scraping (2 AM)          │  │
    │ - Daily Cleanup (4 AM)           │  │
    └──────────────────────────────────┘  │
                                           │
                                           │
└───────────────────────────────────────────┘
```

### Request/Response Processing Flow

```
1. CLIENT REQUEST
   └─ HTTP Request with Headers (including Authorization Bearer Token)

2. SECURITY & PREPROCESSING
   ├─ Helmet: Adds security HTTP headers
   ├─ CORS: Validates request origin
   ├─ Request ID: Assigns unique trace ID
   ├─ Body Parser: Parses JSON/URL-encoded body
   └─ Sanitization: Prevents XSS/injection attacks

3. ROUTING & AUTHENTICATION
   ├─ Express Router: Matches request to endpoint
   ├─ Authentication Middleware: Verifies Firebase token
   │  └─ Extracts user UID and attaches to req.uid
   └─ Request Logging: Morgan logs HTTP request details

4. VALIDATION
   ├─ Express Validator: Validates request body/params
   └─ Custom Validators: Domain-specific validation logic

5. CONTROLLER EXECUTION
   ├─ Business Logic Processing
   ├─ Database Operations (Mongoose queries)
   ├─ External Service Calls (AI, Image Generation)
   ├─ Data Transformation
   └─ Error Handling with try-catch

6. RESPONSE FORMATTING
   ├─ Standard Response Structure
   ├─ Data Serialization
   └─ Status Code Assignment

7. MIDDLEWARE CHAIN COMPLETION
   └─ Response Compression (if applicable)

8. CLIENT RESPONSE
   └─ JSON response with appropriate HTTP status code

9. GLOBAL ERROR HANDLER (if any unhandled error)
   ├─ Catches uncaught exceptions
   ├─ Logs error details
   └─ Returns standardized error response
```

### Data Flow for Core Operations

#### User Signup & Authentication
```
1. Client submits signup via Firebase client SDK
2. Firebase returns ID Token
3. Client sends POST /api/auth/signup with token
4. Server validates token against Firebase
5. Server checks email/phone uniqueness
6. Server creates User document
7. Phone normalized to +91 format
8. Returns user object with metadata
```

#### Coupon Creation
```
1. Validated coupon data received
2. Generate coupon image:
   - Render EJS template with data
   - Convert to PNG canvas
   - Encode as base64
3. Create MongoDB document
4. Add display fields (formatted dates, countdown)
5. Return coupon with image URL
```

#### Automated Scraping Pipeline
```
Daily at 2:00 AM:
├─ Initialize all 8 scrapers in parallel
├─ Per scraper:
│  ├─ Fetch HTML with axios + retry
│  ├─ Parse with Cheerio (jQuery)
│  ├─ Extract coupon fields via selectors
│  ├─ Optional Gemini AI extraction
│  ├─ Validate against schema
│  └─ Batch insert to MongoDB
├─ Log success/failure per source
│
Daily at 4:00 AM:
├─ Find all coupons with expireBy < today
├─ Delete only system_scraper coupons
└─ Preserve user-created coupons
```

---

## Technology Stack

### Runtime & Framework
- Node.js: >=18.0.0 - JavaScript runtime
- Express.js: 4.18.2 - Web application framework

### Database & ORM
- MongoDB: Document-oriented database
- Mongoose: 8.0.3 - MongoDB object modeling

### Authentication & Security
- Firebase Admin SDK: 12.0.0 - Firebase integration
- Helmet: 7.1.0 - HTTP security headers
- CORS: 2.8.5 - Cross-origin handling
- Express Validator: 7.0.1 - Input validation

### Web Scraping
- Cheerio: 1.1.2 - jQuery-like HTML parsing
- Axios: 1.13.4 - HTTP client
- Axios Retry: 4.5.0 - Retry logic for failed requests
- Puppeteer: 24.33.0 - Headless browser (dev only)

### AI & Content Processing
- Google Generative AI: 0.24.1 - Gemini API
- EJS: 3.1.10 - Template engine

### Utilities & Monitoring
- Winston: 3.11.0 - Structured logging
- Morgan: 1.10.0 - HTTP request logger
- Node-Cron: 4.2.1 - Task scheduling
- Compression: 1.8.1 - Response compression
- Dotenv: 16.3.1 - Environment configuration

### Development Tools
- Nodemon: 3.0.2 - Auto-reload for development

---

## System Design & Flow

### Middleware Stack (Request Processing Order)

The application uses a carefully ordered middleware stack:

1. **Trust Proxy**: Sets app.set('trust proxy', 1) for reverse proxies
2. **Helmet**: 30+ security HTTP headers
3. **CORS**: Validates and handles cross-origin requests
4. **Compression**: Gzip response compression
5. **Request ID**: Assigns unique X-Request-ID to each request
6. **Body Parser**: JSON and URL-encoded body parsing (10MB limit)
7. **Sanitization**: Input sanitization middleware
8. **Morgan Logging**: HTTP request logging
9. **Route Handlers**: Application-specific logic
10. **Global Error Handler**: Catches all exceptions

### Authentication Architecture

```
Firebase Authentication Flow:

1. Client-side:
   └─ User signs in via Firebase SDK
      └─ Obtains Firebase ID Token (1 hour expiry)

2. Client sends API request:
   └─ Authorization: Bearer <idToken>

3. Server-side verification:
   ├─ Extract token from Authorization header
   ├─ Verify signature with Firebase public keys
   ├─ Decode JWT payload
   ├─ Extract UID and custom claims
   ├─ Check token expiration
   └─ Attach uid to req.uid for controller use

4. Controller can access:
   └─ req.uid: Firebase unique identifier
```

### Database Schema & Relationships

#### User Collection Schema
```javascript
{
  _id: ObjectId,
  uid: String (Firebase UID, unique, indexed, immutable),
  name: String (2-100 characters),
  email: String (unique, lowercase, indexed),
  phone: String (normalized +91 format, unique, indexed),
  isActive: Boolean (default: true),
  profilePicture: String (URL or null),
  lastLogin: Date,
  deviceTokens: [String],
  createdAt: Date (auto),
  updatedAt: Date (auto)
}
```

#### Coupon Collection Schema
```javascript
{
  _id: ObjectId,
  userId: String (indexed, references User.uid or 'system_scraper'),
  couponName: String (3-100 chars, required),
  brandName: String (indexed, default: 'General'),
  couponTitle: String (optional, 200 char max),
  description: String (required, 10-1000 chars),
  expireBy: Date (indexed, required),
  categoryLabel: Enum,
  useCouponVia: Enum,
  discountType: Enum,
  discountValue: Mixed,
  minimumOrder: Number,
  couponCode: String,
  couponVisitingLink: String (validated URL),
  couponDetails: String,
  addedMethod: String ('manual' or 'scraped'),
  base64ImageUrl: String,
  isRedeemed: Boolean,
  redeemedBy: [String],
  redeemedAt: Date,
  sourceLink: String,
  sourceName: String,
  createdAt: Date,
  updatedAt: Date
}
```

#### Private Coupon Collection Schema
```javascript
{
  _id: ObjectId,
  businessId: String (indexed),
  couponCode: String (unique),
  discount: Number,
  maxUsageCount: Number,
  currentUsageCount: Number,
  validUntil: Date (indexed),
  isActive: Boolean,
  usedBy: [String],
  createdAt: Date,
  updatedAt: Date
}
```

---

## Project Structure

```
Backend/
├── src/
│   ├── app.js                          # Express configuration and middleware setup
│   │
│   ├── config/
│   │   ├── constants.js                # Status codes, error messages, enums
│   │   ├── database.js                 # MongoDB connection with retry logic
│   │   ├── env.js                      # Environment variable validation
│   │   └── firebase.js                 # Firebase Admin SDK initialization
│   │
│   ├── controllers/
│   │   ├── authController.js           # Authentication: signup, login, profile
│   │   ├── couponController.js         # Coupon CRUD and discovery
│   │   └── privateCouponController.js  # Private coupon operations
│   │
│   ├── cron/
│   │   └── jobs.js                     # Scheduled jobs configuration
│   │
│   ├── middlewares/
│   │   ├── authenticate.js             # Firebase token verification
│   │   ├── errorHandler.js             # Global error handling
│   │   ├── requestId.js                # Request ID generation
│   │   ├── sanitize.js                 # Input sanitization
│   │   └── validation.js               # Express validator schemas
│   │
│   ├── models/
│   │   ├── Coupon.js                   # Coupon schema and methods
│   │   ├── PrivateCoupon.js            # Private coupon schema
│   │   └── User.js                     # User schema and methods
│   │
│   ├── routes/
│   │   ├── authRoutes.js               # /api/auth endpoint definitions
│   │   ├── couponRoutes.js             # /api/coupons endpoint definitions
│   │   └── privateCouponRoutes.js      # /api/private-coupons endpoint definitions
│   │
│   ├── scraper/
│   │   ├── engine.js                   # Core scraper orchestration
│   │   ├── index.js                    # Scraper initialization
│   │   └── sources/
│   │       ├── GenericAdapter.js       # Base adapter class
│   │       ├── GrabOnAdapter.js        # GrabOn.co.in scraper
│   │       ├── CouponDuniyaAdapter.js  # CouponDuniya scraper
│   │       ├── DesidimeAdapter.js      # Desidime scraper
│   │       ├── CashkaroAdapter.js      # Cashkaro scraper
│   │       ├── DealivoreAdapter.js     # Dealivore scraper
│   │       ├── CouponDekhoAdapter.js   # CouponDekho scraper
│   │       ├── PaisaWapasAdapter.js    # PaisaWapas scraper
│   │       └── DealsMagnetAdapter.js   # DealsMagnet scraper
│   │
│   ├── services/
│   │   ├── couponImageService.js       # Coupon image generation
│   │   └── geminiExtractionService.js  # AI-powered data extraction
│   │
│   ├── templates/
│   │   └── coupon.ejs                  # Coupon image EJS template
│   │
│   └── utils/
│       ├── couponHelpers.js            # Coupon utilities
│       ├── logger.js                   # Winston logger configuration
│       ├── responseHandler.js          # Response formatting
│       └── validators.js               # Custom validation functions
│
├── logs/                               # Application logs directory
├── server.js                           # Application entry point
├── package.json                        # Dependencies and scripts
├── .env.example                        # Environment template
├── manualScrape.js                     # Manual scraping script
├── normalizecoupons.js                 # Data normalization utility
├── seedPrivateCoupons.js               # Database seeding script
├── test-gemini.js                      # AI service testing
├── test.privatecoupons.json            # Test data file
├── verifySeeding.js                    # Seeding verification
└── README.md                           # This documentation
```

---

## Core Modules

### 1. Authentication Module (authController.js)

Handles user registration, authentication, and profile management using Firebase.

**Key Operations:**
- `signup`: Register new user with Firebase UID
- `login`: Authenticate and retrieve user data
- `logout`: Clear session data
- `getProfile`: Fetch authenticated user's profile
- `updateProfile`: Modify user information
- `addDeviceToken`: Register push notification device tokens

**Validation Rules:**
- Name: 2-100 characters (trimmed)
- Email: Valid format, unique, case-insensitive
- Phone: 10-digit Indian mobile, normalized to +91 format
- Firebase UID: Immutable, unique identifier

### 2. Coupon Management Module (couponController.js)

Complete coupon lifecycle management with discovery features.

**CRUD Operations:**

| Operation | Endpoint | Method | Auth | Purpose |
|-----------|----------|--------|------|---------|
| Create | `/api/coupons` | POST | Yes | Create with auto-generated image |
| Read (List) | `/api/coupons` | GET | Yes | Paginated user coupons |
| Read (Single) | `/api/coupons/:id` | GET | Yes | Single coupon details |
| Update | `/api/coupons/:id` | PUT | Yes | Modify coupon fields |
| Delete | `/api/coupons/:id` | DELETE | Yes | Permanent removal |
| Redeem | `/api/coupons/:id/redeem` | PATCH | Yes | Mark as redeemed |

**Discovery Endpoints:**

| Operation | Endpoint | Method | Purpose |
|-----------|----------|--------|---------|
| Categories | `/api/coupons/categories` | GET | Available categories |
| Sort Options | `/api/coupons/sort-options` | GET | Sorting strategies |
| Filter Options | `/api/coupons/filter-options` | GET | Brands, categories, types |
| Expiring Soon | `/api/coupons/expiring-soon` | GET | Coupons in 7-day window |
| By Brand | `/api/coupons/brand/:brandName` | GET | Brand-specific coupons |

**Search & Filter Features:**
- Full-text search on name, brand, description
- Multiple filter criteria (category, brand, discount type)
- Sorting: latest, oldest, expiring-soon, highest-discount
- Pagination: configurable items per page (default: 20)
- Response includes pagination metadata

**Coupon Categories:**
- Food & Dining
- Fashion & Apparel
- Grocery & Supermarket
- Wallet Rewards & Cashback
- Beauty & Personal Care
- Travel & Hotels
- Entertainment & Media
- Other/General

**Discount Types:**
- percentage (X% off)
- flat (Fixed Rs amount)
- cashback (Returned after purchase)
- freebie (Free item)
- buy1get1 (BOGO)
- free_delivery (Free shipping)
- wallet_upi (UPI specific)
- prepaid_only (Prepaid required)
- unknown (Unclassified)

### 3. Private Coupon Module (privateCouponController.js)

Business partner coupons with usage limits and tracking.

**Features:**
- Fixed discount percentages
- Usage count tracking and limits
- Validity period enforcement
- User usage history
- Enable/disable functionality

### 4. Scraper Engine (scraper/engine.js)

Multi-source coupon aggregation system using Adapter pattern.

**Architecture:**
- Adapter Pattern: Each source has independent, reusable adapter
- Concurrent Execution: All adapters run in parallel using Promise.all()
- Error Isolation: One adapter failure doesn't crash others
- Retry Logic: Automatic retries for network failures
- AI Enhancement: Optional Gemini extraction for complex data

**Supported Sources (8 Adapters):**
1. GrabOn (grabOn.co.in)
2. CouponDuniya
3. Desidime
4. Cashkaro
5. Dealivore
6. CouponDekho
7. PaisaWapas
8. DealsMagnet

**Per-Adapter Flow:**
1. Fetch HTML from source (with axios retry)
2. Parse HTML with Cheerio (jQuery selectors)
3. Extract coupon fields using CSS selectors
4. Optional Gemini AI extraction for complex fields
5. Validate extracted data
6. Transform to standard coupon format
7. Batch insert into MongoDB (upsert mode)
8. Log success/failure metrics

**Error Handling:**
- Network errors trigger automatic retries
- Parsing errors logged but don't stop other adapters
- Failed coupons skipped, others continue
- Global error logging for debugging

### 5. Image Generation Service (couponImageService.js)

Generates visual coupon images as PNG base64 data URLs.

**Process:**
1. Render EJS template with coupon data
2. Generate PNG image using canvas library
3. Convert to base64 data URL
4. Return for inline embedding in responses

**Template Features:**
- Coupon code (prominent display)
- Discount value and type
- Expiry date with countdown
- Brand name (header)
- Description (truncated to 2 lines)
- Category badge
- Visual design for scanning/sharing

### 6. Cron Jobs (cron/jobs.js)

Automated background tasks scheduled with node-cron.

**Job Schedule:**

| Job | Time | Frequency | Action |
|-----|------|-----------|--------|
| Daily Scraping | 2:00 AM | Every day | Run all 8 adapters |
| Cleanup | 4:00 AM | Every day | Delete expired scraper coupons |

**Cleanup Details:**
- Only deletes coupons where `userId === 'system_scraper'`
- Preserves all user-created coupons
- Filters by `expireBy < today`
- Logs deletion count

---

## Setup Instructions

### Prerequisites

Ensure you have installed:
- Node.js >=18.0.0
- MongoDB 4.4+ (local or MongoDB Atlas)
- Firebase project with authentication enabled
- Google Cloud API key (optional, for AI features)

### Step 1: Clone Repository

```bash
cd /path/to/workspace
git clone <repository-url>
cd dealora-backend
```

### Step 2: Install Dependencies

```bash
npm install
```

This installs all packages defined in `package.json` including:
- Production dependencies
- Development dependencies (nodemon, puppeteer)

### Step 3: Environment Setup

```bash
cp .env.example .env
```

Edit `.env` with your configuration values.

### Step 4: Database Setup

#### Option A: MongoDB Atlas (Production Recommended)

1. Create account at https://www.mongodb.com/cloud/atlas
2. Create free tier cluster
3. Create database user with strong password
4. Whitelist IP addresses (or 0.0.0.0 for development)
5. Get connection string format:
   ```
   mongodb+srv://user:password@cluster.mongodb.net/dealora?retryWrites=true
   ```
6. Set `MONGODB_URI` in `.env`

#### Option B: Local MongoDB

```bash
# macOS with Homebrew
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community

# Verify
mongosh

# Set in .env
MONGODB_URI=mongodb://localhost:27017/dealora
```

Collections auto-create on first application run.

### Step 5: Firebase Configuration

1. Go to https://console.firebase.google.com
2. Create or select project
3. Enable "Email/Password" authentication
4. Project Settings → Service Accounts
5. Click "Generate New Private Key"
6. Encode to base64:

```bash
cat firebase-service-account.json | base64 | pbcopy
```

7. Paste as `FIREBASE_SERVICE_ACCOUNT_BASE64` in `.env`

### Step 6: Google Generative AI (Optional)

For advanced coupon data extraction:

1. Visit https://aistudio.google.com/app/apikey
2. Create or use existing API key
3. Set `GOOGLE_GENERATIVE_AI_API_KEY` in `.env`
4. Enable Generative Language API in Google Cloud Console

### Step 7: Verify Installation

```bash
# Check syntax
node -c src/app.js

# Start development server
npm run dev

# Expected output:
# Server running on port 5000 in development mode
# Connected to MongoDB: dealora
# Cron jobs initialized successfully
```

### Step 8: Test API

```bash
# Test endpoint
curl http://localhost:5000/api/coupons/test?uid=test-user-123
```

---

## Configuration

### Environment Variables

```env
# Server Configuration
PORT                              # API port (default: 5000)
NODE_ENV                          # development|production
REQUEST_TIMEOUT                   # Timeout in ms (default: 30000)

# Database
MONGODB_URI                       # MongoDB connection string

# Authentication
FIREBASE_SERVICE_ACCOUNT_BASE64   # Base64 encoded service account

# AI Services
GOOGLE_GENERATIVE_AI_API_KEY      # Gemini API key

# CORS
CORS_ORIGIN                       # Comma-separated allowed origins

# Logging
LOG_LEVEL                         # debug|info|warn|error
LOG_FILE                          # Path to log file
```

### Constants Configuration

Edit `src/config/constants.js` to customize:
- HTTP status codes
- Error messages
- User validation rules
- Database retry configuration
- Coupon enums and categories

### Logging Setup

Winston logger in `src/utils/logger.js`:
- Console output in development
- File output to `logs/app.log`
- JSON format for structured logging
- Daily rotation for log files

```bash
# View logs
tail -f logs/app.log

# Filter by level
grep "ERROR" logs/app.log
```

---

## API Endpoints

### Authentication Routes (/api/auth)

#### POST /api/auth/signup

Create new user account.

**Request:**
```json
{
  "uid": "firebase-uid-string",
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "9876543210"
}
```

**Response (201):**
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Signup successful",
  "data": {
    "user": {
      "_id": "mongo-id",
      "uid": "firebase-uid",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+919876543210",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  }
}
```

#### GET /api/auth/profile

Get authenticated user's profile.

**Headers:**
```
Authorization: Bearer <firebase-id-token>
```

**Response (200):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "User profile retrieved",
  "data": { ... user object ... }
}
```

### Coupon Routes (/api/coupons)

#### POST /api/coupons

Create new coupon with automatic image generation.

**Headers:**
```
Authorization: Bearer <firebase-id-token>
Content-Type: application/json
```

**Request:**
```json
{
  "couponName": "50% Off Pizza",
  "brandName": "Dominos",
  "description": "Get 50% off on minimum order of Rs 300",
  "expireBy": "2024-02-28T23:59:59Z",
  "categoryLabel": "Food",
  "useCouponVia": "Coupon Code",
  "couponCode": "PIZZA50",
  "minimumOrder": 300
}
```

**Response (201):**
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Coupon created successfully",
  "data": {
    "id": "coupon-object-id",
    "couponImageBase64": "data:image/png;base64,iVBORw0KGgo..."
  }
}
```

#### GET /api/coupons

Retrieve user's coupons with pagination and filtering.

**Headers:**
```
Authorization: Bearer <firebase-id-token>
```

**Query Parameters:**
```
page=1              # Page number
limit=20            # Items per page
sortBy=latest       # latest|oldest|expiring-soon|highest-discount
search=pizza        # Full-text search
category=Food       # Category filter
brand=Dominos       # Brand filter
```

**Response (200):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Coupons retrieved successfully",
  "data": {
    "coupons": [ ... ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "pages": 3
    }
  }
}
```

#### GET /api/coupons/:id

Get single coupon details.

#### PUT /api/coupons/:id

Update coupon fields.

#### DELETE /api/coupons/:id

Delete coupon permanently.

#### PATCH /api/coupons/:id/redeem

Mark coupon as redeemed.

#### GET /api/coupons/categories

Get available coupon categories.

#### GET /api/coupons/filter-options

Get available filter values for discovery UI.

#### GET /api/coupons/expiring-soon

Get coupons expiring within 7 days.

#### GET /api/coupons/brand/:brandName

Get all coupons for specific brand.

---

## Data Models

### User Model

**Field Definitions:**
- `uid` (String): Firebase unique ID, immutable, indexed
- `name` (String): User's full name, 2-100 chars
- `email` (String): Unique, case-insensitive
- `phone` (String): Normalized +91 format, unique
- `isActive` (Boolean): Account active status
- `profilePicture` (String): Profile image URL
- `lastLogin` (Date): Last login timestamp
- `deviceTokens` (Array): Push notification tokens
- `createdAt` (Date): Creation timestamp
- `updatedAt` (Date): Modification timestamp

**Key Methods:**
```javascript
User.findByUid(uid)
User.findByEmail(email)
User.findByPhone(phone)
```

### Coupon Model

**Field Definitions:**
- `userId` (String): Owner ID or 'system_scraper'
- `couponName` (String): Display name, required
- `brandName` (String): Merchant/brand, default 'General'
- `description` (String): Detailed description
- `expireBy` (Date): Expiration datetime
- `categoryLabel` (Enum): Predefined category
- `useCouponVia` (Enum): Coupon Code|Link|Both|None
- `discountType` (Enum): Type of discount
- `discountValue` (Mixed): Amount/percentage
- `minimumOrder` (Number): Min purchase required
- `couponCode` (String): Coupon code in uppercase
- `base64ImageUrl` (String): Generated coupon image
- `isRedeemed` (Boolean): Redemption status
- `redeemedBy` (Array): User IDs who redeemed
- `sourceLink` (String): Original source URL
- `sourceName` (String): Scraper source name
- `createdAt` (Date): Creation timestamp
- `updatedAt` (Date): Modification timestamp

**Key Methods:**
```javascript
Coupon.getByCategory(category)
Coupon.getExpiringSoon()
Coupon.getByBrand(brand)
```

### Private Coupon Model

**Field Definitions:**
- `businessId` (String): Business ID
- `couponCode` (String): Unique code
- `discount` (Number): Fixed discount %
- `maxUsageCount` (Number): Usage limit
- `currentUsageCount` (Number): Current usage
- `validUntil` (Date): Expiration date
- `isActive` (Boolean): Enable/disable
- `usedBy` (Array): User IDs list
- `createdAt` (Date): Creation timestamp
- `updatedAt` (Date): Modification timestamp

---

## Development Workflow

### Running the Application

#### Development Mode (Auto-Reload)
```bash
npm run dev
```

Uses nodemon to watch files and auto-restart.

#### Production Mode
```bash
npm start
```

### Project Scripts

```bash
npm run dev    # Development with nodemon
npm start      # Production mode
npm test       # Run tests (placeholder)
```

### Naming Conventions

- **Files**: camelCase.js (authController.js)
- **Classes**: PascalCase (class CouponController)
- **Functions**: camelCase (const createCoupon)
- **Constants**: UPPER_SNAKE_CASE (const MAX_RETRIES)
- **Routes**: kebab-case (/api/private-coupons)

### Code Standards

- Use try-catch in all async functions
- Log important operations and errors
- Validate all user inputs
- Use async/await over promises
- Keep controllers, models, routes separate
- Add JSDoc comments for complex functions
- Follow DRY (Don't Repeat Yourself) principle

### Debugging Tips

**Enable debug logging:**
```env
LOG_LEVEL=debug
NODE_ENV=development
```

**Use request IDs for tracing:**
```bash
grep "request-id-value" logs/app.log
```

**Common Issues:**
- Port in use: `lsof -ti :5000 | xargs kill -9`
- MongoDB failed: Check MONGODB_URI and network
- Firebase error: Verify base64 encoding of service account
- Image generation failed: Check EJS template syntax

---

## Deployment

### Pre-Deployment Checklist

- [ ] All environment variables configured
- [ ] Database backup created
- [ ] Firebase project verified
- [ ] Google AI API key active (if used)
- [ ] CORS origins configured
- [ ] SSL certificate valid
- [ ] Logs directory writable
- [ ] Node >= 18 available
- [ ] Error monitoring set up

### Deployment (AWS EC2)

The recommended deployment method for the Dealora Backend is on an **AWS EC2 (Ubuntu)** instance using **PM2** for process management.

#### 1. Server Prerequisites
- Ubuntu 24.04 LTS (or similar)
- Node.js **v20.x** (Required for `undici`/`firebase` support)
- PM2 (`npm install -g pm2`)
- Security Group: Port **5000** (Custom TCP) and **22** (SSH) open.

#### 2. Initial Setup (One-time)
From your local terminal, connect to your server:
```bash
ssh -i dealora-key.pem ubuntu@YOUR_EC2_IP
```

Inside the server, run the following to setup Node 20:
```bash
sudo apt update
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g pm2
```

#### 3. Deploying Code
```bash
git clone <your-repo-url>
cd dealora/Backend
npm install --omit=dev
nano .env # Paste your configuration
pm2 start server.js --name dealora-api
```

#### 4. Updating Code
When pushing new changes:
1. `cd dealora/Backend`
2. `git pull origin main`
3. `pm2 restart dealora-api`

#### 5. Useful PM2 Commands
- `pm2 logs` - View real-time logs (very useful for debugging)
- `pm2 list` - Check server status
- `pm2 restart dealora-api` - Refresh after `.env` changes
- `pm2 startup` - Ensure server starts on reboot

#### Option 4: Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

---

## Contribution Guidelines

### Branching Strategy

```
main (production)
└── develop (integration)
    ├── feature/description
    ├── bugfix/description
    └── hotfix/description
```

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:** feat, fix, docs, style, refactor, perf, chore

### Pull Request Process

1. Create feature branch from develop
2. Make changes with comments
3. Push and create PR
4. Get code review approval
5. Squash and merge to develop
6. Delete feature branch

### Code Review Checklist

- [ ] Follows naming conventions
- [ ] Error handling complete
- [ ] Logging appropriate
- [ ] Input validation present
- [ ] No security issues
- [ ] Documentation updated
- [ ] No breaking changes

### Adding New Scrapers

Create adapter extending GenericAdapter:

```javascript
class NewSourceAdapter extends GenericAdapter {
  constructor() {
    super({
      name: 'NewSource',
      url: 'https://newsource.com',
      selectors: { /* ... */ }
    });
  }
  
  async extract(parsedData) {
    // Transform to standard format
  }
}
```

Register in `src/scraper/index.js` and test.

### Adding New Endpoints

1. Create controller function
2. Create route definition
3. Add validation schema
4. Register in app.js
5. Document in README

---

## Troubleshooting

### MongoDB Connection Failed

**Check:**
- MongoDB service running
- Correct connection string
- Network access (whitelist IPs)
- Credentials correct

```bash
# Test connection
mongosh mongodb://localhost:27017
```

### Firebase Authentication Error

**Check:**
- Service account JSON valid
- Base64 encoding correct
- Firebase project active
- Credentials not expired

```bash
# Verify encoding
echo $FIREBASE_SERVICE_ACCOUNT_BASE64 | base64 -d | jq .
```

### Port Already in Use

```bash
lsof -ti :5000 | xargs kill -9
PORT=5001 npm run dev
```

### Scraper No Results

```bash
# Test manually
node manualScrape.js

# Check logs
grep "ERROR" logs/app.log
```

### Image Generation Failed

```bash
# Verify template
ls -la src/templates/coupon.ejs

# Reinstall canvas
npm rebuild canvas
```

---

## Performance Optimization

- Add database indexes on frequently queried fields
- Use pagination for large result sets
- Enable response compression
- Monitor memory usage during scraping
- Implement caching for static options
- Use batch operations for bulk inserts

---

## Security Best Practices

- Never commit credentials or `.env`
- Rotate API keys periodically
- Use HTTPS in production
- Whitelist specific CORS origins
- Validate all user inputs
- Sanitize output to prevent XSS
- Implement rate limiting on auth endpoints
- Keep dependencies updated
- Use secure session management
- Monitor logs for suspicious patterns

---

## Additional Resources

- [Express.js Documentation](https://expressjs.com/)
- [MongoDB Documentation](https://docs.mongodb.com/)
- [Firebase Docs](https://firebase.google.com/docs/)
- [Node.js Best Practices](https://nodejs.org/en/docs/guides/)
