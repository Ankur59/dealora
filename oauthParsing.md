# 📧 Dealora — Email Parsing & Gmail Sync Feature

> **Client Documentation** | Version 1.0 | February 2026

---

## 📌 Overview

Dealora's **Email Parsing** feature allows users to **link their Gmail account** with the Dealora platform. Once linked, Dealora automatically scans the user's **Promotional inbox**, extracts coupon codes and deals from brand emails using **Google Gemini AI**, and stores them as usable coupons inside the app — all without any manual input from the user.

---

## 🎯 What Does It Do?

| Step                                  | What Happens                                                                       |
| ------------------------------------- | ---------------------------------------------------------------------------------- |
| 1. User links their Gmail             | User grants Dealora OAuth 2.0 read-only access to their Gmail account              |
| 2. Dealora fetches promotional emails | The backend connects to the Gmail API and fetches emails from the `Promotions` tab |
| 3. AI scans each email                | Each email is sent to **Google Gemini AI** which extracts coupon/deal information  |
| 4. Coupons are saved                  | Extracted coupons are automatically saved to the user's Dealora profile            |
| 5. User gets deals instantly          | All extracted coupons appear in the app — ready to redeem                          |

---

## 🔐 How Gmail Linking Works

### OAuth 2.0 Flow

Dealora uses **Google OAuth 2.0** — the industry-standard, secure authorization protocol. This means:

- ✅ Dealora **never** sees or stores your Gmail password
- ✅ Access is **read-only** — Dealora can only read emails, never send or delete
- ✅ The user can **revoke access** at any time from their Google account settings
- ✅ Only your **Promotions tab** emails are scanned — personal emails are never touched

### Scopes Requested

```
https://www.googleapis.com/auth/gmail.readonly
```

This is the most restricted Gmail scope available — read-only access.

---

## 🤖 AI-Powered Email Parsing

Each promotional email is analyzed by **Google Gemini AI**, which extracts:

| Field                | Example                          |
| -------------------- | -------------------------------- |
| **Brand / Merchant** | Swiggy, Amazon, Myntra           |
| **Coupon Title**     | "Get 20% OFF on your next order" |
| **Coupon Code**      | `SWIGGY20`                       |
| **Discount Type**    | Percentage, Flat, Cashback       |
| **Discount Value**   | 20 (for 20%)                     |
| **Minimum Order**    | ₹299                             |
| **Expiry Date**      | 2026-03-15                       |
| **Confidence Score** | 0.92 (92% certainty)             |

### How the AI Decides

The AI uses the **email subject, sender name, and body content** as context. It understands:

- Offers written in promotional language ("Get flat 50% off")
- Coupon codes embedded in HTML email templates
- Time-limited deals and flash sales
- Minimum order conditions and maximum discount caps

---

## 🛣️ Technical Architecture

```
MOBILE APP (Android)
       │
       │  POST /api/features/gmail-sync
       │  { accessToken: "<google oauth token>", userId: "<uid>" }
       ▼
DEALORA BACKEND (Node.js / Express)
       │
       ├── 1. Calls Gmail API → Fetches up to 50 promotional emails
       │                        (last 7 days, category:promotions)
       │
       ├── 2. For each email:
       │       ├── Extracts: sender, subject, body
       │       ├── Heuristic filter: checks for coupon keywords
       │       │   (discount, off, code, coupon, deal)
       │       └── If relevant → sends to Gemini AI
       │
       ├── 3. Gemini AI → Returns structured JSON coupon data
       │
       ├── 4. Duplicate check → Avoids saving same coupon twice
       │
       └── 5. Saves to MongoDB as "Email Parsing" source coupon
```

---

## 📡 API Endpoints

### 1. Gmail Sync (Primary Feature)

```http
POST /api/features/gmail-sync
```

**Request Body:**

```json
{
  "accessToken": "<Google OAuth 2.0 access token>",
  "userId": "<user-uid>"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Found 23 emails (last 7 days). Processed all 23 emails, extracted 11 coupons. 8 skipped (no coupon keywords), 0 errors.",
  "totalFound": 23,
  "processedCount": 23,
  "extractedCount": 11,
  "skippedCount": 8,
  "errorCount": 0,
  "coupons": [ ... ]
}
```

---

### 2. Direct Email Processing

```http
POST /api/features/email
```

Allows manually pasting email content for one-off extraction (no Gmail linking needed).

**Request Body:**

```json
{
  "emailContent": "<full email body text>",
  "sender": "deals@swiggy.com",
  "userId": "<user-uid>"
}
```

---

### 3. Email History

```http
GET /api/features/email
```

Returns all coupons that were previously extracted from emails (sorted newest first).

---

## 📊 Email Processing Logic (Step-by-Step)

```
For Each Promotional Email:
  ┌──────────────────────────────────────────────────────┐
  │ 1. Fetch full message from Gmail API                  │
  │    → Extract: From, Subject, Body (text/plain)        │
  ├──────────────────────────────────────────────────────┤
  │ 2. Heuristic Filter                                   │
  │    → Check for keywords: discount, off, code,         │
  │      coupon, deal                                     │
  │    → If none found: SKIP (not a coupon email)         │
  ├──────────────────────────────────────────────────────┤
  │ 3. Send to Gemini AI (30s timeout)                    │
  │    → Full context: Subject + From + Body              │
  │    → Returns: merchant, coupon_title, coupon_code,    │
  │      discount_type, discount_value, expiry_date,      │
  │      confidence_score                                 │
  ├──────────────────────────────────────────────────────┤
  │ 4. Duplicate Check                                    │
  │    → If coupon_code + brandName already in DB: SKIP   │
  ├──────────────────────────────────────────────────────┤
  │ 5. Save to Database                                   │
  │    → Source: "Email Parsing"                          │
  │    → Status: "active"                                 │
  └──────────────────────────────────────────────────────┘
```

---

## 🔒 Privacy & Security

| Concern               | Our Approach                                                                       |
| --------------------- | ---------------------------------------------------------------------------------- |
| **Email Privacy**     | Only the Promotions tab is accessed. Personal, Social, Work emails are never read. |
| **Password Security** | We use OAuth — your password is never seen by Dealora.                             |
| **Data Storage**      | Only extracted coupon data is stored, never raw email content.                     |
| **Token Security**    | OAuth tokens are passed at runtime and never persisted on our servers.             |
| **Access Control**    | User can revoke Dealora's Gmail access at any time via myaccount.google.com        |
| **Scope Limitation**  | We request the minimum scope: `gmail.readonly`                                     |

---

## ⚙️ Current Configuration (Demo Mode)

| Parameter        | Value                | Notes                                      |
| ---------------- | -------------------- | ------------------------------------------ |
| Date Range       | Last 7 days          | Temporarily increased from 2 days for demo |
| Max Emails       | 50 per sync          | Temporarily increased from 20 for demo     |
| AI Timeout       | 30 seconds per email | Prevents server hanging                    |
| Duplicate Check  | Enabled              | Same code + brand = skip                   |
| Heuristic Filter | Enabled              | Skips emails with no coupon keywords       |

> **Note:** The current demo settings (7 days, 50 emails) are temporarily increased for the client presentation. Production defaults are 2 days / 20 emails to stay within free Gemini AI tier limits.

---

## 📱 Mobile App Integration (Android — Kotlin)

The Android client:

1. Triggers Google Sign-In with Gmail read-only scope
2. Receives an OAuth access token
3. Sends the token to `POST /api/features/gmail-sync`
4. Displays the extracted coupons in the user's private coupon wallet

---

## 🧠 AI Models Used

The system uses the following **Google Gemini** models (in order of preference):

1. `gemini-2.5-flash` _(primary)_
2. `gemini-2.5-pro`
3. `gemini-2.0-flash`
4. _(Auto-discovers additional available models)_

If a model is rate-limited, the system automatically switches to the next available model.

---

## 🗂️ Database Schema (Extracted Coupon)

Each extracted coupon is saved with:

```json
{
  "userId": "user-uid",
  "brandName": "Swiggy",
  "couponTitle": "20% OFF on your next order",
  "couponCode": "SWIGGY20",
  "discountType": "percentage",
  "discountValue": 20,
  "minimumOrder": 299,
  "expireBy": "2026-03-15T00:00:00.000Z",
  "sourceWebsite": "Email Parsing",
  "status": "active",
  "addedMethod": "manual"
}
```

---

## 📈 Value Proposition

> **"Your inbox is full of deals. Dealora finds them for you."**

- 🕐 **Saves time** — no manually searching for coupon codes
- 💰 **Maximizes savings** — never miss a deal in your inbox
- 🤖 **Fully automated** — one tap to sync, AI does the rest
- 🔒 **Privacy-first** — read-only access, no password required

---

_Document generated for client presentation — Dealora Platform, February 2026_
