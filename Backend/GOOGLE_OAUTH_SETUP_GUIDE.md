# Complete Google OAuth Setup Guide for Gmail Integration
## Step-by-Step Tutorial for Beginners

This guide will walk you through setting up Google OAuth for the Dealora Gmail integration feature, even if you've never used Google Cloud Console before.

---

## 📋 Prerequisites

Before starting, make sure you have:
- ✅ A Google account (Gmail)
- ✅ Your React Native app package name (e.g., `com.dealora.app`)
- ✅ Admin access to your development machine

---

## Part 1: Google Cloud Console Setup

### Step 1: Access Google Cloud Console

1. Open your browser and go to: [https://console.cloud.google.com/](https://console.cloud.google.com/)
2. Sign in with your Google account (the one you want to manage the project)
3. If prompted about terms of service, accept them

**What you'll see:**
- A blue navigation bar at the top
- A sidebar on the left with menu items
- A main dashboard area

---

### Step 2: Create a New Project

1. **Find the project selector:**
   - Look at the top bar, near the left
   - You'll see "Google Cloud" logo, then a dropdown that says "Select a project" or shows a project name

2. **Open the project selector:**
   - Click on that dropdown
   - A popup will appear showing existing projects (if any)

3. **Create new project:**
   - Click the **"NEW PROJECT"** button in the top-right of the popup
   - A new page will open

4. **Fill in project details:**
   - **Project name**: Enter "Dealora" (or your app name)
   - **Organization**: Leave as "No organization" (unless you have a company account)
   - **Location**: Leave as default
   - Click **"CREATE"** button (bottom of form)

5. **Wait for creation:**
   - You'll see a notification bell icon in the top-right
   - Wait 5-10 seconds for the project to be created
   - You'll get a notification saying "Project created"

6. **Verify project is selected:**
   - Look at the project selector dropdown again
   - It should now show "Dealora" (your project name)

---

### Step 3: Enable Gmail API

**Why?** Your app needs permission to access Gmail data. Enabling the API gives your project that capability.

1. **Navigate to API Library:**
   - Look at the left sidebar
   - Click **"APIs & Services"** (has an icon that looks like a puzzle piece)
   - In the submenu, click **"Library"**

2. **Search for Gmail API:**
   - You'll see a search bar at the top
   - Type: `Gmail API`
   - Press Enter or click the search icon

3. **Select Gmail API:**
   - From the search results, click on **"Gmail API"**
   - It has a red/white envelope icon

4. **Enable the API:**
   - You'll see a blue **"ENABLE"** button
   - Click it
   - Wait a few seconds
   - The button will change to "MANAGE" and you'll see "API enabled" message

✅ **Gmail API is now enabled for your project!**

---

### Step 4: Configure OAuth Consent Screen

**Why?** This is the screen users will see when they click "Connect Gmail" in your app.

1. **Navigate to OAuth consent screen:**
   - In the left sidebar, click **"APIs & Services"** → **"OAuth consent screen"**

2. **Choose user type:**
   - You'll see two options: **Internal** and **External**
   - Select **"External"** (unless you have a Google Workspace account)
   - Click **"CREATE"** button

3. **Fill OAuth consent screen (Page 1 - App information):**

   **Required fields:**
   - **App name**: `Dealora` (your app name that users will see)
   - **User support email**: Select your email from dropdown
   - **App logo**: (Optional - skip for now, you can add later)

   **App domain** (Optional - can skip for testing):
   - Application home page: Leave blank for now
   - Privacy policy: Leave blank
   - Terms of service: Leave blank

   **Authorized domains** (Optional - skip for testing)

   **Developer contact information:**
   - Enter your email address

   - Click **"SAVE AND CONTINUE"** (bottom of page)

4. **Configure Scopes (Page 2):**

   - You're now on the "Scopes" page
   - Click **"ADD OR REMOVE SCOPES"** button
   - A panel will slide in from the right

   **In the scope selector:**
   - Find the filter/search box at the top
   - Type: `gmail`
   - Look for scope: `https://www.googleapis.com/auth/gmail.readonly`
   - Description will say: "Read all resources and their metadata..."
   - **Check the checkbox** next to it
   - Click **"UPDATE"** button at the bottom of the panel

   - You'll return to the Scopes page
   - You should see 1 scope listed under "Your sensitive scopes"
   - Click **"SAVE AND CONTINUE"**

5. **Add Test Users (Page 3):**

   **Note:** While your app is in "Testing" status, only these users can use Gmail login.

   - Click **"+ ADD USERS"** button
   - Enter email addresses of people who will test (one per line):
     ```
     your.email@gmail.com
     tester1@gmail.com
     tester2@gmail.com
     ```
   - Click **"ADD"**
   - Click **"SAVE AND CONTINUE"**

6. **Review Summary (Page 4):**
   - Review all information
   - Click **"BACK TO DASHBOARD"**

✅ **OAuth Consent Screen is configured!**

---

### Step 5: Get Your Android SHA-1 Certificate

**Why?** Google needs this to verify that requests are coming from your app.

#### For Development (Debug Key):

1. **Open Terminal/Command Prompt**

2. **Navigate to your project:**
   ```bash
   cd path/to/your/project
   cd android
   ```

3. **Run signing report:**

   **On Mac/Linux:**
   ```bash
   ./gradlew signingReport
   ```

   **On Windows:**
   ```bash
   gradlew.bat signingReport
   ```

4. **Find SHA-1:**
   - Look for section: `Variant: debug`
   - Under it, find: `SHA1: A1:B2:C3:D4:E5:...`
   - Copy this entire SHA-1 value
   - Example: `A1:B2:C3:D4:E5:F6:01:23:45:67:89:AB:CD:EF:12:34:56:78:9A:BC`

5. **Save it somewhere** (Notepad, Notes app) - you'll need it in the next step

#### Alternative Method (If Gradle fails):

**On Mac:**
```bash
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
```

**On Windows:**
```bash
keytool -list -v -keystore "%USERPROFILE%\.android\debug.keystore" -alias androiddebugkey -storepass android -keypass android
```

---

### Step 6: Create OAuth Client ID for Android

1. **Navigate to Credentials:**
   - Left sidebar: **"APIs & Services"** → **"Credentials"**

2. **Create new credential:**
   - Click **"+ CREATE CREDENTIALS"** (near the top)
   - Select **"OAuth client ID"** from the dropdown

3. **Select application type:**
   - Choose **"Android"** from the dropdown

4. **Fill in Android details:**

   **Name:**
   ```
   Dealora Android Client
   ```

   **Package name:**
   - This is from your `android/app/build.gradle` file
   - Look for: `applicationId "com.yourcompany.yourapp"`
   - Example: `com.dealora.app`

   **SHA-1 certificate fingerprint:**
   - Paste the SHA-1 value you copied in Step 5
   - Example: `A1:B2:C3:D4:E5:F6:01:23:45:67:89:AB:CD:EF:12:34:56:78:9A:BC`

5. **Create:**
   - Click **"CREATE"** button
   - You'll see a popup: "OAuth client created"
   - Click **"OK"**

✅ **Android OAuth Client created!**

---

### Step 7: Create OAuth Client ID for iOS

1. **Create another credential:**
   - Click **"+ CREATE CREDENTIALS"** again
   - Select **"OAuth client ID"**

2. **Select application type:**
   - Choose **"iOS"** from the dropdown

3. **Fill in iOS details:**

   **Name:**
   ```
   Dealora iOS Client
   ```

   **Bundle ID:**
   - Found in Xcode → Select project → General → Bundle Identifier
   - Or in `ios/YourApp/Info.plist` → `CFBundleIdentifier`
   - Example: `com.dealora.app`

4. **Create:**
   - Click **"CREATE"**
   - Click **"OK"** on success popup

✅ **iOS OAuth Client created!**

---

### Step 8: Create Web Client ID (Critical!)

**Important:** React Native uses the Web Client ID for authentication configuration.

1. **Create web credential:**
   - Click **"+ CREATE CREDENTIALS"** once more
   - Select **"OAuth client ID"**

2. **Select application type:**
   - Choose **"Web application"** from the dropdown

3. **Fill in web details:**

   **Name:**
   ```
   Dealora Web Client
   ```

   **Authorized JavaScript origins:**
   - Leave blank for now

   **Authorized redirect URIs:**
   - Leave blank for now

4. **Create:**
   - Click **"CREATE"**

5. **COPY YOUR CLIENT ID:**
   - You'll see a popup with:
     - **Your Client ID**: `123456789012-abcdefghijklmnop.apps.googleusercontent.com`
     - **Your Client Secret**: (you don't need this for mobile)

   **⚠️ IMPORTANT: Copy and save the Client ID!**
   - Click the copy icon next to Client ID
   - Save it in a text file
   - You'll need this in your React Native code

6. **Close popup:**
   - Click **"OK"**

✅ **Web Client created! You now have the Client ID!**

---

### Step 9: Download google-services.json (Android)

1. **Find your credentials:**
   - On the Credentials page
   - Look for list of "OAuth 2.0 Client IDs"

2. **Download Android config:**
   - Find your Android client (e.g., "Dealora Android Client")
   - Look for download icon (↓) on the right side
   - Click it
   - File `google-services.json` will download

3. **Place in your project:**
   - Move `google-services.json` to: `your-project/android/app/`
   - Replace if one already exists

---

## Part 2: React Native Configuration

### Step 10: Install Package

Open Terminal in your React Native project:

```bash
npm install @react-native-google-signin/google-signin
```

Or with Yarn:

```bash
yarn add @react-native-google-signin/google-signin
```

---

### Step 11: Configure Android

1. **Add google-services plugin:**

   Edit `android/build.gradle`:
   ```gradle
   buildscript {
       dependencies {
           // Add this line
           classpath 'com.google.gms:google-services:4.3.15'
       }
   }
   ```

2. **Apply plugin:**

   Edit `android/app/build.gradle` (bottom of file):
   ```gradle
   apply plugin: 'com.google.gms.google-services'
   ```

3. **Sync Gradle:**
   ```bash
   cd android
   ./gradlew clean
   cd ..
   ```

---

### Step 12: Configure iOS

1. **Install pods:**
   ```bash
   cd ios
   pod install
   cd ..
   ```

2. **Add URL scheme to Info.plist:**

   Edit `ios/YourApp/Info.plist`:
   ```xml
   <key>CFBundleURLTypes</key>
   <array>
     <dict>
       <key>CFBundleURLSchemes</key>
       <array>
         <!-- Replace with YOUR Web Client ID reversed -->
         <string>com.googleusercontent.apps.123456789012-abcdefghijklmnop</string>
       </array>
     </dict>
   </array>
   ```

   **How to get reversed client ID:**
   - Take your Web Client ID: `123456789012-abcdefghijklmnop.apps.googleusercontent.com`
   - Reverse it: `com.googleusercontent.apps.123456789012-abcdefghijklmnop`

---

### Step 13: Initialize in Your App

In your React Native app (e.g., `App.js`):

```javascript
import { GoogleSignin } from '@react-native-google-signin/google-signin';

GoogleSignin.configure({
  webClientId: '123456789012-abcdefghijklmnop.apps.googleusercontent.com', // FROM STEP 8
  scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
  offlineAccess: true,
});
```

**Replace `123456789012-abcdefghijklmnop.apps.googleusercontent.com` with YOUR Web Client ID from Step 8!**

---

## Part 3: Testing

### Step 14: Test the Integration

1. **Start your app:**
   ```bash
   npx react-native run-android
   # or
   npx react-native run-ios
   ```

2. **Try signing in:**
   - Use the code from `REACT_NATIVE_EXAMPLE.md`
   - Click "Connect Gmail"
   - Google sign-in popup should appear
   - Select your test account (from Step 4)
   - Grant permissions

3. **Check logs:**
   - If successful, you'll get an access token
   - If error, check:
     - SHA-1 matches
     - Package name matches
     - Web Client ID is correct

---

## ⚠️ Common Issues

### Issue 1: "Developer Error" or "10: error"
**Solution:**
- SHA-1 fingerprint doesn't match
- Re-run `./gradlew signingReport` and copy SHA-1 again
- Update in Google Cloud Console → Credentials → Edit Android client

### Issue 2: "Web Client ID of type 3 is required"
**Solution:**
- You didn't create the Web Client ID (Step 8)
- Or you used wrong Client ID in `GoogleSignin.configure()`

### Issue 3: "Access not configured"
**Solution:**
- Gmail API not enabled (go back to Step 3)

### Issue 4: "This app isn't verified"
**Solution:**
- Normal for testing mode
- Click "Advanced" → "Go to Dealora (unsafe)"
- For production, you need to verify your app (separate process)

---

## ✅ Checklist

Before finishing, verify you have:

- [ ] Created Google Cloud project
- [ ] Enabled Gmail API
- [ ] Configured OAuth consent screen
- [ ] Created Android OAuth client with SHA-1
- [ ] Created iOS OAuth client with Bundle ID
- [ ] Created Web OAuth client and copied Client ID
- [ ] Downloaded `google-services.json` (Android)
- [ ] Installed npm package
- [ ] Configured `GoogleSignin.configure()` with Web Client ID
- [ ] Added Info.plist entry (iOS)
- [ ] Applied google-services plugin (Android)
- [ ] Tested sign-in flow

---

## 📝 Save These Values

Keep these values safe - you'll need them:

```
Project Name: Dealora
Project ID: dealora-xxxxx

Web Client ID: 
xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com

Android Package: 
com.yourcompany.yourapp

iOS Bundle ID:
com.yourcompany.yourapp

SHA-1 (Debug):
A1:B2:C3:...
```

---

## 🎉 Done!

Your Gmail OAuth integration is now set up! Users can connect their Gmail accounts and your backend will scan for coupon emails automatically.

Need help? Check:
- `API_INTEGRATION_GUIDE.md` for backend API details
- `REACT_NATIVE_EXAMPLE.md` for complete code example
