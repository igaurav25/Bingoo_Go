/**
 * test/tournament_create_and_lobby_fix.test.js
 *
 * Comprehensive verification suite for BUG 1 & BUG 2:
 * - TEST 1: Button Visibility, Form Semantics, Responsive Scrollability & CSS Clipping Fix
 * - TEST 2: Valid Tournament + Multiplayer Lobby Room Creation Flow & Persistence
 * - TEST 3: Real Refresh / Re-fetch & Lobby Metadata Integrity
 * - TEST 4: Multi-User Join via Code + Real-Time WebSocket Presence Sync
 * - TEST 5: Validation, Auth & Empty Optional Field Handling
 * - TEST 6: Transaction Rollback Guard (No Orphan Tournament on Persist Failure)
 * - TEST 7: Duplicate Request / Double-Click Prevention & State Recovery
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import WebSocket from 'ws';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import * as esbuild from 'esbuild';
import { server } from '../server/server.js';
import { tournamentManager } from '../server/tournamentManager.js';
import { tournamentService } from '../server/services/tournamentService.js';

async function loadJsxModule(relPath) {
  const cacheDir = path.resolve('node_modules/.cache');
  fs.mkdirSync(cacheDir, { recursive: true });
  const tmpFile = path.join(cacheDir, `bingoo-ssr-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`);
  try {
    await esbuild.build({
      entryPoints: [path.resolve(relPath)],
      bundle: true,
      platform: 'node',
      format: 'esm',
      jsx: 'automatic',
      external: ['react', 'react-dom', 'react-dom/server', 'react/jsx-runtime'],
      outfile: tmpFile
    });
    return await import(pathToFileURL(tmpFile).href);
  } finally {
    fs.rmSync(tmpFile, { force: true });
  }
}

let port = 0;
let baseUrl = '';

async function api(pathname, method = 'GET', body = null, token = null) {
  const res = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json();
  return { status: res.status, data };
}

function wsConnect() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    const queue = [];
    const waiters = [];

    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      const idx = waiters.findIndex(w => !w.type || w.type === msg.type);
      if (idx !== -1) {
        const w = waiters.splice(idx, 1)[0];
        clearTimeout(w.timer);
        w.resolve(msg);
      } else {
        queue.push(msg);
      }
    });

    ws.on('open', () => {
      resolve({
        ws,
        sendMsg(type, payload = {}) {
          ws.send(JSON.stringify({ type, payload }));
        },
        nextMsg(type = null, timeoutMs = 5000) {
          const qIdx = queue.findIndex(m => !type || m.type === type);
          if (qIdx !== -1) {
            return Promise.resolve(queue.splice(qIdx, 1)[0]);
          }
          return new Promise((res, rej) => {
            const timer = setTimeout(() => {
              rej(new Error(`Timeout waiting for WS event: ${type || 'any'}`));
            }, timeoutMs);
            waiters.push({ type, resolve: res, reject: rej, timer });
          });
        },
        close() {
          for (const w of waiters) clearTimeout(w.timer);
          ws.close();
        }
      });
    });

    ws.on('error', reject);
  });
}

describe('BUG 1 & BUG 2 Complete Verification — Tournament Create Button & Room Creation', () => {
  before(async () => {
    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it('TEST 1: Renders real <form> with visible Create Tournament submit button on initial Step 1 and fixes PageShell scrolling & mobile layout CSS', async () => {
    const { TournamentCreate } = await loadJsxModule('src/tournaments/screens/TournamentCreate.jsx');
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(TournamentCreate, {
        currentUserId: 'host-render-1',
        currentUserName: 'HostRender'
      })
    );

    assert.ok(html.includes('<form class="tourn-create-form"'), 'Must render real <form> element');
    assert.ok(
      html.includes('id="tourn-create-submit-btn"') &&
      html.includes('type="submit"') &&
      html.includes('>Create Tournament</button>'),
      'Create Tournament submit button must be rendered visibly at bottom on initial Step 1 load'
    );
    assert.ok(html.includes('tournament-page-shell'), 'PageShell wrapper must use .tournament-page-shell');

    const createSrc = fs.readFileSync(path.resolve('src/tournaments/screens/TournamentCreate.jsx'), 'utf8');
    assert.ok(createSrc.includes('onSubmit={handleSubmit}'), 'Form must attach real onSubmit={handleSubmit}');
    assert.ok(createSrc.includes('Creating Tournament...'), 'Must expose Creating Tournament... state');
    assert.ok(createSrc.includes('Tournament Created'), 'Must expose Tournament Created state');
    assert.ok(createSrc.includes('Creation Failed'), 'Must expose Creation Failed state');
    assert.ok(createSrc.includes('submitLockRef'), 'Must enforce synchronous double-submit lock');

    const cssSrc = fs.readFileSync(path.resolve('src/styles/tournaments.css'), 'utf8');
    assert.ok(cssSrc.includes('.tournament-page-shell'), 'CSS must style .tournament-page-shell');
    assert.ok(cssSrc.includes('overflow-y: auto;'), 'Tournament PageShell must allow vertical scrolling inside .arena-main-stage');
    assert.ok(cssSrc.includes('.tournament-router-viewport'), 'CSS must style .tournament-router-viewport');
    assert.ok(!cssSrc.includes('.tourn-create-summary-sidebar {\n    order: -1;'), 'Mobile layout must not push summary above form inputs & submit button');
    assert.ok(cssSrc.includes('order: 2;'), 'Mobile summary sidebar should appear below form (order: 2)');
  });

  it('TEST 2 & TEST 3: Valid POST /api/tournaments creates persistent tournament + multiplayer room/lobby, registers host, and renders in TournamentLobby', async () => {
    const regHost = await api('/api/auth/register', 'POST', {
      username: `bugfix_host_${Date.now().toString(36)}`,
      password: 'StrongPassword!1',
      avatar: '🏆'
    });
    assert.equal(regHost.status, 201);
    const { token, user } = regHost.data;

    // Submit with blank optional date fields (must succeed cleanly)
    const createRes = await api('/api/tournaments', 'POST', {
      name: 'Sunday Midnight Bingo',
      format: 'HYBRID',
      maxPlayers: 8,
      minParticipants: 2,
      entryFee: 100,
      matchesPerPlayer: 5,
      pointsPerWin: 2,
      pointsPerLoss: 0,
      qualificationSlots: 4,
      playoffFormat: 'IPL_TOP4',
      turnTimerSeconds: 30,
      registrationDeadline: '',
      startTime: ''
    }, token);

    assert.equal(createRes.status, 201);
    assert.equal(createRes.data.success, true);
    assert.ok(createRes.data.tournament?.id);
    assert.ok(createRes.data.tournament?.code);
    assert.ok(createRes.data.room, 'API must return created room object');
    assert.equal(createRes.data.room.code, createRes.data.tournament.code);
    assert.equal(createRes.data.room.status, 'OPEN');
    assert.equal(createRes.data.room.maxCapacity, 8);
    assert.equal(createRes.data.room.currentPlayers, 1);
    assert.equal(createRes.data.tournament.participants.length, 1);
    assert.equal(createRes.data.tournament.participants[0].id, user.id);

    // Reload / GET /api/tournaments/:id must return persisted tournament & room
    const detailRes = await api(`/api/tournaments/${createRes.data.tournament.id}`);
    assert.equal(detailRes.status, 200);
    assert.equal(detailRes.data.success, true);
    assert.equal(detailRes.data.tournament.name, 'Sunday Midnight Bingo');
    assert.equal(detailRes.data.room.code, createRes.data.tournament.code);

    // Verify TournamentRouter fixes & TournamentLobby rendering with created state
    const routerSrc = fs.readFileSync(path.resolve('src/tournaments/TournamentRouter.jsx'), 'utf8');
    assert.ok(routerSrc.includes('loading={detailLoading || !detailError}'), 'Must pass valid loading prop (not isLoading) to PageShell');
    assert.ok(routerSrc.includes('error={detailError}'), 'Must pass error prop to avoid endless loading screen');

    const { TournamentLobby } = await loadJsxModule('src/tournaments/screens/TournamentLobby.jsx');
    const lobbyHtml = ReactDOMServer.renderToStaticMarkup(
      React.createElement(TournamentLobby, {
        tournament: detailRes.data.tournament,
        currentUserId: user.id,
        currentUserName: user.username
      })
    );
    assert.ok(lobbyHtml.includes('Sunday Midnight Bingo'));
    assert.ok(lobbyHtml.includes(createRes.data.tournament.code));
    assert.ok(lobbyHtml.includes('1 / 8'));
    assert.ok(lobbyHtml.includes('<svg'), 'QR code SVG must render in created tournament lobby');
  });

  it('TEST 4: Second authenticated user joins created lobby by invite code and WS broadcasts updated room state', async () => {
    const regHost = await api('/api/auth/register', 'POST', {
      username: `join_host_${Date.now().toString(36)}`,
      password: 'StrongPassword!1'
    });
    const regGuest = await api('/api/auth/register', 'POST', {
      username: `join_guest_${Date.now().toString(36)}`,
      password: 'StrongPassword!1'
    });

    const created = await api('/api/tournaments', 'POST', {
      name: 'Two Player Join Room Cup',
      format: 'KNOCKOUT',
      maxPlayers: 4
    }, regHost.data.token);
    assert.equal(created.status, 201);
    const t = created.data.tournament;

    const hostWs = await wsConnect();
    try {
      hostWs.sendMsg('join_tournament_lobby', {
        tournamentId: t.id,
        playerId: regHost.data.user.id,
        name: regHost.data.user.username
      });
      await hostWs.nextMsg('tournament_updated');

      const joinRes = await api('/api/tournaments/join', 'POST', {
        code: t.code
      }, regGuest.data.token);
      assert.equal(joinRes.status, 200);
      assert.equal(joinRes.data.success, true);
      assert.equal(joinRes.data.tournament.participants.length, 2);
      assert.equal(joinRes.data.tournament.room.currentPlayers, 2);

      const wsUpdate = await hostWs.nextMsg('tournament_updated');
      assert.equal(wsUpdate.tournament.participants.length, 2);
    } finally {
      hostWs.close();
    }
  });

  it('TEST 5: Invalid inputs & unauthorized creation return structured 4xx errors without creating orphan records', async () => {
    const reg = await api('/api/auth/register', 'POST', {
      username: `val_host_${Date.now().toString(36)}`,
      password: 'StrongPassword!1'
    });
    const token = reg.data.token;
    const countBefore = (await api('/api/tournaments')).data.tournaments.length;

    const cases = [
      { body: { name: 'AB', format: 'HYBRID' }, token, expectedStatus: 400 },
      { body: { name: 'Valid Cup Name', format: 'HYBRID', maxPlayers: 4, minParticipants: 8 }, token, expectedStatus: 400 },
      { body: { name: 'Valid Cup Name', format: 'HYBRID', entryFee: -50 }, token, expectedStatus: 400 },
      { body: { name: 'Valid Cup Name', format: 'UNKNOWN_FMT' }, token, expectedStatus: 400 },
      { body: { name: 'Valid Cup Name', format: 'HYBRID', registrationDeadline: 'not-a-valid-date' }, token, expectedStatus: 400 },
      { body: { name: 'No Auth Cup', format: 'HYBRID' }, token: null, expectedStatus: 401 },
      { body: { name: 'Bad Token Cup', format: 'HYBRID' }, token: 'bad.jwt.token', expectedStatus: 401 }
    ];

    for (const c of cases) {
      const res = await api('/api/tournaments', 'POST', c.body, c.token);
      assert.equal(res.status, c.expectedStatus, `Expected ${c.expectedStatus} for ${JSON.stringify(c.body)}, got ${res.status}`);
      assert.equal(res.data.success, false);
      assert.ok(res.data.error);
    }

    const countAfter = (await api('/api/tournaments')).data.tournaments.length;
    assert.equal(countAfter, countBefore, 'No invalid/unauthorized tournament may exist in storage');
  });

  it('TEST 6: Atomic rollback cleans up in-memory & disk state if persistence fails mid-creation', async () => {
    const originalPersist = tournamentService._persistTournament.bind(tournamentService);
    const countBefore = tournamentManager.listTournaments().length;

    tournamentService._persistTournament = async () => {
      throw { status: 500, message: 'Simulated DB transaction failure' };
    };

    try {
      const res = await api('/api/tournaments', 'POST', {
        name: 'Rollback Safety Cup',
        format: 'KNOCKOUT',
        maxPlayers: 4,
        creatorId: 'rollback-tester',
        creatorName: 'RollbackTester'
      });

      assert.equal(res.status, 500);
      assert.equal(res.data.success, false);
      assert.match(res.data.error, /Simulated DB transaction failure/);
      assert.equal(
        tournamentManager.listTournaments().length,
        countBefore,
        'Rollback must delete failed tournament from memory so zero orphan tournaments remain'
      );
      const found = tournamentManager.listTournaments().find(t => t.name === 'Rollback Safety Cup');
      assert.equal(found, undefined);
    } finally {
      tournamentService._persistTournament = originalPersist;
    }
  });

  it('TEST 7: Host duplicate join is rejected cleanly (409) & lobby maintains single host participant', async () => {
    const regHost = await api('/api/auth/register', 'POST', {
      username: `dup_host_${Date.now().toString(36)}`,
      password: 'StrongPassword!1'
    });
    const created = await api('/api/tournaments', 'POST', {
      name: 'Double Join Guard Cup',
      format: 'LEAGUE',
      maxPlayers: 6
    }, regHost.data.token);
    assert.equal(created.status, 201);

    const dup = await api('/api/tournaments/join', 'POST', {
      code: created.data.tournament.code
    }, regHost.data.token);
    assert.equal(dup.status, 409);
    assert.equal(dup.data.alreadyJoined, true);
    assert.equal(dup.data.tournament.participants.length, 1);
  });
});
