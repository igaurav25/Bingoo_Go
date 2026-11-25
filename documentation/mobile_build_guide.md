# BINGO CHAMPIONSHIP — MOBILE BUILD & RUN GUIDE
Target Platforms: Android Phones, iPhones, Android Tablets, iPads

---

## 1. Prerequisites

1. **Node.js**: v18+ or v20+ (tested with v24.19.0).
2. **Expo CLI**: Installed globally or via `npx expo`.
3. **EAS CLI** (for cloud builds):
   ```bash
   npm install -g eas-cli
   ```

---

## 2. Local Development & Simulator Run

Navigate to the `mobile/` directory:

```bash
cd mobile
```

### Run on Local Development Server:
```bash
npx expo start
```
This starts Metro bundler. Scan the QR code using the **Expo Go** app on your physical device, or press:
- `a` to open in Android Emulator.
- `i` to open in iOS Simulator.
- `w` to open in Web view.

---

## 3. Building Installable Binaries (EAS Build)

### Android APK / AAB:
1. Configure credentials and project:
   ```bash
   eas build:configure
   ```
2. Build Standalone Installable Android APK:
   ```bash
   eas build -p android --profile preview
   ```
3. Build Production Google Play Store App Bundle (`.aab`):
   ```bash
   eas build -p android --profile production
   ```

### iOS IPA / Simulator:
1. Build for iOS Simulator:
   ```bash
   eas build -p ios --profile simulator
   ```
2. Build Production Apple App Store IPA:
   ```bash
   eas build -p ios --profile production
   ```

---

## 4. Multi-Device Tablet Configuration

The application natively supports iPad and Android tablet layouts configured via `mobile/app.json`:
- `"supportsTablet": true` in iOS configuration.
- Responsive scaling using `Dimensions.get('window').width` ensures that on large screens (768px–1366px), game boards, standings tables, and tournament brackets automatically expand to utilize the full display width without clipping or distortion.
