# Retail Mobile (React Native)

Android-focused retail mobile app with:
- Barcode scanner
- Product lookup by barcode
- Product field editing (price/sell price/stock inventory and related fields)

No sales/cart/checkout screen is included.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Set API base URL (required for real device):

```bash
# PowerShell
$env:EXPO_PUBLIC_POS_API_URL="http://YOUR_PC_IP:4000"
```

Notes:
- Android emulator default is `http://10.0.2.2:4000`.
- iOS simulator default is `http://127.0.0.1:4000`.

3. Start app:

```bash
npm run start
```

4. Run on Android:

```bash
npm run android
```
