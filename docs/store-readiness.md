# Store Readiness & Policy Compliance: "Copy Ke Last Page Wala Bingo"

## 1. App Summary & Metadata
- **App Name**: Bingo — Copy Ke Last Page Wala Bingo
- **Package ID**: `com.bingo.lastpage`
- **Short Name**: Bingo
- **Category**: Games > Board / Word / Casual
- **Target Audience**: Everyone (PEGI 3, ESRB Everyone, IARC 3+)
- **Primary Languages**: English (en), Hindi (hi)

---

## 2. Policy Declarations (Google Play & Apple App Store)

### 2.1 Gambling & Real Money Wagering Policy (0% Real Money / 0% Simulated Gambling)
- **Zero Real Money**: The app does not facilitate, support, or allow real-money wagering, real prizes, cash payouts, betting, or fiat transfers of any kind.
- **Zero In-App Currency**: There are no virtual chips, coin packages, or loot boxes purchased with real currency.
- **Zero Simulated Gambling**: The game mechanics are 100% faithful to the authentic school notebook paper game ("copy ke last page wala Bingo" with numbers 1 to 25 and pencil/pen marks). There are no slot reels, roulette wheels, card betting, or casino metaphors.

### 2.2 Content & Communication Safety
- **No Free-Text Chat**: To eliminate cyberbullying, profanity, predatory behavior, and hate speech without requiring intrusive moderation surveillance, players interact exclusively through pre-set tactical emojis / reactions and automated game announcements.
- **Child & Family Friendly**: Complies with COPPA and Google Play Families Policy. No personal information is gathered from minors.

### 2.3 Data Safety & Privacy
- **Account-Free Play**: Users do not need an account or login to play.
- **Data Collected**:
  - `Nickname`: User-chosen handle stored locally in `localStorage`.
  - `Avatar Identifier`: Preset avatar ID (e.g. `fox`, `tiger`, `panda`).
  - `Match Telemetry`: Ephemeral in-memory match events on the server (`eventSeq`, marked numbers) discarded after match termination.
- **Data Not Collected**:
  - No email addresses, phone numbers, contacts, device IDs, GPS coordinates, or biometric data.
- **User Right to Delete / Data Erasure**:
  - In-app "Clear Data / Reset Profile" button under Settings instantly wipes `localStorage` and all cached client data.
  - An HTTP endpoint `POST /api/user/clear-data` provides server-side deletion confirmation if persistent profiles are used.

### 2.4 Advertising & Monetization
- **In-Match Ads**: None. Matches are completely free of interruption, pop-ups, banner obstruction, and interstitials.
- **Tracking**: Zero 3rd-party ad trackers or fingerprinting scripts.

---

## 3. Native Wrapper Instructions (Capacitor / Android TWA)

### 3.1 Architecture
The web application is the single source of truth (`public/`). The native Android shell wraps the tested, responsive web app using `@capacitor/core` and `@capacitor/android` without codebase divergence.

### 3.2 Prerequisites
- Node.js >= 18
- Android Studio Ladybug or newer
- JDK 17+
- Android SDK Platform 34+

### 3.3 Build Commands
```bash
# 1. Install Capacitor CLI & dependencies
npm install @capacitor/core @capacitor/android @capacitor/cli --save-dev

# 2. Build production React and CSS bundles
node build.js

# 3. Initialize or sync the Android project
npx cap add android # Run once
npx cap sync android

# 4. Open in Android Studio
npx cap open android

# 5. Generate Signed Android App Bundle (AAB) for Play Store:
# In Android Studio: Build > Generate Signed Bundle / APK > Android App Bundle
# Output location: android/app/release/app-release.aab
```

---

## 4. Performance & Quality Budgets Verification
- **App Shell Size**: Initial JS bundle <= 180 KB gzipped.
- **Performance Budget**: Target >= 90 on Lighthouse Mobile over 4G emulation.
- **Touch Targets**: All buttons, pills, and grid cells have minimum touch targets >= 48px - 52px.
- **Offline Reliability**: Tested offline screen (`/offline.html`) and service worker app shell caching.
