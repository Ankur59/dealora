# Coupon Viewer App

A standalone Android application that receives coupon information from external apps (specifically Dealora) via implicit intents and displays the coupon details.

## Setup Instructions

1.  Open this project in Android Studio.
2.  Sync Gradle files.
3.  Build and Run the application.

## Integration

To integrate with the source app (Dealora), please refer to [IntegrationGuide.md](IntegrationGuide.md) and the files in `integration_files/`.

## Testing

You can use ADB to test the intent handling:

```bash
adb shell am start -a com.ayaan.couponviewer.SHOW_COUPON \
  -e EXTRA_COUPON_CODE "GROOMING999" \
  -e EXTRA_BRAND_NAME "Bombay Shaving Company" \
  com.ayaan.couponviewer
```

## Features

- Displays coupon details.
- Auto-copy coupon code.
- Redeem via app or link.
- Share coupon.
