# Project Architecture Audit (Phase 0)

**Date**: November 2026  
**Auditor**: Principal Full-Stack Game Engineer  
**Document**: `docs/AUDIT.md`  

---

## 1. Architecture Map

### 1.1 Front End
- **Framework**: Dual-mode architecture:
  1. Vanilla JavaScript SPA shell in `public/js/gameClient.js` for lightweight mobile client entry, modal controllers, tabs, and direct socket routing.
  2. React 18 (`src/index.jsx`, `src/components/`, `src/tournaments/`) bundled via `esbuild` to `public/dist/bingo-react.js` and `public/dist/bingo-react.css` for complex UI flows (5x5 responsive SVG strike-through gameplay, bracket trees, standings tables, tournament router).
- **Router**:
  - Browser History API (`pushState`, `popstate`) integrated with server-side SPA fallback for deep links (`/`, `/r/:code`, `/modes`, `/modes/:modeId`, `/tournaments/*`).
  - React Tournament Router (`src/tournaments/TournamentRouter.jsx`) parses path and query params (`?round=...`, `?tab=...`).
- **State Management**:
  - Server-authoritative state synchronization over WebSocket.
  - React local hooks (`useBingoGame.js`) for reactive board state, selection queues, animation sequences, and line projection.
  - Client session state in `localStorage` (`bingo_player_id`, `bingo_player_name`, `bingo_avatar`, `bingo_wallet`).
- **Styling**:
  - CSS Custom Properties declared at `:root` in `public/css/variables.css` using the Hallmark Ribbon "Last Page after dark" / "Two-in-the-Morning" palette.
  - Component CSS in `public/css/components/`, `public/css/features/`, `src/styles/bingo.css`, and `src/styles/tournaments.css`.
  - CSS Grid (5x5 fixed aspect 1:1) and SVG overlays with relative unit coordinate systems (`viewBox="-25 -25 550 550"`).

### 1.2 Backend
- **Runtime**: Node.js (v18+) ES Modules.
- **HTTP Server**: Node native `http.createServer` in `server/server.js` with static asset streaming and REST routing (`server/routes/apiRoutes.js`).
- **Realtime Transport**:
  - Native WebSockets (`ws` library) on the same HTTP port.
  - Message schema: JSON envelopes `{ action, payload, clientCmdId, token }`.
  - Server assigned monotonic `eventSeq` per room.
  - Heartbeat / ping-pong interval (15s) with 60s seat-hold grace period for dropped connections.

### 1.3 Database & Prisma ORM
- **ORM**: Prisma Client v6.19.3 (`prisma/schema.prisma`).
- **Database**: PostgreSQL with resilient in-memory fallback services (`server/services/`) when the database container is unprovisioned, preventing server crashes.
- **Models**: User, Session, UserProfile, UserStatistics, Wallet, CoinTransaction, GameRoom, RoomPlayer, Match, MatchPlayer, GameBoard, BoardNumber, CalledNumber, GameEvent, GameResult, Team, Tournament, TournamentParticipant, TournamentMatch, TournamentFixture, TournamentStanding.

### 1.4 Config / Environment
- `.env` and `.env.example` defining `PORT`, `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV`.
- Build script `build.js` using `esbuild` for production bundling (`target: 'es2020'`, `minifySyntax: true`, `keepNames: true`).

### 1.5 Tests
- Test Runner: Node.js native test runner (`node --test test/*.test.js`).
- 85 automated tests passing across 23 test suites (unit, geometry, protocol, tournament selectors, server authority, Prisma services, and E2E simulation).

---

## 2. Screen Inventory

| Route / Screen | Current State | Notes |
|---|---|---|
| `/` (Home Lobby) | **Working** | Header, brand, quick play CTA, mode cards, bottom navigation, modals. |
| `/r/:code` (Room / Match) | **Working** | 5-character room code, seat assignment, board arrangement, active match, results. |
| `/modes` (Modes Hub) | **Working** | Grid of all 13 game modes with descriptions, badges, and launch handlers. |
| `/modes/:modeId` (Dedicated Mode) | **Working** | Dynamic launcher configuring rules, timer, players, and bot/offline support. |
| `/tournaments` (Tournament Home) | **Working** | React-powered tournament hub: featured hero, formats, active/upcoming lists. |
| `/tournaments/create` | **Working** | Tournament creation form (Knockout, League, Hybrid, participant limits, fees). |
| `/tournaments/join` | **Working** | Join via 5-char code or direct link. |
| `/tournaments/:id/lobby` | **Working** | Participant slots, host controls (start, kick), invite button. |
| `/tournaments/:id/overview` | **Working** | Stage progress, round overview, match list. |
| `/tournaments/:id/fixtures` | **Working** | Filterable fixtures (All, Mine, Live, Done). |
| `/tournaments/:id/standings` | **Working** | Points table with played, won, lost, points, rank, and cut line. |
| `/tournaments/:id/bracket` | **Working** | Mobile round tabs & tablet/desktop horizontal connector bracket tree. |
| `/tournaments/:id/match/:matchId` | **Working** | Match focus screen with "Enter Match" / 3-minute walkover timer. |
| `/tournaments/:id/champion` | **Working** | Podium screen, winner avatar, final score, prize reward. |
| Offline Fallback (`/offline.html`) | **Working** | Standalone PWA fallback page with auto-reload on `online` event. |
| PWA Service Worker (`/sw.js`) | **Working** | App shell cache with network-first navigation strategy. |

---

## 3. Button & Control Audit

| Selector / ID | Label / Action | Real Outcome | Status |
|---|---|---|---|
| `#btn-hero-play` | "⚡ PLAY NOW" | Opens matchmaking modal & connects to queue | **Works** |
| `#btn-browse-all-modes` | "Browse All 13 Game Modes →" | Navigates to `/modes` view | **Works** |
| `#btn-claim-daily` | "Claim" | Calls `/api/wallet/daily-reward`, awards coins, updates streak | **Works** |
| `#btn-join-code` | "Join Game" | Normalizes 5-char code, joins via WebSocket | **Works** |
| `#btn-create-casual-room` | "➕ Create New Room" | Generates 5-char code, transitions to `/r/:code` | **Works** |
| `#btn-start-team-2v2` | "🛡️ Find 2v2 Match" | Enters 2v2 matchmaking queue | **Works** |
| `#btn-offline-pass-and-play`| "Pass & Play" | Switches to local 2-player mode with privacy screen | **Works** |
| `#btn-offline-bot` | "Play vs Local Bot" | Starts local match against AI bot | **Works** |
| `#btn-launch-survival` | "Enter Gauntlet" | Launches Survival mode against escalating bots | **Works** |
| `#btn-start-time-challenge` | "Start Speed Run" | Initiates 2s auto-call speed challenge with daily seed | **Works** |
| `#btn-auto-arrange` | "🎲 Shuffle" | Generates Fisher-Yates random 1–25 board | **Works** |
| `#btn-reset-arrange` | "↺ Reset" | Restores natural 1..25 order | **Works** |
| `#btn-lock-board` | "🔒 Confirm & Lock Board" | Locks board arrangement, sends to server | **Works** |
| `#bingo-claim-btn` | "BINGO" | Submits server claim, verifies lines >= 5 | **Works** |
| `#btn-rematch` | "↺ Play Again" | Sends rematch request, alternates first caller | **Works** |
| `.modal-close` | "Done / Close" | Closes active modal overlay via `data-close` | **Works** |

---

## 4. Game Logic & Rules Audit

- **Board Dimension**: Strictly 5×5 grid.
- **Numbers**: Numbers 1 to 25 appear exactly once. Validated on server with `new Set(board).size === 25` and range `[1, 25]`.
- **Diagonals**: Existing rules and classic school copybook rules evaluate 12 potential lines: 5 horizontal rows (`r0`–`r4`), 5 vertical columns (`c0`–`c4`), and 2 diagonal lines (`d0`, `d1`).
- **Line Progression**: 1st completed line strikes 'B', 2nd strikes 'I', 3rd strikes 'N', 4th strikes 'G', 5th strikes 'O'. Lines beyond 5th are still marked with pen strokes but no extra letters exist.
- **Win Condition**: Player taps BINGO button. The server strictly validates from its own state that `linesCompleted >= 5`.
- **Tie-Break**: First valid claim processed by the server's serial event queue wins.
- **Turn Timer**: Configurable (0 = Off, 20s, 30s, 45s). Server enforces turn deadlines; on expiration, server auto-picks a random uncalled legal number.
- **Disconnect Seat Hold**: 60 seconds grace period before forfeit.

---

## 5. Responsive Audit

- **Tested Viewports**:
  - Mobile Small: `320×568` (iPhone SE 1st gen)
  - Mobile Standard: `360×800` (Android mid-range)
  - Mobile Tall: `390×844` (iPhone 12/13/14)
  - Mobile Large: `430×932` (iPhone Pro Max)
  - Tablet Portrait: `768×1024` (iPad Mini)
  - Tablet Landscape: `1024×768`
  - Desktop Standard: `1366×768`
  - Desktop Wide: `1920×1080`
  - Landscape Phone: `800×360`
- **Findings & Fixes Applied**:
  - `100dvh` viewport constraints prevent accidental document-style scrolling on gameplay screens.
  - Number cells enforce `aspect-ratio: 1 / 1` and never clip or truncate digits.
  - Bracket scroller uses labelled snap-scrolling on tablet/desktop, while mobile switches to compact round-by-round tabs.

---

## 6. Risks & Mitigation Plan

1. **Client Trust Risk**: Mitigated. The server never trusts client line declarations. All boards, calls, and claims are verified server-side. Opponent boards are redacted from public snapshots.
2. **Database Connectivity**: Mitigated. Prisma services implement an automatic fallback to in-memory state when PostgreSQL is temporarily offline, preserving server availability.
3. **Double Click / Idempotency**: Mitigated. Every client command carries a `clientCmdId` and the server tracks `processedCmds` to reject duplicate invocations.
4. **CSS Bloat / Conflicts**: Mitigated. Styles are scoped into modular files under `public/css/features/` and `src/styles/`.

---

## 7. Adapted Milestone Execution Plan

- **M0**: Tooling, Design Tokens, and Documentation Suite (`AUDIT.md`, `PROGRESS.md`, `DECISIONS.md`, `RULES.md`, `COVERAGE.md`, `ASSETS.md`).
- **M1**: Shared Pure Engine, Mode Rules Registry, Event Log & Projection, Property-Based Tests (Gate: Pause for owner review).
- **M2**: Design System "Last Page after dark", Home Lobby, Gameplay Screen, Procedural Audio & Haptics (Gate: Pause for owner review).
- **M3**: Accounts & Profiles, Friends Directory, Private Rooms, Quick Match Matchmaking, Elo Rating.
- **M4**: Soft Economy: XP, CoinLedger (append-only), Daily Rewards, Achievements, Leaderboards.
- **M5**: Tournament Engine: Knockout, League, Hybrid, Bracket Tree, 3-minute Walkovers.
- **M6**: Remaining Playable Modes: 2v2 Team, Solo Bot, Offline Pass & Play, Survival Gauntlet, Time Challenge.
- **M7**: Hardening: Security review, Load test verification, Accessibility AA audit, No-Op detector.
- **M8**: PWA Polish, Capacitor Android Wrapper, Store Compliance.
