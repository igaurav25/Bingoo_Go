import test from 'node:test';
import assert from 'node:assert/strict';
import { Tournament, TournamentManager, tournamentManager } from '../server/tournamentManager.js';
import { FriendsManager, friendsManager } from '../server/friendsManager.js';
import { economy } from '../server/economy.js';

test('Tournament Engine: Knockout Cup (4-player & 8-player bracket propagation)', () => {
  const tm = new TournamentManager();

  // --- 4-Player Knockout ---
  const t4 = tm.createTournament('KNOCKOUT', 'Thunder 4 Cup', 'p1', 'Player 1', { maxParticipants: 4 });
  t4.addParticipant('p2', 'Player 2');
  t4.addParticipant('p3', 'Player 3');
  t4.addParticipant('p4', 'Player 4');

  const snap4 = t4.startTournament();
  assert.equal(snap4.status, 'IN_PROGRESS');
  assert.equal(snap4.knockoutMatches.length, 3); // SF1, SF2, Final

  const sf1 = snap4.knockoutMatches[0];
  const sf2 = snap4.knockoutMatches[1];
  const fin = snap4.knockoutMatches[2];

  assert.equal(sf1.status, 'READY');
  assert.equal(sf2.status, 'READY');
  assert.equal(fin.status, 'WAITING');

  // Win SF1 by p1
  t4.recordMatchResult(sf1.id, 'p1');
  assert.equal(t4.knockoutMatches[0].status, 'COMPLETED');
  assert.equal(t4.knockoutMatches[2].player1.id, 'p1');
  assert.equal(t4.knockoutMatches[2].status, 'WAITING'); // Waiting for SF2 winner

  // Win SF2 by p4
  t4.recordMatchResult(sf2.id, 'p4');
  assert.equal(t4.knockoutMatches[1].status, 'COMPLETED');
  assert.equal(t4.knockoutMatches[2].player2.id, 'p4');
  assert.equal(t4.knockoutMatches[2].status, 'READY'); // Both finalist ready

  // Win Final by p1
  const finRes = t4.recordMatchResult(fin.id, 'p1');
  assert.equal(finRes.status, 'COMPLETED');
  assert.equal(finRes.champion.id, 'p1');
  assert.equal(finRes.champion.name, 'Player 1');

  // --- 8-Player Knockout ---
  const t8 = tm.createTournament('KNOCKOUT', 'Epic 8 Cup', 'p1', 'Player 1', { maxParticipants: 8 });
  t8.fillWithBots();
  const snap8 = t8.startTournament();
  assert.equal(snap8.participants.length, 8);
  assert.equal(snap8.knockoutMatches.length, 7); // 4 QFs + 2 SFs + 1 Final

  // Win QF1 and QF2
  const [qf1, qf2, qf3, qf4, koSf1, koSf2, koFin] = snap8.knockoutMatches;
  t8.recordMatchResult(qf1.id, qf1.player1.id);
  t8.recordMatchResult(qf2.id, qf2.player1.id);
  assert.equal(t8.knockoutMatches[4].status, 'READY'); // SF1 is ready
  assert.equal(t8.knockoutMatches[4].player1.id, qf1.player1.id);
  assert.equal(t8.knockoutMatches[4].player2.id, qf2.player1.id);
});

test('Tournament Engine: League (IPL-style points table & deterministic tie-breakers)', () => {
  const tm = new TournamentManager();
  // 4 participants, 3 points for win, 0 for loss
  const league = tm.createTournament('LEAGUE', 'Premier Super League', 'p1', 'Alpha', {
    maxParticipants: 4,
    pointsPerWin: 3,
    pointsPerLoss: 0
  });
  league.addParticipant('p2', 'Beta');
  league.addParticipant('p3', 'Gamma');
  league.addParticipant('p4', 'Delta');

  const snap = league.startTournament();
  assert.equal(snap.status, 'IN_PROGRESS');
  // 4 teams round-robin = (4 * 3) / 2 = 6 fixtures
  assert.equal(snap.leagueFixtures.length, 6);
  assert.equal(snap.pointsTable.length, 4);

  // Play fixtures
  // Fixture 1: Alpha (p1) vs Beta (p2) -> Alpha wins (3 pts)
  const fix1 = snap.leagueFixtures[0];
  league.recordMatchResult(fix1.id, 'p1');

  // Fixture 2: Alpha (p1) vs Gamma (p3) -> Alpha wins (3 pts, total 6)
  const fix2 = snap.leagueFixtures[1];
  league.recordMatchResult(fix2.id, 'p1');

  // Fixture 3: Alpha (p1) vs Delta (p4) -> Delta wins (3 pts)
  const fix3 = snap.leagueFixtures[2];
  league.recordMatchResult(fix3.id, 'p4');

  // Fixture 4: Beta (p2) vs Gamma (p3) -> Beta wins (3 pts)
  const fix4 = snap.leagueFixtures[3];
  league.recordMatchResult(fix4.id, 'p2');

  // Fixture 5: Beta (p2) vs Delta (p4) -> Delta wins (3 pts, total 6)
  const fix5 = snap.leagueFixtures[4];
  league.recordMatchResult(fix5.id, 'p4');

  // Fixture 6: Gamma (p3) vs Delta (p4) -> Gamma wins (3 pts)
  const fix6 = snap.leagueFixtures[5];
  const finalSnap = league.recordMatchResult(fix6.id, 'p3');

  assert.equal(finalSnap.status, 'COMPLETED');
  assert.ok(finalSnap.champion);

  // Verify points & tie-breakers:
  // Alpha (p1): 2 wins, 1 loss = 6 pts
  // Delta (p4): 2 wins, 1 loss = 6 pts
  // Beta (p2): 1 win, 2 losses = 3 pts
  // Gamma (p3): 1 win, 2 losses = 3 pts
  const pt = finalSnap.pointsTable;
  assert.equal(pt[0].points, 6);
  assert.equal(pt[1].points, 6);
  assert.equal(pt[2].points, 3);
  assert.equal(pt[3].points, 3);
  assert.equal(pt[0].won, 2);
  assert.equal(pt[1].won, 2);
});

test('Tournament Engine: Hybrid Format (League stage -> Top 4 Playoffs: 1v4, 2v3 -> Final)', () => {
  const tm = new TournamentManager();
  const hybrid = tm.createTournament('HYBRID', 'Friends IPL Hybrid Cup', 'u1', 'User 1', {
    maxParticipants: 4,
    pointsPerWin: 2,
    pointsPerLoss: 0
  });
  hybrid.addParticipant('u2', 'User 2');
  hybrid.addParticipant('u3', 'User 3');
  hybrid.addParticipant('u4', 'User 4');

  hybrid.startTournament();
  assert.equal(hybrid.playoffMatches.length, 3); // SF1 (1v4), SF2 (2v3), Final

  // Complete all 6 fixtures:
  for (const fix of hybrid.leagueFixtures) {
    // Arbitrary winner (p1 of the fixture)
    hybrid.recordMatchResult(fix.id, fix.p1.id);
  }

  // Once all league fixtures complete, tournament should transition to PLAYOFFS
  const playoffSnap = hybrid.getSnapshot();
  assert.equal(playoffSnap.status, 'PLAYOFFS');

  // SF1 should be Rank 1 vs Rank 4
  const sf1 = playoffSnap.playoffMatches[0];
  const sf2 = playoffSnap.playoffMatches[1];
  const fin = playoffSnap.playoffMatches[2];

  assert.equal(sf1.status, 'READY');
  assert.equal(sf2.status, 'READY');
  assert.equal(sf1.player1.id, playoffSnap.pointsTable[0].id);
  assert.equal(sf1.player2.id, playoffSnap.pointsTable[3].id);
  assert.equal(sf2.player1.id, playoffSnap.pointsTable[1].id);
  assert.equal(sf2.player2.id, playoffSnap.pointsTable[2].id);

  // Play SF1
  hybrid.recordMatchResult(sf1.id, sf1.player1.id);
  // Play SF2
  hybrid.recordMatchResult(sf2.id, sf2.player2.id);

  assert.equal(hybrid.playoffMatches[2].status, 'READY');
  assert.equal(hybrid.playoffMatches[2].player1.id, sf1.player1.id);
  assert.equal(hybrid.playoffMatches[2].player2.id, sf2.player2.id);

  // Play Final
  const finalSnap = hybrid.recordMatchResult(fin.id, sf1.player1.id);
  assert.equal(finalSnap.status, 'COMPLETED');
  assert.equal(finalSnap.champion.id, sf1.player1.id);
});

test('Friends Directory: Presence tracking and direct challenges', () => {
  const fm = new FriendsManager();

  // Register online user
  const mockWs = { send: () => {} };
  fm.registerUser('player-101', 'GamerGuy', '🐯', mockWs);

  const friends = fm.getFriendsList('player-101');
  assert.ok(friends.length >= 5);
  // Registered user should appear in others' lists
  const friendListOther = fm.getFriendsList('other-player');
  const foundUser = friendListOther.find(f => f.id === 'player-101');
  assert.ok(foundUser);
  assert.equal(foundUser.name, 'GamerGuy');
  assert.equal(foundUser.status, 'online');

  // Update status to in_game
  fm.setUserStatus('player-101', 'in_game');
  assert.equal(fm.users.get('player-101').status, 'in_game');

  // Create Challenge
  const fromUser = { id: 'player-101', name: 'GamerGuy', avatar: '🐯' };
  const challenge = fm.createChallenge(fromUser, 'f-alex');
  assert.equal(challenge.status, 'pending');
  assert.equal(challenge.fromId, 'player-101');
  assert.equal(challenge.toId, 'f-alex');

  // Accept Challenge
  const acceptRes = fm.respondToChallenge(challenge.id, true);
  assert.equal(acceptRes.success, true);
  assert.equal(acceptRes.challenge.status, 'accepted');

  // Cannot respond twice
  const secondRes = fm.respondToChallenge(challenge.id, false);
  assert.equal(secondRes.success, false);

  // Unregister user -> offline
  fm.unregisterUser('player-101');
  assert.equal(fm.users.get('player-101').status, 'offline');
});

test('Single App Routing: Dedicated /modes routes return application index', async () => {
  const { server, wss } = await import('../server/server.js');
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  const http = await import('node:http');
  const fetchUrl = (path) => new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path,
      method: 'GET'
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    req.end();
  });

  try {
    // /modes route
    const resModes = await fetchUrl('/modes');
    assert.equal(resModes.status, 200);
    assert.match(resModes.body, /BINGO/);

    // /modes/:mode route
    const resQuick = await fetchUrl('/modes/quick-match');
    assert.equal(resQuick.status, 200);
    assert.match(resQuick.body, /BINGO/);

    const resLeague = await fetchUrl('/modes/friends-league');
    assert.equal(resLeague.status, 200);
    assert.match(resLeague.body, /BINGO/);
  } finally {
    wss.close();
    await new Promise(r => server.close(r));
  }
});
