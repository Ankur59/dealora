# Dealora AI Features API Integration Guide

This document provides detailed information for integrating the Dealora AI-powered features (OCR Screenshot Parsing and Email Parsing) into the native mobile application.

## Quick Start for Developers

**Want to test the backend before mobile integration?**

1. Start backend: `npm run dev` (port 5000)
2. Open `test-interface.html` with Live Server (port 5500)
3. Test OCR: Upload a coupon screenshot
4. Test Gmail: Get OAuth token from [Google OAuth Playground](https://developers.google.com/oauthplayground/) and paste it

📖 **See full testing guide below** in the "Testing the Backend" section.

---

## Base Configuration

*   **Base URL:** `http://<your-backend-domain>/api/features`
*   **Content-Type:** `application/json`

---

## Testing the Backend (For Developers)

Before integrating into your mobile app, you can test the backend API endpoints using the provided `test-interface.html` file.

### **Prerequisites**

1. **Backend Server Running:**
   ```bash
   cd Backend
   npm install
   npm run dev
   ```
   - Server should start on `http://localhost:5000`
   - Check terminal for "Server running on port 5000"

2. **VS Code Live Server Extension** (or any local web server):
   - Install "Live Server" extension in VS Code
   - Or use: `npx http-server -p 5500`

3. **Environment Variables Configured:**
   - Ensure `.env` file has:
     ```
     GEMINI_API_KEY=your_gemini_api_key_here
     MONGODB_URI=mongodb://localhost:27017/dealora
     ```

4. **MongoDB Running:**
   ```bash
   # Start MongoDB service
   mongod
   ```

5. **OAuth Access Token** (for Gmail sync testing):
   - Get a temporary token from [Google OAuth Playground](https://developers.google.com/oauthplayground/)
   - Steps:
     1. Go to OAuth 2.0 Playground
     2. Click settings (⚙️) → Check "Use your own OAuth credentials"
     3. Enter your Web Client ID and Secret
     4. Select scope: `https://www.googleapis.com/auth/gmail.readonly`
     5. Click "Authorize APIs"
     6. Click "Exchange authorization code for tokens"
     7. Copy the **Access Token**

### **How to Use test-interface.html**

1. **Open the test interface:**
   - Right-click `test-interface.html` in VS Code
   - Select "Open with Live Server"
   - Browser opens at: `http://127.0.0.1:5500/test-interface.html`

2. **Test OCR Screenshot Parsing:**
   - Click "Click to Upload Screenshot" in the left card
   - Select a coupon image (JPG, PNG)
   - Click "Extract Coupon from Image" button
   - Wait 5-10 seconds for AI processing
   - Result appears below showing extracted coupon data

3. **Test Gmail Coupon Sync:**
   - In the right card, paste your OAuth Access Token
   - Click "Connect Gmail & Scan" button
   - Backend fetches promotional emails from last 2 days
   - Processes all emails through Gemini AI (30s timeout per email)
   - Result shows: total found, extracted count, skipped, errors
   - Extracted coupons appear in the results section

4. **Check Backend Logs:**
   - Monitor the terminal where `npm run dev` is running
   - You'll see:
     ```
     [info]: Fetching emails from Gmail API (last 2 days)...
     [info]: Found 35 messages. Processing all emails one-by-one through AI...
     [info]: Successfully extracted coupon from email abc123
     ```

5. **View Extraction History:**
   - Click "Load OCR History" to see previously processed screenshots
   - Click "Load Email History" to see coupons from Gmail sync
   - Both fetch from MongoDB

### **Troubleshooting**

| Issue | Solution |
|-------|----------|
| "Failed to fetch" error | Ensure backend is running on port 5000 |
| "Port 5000 already in use" | Kill process: `npx kill-port 5000` or `lsof -ti:5000 \| xargs kill -9` |
| "401 Unauthorized" (Gmail) | Access token expired - get a fresh one from OAuth Playground |
| "429 Rate Limit" (AI) | Gemini free tier limit hit - wait 60s or use paid plan |
| No coupons extracted | Emails might not contain coupon keywords (discount, code, deal, offer) |
| MongoDB connection error | Start MongoDB: `mongod` or check `MONGODB_URI` in `.env` |

### **Important Notes**

- **Date Range:** Gmail sync fetches from last **2 days** (change in `featureController.js` line ~145)
- **Processing:** All found emails are processed sequentially with 30s timeout per email
- **Keyword Filter:** Emails without keywords (discount, code, coupon, deal) are skipped
- **Rate Limits:** Gemini free tier = ~20 requests/day per model; backend rotates between models
- **Timeouts:** Each email processing has 30s timeout to prevent server hanging

---

## 1. OCR Screenshot Parsing

Used when a user uploads a screenshot of a coupon to extract details automatically.

### **Endpoint:** `POST /ocr`

#### **Request Body:**

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `image` | `string` | **Yes** | Base64 encoded string of the image. Can include or exclude the `data:image/jpeg;base64,` prefix. |
| `userId` | `string` | No | ID of the user uploading the coupon. |

**Example JSON Payload:**
```json
{
  "image": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAA...",
  "userId": "user_123456"
}
```

#### **Response (Success - 201 Created):**
```json
{
  "success": true,
  "message": "Coupon processed from OCR successfully",
  "data": {
    "_id": "65c3f...",
    "brandName": "Swiggy",
    "couponCode": "SWIGGY20",
    "discountValue": 20,
    "discountType": "percentage",
    "expireBy": "2026-01-15T00:00:00.000Z",
    "description": "20% OFF on Swiggy orders Max Discount: 150",
    "sourceWebsite": "OCR Upload",
    "status": "active"
    // ...other coupon fields
  },
  "confidence": 0.92
}
```

#### **Response (Error):**
*   **400 Bad Request:** Missing image data.
*   **409 Conflict:** Duplicate coupon detected (returns existing coupon in `data`).
*   **500 Server Error:** AI extraction failed.

---

## 2. Gmail Auto-Sync (Production Implementation)

### **Native App OAuth Flow**

To implement Gmail sync in your React Native app:

#### **Step 1: Install Dependencies**
```bash
npm install @react-native-google-signin/google-signin
# or
yarn add @react-native-google-signin/google-signin
```

#### **Step 2: Configure Google OAuth (Detailed Guide)**

##### **A. Create Google Cloud Project**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Sign in with your Google account
3. Click **"Select a project"** dropdown at the top
4. Click **"NEW PROJECT"** button
5. Enter project name (e.g., "Dealora App")
6. Click **"CREATE"**
7. Wait for project creation (few seconds)
8. Make sure your new project is selected in the dropdown

##### **B. Enable Gmail API**
1. In the left sidebar, click **"APIs & Services"** → **"Library"**
2. In the search bar, type **"Gmail API"**
3. Click on **"Gmail API"** from results
4. Click the blue **"ENABLE"** button
5. Wait for it to enable (you'll see "API enabled" message)

##### **C. Configure OAuth Consent Screen**
1. Go to **"APIs & Services"** → **"OAuth consent screen"** (left sidebar)
2. Select **"External"** user type (unless you have Google Workspace)
3. Click **"CREATE"**
4. Fill in required fields:
   - **App name**: "Dealora" (your app name)
   - **User support email**: Your email
   - **Developer contact email**: Your email
5. Click **"SAVE AND CONTINUE"**
6. On "Scopes" page, click **"ADD OR REMOVE SCOPES"**
7. In the filter box, search for **"Gmail API"**
8. Check the box for: **"https://www.googleapis.com/auth/gmail.readonly"**
9. Click **"UPDATE"** at bottom
10. Click **"SAVE AND CONTINUE"**
11. On "Test users" page (if in testing mode):
    - Click **"+ ADD USERS"**
    - Enter Gmail addresses that will test the app
    - Click **"ADD"**
    - Click **"SAVE AND CONTINUE"**
12. Review summary and click **"BACK TO DASHBOARD"**

##### **D. Create OAuth Client ID (Android)**
1. Go to **"APIs & Services"** → **"Credentials"**
2. Click **"+ CREATE CREDENTIALS"** → **"OAuth client ID"**
3. Select **"Android"** as application type
4. Enter:
   - **Name**: "Dealora Android App"
   - **Package name**: Your app's package (e.g., `com.dealora.app`)
   - **SHA-1 certificate fingerprint**: (see below how to get this)

**How to Get SHA-1 Certificate:**
```bash
# For Debug (Development)
cd android
./gradlew signingReport

# Look for "SHA1" under "Variant: debug"
# Copy the value (looks like: A1:B2:C3:...)
```

5. Click **"CREATE"**
6. You'll see a success popup - click **"OK"**

##### **E. Create OAuth Client ID (iOS)**
1. Click **"+ CREATE CREDENTIALS"** → **"OAuth client ID"** again
2. Select **"iOS"** as application type
3. Enter:
   - **Name**: "Dealora iOS App"
   - **Bundle ID**: Your iOS bundle ID (e.g., `com.dealora.app`)
4. Click **"CREATE"**
5. Click **"OK"** on success popup

##### **F. Create Web Client ID (Required for React Native)**
1. Click **"+ CREATE CREDENTIALS"** → **"OAuth client ID"** again
2. Select **"Web application"** as application type
3. Enter:
   - **Name**: "Dealora Web Client"
4. Click **"CREATE"**
5. **IMPORTANT**: Copy the **"Client ID"** shown (starts with `xxxxx.apps.googleusercontent.com`)
6. Save this - you'll need it in your React Native app configuration
7. Click **"OK"**

##### **G. Download Configuration Files** (Optional but recommended)
1. On the Credentials page, find your OAuth 2.0 Client IDs
2. For Android client: Click download icon (↓) → saves `google-services.json`
3. Place `google-services.json` in `android/app/` folder of your React Native project

##### **H. Note Your Credentials**
From the **Credentials** page, you should now have:
- ✅ Android OAuth Client (with SHA-1)
- ✅ iOS OAuth Client (with Bundle ID)
- ✅ Web Client ID (for React Native config)

**Copy the Web Client ID** - it looks like:
```
123456789012-abcdefghijklmnop.apps.googleusercontent.com
```

You'll use this in Step 3.

#### **Step 3: Initialize in App**
```javascript
import { GoogleSignin } from '@react-native-google-signin/google-signin';

GoogleSignin.configure({
  scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
  webClientId: 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com',
});
```

#### **Step 4: Implement Connect Button**
```javascript
import { GoogleSignin } from '@react-native-google-signin/google-signin';

async function connectGmail() {
  try {
    // Check if Gmail API is available
    await GoogleSignin.hasPlayServices();
    
    // Sign in and request Gmail scope
    const userInfo = await GoogleSignin.signIn();
    
    // Get access token
    const tokens = await GoogleSignin.getTokens();
    const accessToken = tokens.accessToken;
    
    // Call your backend API
    const response = await fetch('https://your-api.com/api/features/gmail-sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${yourUserToken}` // If using auth
      },
      body: JSON.stringify({
        accessToken: accessToken,
        userId: userInfo.user.id
      })
    });
    
    const result = await response.json();
    console.log(`Found ${result.totalFound} emails, extracted ${result.extractedCount} coupons!`);
    
  } catch (error) {
    console.error('Gmail connection failed:', error);
  }
}
```

#### **Step 5: UI Example**
```jsx
<TouchableOpacity onPress={connectGmail}>
  <Text>Connect Gmail & Scan for Coupons</Text>
</TouchableOpacity>
```

---

### **Backend Endpoint:** `POST /gmail-sync`

#### **Request Body:**
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `accessToken` | `string` | **Yes** | OAuth2 Access Token from Google Sign-In |
| `userId` | `string` | No | User ID from your app |

**Example:**
```json
{
  "accessToken": "ya29.a0AfB_byIB...",
  "userId": "user_123456"
}
```

#### **Response (Success - 200):**
```json
{
  "success": true,
  "message": "Found 35 emails (last 2 days). Processed all 35 emails, extracted 3 coupons. 28 skipped (no coupon keywords), 4 errors.",
  "totalFound": 35,
  "processedCount": 35,
  "extractedCount": 3,
  "skippedCount": 28,
  "errorCount": 4,
  "coupons": [
    {
      "brandName": "Amazon",
      "couponCode": "AMAZ200",
      "discountType": "flat",
      "discountValue": 200,
      "expireBy": "2026-01-20T00:00:00.000Z",
      "sourceWebsite": "Email Parsing",
      "status": "active"
    },
    {
      "brandName": "Flipkart",
      "couponCode": "FLIP50",
      "discountType": "percentage",
      "discountValue": 50,
      "expireBy": "2026-02-15T00:00:00.000Z",
      "sourceWebsite": "Email Parsing",
      "status": "active"
    }
  ]
}
```

**Response Fields:**
- `totalFound`: Total promotional emails found in Gmail (last 2 days)
- `processedCount`: Number of emails processed through AI
- `extractedCount`: Successfully extracted and saved coupons
- `skippedCount`: Emails skipped (no coupon-related keywords)
- `errorCount`: Emails that failed processing
- `coupons`: Array of extracted coupon objects

**Important Notes:**
- Fetches emails from **last 2 days** by default (configurable in code)
- Processes **ALL found emails** sequentially
- Each email has **30-second timeout** to prevent hanging
- Emails without coupon keywords (discount, code, deal, etc.) are skipped
- Duplicate coupons are silently ignored

#### **Error Responses:**
- **400**: Missing access token
- **403**: Invalid/expired token
- **500**: Server error

---

### **Token Refresh (Important)**
Access tokens expire after 1 hour. Implement refresh logic:

```javascript
async function refreshToken() {
  const tokens = await GoogleSignin.getTokens();
  return tokens.accessToken; // Auto-refreshed by library
}
```

---

## 3. Extraction History

Retrieve coupons previously added via these AI methods.

### **Get OCR History**
*   **Endpoint:** `GET /ocr`
*   **Response:**
    ```json
    {
      "success": true,
      "count": 10,
      "data": [ ...array of coupon objects... ]
    }
    ```

### **Get Email History**
*   **Endpoint:** `GET /email`
*   **Response:**
    ```json
    {
      "success": true,
      "count": 5,
      "data": [ ...array of coupon objects... ]
    }
    ```

---

## 4. Service Status Check

Check if the AI service (Gemini) is online and configured.

*   **Endpoint:** `GET /status`
*   **Response:**
    ```json
    {
      "status": "online",
      "service": "Gemini Vision AI",
      "keyConfigured": true,
      "availableFeatures": ["OCR Screenshot", "Email Parsing"]
    }
    ```
