# Project Progress Tracking (`docs/PROGRESS.md`)

## Current Milestone Status

| Milestone | Description | Gate Requirement | Status |
|---|---|---|---|
| **M0** | Audit, Plan, Tooling & Documents | `AUDIT.md`, `DECISIONS.md`, `RULES.md`, `COVERAGE.md`, `ASSETS.md`, tokens | **DONE** |
| **M1** | Engine & Protocol (Vertical Slice) | Pure engine, event log, projection, line cutting, 2-device E2E tests | **DONE** |
| **M2** | Design System & Core Polish | "Last Page after dark" tokens, home lobby, results, audio/haptics | **COMPLETED (Awaiting Review)** |
| **M3** | Accounts, Friends & Matchmaking | Presence, invitations, quick match queue, rating | **READY** |
| **M4** | Economy & Progression | XP, append-only CoinLedger, daily reward, achievements | **READY** |
| **M5** | Tournament Engine & Screens | Knockout, League, Hybrid, 3-min walkover, bracket scroller | **READY** |
| **M6** | Remaining Modes | 2v2, Solo Bots, Offline Pass & Play, Survival, Time Challenge | **READY** |
| **M7** | Hardening & Performance | Security, zero no-ops, 60fps, Lighthouse 90+, bundle budget | **READY** |
| **M8** | PWA & Native Wrapper | Service worker shell, offline screen, Capacitor Android wrapper | **READY** |

---

## Completed in M0 & M1
- **Audit**: Comprehensive inspection across front end, backend, Prisma schema, routes, buttons, game logic, and responsive breakpoints saved in `docs/AUDIT.md`.
- **Pure Engine (`shared/lineModel.js`)**:
  - Deterministic line detection (5 rows, 5 columns, 2 diagonals).
  - Validation of 1–25 permutations without duplicates or omissions.
  - Continuous slanted red-pen stroke geometry with 15% overshoot and 25% angle.
  - Letter strike slash geometry.
- **Protocol & Projection (`shared/protocol.js`)**:
  - 5-character vowel-free, look-alike-free alphabet (`23456789BCDFGHJKMNPQRSTVWXYZ`).
  - Monotonic integer `eventSeq` per room.
  - Idempotent `clientCmdId` deduplication.
  - Strict privacy projection: `createPublicPlayerSnapshot` redacts player's private 25-number board from opponent view.
- **Cross-Device Matchmaking & Rooms (`server/roomManager.js`)**:
  - 60-second disconnect seat hold.
  - Tab conflict resolution.
  - Serial queue for deterministic BINGO claim adjudication.
- **Classic Line Cutting Overlay (`src/components/StrikeThroughOverlay.jsx`)**:
  - Continuous animated line draw-in (`pathLength=1`, keyframe `draw-strike`).
  - Struck B-I-N-G-O letter slashes.

---

## Completed in M2 & Frontend Emergency Repair
- **Navigation & Back Button Repair**:
  - Resolved root-cause bug where mode back buttons pointed to nonexistent `screen-modes` instead of `screen-modes-hub`.
  - Updated all 13 dedicated mode screen back buttons in `public/index.html` to `data-back="modes-hub"`.
  - Added defensive routing normalization in `public/js/gameClient.js` for both `navigateTo()` and `_showScreen()` to seamlessly handle `'modes'` target.
- **Responsive Layout & Bottleneck Elimination**:
  - Removed artificial `max-width: 460px` bottleneck at `>= 600px` and `>= 1024px` in `public/css/responsive.css`.
  - Enabled scaling up to `720px` for tablets and `1024px` for desktop, allowing multi-column mode cards (2 cols at 480px, 3 cols at 768px+) and tournament brackets to breathe.
  - Active gameplay console constrained to ergonomic 520px-540px.
- **Viewport Overflow & Natural Scrolling**:
  - Updated `public/css/global.css` `.screen-view` with `overflow-y: auto; overflow-x: hidden;` so long forms and cards (e.g. Mode 2 tournament setup, leaderboard, profile, friends) scroll smoothly on small vertical heights (< 640px).
  - Maintained strict `overflow: hidden !important;` during active gameplay (`.gameplay-layout`, `#screen-game`, `#screen-arrange`, `#screen-react-game`).
- **Modal Viewport Clamping**:
  - Updated `public/css/components/modals.css` `.modal-card` with `max-width: min(100%, 380px); max-height: calc(100dvh - 32px); overflow-y: auto;`.
  - Completely prevents bottom buttons from clipping off-screen on short devices or landscape mobile phones.
- **Landscape Gameplay 2-Column Layout**:
  - Implemented `@media (orientation: landscape) and (max-height: 520px)` in both `public/css/features/gameplay.css` and `src/styles/bingo.css`.
  - Board centered on the left (`width: min(88vh, 320px)`), and opponent info, timer, BINGO letters, claim button, and recent calls stacked cleanly on the right.
- **Automated Verification**:
  - 91 automated tests passing across 24 test suites (`npm test`).
  - Bundle size: 81.98 KB gzipped (<= 180 KB budget).
- **Master Tokens ("Last Page after dark") in `public/css/variables.css`**:
  - `--bg: #0C1422` (page)
  - `--navy-900: #101827` (surface 1)
  - `--navy-800: #17243A` (surface 2)
  - `--navy-700: #1E2E4A` (surface 3)
  - `--royal: #2864D9` (primary blue actions & marked numbers)
  - `--electric: #438BFF` (focus ring & links)
  - `--gold: #F3B94F` (ready BINGO button & victory trophy)
  - `--white: #F4F6FA` (text on dark and paper sheet)
  - `--slate: #8995A8` (secondary text & locked states)
  - `--success: #32B879`, `--danger: #E6535D`
  - `--pen-red: #D9383A`, `--pen-red-lit: #FF4D4F`, `--paper-rule: #C9D3E6`
- **Typography Stack**:
  - Barlow Condensed (600/700) for display headings and ranks.
  - Figtree (400/500/600) for UI.
  - Kalam (700) for handwritten board digits.
  - Noto Sans Devanagari for natural Hindi translations.
- **Procedural Audio Suite & Haptics (`public/js/audio.js`)**:
  - 10 synthesized Web Audio sounds (pencil friction, pen-scratch stroke, letter strike, BINGO ready shimmer, victory fanfare, defeat cadence, your turn chime, last 5s tick, tap, error buzz).
  - Tactile haptic vibration patterns via `navigator.vibrate`.
- **Graphics Quality Engine (`public/js/rain.js` & `public/css/global.css`)**:
  - Auto-detection reading `deviceMemory` and `hardwareConcurrency`.
  - Manual modes: `Auto`, `High`, `Low`.
  - In `Low` quality or `prefers-reduced-motion`: disables rain canvas, disables blur, static backdrop.
  - In active matches: dimming to faint rain to protect 60fps framerates.
- **BINGO Button Lifecycle (`src/components/BingoButton.jsx` & `src/styles/bingo.css`)**:
  - Locked (slate with n/5 pips) -> Ready (gold ring pulse) -> Submitting (spinner, taps ignored) -> Verified.
- **Results Screen Polish (`src/components/MatchResult.jsx`)**:
  - Web Share API victory card sharing.
  - Return home & rematch controls.

---

## Completed in M5 (Full Tournament Engine, Lobby & Gameplay Wiring)
- **Tournament Creation & Format Options**:
  - Validated creation for Knockout, League, and Hybrid formats.
  - Supported participant count selector for 4, 6, 8, 10, 12, 16 players in `TournamentCreate.jsx`.
  - Automatically redirects host directly into the Tournament Lobby on creation.
- **Tournament Lobby & Registration**:
  - Fixed status normalization (`REGISTERING`, `PENDING`, `OPEN`) in `TournamentRouter.jsx` and `TournamentHome.jsx` so created tournaments open the Lobby instead of skipping to empty overview.
  - Enabled code copying, participant seat cards, avatar display, ready states, and host kick controls.
  - Validated host Start Tournament requirement (>= 2 players; fills with AI if needed).
- **Match Gameplay Linking & Room Generation**:
  - Implemented `createTournamentMatchRoom(matchId, roomManager)` with `POST /api/tournaments/:id/matches/:matchId/start` and WebSocket `start_tournament_match`.
  - Created live 5-character device room tagged with `tournamentId` and `tournamentMatchId`.
  - Linked `onPlayMatch` in `BracketView`, `TournamentOverview`, `TournamentFixtures`, and `TournamentMatchFocus` to launch match in game console.
- **Automatic Server-Authoritative Result Advancement**:
  - `handleVictory()` detects tournament match rooms, invokes `tourn.recordMatchResult(matchId, winnerId)`, and broadcasts `tournament_updated`.
  - Points table automatically updates points/played/won/lost and re-sorts standings with tie-breaker rules.
  - Bracket advances winners to next round (Semifinals, Final) and marks next match `READY`.
  - When the final match is won, crowns the Champion and updates the Trophy screen.
- **Results Screen Routing**:
  - "Return to Tournament" button returns player directly to `/tournaments/:id` with real updated progression.

---

## Decisions Log
- ADR 001 - Pure shared engine with dependency injection.
- ADR 002 - Append-only event log with monotonic `eventSeq`.
- ADR 003 - Strict opponent grid privacy guarantee.
- ADR 004 - SVG relative unit coordinate geometry for pen strikes.
- ADR 005 - 5-character vowel-free room codes.
- ADR 006 - 3-minute tournament walkover rule.
- ADR 007 - Procedural Web Audio API sound synthesis.
- ADR 008 - Prisma ORM with in-memory persistence fallback.

---

## Blockers
- **None**. All 101 tests green across 26 test suites. Bundle size is 81.98 KB gzipped (budget <= 180 KB). Server running on port 3000.
