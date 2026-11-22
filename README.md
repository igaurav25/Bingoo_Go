# 🎱 Bingoo Goo — Classic Notebook-Style Bingo Multiplayer

> **A real-time, cross-device 2D Bingo game inspired by traditional school notebook battles, wrapped in a rich "Notebook on a Night Desk" theme.**

Play live with a friend across two phones or computers on any network (Wi-Fi or mobile data) with a single link or a 5-character code. No login, no app store install, and zero personal data collected.

---

## 🌟 Key Highlights

### 1. Classic Notebook Line-Cutting System (Part 1)
- **Continuous Line Strokes**: Completing a row or column triggers **exactly ONE** smooth, continuous slanted red pen stroke ($450\text{ ms}$ ease-out, $120\text{ ms}$ settle) drawn end-to-end across the entire line.
- **Ink Stamp Numbers**: Marked numbers receive a non-strike translucent blue ink stamp circle (`#2946D9`), preserving classic notebook play where numbers are marked, not slashed.
- **Sequential B-I-N-G-O Strikes**: Line completions map directly to the word header:
  - 1st Line $\to$ **B**
  - 2nd Line $\to$ **I**
  - 3rd Line $\to$ **N**
  - 4th Line $\to$ **G**
  - 5th Line $\to$ **O**
  Strokes are drawn dynamically across real glyph bounding boxes with a crisp 10% overshoot.
- **Central BINGO Button**: Positioned directly below the 5×5 grid. Remains locked with an ink-gray outline until the server confirms 5 valid lines, then ignites into an energetic golden gradient glow (`#FFC83D` $\to$ `#FF9F1C`).
- **Server Authority**: Line detection, letter strikes, turn legality, and victory claims are 100% server-authoritative with serialized event handling and claim rate-limiting. Opponent board layouts are strictly withheld.

### 2. One Link, Two Phones Cross-Device Play (Part 2)
- **Single URL Architecture**: Only two clean routes exist:
  - `/` — Home (Create room, Join with code, Practice vs Bot, Nickname/Avatar, Stats, How to play)
  - `/r/:code` — Direct join link (e.g. `/r/7K9MQ`)
- **Vowel-Free Room Codes**: 5-character alphabet (`23456789BCDFGHJKMNPQRSTVWXYZ`) free of vowels (prevents accidental words) and look-alikes (`0`/`O`, `1`/`I`/`L`).
- **Anonymous Identity**: Persistent random `playerId` and secret `sessionToken` stored in `localStorage`. The token proves seat ownership and is **never** broadcast to the opponent.
- **Seamless Disconnect Recovery**: A dropped player has a 60-second grace period to reconnect. The match is paused, timers freeze, and the opponent sees a polite countdown. After 60 seconds (or after exceeding 2 pauses), the connected player wins by forfeit.
- **Tab Conflict Resolution**: Opening the same session in a second tab smoothly claims the seat, while the older tab shows an "Opened in another tab" overlay.
- **Rematch & Score Tracking**: Post-match rematch resets boards and automatically alternates the starting player, tracking lifetime series scores in the room.
- **Practice vs Bot**: Play offline or solo against an intelligent AI bot (`BingoBot`) that tracks line completions without reading your grid.
- **Modern Web APIs**:
  - **Zero-Dependency QR Code Generator**: Modal with high-contrast SVG QR code for camera scanning.
  - **Web Share API**: Native share sheet with one-tap WhatsApp fallback (`https://api.whatsapp.com/send?text=...`).
  - **Screen Wake Lock API**: Prevents phone screens from dimming or sleeping mid-match.
  - **Web Audio API Synthesizer**: Custom synthesized audio effects for ink stamps, pen slashes, letter strikes, ready button chime, and winning fanfare.
  - **Canvas Confetti**: Particle burst celebration upon victory.
  - **PWA Ready**: `manifest.json`, high-resolution icons (192px and 512px SVG), Open Graph social preview cards.
  - **Bilingual (English / हिन्दी)**: Full native Hindi translation with instant UI switching.
  - **4 Desk Themes**: Night Indigo (default), Ocean, Plum, and Forest.

---

## 🎨 Theme: Notebook on a Night Desk

- **Desk Background**: Deep indigo gradient (`#1B1B5E` $\to$ `#4B2F9E`) with a warm ambient desk lamp glow.
- **Paper Grid**: Clean ruled paper card (`#F6F8FF`) with subtle blue ledger guidelines (`rgba(41, 70, 217, 0.08)`).
- **Ink Palette**:
  - Ink Navy: `#1D2459`
  - Stamp Ring: `#2946D9`
  - Red Pen Cut: `#E0243F` (slanted pen strokes)
  - Golden Button: `#FFC83D` $\to$ `#FF9F1C`
  - Accent Mint: `#35D6A0`
- **Typography**: Clean, handwritten pairing using Google Fonts *Kalam* and *Baloo 2*.

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ (tested on Node.js 20, 22)
- npm

### 1. Clone & Install
```bash
git clone https://github.com/your-username/bingoo_goo.git
cd bingoo_goo
npm install
```

### 2. Run the Server
```bash
npm start
```
The server will start at `http://localhost:3000`.

### 3. Run the Tests
Bingoo Goo includes 20 comprehensive unit, integration, and E2E test suites with 100% pass rate:
```bash
npm test
```

---

## 📱 How to Play from Two Phones

### On the Same Local Network (Wi-Fi)
1. Find your machine's local IP address (e.g. `192.168.1.15`).
2. Start the server with `npm start`.
3. Open `http://<your-local-ip>:3000` in mobile Chrome or Safari on Phone A.
4. Tap **Create Room**.
5. Tap **Share Link** (or let Phone B scan the on-screen **QR Code**).
6. Phone B opens the link (`/r/ABCDE`), types a nickname, and joins instantly.
7. Both players tap **Ready**, arrange their 5×5 numbers (tap two cells to swap, or tap **Auto Arrange**), and tap **Lock Board**.
8. Take turns calling numbers. Watch the continuous red pen lines cut through rows and columns, striking out B-I-N-G-O letters!
9. After 5 lines, the central golden **BINGO** button unlocks. Tap it to claim victory!

---

## ☁️ Deployment Guide

The application is completely self-contained in standard Node.js + WebSocket (`ws`), with no external database requirements. It can be deployed to any cloud provider in under 2 minutes:

| Platform | Build Command | Start Command | Port Variable | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Render** | `npm install` | `npm start` | `PORT` (auto) | Select "Web Service", Node environment |
| **Railway** | `npm install` | `npm start` | `PORT` (auto) | One-click repo deployment |
| **Fly.io** | `fly launch` | `npm start` | `PORT=3000` | Works with default `Dockerfile` |
| **Heroku** | `npm install` | `npm start` | `PORT` (auto) | Standard Node buildpack |
| **Docker / VPS** | `docker build` | `docker run -p 3000:3000` | `PORT=3000` | Native containerization |

### Production Environment Variables
- `PORT`: HTTP and WebSocket listening port (defaults to `3000`).
- `NODE_ENV`: Set to `production`.

---

## 🏗️ Architecture & Protocols

```
d:/Bingoo_Goo/
├── shared/
│   └── lineModel.js         # Pure line detection, 5 continuous line geometries, B-I-N-G-O mapping
├── server/
│   ├── gameState.js         # Authoritative Match engine, serial queue, immutable boards, rate limiter
│   ├── roomManager.js       # 5-char codes, device rooms, sessionToken auth, disconnect recovery
│   ├── botPlayer.js         # Intelligent AI bot for solo play
│   ├── economy.js           # Virtual currency, welcome bonus (500 coins), match rewards
│   └── server.js            # Node HTTP + WebSocket server, SPA router, legacy redirects
├── public/
│   ├── index.html           # Single-page app with Home, Lobby, Arrange, Game, Modals
│   ├── manifest.json        # PWA configuration
│   ├── css/
│   │   └── style.css        # Night Desk theme tokens, paper card, pen animations, mobile layouts
│   ├── js/
│   │   ├── gameClient.js    # SPA client router, state hydration, cell swapping, wake lock
│   │   ├── renderOverlay.js # SVG continuous red pen animator & glyph bounds letter strikethroughs
│   │   ├── audio.js         # Web Audio API sound synthesizer
│   │   ├── confetti.js      # Canvas confetti explosion
│   │   ├── qrcode.js        # Zero-dependency SVG QR code generator
│   │   └── i18n.js          # Bilingual translation dictionary (English & Hindi)
│   └── assets/
│       ├── icon-192.svg     # PWA app icon
│       ├── icon-512.svg     # PWA app icon
│       └── og-image.svg     # Open Graph social preview (1200x630)
└── test/
    ├── lineModel.test.js    # Pure geometry, deduplication, 10 lines detection (7 tests)
    ├── serverAuthority.test.js # Turn validation, rate limits, race conditions, privacy (5 tests)
    ├── integration.test.js  # Full match with 2 simulated clients & sequential strikes (1 test)
    ├── roomsAndTournaments.test.js # Room lifecycle, tab conflicts, bots, rematches (4 tests)
    ├── economy.test.js      # Coin balances and transactions (1 test)
    ├── static.test.js       # SPA routes, health check, legacy redirects (1 test)
    └── part2CrossDevice.test.js # Two phones live E2E simulation with disconnect recovery (1 test)
```

---

## 🔒 Security & Privacy Guarantees
1. **Zero Secret Leakage**: `sessionToken` is only checked server-side to confirm seat ownership; it is never sent in snapshots or broadcasts.
2. **Hidden Opponent Boards**: A player never receives their opponent's 5×5 arrangement. Opponents only receive public line counts (`linesCompleted: 2`).
3. **Server Validation**: The client cannot falsify line completions, call numbers out of turn, or fabricate wins. All claims are verified against the authoritative server model.

---

## 📜 License
MIT License. Built with ❤️ for timeless notebook gaming.
