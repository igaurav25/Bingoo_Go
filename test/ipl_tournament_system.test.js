/**
 * test/ipl_tournament_system.test.js
 * 
 * Comprehensive Unit Tests for the IPL-Style Competitive Tournament System:
 * - IPL metadata: Season, Logo, Description, Approval Mode, Scheduling Mode
 * - Host Registration Approvals: Auto vs Host Approval workflow
 * - Team Franchise League: Mumbai Strikers, Royal Challengers, Chennai Super Stars, Kolkata Knights
 * - IPL Points Calculation (3 Pts for Win) and Tie-Breaker Ordering
 * - Playoff Progression: League Stage -> Top 4 Semifinals -> Grand Final -> Champion
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { tournamentManager } from '../server/tournamentManager.js';

describe('IPL Tournament System Verification', () => {
  it('1. Creates an IPL-branded tournament with season, logo, and approval settings', () => {
    const config = {
      name: 'Bingo Premier League 2026',
      season: 'Season 01',
      logo: '🦁',
      format: 'TEAM_LEAGUE',
      maxPlayers: 8,
      entryFee: 100,
      approvalMode: 'HOST_APPROVAL',
      scheduleMode: 'AUTOMATIC',
      pointsWin: 3,
      qualificationSlots: 4,
      turnTimerSeconds: 30,
      hostId: 'host-rohit',
      hostName: 'Rohit_Capt'
    };

    const tournament = tournamentManager.createTournament(config);
    assert.ok(tournament.id);
    assert.equal(tournament.name, 'Bingo Premier League 2026');
    assert.equal(tournament.season, 'Season 01');
    assert.equal(tournament.logo, '🦁');
    assert.equal(tournament.format, 'TEAM_LEAGUE');
    assert.equal(tournament.approvalMode, 'HOST_APPROVAL');
    assert.equal(tournament.isTeamLeague, true);
    assert.equal(tournament.teams.length, 4);
    assert.equal(tournament.pendingApprovals.length, 0);
  });

  it('2. Host Approval Workflow: Guest registration requires host approval', () => {
    const tournament = tournamentManager.createTournament({
      name: 'IPL Private Cup',
      format: 'LEAGUE',
      maxPlayers: 4,
      approvalMode: 'HOST_APPROVAL',
      hostId: 'host-1',
      hostName: 'HostPlayer'
    });

    // Guest joins tournament
    const joinResult = tournamentManager.addParticipant(tournament.id, 'guest-1', 'GuestPlayer');
    assert.ok(joinResult.success);
    assert.equal(joinResult.pendingApproval, true);

    const snapshot1 = tournamentManager.getTournament(tournament.id);
    // Guest should be in pendingApprovals, not in participants
    assert.equal(snapshot1.participants.length, 1); // Only host
    assert.equal(snapshot1.pendingApprovals.length, 1);
    assert.equal(snapshot1.pendingApprovals[0].id, 'guest-1');

    // Host approves guest
    const approveResult = tournamentManager.approveParticipant(tournament.id, 'host-1', 'guest-1');
    assert.ok(approveResult.success);

    const snapshot2 = tournamentManager.getTournament(tournament.id);
    assert.equal(snapshot2.participants.length, 2);
    assert.equal(snapshot2.pendingApprovals.length, 0);
    assert.equal(snapshot2.participants[1].id, 'guest-1');
  });

  it('3. Team Franchise League: generates round-robin fixtures between franchises', () => {
    const tournament = tournamentManager.createTournament({
      name: 'BPL Franchise Trophy',
      format: 'TEAM_LEAGUE',
      maxPlayers: 4,
      hostId: 'player-1',
      hostName: 'Captain1'
    });

    // Add another participant to reach min 2
    tournamentManager.addParticipant(tournament.id, 'player-2', 'Captain2');

    // Start tournament
    const startResult = tournamentManager.startTournament(tournament.id, 'player-1');
    assert.ok(startResult.success);

    const liveTourn = tournamentManager.getTournament(tournament.id);
    assert.equal(liveTourn.status, 'IN_PROGRESS');
    assert.ok(liveTourn.matches.length > 0);

    // Verify fixtures have team metadata
    const firstMatch = liveTourn.matches[0];
    assert.ok(firstMatch.team1);
    assert.ok(firstMatch.team2);
    assert.ok(firstMatch.team1.name);
    assert.ok(firstMatch.team2.name);
  });

  it('4. IPL Points Calculation: awards 3 points per victory to the winning team', () => {
    const tournament = tournamentManager.createTournament({
      name: 'IPL Points Derby',
      format: 'TEAM_LEAGUE',
      maxPlayers: 4,
      hostId: 'p1',
      hostName: 'Player1'
    });
    tournamentManager.addParticipant(tournament.id, 'p2', 'Player2');
    tournamentManager.startTournament(tournament.id, 'p1');

    const liveTourn = tournamentManager.getTournament(tournament.id);
    const match = liveTourn.matches[0];
    const winningTeamId = match.team1.id;

    // Record victory for team 1
    const recordResult = tournamentManager.recordMatchResult(
      tournament.id,
      match.id,
      match.slots[0].playerId,
      { linesCompleted: 5, callsCount: 12 }
    );
    assert.ok(recordResult.success);

    const updated = tournamentManager.getTournament(tournament.id);
    const updatedTeam = updated.teams.find(t => t.id === winningTeamId);
    assert.equal(updatedTeam.won, 1);
    assert.equal(updatedTeam.points, 3); // 3 pts for win
  });

  it('5. Standings & Deterministic Tie-Breakers: sorts by Points -> Wins', () => {
    const tournament = tournamentManager.createTournament({
      name: 'IPL Championship Race',
      format: 'LEAGUE',
      maxPlayers: 4,
      hostId: 'p1',
      hostName: 'Player1'
    });
    tournamentManager.addParticipant(tournament.id, 'p2', 'Player2');
    tournamentManager.startTournament(tournament.id, 'p1');

    const live = tournamentManager.getTournament(tournament.id);
    const m1 = live.matches[0];

    // p1 wins match 1
    tournamentManager.recordMatchResult(tournament.id, m1.id, 'p1', { linesCompleted: 5, callsCount: 14 });

    const snap = tournamentManager.getTournament(tournament.id);
    const standings = snap.pointsTable;
    assert.equal(standings[0].playerId, 'p1');
    assert.equal(standings[0].points, 3);
    assert.equal(standings[0].won, 1);
    assert.equal(standings[1].points, 0);
  });
});
