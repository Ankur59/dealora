# React Native Gmail Integration Example

This is a complete example for integrating Gmail coupon scanning in your React Native app.

## Installation

```bash
npm install @react-native-google-signin/google-signin
```

## Configuration (Android)

### 1. Update `android/build.gradle`
```gradle
buildscript {
    ext {
        googlePlayServicesAuthVersion = "20.7.0"
    }
}
```

### 2. Get SHA-1 Certificate
```bash
cd android && ./gradlew signingReport
```

### 3. Google Cloud Console Setup
1. Go to https://console.cloud.google.com/
2. Create project → Enable Gmail API
3. Create OAuth 2.0 Client ID
4. Add SHA-1 and package name
5. Download `google-services.json` → place in `android/app/`

## Configuration (iOS)

### 1. Update `ios/Podfile`
```ruby
pod 'GoogleSignIn', '~> 7.0'
```

### 2. Run
```bash
cd ios && pod install
```

### 3. Add URL Scheme in `Info.plist`
```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>com.googleusercontent.apps.YOUR_CLIENT_ID</string>
    </array>
  </dict>
</array>
```

---

## Complete Component Example

```javascript
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

const GmailSyncScreen = () => {
  const [loading, setLoading] = useState(false);
  const [coupons, setCoupons] = useState([]);
  const [message, setMessage] = useState('');
  const [isSignedIn, setIsSignedIn] = useState(false);

  useEffect(() => {
    // Configure Google Sign-In
    GoogleSignin.configure({
      scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
      webClientId: 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com', // From Google Cloud Console
      offlineAccess: true,
    });

    // Check if already signed in
    checkSignInStatus();
  }, []);

  const checkSignInStatus = async () => {
    const isSignedIn = await GoogleSignin.isSignedIn();
    setIsSignedIn(isSignedIn);
  };

  const handleGmailSync = async () => {
    try {
      setLoading(true);
      setMessage('');
      setCoupons([]);

      // Step 1: Check Play Services
      await GoogleSignin.hasPlayServices();

      // Step 2: Sign in (or get current user if already signed in)
      let userInfo;
      if (!isSignedIn) {
        userInfo = await GoogleSignin.signIn();
        setIsSignedIn(true);
      } else {
        userInfo = await GoogleSignin.getCurrentUser();
      }

      // Step 3: Get fresh access token
      const tokens = await GoogleSignin.getTokens();
      
      // Step 4: Call backend API
      const API_URL = 'http://your-backend-url.com/api/features/gmail-sync';
      
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accessToken: tokens.accessToken,
          userId: userInfo.user.id
        })
      });

      const result = await response.json();

      if (result.success) {
        setMessage(result.message);
        setCoupons(result.coupons || []);
      } else {
        setMessage(`Error: ${result.message}`);
      }

    } catch (error) {
      console.error('Gmail sync error:', error);
      setMessage(`Failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await GoogleSignin.signOut();
      setIsSignedIn(false);
      setCoupons([]);
      setMessage('');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Gmail Coupon Sync</Text>
      
      <Text style={styles.description}>
        Connect your Gmail to automatically scan for promotional emails and extract coupons.
      </Text>

      {!isSignedIn ? (
        <TouchableOpacity 
          style={styles.gmailButton} 
          onPress={handleGmailSync}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.gmailIcon}>G</Text>
              <Text style={styles.buttonText}>Connect Gmail</Text>
            </>
          )}
        </TouchableOpacity>
      ) : (
        <View>
          <TouchableOpacity 
            style={styles.scanButton} 
            onPress={handleGmailSync}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Scan for Coupons</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.signOutButton} 
            onPress={handleSignOut}
          >
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      )}

      {message ? (
        <View style={styles.messageBox}>
          <Text style={styles.messageText}>{message}</Text>
        </View>
      ) : null}

      {coupons.length > 0 && (
        <ScrollView style={styles.couponList}>
          <Text style={styles.couponTitle}>Found Coupons:</Text>
          {coupons.map((coupon, index) => (
            <View key={index} style={styles.couponCard}>
              <Text style={styles.couponBrand}>{coupon.brandName}</Text>
              <Text style={styles.couponCode}>{coupon.couponCode}</Text>
              <Text style={styles.couponDiscount}>
                {coupon.discountType === 'percentage' 
                  ? `${coupon.discountValue}% OFF` 
                  : `₹${coupon.discountValue} OFF`}
              </Text>
              <Text style={styles.couponExpiry}>
                Valid till: {new Date(coupon.expireBy).toLocaleDateString()}
              </Text>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  gmailButton: {
    backgroundColor: '#db4437',
    padding: 15,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanButton: {
    backgroundColor: '#4285F4',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  gmailIcon: {
    fontSize: 20,
    color: '#fff',
    fontWeight: 'bold',
    marginRight: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  signOutButton: {
    padding: 10,
    alignItems: 'center',
  },
  signOutText: {
    color: '#666',
    fontSize: 14,
  },
  messageBox: {
    backgroundColor: '#e8f5e9',
    padding: 15,
    borderRadius: 8,
    marginTop: 20,
  },
  messageText: {
    color: '#2e7d32',
    fontSize: 14,
  },
  couponList: {
    marginTop: 20,
  },
  couponTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  couponCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  couponBrand: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  couponCode: {
    fontSize: 18,
    color: '#4285F4',
    fontWeight: 'bold',
    marginTop: 5,
  },
  couponDiscount: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  couponExpiry: {
    fontSize: 12,
    color: '#999',
    marginTop: 5,
  },
});

export default GmailSyncScreen;
```

---

## Error Handling

```javascript
const handleGmailSync = async () => {
  try {
    // ... sync logic
  } catch (error) {
    if (error.code === statusCodes.SIGN_IN_CANCELLED) {
      console.log('User cancelled sign in');
    } else if (error.code === statusCodes.IN_PROGRESS) {
      console.log('Sign in already in progress');
    } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      console.log('Play services not available');
    } else {
      console.error('Unknown error:', error);
    }
  }
};
```

---

## Token Auto-Refresh

The `@react-native-google-signin/google-signin` library automatically handles token refresh. Just call:

```javascript
const tokens = await GoogleSignin.getTokens();
// Library will refresh if expired
```

---

## Testing

Use a test Gmail account with promotional emails for testing. The backend will scan the last 15 promotional emails.
