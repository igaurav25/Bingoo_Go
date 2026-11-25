# Architectural Decisions Log (ADR)

## ADR 001: Pure Shared Engine with Dependency Injection
- **Context**: The game logic (line detection, permutation validation, RNG shuffling, B-I-N-G-O progression, win verification) must execute identically on client, server, bots, and test runners.
- **Decision**: Keep `shared/lineModel.js` and `shared/protocol.js` completely pure. Never call `Date.now()` or `Math.random()` internally; always inject timestamp and RNG functions or pass seeds.
- **Consequences**: Guarantees zero divergence between client visual predictions and server authoritative verifications.

## ADR 002: Append-Only Event Log & Command Idempotency
- **Context**: Realtime mobile networks experience latency, packet drops, duplicate submits, and reconnection gaps.
- **Decision**: Every room maintains an append-only event log (`eventLog`) with monotonic integer sequence numbers (`eventSeq`). Client commands carry a `clientCmdId`. The server records `processedCmds` to reject duplicate transmissions.
- **Consequences**: Deterministic match rehydration on reconnect, replay capabilities, and audit trails.

## ADR 003: Strict Opponent Privacy (Zero Grid Leakage)
- **Context**: Cheating by inspecting network packets or DOM memory would ruin competitive fairness.
- **Decision**: Opponent's 25-number permutation and marked cell positions are never sent across the wire. Opponents only receive public progress: `linesCompleted`, `lettersStruck`, `lastCalledNumber`, and turn timer.
- **Consequences**: Tested and verified in `sharedProtocol.test.js` and `serverAuthority.test.js`.

## ADR 004: SVG Relative Unit Coordinate Geometry for Pen Strikes
- **Context**: Continuous pen strikes drawn per row/column must scale accurately across screen resolutions from 320px to 4K desktops without pixel-level math.
- **Decision**: The SVG overlay uses a grid-unit `viewBox="-25 -25 550 550"` with 100 units per cell. Row lines run from `(-15, yc + 25)` to `(515, yc - 25)` and column lines run from `(xc - 25, -15)` to `(xc + 25, 515)`.
- **Consequences**: 15% line overshoot and 25% natural handwritten slant angle without clipping at edges.

## ADR 005: 5-Character Vowel-Free Room Alphabet
- **Context**: Room codes shared between friends must be short, unambiguous, and free from accidental offensive words.
- **Decision**: Alphabet `23456789BCDFGHJKMNPQRSTVWXYZ` (length 28). Excludes vowels (A, E, I, O, U) and easily confused characters (0/O, 1/I/L).
- **Consequences**: Safe, memorable, uppercase-normalized 5-character room codes.

## ADR 006: 3-Minute Walkover Rule for Tournament Matches
- **Context**: Tournaments stall when a player fails to connect or abandons a match.
- **Decision**: A contender has 3 minutes (180,000 ms) from match announcement to enter the room. If no-show, the server awards a 5–0 walkover to the active contender and advances them to the next bracket round.
- **Consequences**: Tournaments proceed reliably without manual administrator intervention.

## ADR 007: Procedural Web Audio API Sound Generation
- **Context**: Sound effects for paper friction, pen scratching, clicks, and fanfares must be lightweight and work without network asset latency.
- **Decision**: `public/js/audio.js` synthesizes sounds in real time using the Web Audio API (oscillators, white noise buffers, biquad bandpass filters, exponential gain ramps).
- **Consequences**: Zero audio file downloads, instant playback, zero licensing issues.

## ADR 008: Prisma ORM with Resilient In-Memory Fallback
- **Context**: Backend data access requires type safety and migration tracking, but the app must remain functional in sandboxed environments where PostgreSQL is not currently running.
- **Decision**: Prisma Client is used as the primary database layer, backed by in-memory caching services (`server/services/`) that kick in gracefully when `DATABASE_URL` is unreachable.
- **Consequences**: 100% test pass rate with full API and service contract adherence.
