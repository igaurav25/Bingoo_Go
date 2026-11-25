/**
 * src/tournaments/components/StandingsTable.jsx
 * 
 * Responsive Standings Table Component.
 * Rules:
 * - Wide container: Real <table> with Rank, Player, Played, Won, Lost, Points, Win %.
 * - Narrow container: Compact cards with prominent Rank and Points.
 * - <Num> used on all figures with tabular-nums lining-nums, min-width 3ch, right aligned.
 * - <PlayerName> with overflow-wrap: anywhere, Noto Sans Devanagari safe, 2 lines max.
 * - Qualification cut line visible. Current user highlighted.
 * - Tie-break rule clearly stated.
 */

import React from 'react';
import { Num } from './Num.jsx';
import { PlayerName } from './PlayerName.jsx';
import { TrophyGraphic } from '../../components/SportsGraphics.jsx';

// Colored rank circular badge helper matching visual reference
function RankCircleBadge({ rank = 1 }) {
  const getBadgeStyle = (r) => {
    switch (r) {
      case 1:
        return { bg: '#32B879', shadow: '0 0 10px rgba(50, 184, 121, 0.5)' };
      case 2:
        return { bg: '#06B6D4', shadow: '0 0 10px rgba(6, 182, 212, 0.5)' };
      case 3:
        return { bg: '#EC4899', shadow: '0 0 10px rgba(236, 72, 153, 0.5)' };
      case 4:
        return { bg: '#3B82F6', shadow: '0 0 10px rgba(59, 130, 246, 0.5)' };
      default:
        return { bg: '#475569', shadow: 'none' };
    }
  };

  const style = getBadgeStyle(rank);

  return (
    <div
      style={{
        width: '24px',
        height: '24px',
        borderRadius: '50%',
        background: style.bg,
        boxShadow: style.shadow,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#FFFFFF',
        fontWeight: 900,
        fontSize: '0.78rem',
        margin: '0 auto'
      }}
    >
      {rank}
    </div>
  );
}

export function StandingsTable({
  standings = [],
  tournament = null,
  currentUserId = null,
  qualifierCutoff = 4,
  tieBreakRule = 'Points > Direct Head-to-Head > Total Wins > Win %',
  showLeagueBanner = false,
  showCompactOnMobile = false
}) {
  if (!standings || standings.length === 0) {
    return (
      <div className="tournament-empty-standings">
        <p>No matches completed yet. Standings will update as fixtures conclude.</p>
      </div>
    );
  }

  return (
    <div className="standings-container sports-standings-card" style={{
      background: 'var(--sports-card-bg, #101827)',
      border: '1px solid var(--sports-border, rgba(137, 149, 168, 0.2))',
      borderRadius: '20px',
      padding: '16px',
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)'
    }}>
      {/* Visual Reference Header: Bingo League Banner with Countdown Pill */}
      <div className="sports-league-header-banner" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        background: 'linear-gradient(90deg, #17243A 0%, #101827 100%)',
        border: '1px solid rgba(67, 139, 255, 0.25)',
        borderRadius: '16px',
        marginBottom: '14px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <TrophyGraphic size={42} />
          <div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: '#F4F6FA', letterSpacing: '-0.01em' }}>
              Bingo League
            </h3>
            <span style={{ fontSize: '0.76rem', color: '#8995A8', fontWeight: 700 }}>
              Compete • Climb • Win
            </span>
          </div>
        </div>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          background: 'rgba(40, 100, 217, 0.15)',
          border: '1px solid rgba(67, 139, 255, 0.3)',
          padding: '4px 12px',
          borderRadius: '10px'
        }}>
          <span style={{ fontSize: '0.65rem', color: tournament?.leagueLocked ? '#00E5A3' : '#F59E0B', fontWeight: 800, textTransform: 'uppercase' }}>
            {tournament?.leagueLocked ? 'League Complete' : 'Live Points Table'}
          </span>
          <span style={{ fontSize: '0.85rem', color: '#F4F6FA', fontWeight: 900, fontFamily: 'var(--font-sports-mono, monospace)' }}>
            {tournament?.leagueLocked ? 'Standings Locked' : `Top ${qualifierCutoff} Advance`}
          </span>
        </div>
      </div>

      {/* League Navigation Tabs: Standings, Fixtures, Top Players */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
        <button
          type="button"
          style={{
            background: 'var(--sports-royal, #2864D9)',
            border: '1px solid var(--sports-electric, #438BFF)',
            color: '#FFFFFF',
            fontWeight: 800,
            fontSize: '0.85rem',
            padding: '6px 16px',
            borderRadius: '9999px',
            cursor: 'pointer',
            boxShadow: '0 0 10px rgba(67, 139, 255, 0.35)'
          }}
        >
          Standings
        </button>
        <button
          type="button"
          style={{
            background: 'rgba(23, 36, 58, 0.6)',
            border: '1px solid rgba(137, 149, 168, 0.2)',
            color: '#8995A8',
            fontWeight: 700,
            fontSize: '0.85rem',
            padding: '6px 16px',
            borderRadius: '9999px',
            cursor: 'pointer'
          }}
        >
          Fixtures
        </button>
        <button
          type="button"
          style={{
            background: 'rgba(23, 36, 58, 0.6)',
            border: '1px solid rgba(137, 149, 168, 0.2)',
            color: '#8995A8',
            fontWeight: 700,
            fontSize: '0.85rem',
            padding: '6px 16px',
            borderRadius: '9999px',
            cursor: 'pointer'
          }}
        >
          Top Players
        </button>
      </div>

      {/* Active Tie-Break Rule Callout */}
      <div className="standings-rule-banner">
        <span className="rule-icon" aria-hidden="true">ℹ️</span>
        <span className="rule-text"><strong>Tie-Break Rule:</strong> {tieBreakRule}</span>
      </div>

      {standings.some(r => Boolean(r.tieBreakerNote)) && (
        <div
          className="standings-tiebreak-explained"
          style={{
            background: 'rgba(245, 158, 11, 0.12)',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            borderRadius: '10px',
            padding: '8px 12px',
            marginBottom: '12px',
            fontSize: '0.78rem',
            color: '#FDE68A'
          }}
        >
          <strong>⚖️ Tie-Breaker Applied:</strong>{' '}
          {standings
            .filter(r => Boolean(r.tieBreakerNote))
            .map(r => `#${r.rank} ${r.playerName}: ${r.tieBreakerNote}`)
            .join(' • ')}
        </div>
      )}

      {/* 1. Wide Desktop / Tablet View: Real <table> */}
      <div className="standings-table-wrapper" role="region" aria-label="Points Table">
        <table className="tournament-points-table">
          <thead>
            <tr>
              <th scope="col" style={{ width: '4.5ch', textAlign: 'center' }}>#</th>
              <th scope="col" style={{ minWidth: '10rem', textAlign: 'start' }}>Player</th>
              <th scope="col" style={{ width: '4ch', textAlign: 'end' }}>P</th>
              <th scope="col" style={{ width: '4ch', textAlign: 'end' }}>W</th>
              <th scope="col" style={{ width: '4ch', textAlign: 'end' }}>L</th>
              <th scope="col" style={{ width: '6ch', textAlign: 'end' }}>Win %</th>
              <th scope="col" style={{ width: '7ch', textAlign: 'center' }}>H2H</th>
              <th scope="col" style={{ width: '6ch', textAlign: 'end' }}>Pts ▲</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((row, idx) => {
              const isCutLine = idx === qualifierCutoff - 1 && idx < standings.length - 1;
              const isUser = currentUserId && row.playerId === currentUserId;
              const isRankOne = row.rank === 1 || idx === 0;

              return (
                <React.Fragment key={row.playerId}>
                  <tr className={`standings-tr ${row.qualified ? 'is-qualified' : ''} ${isUser ? 'is-user-row' : ''} ${isRankOne ? 'rank-one-highlight' : ''}`}>
                    <td style={{ textAlign: 'center' }}>
                      <RankCircleBadge rank={row.rank || idx + 1} />
                    </td>
                    <td>
                      {row.isTeam ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '1.25rem' }}>{row.logo || '🛡️'}</span>
                          <div>
                            <strong style={{ display: 'block', color: 'var(--tourn-text-primary)' }}>{row.playerName}</strong>
                            {row.captainName && (
                              <span style={{ fontSize: '0.72rem', color: 'var(--tourn-text-muted)' }}>👑 Capt: {row.captainName}</span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '1.1rem' }} aria-hidden="true">{row.avatar || '🦊'}</span>
                          <PlayerName
                            name={row.playerName}
                            isCurrentUser={isUser}
                          />
                        </div>
                      )}
                    </td>
                    <td><Num value={row.played} /></td>
                    <td><Num value={row.won} /></td>
                    <td><Num value={row.lost} /></td>
                    <td><Num value={row.winRate} /></td>
                    <td style={{ textAlign: 'center', fontFamily: 'var(--font-sports-mono, monospace)', fontSize: '0.78rem', color: '#94A3B8' }}>
                      {row.h2hSummary || '-'}
                    </td>
                    <td>
                      <Num
                        value={row.points}
                        variant="points"
                        className="pts-highlight"
                      />
                    </td>
                  </tr>

                  {/* Qualification Line */}
                  {isCutLine && (
                    <tr className="qualification-cut-line-tr" aria-hidden="true">
                      <td colSpan={8}>
                        <div className="qualification-cut-line">
                          <span>▲ Top {qualifierCutoff} Qualify for Playoffs</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 2. Narrow Mobile View: Stacked Cards */}
      <div className="standings-cards-list">
        {standings.map((row, idx) => {
          const isCutLine = idx === qualifierCutoff - 1 && idx < standings.length - 1;
          const isUser = currentUserId && row.playerId === currentUserId;

          return (
            <React.Fragment key={row.playerId}>
              <div className={`standings-card ${row.qualified ? 'is-qualified' : ''} ${isUser ? 'is-user-card' : ''}`}>
                <div className="standings-card-top">
                  <div className="rank-and-name">
                    <Num value={row.rank} variant="rank" prefix="#" align="start" />
                    {row.isTeam ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '1.2rem' }}>{row.logo || '🛡️'}</span>
                        <div>
                          <strong style={{ fontSize: '0.92rem', color: 'var(--tourn-text-primary)' }}>{row.playerName}</strong>
                          {row.captainName && (
                            <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--tourn-text-muted)' }}>👑 Capt: {row.captainName}</span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '1rem' }} aria-hidden="true">{row.avatar || '🦊'}</span>
                        <PlayerName name={row.playerName} isCurrentUser={isUser} />
                      </div>
                    )}
                  </div>
                  <div className="points-badge">
                    <span className="pts-label">PTS</span>
                    <Num value={row.points} variant="points" />
                  </div>
                </div>

                <div className="standings-card-stats-row">
                  <div className="stat-pill">
                    <span className="stat-label">Played</span>
                    <Num value={row.played} align="start" />
                  </div>
                  <div className="stat-pill">
                    <span className="stat-label">Won</span>
                    <Num value={row.won} align="start" />
                  </div>
                  <div className="stat-pill">
                    <span className="stat-label">Lost</span>
                    <Num value={row.lost} align="start" />
                  </div>
                  <div className="stat-pill">
                    <span className="stat-label">Win %</span>
                    <Num value={row.winRate} align="start" />
                  </div>
                  <div className="stat-pill">
                    <span className="stat-label">H2H</span>
                    <span style={{ fontWeight: 700, fontSize: '0.82rem' }}>{row.h2hSummary || '-'}</span>
                  </div>
                </div>
              </div>

              {isCutLine && (
                <div className="qualification-cut-pill" aria-hidden="true">
                  <span>▲ Top {qualifierCutoff} Qualify for Playoffs</span>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
