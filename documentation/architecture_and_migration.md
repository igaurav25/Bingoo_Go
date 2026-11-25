# BINGO CHAMPIONSHIP — ARCHITECTURE & MIGRATION SPECIFICATION

## 1. System Overview

The **Bingo Championship** application has been migrated into a unified full-stack architecture:

1. **Mobile Frontend (`mobile/`)**:
   - Built with **React Native** + **Expo** + **TypeScript**.
   - Zero WebViews. 100% native primitives (`View`, `Text`, `TouchableOpacity`, `ScrollView`, `Modal`, `TextInput`, `StyleSheet`).
   - Supports Android phones, Android tablets, iPhones, and iPads with responsive scaling and safe area handling.
   - Master Sports Design System matching the visual reference board:
     - Deep Navy: `#0C1422`
     - Midnight Blue: `#101827`
     - Secondary Blue: `#17243A`
     - Royal Blue: `#2864D9`
     - Electric Blue: `#438BFF`
     - Gold: `#F3B94F`
     - Premium White: `#F4F6FA`
     - Slate: `#8995A8`
     - Success Green: `#32B879`
     - Danger Red: `#E6535D`

2. **Backend Engine (`server/`)**:
   - **Node.js** + **Express.js** + **Prisma ORM** + **PostgreSQL** + **WebSocket / Socket.IO**.
   - 24 normalized Prisma models covering Users, Profiles, Friends, Rooms, Matches, Events, Tournaments, Standings, Wallets, Transactions, and Notifications.
   - Resilient in-memory fallback layer ensures 100% test and development capability when a live PostgreSQL instance is offline.

3. **Shared Contracts (`shared/`)**:
   - `lineModel.js`: 5x5 board checking (1–25 permutations), 5 horizontal rows, 5 vertical columns, 2 diagonals, line strike deduplication, sequential B-I-N-G-O 5-letter mapping, server-authoritative win validation.
   - `protocol.js`: Client action constants, server event contracts, 5-character vowel-free room code generation and validation (`ROOM_CODE_ALPHABET = '23456789BCDFGHJKLMNPQRSTVWXYZ'`).
   - `types.ts`: Universal TypeScript interfaces for players, matches, rooms, tournaments, standings, and profiles.
   - `constants.ts`: Complete catalog of all 13 game modes.

---

## 2. Directory Layout

```text
BingoGame/
├── mobile/                      # Native React Native + Expo Application
│   ├── app.json                 # Expo project configuration (bundle IDs, tablet support)
│   ├── package.json             # Mobile dependencies and run scripts
│   ├── tsconfig.json            # Strict TypeScript configuration
│   ├── App.tsx                  # Root Application Coordinator
│   ├── theme/                   # Sports Design System Tokens (colors, typography, spacing)
│   ├── services/                # API Client, Socket Service, Storage Service
│   ├── hooks/                   # useBingoGame, useMultiplayer, useTournaments
│   ├── components/              # Native UI components (Header, BottomNav, BingoBoard, Gauges, Modals)
│   └── screens/                 # HomeScreen, GameModesScreen, BingoGameScreen, TournamentScreen, etc.
├── server/                      # Authoritative Node.js Express + WebSocket Server
│   ├── server.js                # Master server, HTTP routing, real-time socket turn engine
│   ├── roomManager.js           # 5-character room lifecycle, player ready state
│   ├── tournamentManager.js     # Knockout brackets, League points tables, Hybrid playoffs
│   ├── economy.js               # In-game coin wallet, win rewards, daily gift
│   ├── routes/                  # RESTful API endpoints (/api/*)
│   ├── services/                # AuthService, MatchService, TournamentService, WalletService
│   └── db/                      # Prisma ORM client with resilient fallback
├── prisma/                      # Production Database Schema & Seed Scripts
│   ├── schema.prisma            # 765-line normalized schema (24 models)
│   └── seed.js                  # Seed data for production tournaments, bots, and demo users
├── shared/                      # Isomorphic Logic & Protocol Contracts
│   ├── lineModel.js             # 5x5 line-cutting geometry & verification
│   ├── protocol.js              # Message actions & 5-char room code generator
│   ├── types.ts                 # TypeScript definitions
│   └── constants.ts             # 13 Game Modes & color tokens
└── documentation/               # Complete Architectural, API, and Build Guides
```
