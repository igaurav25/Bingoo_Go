/**
 * src/tournaments/screens/TournamentResults.jsx
 * 
 * Final Results Screen (/tournaments/:id/results).
 * Shows final outcome, podium cards (1st Gold, 2nd Silver, 3rd Bronze) with coin rewards,
 * tournament statistics, and links to final bracket / standings.
 */

import React, { useMemo } from 'react';
import { PageShell } from '../components/PageShell.jsx';
import { Num } from '../components/Num.jsx';
import { PlayerName } from '../components/PlayerName.jsx';
import { selectStandings, selectBracketRounds, selectFixtures } from '../selectors.js';

export function TournamentResults({
  tournament,
  currentUserId = null,
  onNavigate = null
}) {
  if (!tournament) return null;

  const { id, name, format, prizePool = 1000 } = tournament;
  const standings = useMemo(() => selectStandings(tournament), [tournament]);
  const fixtures = useMemo(() => selectFixtures(tournament), [tournament]);
  const bracketRounds = useMemo(() => selectBracketRounds(tournament), [tournament]);

  // Determine top 3 podium players
  const podium = useMemo(() => {
    if (format === 'KNOCKOUT') {
      const finalRound = bracketRounds.find(r => r.key === 'final') || bracketRounds[bracketRounds.length - 1];
      const finalMatch = finalRound?.matches[0];
      if (finalMatch && finalMatch.status === 'COMPLETED') {
        const winnerSlot = finalMatch.slots.find(s => s.playerId === finalMatch.winnerId);
        const runnerSlot = finalMatch.slots.find(s => s.playerId !== finalMatch.winnerId);

        // Semifinalists for 3rd place
        const sfRound = bracketRounds.find(r => r.key === 'semifinal');
        const sfLosers = [];
        if (sfRound) {
          for (const m of sfRound.matches) {
            const loser = m.slots.find(s => s.playerId !== m.winnerId);
            if (loser) sfLosers.push(loser);
          }
        }

        return [
          { rank: 1, player: winnerSlot, prizePct: 0.60 },
          { rank: 2, player: runnerSlot, prizePct: 0.25 },
          { rank: 3, player: sfLosers[0] || { playerName: 'Semi-finalist' }, prizePct: 0.15 }
        ];
      }
    }

    // Default or League: Use standings
    return [
      { rank: 1, player: standings[0] ? { playerName: standings[0].playerName, playerId: standings[0].playerId } : null, prizePct: 0.60 },
      { rank: 2, player: standings[1] ? { playerName: standings[1].playerName, playerId: standings[1].playerId } : null, prizePct: 0.25 },
      { rank: 3, player: standings[2] ? { playerName: standings[2].playerName, playerId: standings[2].playerId } : null, prizePct: 0.15 }
    ];
  }, [tournament, format, bracketRounds, standings]);

  const totalMatches = fixtures.length;
  const completedMatches = fixtures.filter(m => m.status === 'COMPLETED').length;

  return (
    <PageShell
      title="Tournament Results"
      subtitle={`${name} • Concluded`}
      onBack={() => onNavigate && onNavigate(`/tournaments/${id}`)}
      actions={
        <button
          type="button"
          className="btn-tactile btn-amber"
          onClick={() => onNavigate && onNavigate(`/tournaments/${id}/champion`)}
        >
          <span>🎉</span>
          <span>Celebration</span>
        </button>
      }
    >
      <div className="tourn-results-container">
        {/* Podium Section */}
        <section className="results-podium-section">
          <h3 className="section-title">🏆 Top Podium Finishes</h3>

          <div className="podium-grid">
            {/* 2nd Place: Silver */}
            <div className="podium-card silver">
              <div className="podium-rank-badge">🥈 2nd</div>
              <div className="podium-avatar">👤</div>
              <PlayerName
                name={podium[1]?.player?.playerName || 'Runner-Up'}
                isCurrentUser={currentUserId && podium[1]?.player?.playerId === currentUserId}
              />
              <span className="podium-prize">
                🪙 <Num value={Math.round(prizePool * (podium[1]?.prizePct || 0.25))} /> Coins
              </span>
            </div>

            {/* 1st Place: Gold Champion */}
            <div className="podium-card gold">
              <div className="podium-rank-badge">🥇 CHAMPION</div>
              <div className="podium-avatar crown-avatar">👑</div>
              <PlayerName
                name={podium[0]?.player?.playerName || 'Champion'}
                isWinner={true}
                isCurrentUser={currentUserId && podium[0]?.player?.playerId === currentUserId}
              />
              <span className="podium-prize gold-prize">
                🪙 <Num value={Math.round(prizePool * (podium[0]?.prizePct || 0.60))} /> Coins
              </span>
            </div>

            {/* 3rd Place: Bronze */}
            <div className="podium-card bronze">
              <div className="podium-rank-badge">🥉 3rd</div>
              <div className="podium-avatar">👤</div>
              <PlayerName
                name={podium[2]?.player?.playerName || '3rd Place'}
                isCurrentUser={currentUserId && podium[2]?.player?.playerId === currentUserId}
              />
              <span className="podium-prize">
                🪙 <Num value={Math.round(prizePool * (podium[2]?.prizePct || 0.15))} /> Coins
              </span>
            </div>
          </div>
        </section>

        {/* Tournament Statistics */}
        <section className="results-stats-section">
          <h3 className="section-title">📊 Tournament Statistics</h3>
          <div className="stats-cards-grid">
            <div className="stat-card">
              <span className="stat-card-label">Matches Played</span>
              <span className="stat-card-val"><Num value={completedMatches} /> / <Num value={totalMatches} /></span>
            </div>
            <div className="stat-card">
              <span className="stat-card-label">Total Prize Pool</span>
              <span className="stat-card-val">🪙 <Num value={prizePool} /></span>
            </div>
            <div className="stat-card">
              <span className="stat-card-label">Participants</span>
              <span className="stat-card-val"><Num value={tournament.participants?.length || 8} /></span>
            </div>
            <div className="stat-card">
              <span className="stat-card-label">Format</span>
              <span className="stat-card-val">{format}</span>
            </div>
          </div>
        </section>

        {/* Action Buttons */}
        <div className="results-actions">
          {format !== 'LEAGUE' && (
            <button
              type="button"
              className="btn-tactile btn-primary"
              onClick={() => onNavigate && onNavigate(`/tournaments/${id}/bracket`)}
            >
              <span>🥊</span>
              <span>View Full Bracket</span>
            </button>
          )}
          {format !== 'KNOCKOUT' && (
            <button
              type="button"
              className="btn-tactile btn-amber"
              onClick={() => onNavigate && onNavigate(`/tournaments/${id}/table`)}
            >
              <span>📋</span>
              <span>View Final Standings</span>
            </button>
          )}
          <button
            type="button"
            className="btn-tactile btn-neutral"
            onClick={() => onNavigate && onNavigate('/tournaments')}
          >
            Back to Tournaments
          </button>
        </div>
      </div>
    </PageShell>
  );
}
