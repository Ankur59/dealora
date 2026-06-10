# Extension Coupon Filters

These MongoDB filters are applied in the backend controller (`ai-coupon-engine/src/controllers/coupon.controller.js`) when retrieving coupons for the extension.

## Active Filters

```javascript
{
  code: { $ne: null },       // must have a coupon code
  isNewUser: false,           // exclude new-user-only coupons
  isInStore: false,           // exclude in-store-only coupons
  offerType: "Coupon",        // only coupons, not offers
  end: { $gt: new Date() }    // only non-expired coupons
}
```

## Details

| Field | Filter Value | Description |
|---|---|---|
| `code` | `{ $ne: null }` | Excludes deals or offers without a promo code. |
| `isNewUser` | `false` | Filters out coupons limited to first-time users. |
| `isInStore` | `false` | Excludes physical in-store-only coupons. |
| `offerType` | `"Coupon"` | Ensures only coupon types are selected (excludes general cashback/offers). |
| `end` | `{ $gt: new Date() }` | Filters out expired coupons using the current timestamp. |
