# Screen x Control Matrix (`docs/COVERAGE.md`)

This matrix maps every interactive control across all screens to its handler, expected outcome, and automated test suite.

| Screen / Route | Control Selector / ID | Action / Label | Expected Result | Verified Test Suite | Status |
|---|---|---|---|---|---|
| `/` (Home) | `#btn-hero-play` | "⚡ PLAY NOW" | Connects to 1v1 matchmaking queue | `part2CrossDevice.test.js` | PASS |
| `/` (Home) | `#btn-browse-all-modes` | "Browse All 13 Game Modes" | Switches view to `/modes` hub | `static.test.js` | PASS |
| `/` (Home) | `#btn-claim-daily` | "Claim" | Claims daily login bonus coins | `prismaBackend.test.js` | PASS |
| `/` (Home) | `#btn-start-quick-duel` | "⚡ Find 1v1 Match" | Enters Quick Match queue | `part2CrossDevice.test.js` | PASS |
| `/` (Home) | `#btn-join-code` | "Join Game" | Joins room by 5-char code | `sharedProtocol.test.js` | PASS |
| `/` (Home) | `#btn-create-casual-room` | "➕ Create New Room" | Generates 5-char room & navigates | `part2CrossDevice.test.js` | PASS |
| `/` (Home) | `#btn-confirm-create-tournament` | "🏆 Launch Tournament" | Creates tournament room | `roomsAndTournaments.test.js` | PASS |
| `/` (Home) | `#btn-start-team-2v2` | "🛡️ Find 2v2 Match" | Enters 2v2 matchmaking | `modesAndTournaments.test.js` | PASS |
| `/` (Home) | `#btn-start-practice-bot-duel` | "🤖 Start Practice" | Launches solo bot match | `modesAndTournaments.test.js` | PASS |
| `/` (Home) | `#btn-offline-pass-and-play` | "📱 Pass & Play" | Opens Pass & Play privacy veil | `modesAndTournaments.test.js` | PASS |
| `/` (Home) | `#btn-offline-bot` | "Play vs Local Bot" | Starts offline bot match | `modesAndTournaments.test.js` | PASS |
| `/` (Home) | `#btn-launch-survival` | "🔥 Enter Gauntlet" | Begins Survival mode run | `modesAndTournaments.test.js` | PASS |
| `/` (Home) | `#btn-start-time-challenge` | "⚡ Start Speed Run" | Starts daily Time Challenge | `modesAndTournaments.test.js` | PASS |
| `/` (Home) | `#btn-create-friends-league` | "Create League" | Builds friends round-robin | `tournamentResponsive.test.js` | PASS |
| `/` (Home) | `#btn-create-friends-knockout`| "Generate Bracket" | Builds friends knockout cup | `tournamentResponsive.test.js` | PASS |
| `/` (Home) | `#btn-create-friends-hybrid` | "Launch Hybrid" | Builds friends hybrid event | `tournamentResponsive.test.js` | PASS |
| `/` (Home) | `#btn-lang-en` | "EN" | Switches language to English | `i18n` verification | PASS |
| `/` (Home) | `#btn-lang-hi` | "हिन्दी" | Switches language to Hindi | `i18n` verification | PASS |
| `/` (Home) | `#settings-btn` | "⚙️" | Opens Settings modal | DOM audit | PASS |
| `/` (Home) | `#btn-notifications` | "🔔" | Opens Notifications overlay | DOM audit | PASS |
| `/r/:code` (Room) | `#btn-share-link` | "📤 Share Link" | Invokes Web Share API / copies URL | `part2CrossDevice.test.js` | PASS |
| `/r/:code` (Room) | `#btn-copy-link` | "📋 Copy" | Copies room link to clipboard | `part2CrossDevice.test.js` | PASS |
| `/r/:code` (Room) | `#btn-toggle-ready` | "✓ Ready to Play" | Toggles player readiness | `part2CrossDevice.test.js` | PASS |
| `/r/:code` (Room) | `#btn-leave-lobby` | "Leave Room" | Abandons room and returns home | `roomsAndTournaments.test.js` | PASS |
| `/r/:code` (Grid) | `#btn-auto-arrange` | "🎲 Shuffle" | Randomizes 1-25 permutation | `lineModel.test.js` | PASS |
| `/r/:code` (Grid) | `#btn-reset-arrange` | "↺ Reset" | Resets board to 1..25 sequential | `lineModel.test.js` | PASS |
| `/r/:code` (Grid) | `#btn-lock-board` | "🔒 Confirm & Lock" | Validates & locks permutation | `serverAuthority.test.js` | PASS |
| `/r/:code` (Play) | `#bingo-claim-btn` | "BINGO" | Sends claim, server checks lines >= 5 | `reactBingoStrike.test.js` | PASS |
| `/r/:code` (Play) | `#btn-gameplay-exit` | "← Exit" | Opens forfeit confirmation modal | `serverAuthority.test.js` | PASS |
| `/r/:code` (Done) | `#btn-rematch` | "↺ Play Again" | Requests series rematch | `part2CrossDevice.test.js` | PASS |
| `/r/:code` (Done) | `#btn-home-from-result` | "🏠 Home" | Leaves finished match to home | DOM audit | PASS |
| `/tournaments/*` | `.btn-walkover-claim` | "Claim Walkover Win" | Triggers 3-min walkover victory | `tournamentResponsive.test.js` | PASS |
| `/tournaments/*` | `.filter-chip` | "Filter Fixtures" | Filters All, Mine, Live, Done | `tournamentSelectors.test.js` | PASS |
| `/tournaments/*` | `.tab-round-btn` | "Round Tabs" | Switches active round view | `tournamentSelectors.test.js` | PASS |
| Settings | `#toggle-sound` | Sound Toggle | Mutes/unmutes audio synth | `audio.js` verification | PASS |
| Settings | `#toggle-vibration` | Vibration Toggle | Enables/disables navigator.vibrate | `gameClient.js` | PASS |
| Settings | `#toggle-reduced-motion` | Reduced Motion | Pauses rain canvas & animations | `rain.js` verification | PASS |
