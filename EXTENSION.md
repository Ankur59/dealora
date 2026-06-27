# Extension Coupon Filters & AI Verification Metrics

## Part 1: Extension Coupon Filters

These MongoDB filters are applied in the backend controller (`ai-coupon-engine/src/controllers/coupon.controller.js`) when retrieving coupons for the extension.

### Active Filters

```javascript
{
  code: { $ne: null },       // must have a coupon code
  isNewUser: false,           // exclude new-user-only coupons
  isInStore: false,           // exclude in-store-only coupons
  offerType: "Coupon",        // only coupons, not offers
  end: { $gt: new Date() }    // only non-expired coupons
}
```

### Filter Details

| Field | Filter Value | Description |
|---|---|---|
| `code` | `{ $ne: null }` | Excludes deals or offers without a promo code. |
| `isNewUser` | `false` | Filters out coupons limited to first-time users. |
| `isInStore` | `false` | Excludes physical in-store-only coupons. |
| `offerType` | `"Coupon"` | Ensures only coupon types are selected (excludes general cashback/offers). |
| `end` | `{ $gt: new Date() }` | Filters out expired coupons using the current timestamp. |

---

## Part 2: AI Verification Metrics

These metrics track the reliability and throughput of the AI Coupon Verification Agent, as shown in the Admin panel.

### Metric Snapshot

- **AI Verification Accuracy**: `77.78%`
- **Total Verifications**: `9`
- **Avg Attempts**: `1.44`
- **Manual Overrides**: `3`

### Code Implementation (`healthScore.service.js`)

#### 1. Total Verifications
Count of all records in the `CouponVerification` collection.
```javascript
const verifications = await CouponVerification.find({}).lean();
const total = verifications.length; // 9
```

#### 2. AI Verification Accuracy
Calculated by matching the AI status against human manual overrides. If an override contradicts the AI status, it is counted as incorrect (`wrongCount`).
```javascript
let wrongCount = 0;
for (const v of verifications) {
  if (v.manualOverride?.newStatus && v.manualOverride.newStatus !== v.status) {
    wrongCount++;
  }
}
const accuracy = total > 0
  ? Math.round(((total - wrongCount) / total) * 10000) / 100 // 77.78%
  : 100;
```

#### 3. Average Attempts
Calculated from the `attemptCount` field in the verification history.
```javascript
const avgAttempts = verifications.reduce((sum, v) => sum + (v.attemptCount || 1), 0) / total; // 1.44
```

#### 4. Manual Overrides
The count of verification records that were overridden by humans via the Admin Dashboard.
```javascript
const withOverride = verifications.filter(v => v.manualOverride?.newStatus);
const manualOverrideCount = withOverride.length; // 3
```

