# Complete Game Mode Rules (`docs/RULES.md`)

This document defines the exact rules implemented in the shared engine for all 13 game modes.

---

## Shared Universal Rules (All Modes)
- **Board Grid**: 5×5 grid consisting of cells with indices 0 to 24.
- **Number Pool**: Numbers 1 through 25, each appearing exactly once.
- **Line Definitions**:
  - 5 Horizontal Rows: `r0` (cells 0-4), `r1` (5-9), `r2` (10-14), `r3` (15-19), `r4` (20-24).
  - 5 Vertical Columns: `c0` (0,5,10,15,20), `c1` (1,6,11,16,21), `c2` (2,7,12,17,22), `c3` (3,8,13,18,23), `c4` (4,9,14,19,24).
  - 2 Diagonals: `d0` (top-left to bottom-right: 0,6,12,18,24) and `d1` (top-right to bottom-left: 4,8,12,16,20).
- **Line Strike Sequence**:
  - Line 1: 'B'
  - Line 2: 'I'
  - Line 3: 'N'
  - Line 4: 'G'
  - Line 5: 'O'
  - Lines 6+: Red pen stroke drawn on board; no additional letters.
- **Win Claim**: Claimant must press the BINGO button once 5 lines are completed. Server validates line count from its own state.

---

## 1. Quick Match
- **Players**: 1v1 (Human vs Human).
- **Matchmaking**: Elo-based with expanding range (+/-50 widening by 50 every 5s up to +/-300).
- **Turn Timer**: 30 seconds. On timeout, server auto-calls a random uncalled legal number.
- **Ranked**: Yes (Elo rating change awarded upon victory/defeat).

## 2. Private Room
- **Players**: 2 players (expandable to 4).
- **Joining**: 5-character vowel-free code or direct URL `/r/:code`.
- **Turn Timer**: Configurable by host (0 = Off, 20s, 30s, 45s).
- **Series**: Best-of-1, Best-of-3, or Best-of-5 with score tracking and alternating first turns.
- **Ranked**: Unranked casual play.

## 3. 2v2 Team Battle
- **Players**: 4 players split into 2 teams: Blue Team (A1, A2) vs Orange Team (B1, B2).
- **Turn Order**: Cyclic: A1 -> B1 -> A2 -> B2.
- **Board Synergy**: Calls mark numbers on all 4 boards. Teammates see each other's line count, but never the opponent's or teammate's grid arrangement.
- **Victory**: First team member to achieve 5 lines and claim BINGO wins for the entire team.

## 4. Friend Challenge
- **Players**: 1v1 directly targeted at an online friend.
- **Invitation**: Direct invite with a 10-minute expiry window.
- **Series**: Best-of-1, Best-of-3, or Best-of-5.
- **Ranked**: Unranked friendly competition.

## 5. Knockout Tournament
- **Participants**: 4, 8, 16, or 32 players.
- **Format**: Single-elimination bracket.
- **Byes**: Automated for odd bracket sizes in round 1; awarded to top seeds.
- **Walkover**: 3-minute grace period for match appearance before 5–0 walkover.
- **Prizes**: Coins awarded to Champion and Runner-up.

## 6. League Tournament
- **Participants**: 3 to 16 players.
- **Format**: Round-robin (circle method schedule).
- **Scoring**: Win = 2 points (or 3 points per config), Loss = 0 points.
- **Tie-Breakers**: 1. Points, 2. Wins, 3. Head-to-Head result, 4. Earliest registration.

## 7. Practice (Bot)
- **Players**: Solo vs AI Bot.
- **Difficulty Levels**:
  - Easy: Calls random uncalled numbers.
  - Medium: Greedily selects numbers completing lines with the most marked cells.
  - Hard: Evaluates line progress across all rows, columns, and diagonals.
  - Expert: 2-ply lookahead optimization.
- **Offline Capable**: Yes.

## 8. Offline Mode (Pass & Play / Offline Bot)
- **Connectivity**: Fully functional without network connection.
- **Modes**:
  - Pass & Play: Two human players take turns on one phone with a privacy veil between turns.
  - Offline Bot: Local offline simulation against AI bot.
- **Integrity**: Local stats tracked; rewards capped at small daily offline limit to prevent tampering.

## 9. Survival Gauntlet
- **Structure**: Continuous run against bots with increasing difficulty (Easy -> Medium -> Hard -> Expert).
- **Rules**: One match loss ends the gauntlet run.
- **Scoring**: Number of rounds survived + time bonus.

## 10. Time Challenge (Daily Speed Run)
- **Structure**: Solo speed challenge with a daily deterministic seed shared globally.
- **Mechanic**: Numbers auto-called every 2.0 seconds. Player must rapidly tap and mark numbers.
- **Penalties**: Tapping an incorrect or uncalled cell adds a +3.0 second time penalty.
- **Leaderboard**: Global daily leaderboard based on fastest verified completion time.

## 11. Friends League
- **Host**: User-created private league for invited friends.
- **Access**: Invite link or code required.
- **Schedule**: Host controls match start and can advance rounds.

## 12. Friends Knockout
- **Host**: User-created bracket tournament for friends.
- **Access**: Private invite link.

## 13. Friends Hybrid
- **Structure**: Two stages:
  1. Group stage: Round-robin league.
  2. Playoff stage: Top 4 qualify into Knockout semifinals and Grand Final.
- **Visuals**: Cut line separating qualified contenders from eliminated contenders in the standings table.
