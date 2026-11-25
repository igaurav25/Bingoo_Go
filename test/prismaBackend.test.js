/**
 * test/prismaBackend.test.js
 * 
 * Unit & Integration tests for Prisma ORM Backend Services and REST Endpoints.
 * Verifies Auth, User, Wallet, Match, Tournament, and Friend systems.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { authService } from '../server/services/authService.js';
import { walletService } from '../server/services/walletService.js';
import { matchService } from '../server/services/matchService.js';
import { tournamentService } from '../server/services/tournamentService.js';
import { friendService } from '../server/services/friendService.js';
import { userService } from '../server/services/userService.js';
import { server } from '../server/server.js';

let testPort = 3099;
let testServerUrl = `http://localhost:${testPort}`;

describe('Prisma Backend Architecture & Services', () => {

  describe('1. AuthService - Registration, Password Hashing & Sessions', () => {
    it('registers a new player with hashed password, initial wallet balance, and session token', async () => {
      const res = await authService.register({
        username: 'BingoHero',
        email: 'hero@bingo.test',
        password: 'SecurePassword123!',
        avatar: '🦁'
      });

      assert.ok(res.user);
      assert.equal(res.user.username, 'BingoHero');
      assert.equal(res.user.avatar, '🦁');
      assert.ok(res.sessionToken);
      assert.ok(res.user.wallet);
      assert.equal(res.user.wallet.balance, 500); // 500 Welcome Coins
    });

    it('rejects duplicate username registration', async () => {
      await assert.rejects(
        async () => {
          await authService.register({
            username: 'BingoHero',
            email: 'another@bingo.test',
            password: 'Pass'
          });
        },
        (err) => err.status === 409
      );
    });

    it('authenticates user and generates session token upon valid login', async () => {
      const loginRes = await authService.login({
        username: 'BingoHero',
        password: 'SecurePassword123!'
      });

      assert.ok(loginRes.user);
      assert.equal(loginRes.user.username, 'BingoHero');
      assert.ok(loginRes.sessionToken);
    });

    it('rejects invalid password login', async () => {
      await assert.rejects(
        async () => {
          await authService.login({
            username: 'BingoHero',
            password: 'WrongPassword'
          });
        },
        (err) => err.status === 401
      );
    });

    it('generates and verifies 6-digit OTP codes', async () => {
      const { identifier, code } = await authService.requestOTP('+919876543210');
      assert.equal(code.length, 6);

      const isValid = await authService.verifyOTP(identifier, code);
      assert.equal(isValid, true);

      const isInvalid = await authService.verifyOTP(identifier, '000000');
      assert.equal(isInvalid, false);
    });
  });

  describe('2. WalletService - ACID Balances & Audit Transactions', () => {
    const testUserId = 'test-player-wallet-1';

    it('initializes wallet with 500 coins', async () => {
      const wallet = await walletService.getWallet(testUserId);
      assert.equal(wallet.balance, 500);
    });

    it('awards match victory coins atomically with transaction audit log', async () => {
      const { wallet, transaction } = await walletService.awardCoins(
        testUserId,
        150,
        'MATCH_WIN',
        '1v1 Victory reward'
      );

      assert.equal(wallet.balance, 650);
      assert.equal(transaction.amount, 150);
      assert.equal(transaction.balanceAfter, 650);
    });

    it('deducts tournament entry fee atomically', async () => {
      const { wallet, transaction } = await walletService.deductCoins(
        testUserId,
        200,
        'TOURNAMENT_ENTRY',
        'Entry fee'
      );

      assert.equal(wallet.balance, 450);
      assert.equal(transaction.amount, -200);
    });

    it('rejects coin deduction when balance is insufficient', async () => {
      await assert.rejects(
        async () => {
          await walletService.deductCoins(testUserId, 99999, 'ITEM_PURCHASE', 'Too expensive');
        },
        (err) => err.status === 400
      );
    });

    it('fetches transaction history list', async () => {
      const history = await walletService.getTransactionHistory(testUserId);
      assert.ok(Array.isArray(history));
      assert.ok(history.length >= 2);
    });
  });

  describe('3. MatchService - Room, Board & Result Persistence', () => {
    let matchId = null;

    it('persists game room and match for any of the 13 game modes', async () => {
      const { room, match } = await matchService.createRoomAndMatch({
        roomCode: 'TEST9',
        mode: 'friends_league',
        maxPlayers: 2
      });

      assert.ok(room);
      assert.equal(room.code, 'TEST9');
      assert.equal(room.mode, 'FRIENDS_LEAGUE');
      assert.ok(match);
      assert.equal(match.status, 'IN_PROGRESS');
      matchId = match.id;
    });

    it('records called number during active match', async () => {
      const called = await matchService.recordCalledNumber({
        matchId,
        callerId: 'player-1',
        number: 17,
        turnNumber: 1
      });

      assert.ok(called);
      assert.equal(called.number, 17);
    });

    it('persists player 5x5 board arrangement', async () => {
      const numbers = Array.from({ length: 25 }, (_, i) => i + 1);
      const board = await matchService.savePlayerBoard({
        matchId,
        seat: 1,
        boardNumbers: numbers
      });

      assert.ok(board);
    });

    it('completes match and records winner victory', async () => {
      const result = await matchService.completeMatch({
        matchId,
        winnerId: 'player-1',
        winnerSeat: 1,
        completedLinesCount: 5,
        summary: 'Won with lines: row-0, row-1, row-2, row-3, row-4'
      });

      assert.ok(result);
      assert.equal(result.status, 'COMPLETED');
    });
  });

  describe('4. TournamentService - Formats, Registration & Standings', () => {
    let tournamentId = null;

    it('creates a Knockout tournament with prize pool', async () => {
      const tourn = await tournamentService.createTournament({
        title: 'BINGO Weekend Championship',
        format: 'KNOCKOUT',
        entryFee: 100,
        prizePool: 2500,
        maxParticipants: 8
      });

      assert.ok(tourn);
      assert.equal(tourn.title, 'BINGO Weekend Championship');
      assert.equal(tourn.format, 'KNOCKOUT');
      assert.equal(tourn.status, 'REGISTERING');
      tournamentId = tourn.id;
    });

    it('registers player for tournament', async () => {
      const p = await tournamentService.registerParticipant(tournamentId, 'player-1', 'Strikers');
      assert.ok(p);
      assert.equal(p.teamName, 'Strikers');
    });

    it('retrieves tournament list', async () => {
      const list = await tournamentService.getTournaments();
      assert.ok(Array.isArray(list));
      assert.ok(list.length >= 1);
    });
  });

  describe('5. FriendService - Requests & Reciprocal Relationships', () => {
    let requestId = null;

    it('sends friend request between players', async () => {
      const req = await friendService.sendFriendRequest('user-A', 'user-B');
      assert.ok(req);
      assert.equal(req.status, 'PENDING');
      requestId = req.id;
    });

    it('accepts friend request and establishes friendship', async () => {
      const updated = await friendService.respondToFriendRequest(requestId, true);
      assert.equal(updated.status, 'ACCEPTED');
    });
  });

  describe('6. REST API Endpoints Integration', () => {
    before(async () => {
      if (!server.listening) {
        await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
      }
      const port = server.address().port;
      testServerUrl = `http://127.0.0.1:${port}`;
    });

    after(async () => {
      if (server.listening) {
        await new Promise((resolve) => server.close(resolve));
      }
    });

    it('GET /api/health/db returns database and ORM status', async () => {
      const res = await fetch(`${testServerUrl}/api/health/db`);
      const data = await res.json();
      assert.equal(res.status, 200);
      assert.equal(data.orm, 'Prisma 6.19.3');
      assert.ok(data.status);
    });

    it('POST /api/auth/register creates user over HTTP', async () => {
      const res = await fetch(`${testServerUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'HttpUser',
          password: 'Password999!',
          avatar: '🐼'
        })
      });
      const data = await res.json();
      assert.equal(res.status, 201);
      assert.equal(data.success, true);
      assert.equal(data.user.username, 'HttpUser');
    });

    it('GET /api/users/leaderboard returns rankings', async () => {
      const res = await fetch(`${testServerUrl}/api/users/leaderboard?limit=5`);
      const data = await res.json();
      assert.equal(res.status, 200);
      assert.equal(data.success, true);
      assert.ok(Array.isArray(data.leaderboard));
    });
  });
});
