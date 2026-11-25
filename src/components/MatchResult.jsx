/**
 * src/components/MatchResult.jsx
 *
 * Authoritative Match Victory / Defeat Result Modal.
 * Renders real competitor identities, scores, match duration, verified rewards,
 * rematch voting state, and tournament progression links.
 */

import React, { useState, useEffect } from 'react';
import { VictoryCrest, DefeatCrest, CoinIcon, AvatarFrame } from './SportsGraphics.jsx';

export function MatchResult({
  result,
  playerName = 'You',
  playerAvatar = '🦊',
  playerLevel = 1,
  opponent = null,
  tournamentMatch = null,
  completedLinesCount = 5,
  rematchRequested = false,
  onRematch,
  onReturnHome,
  onNavigateTournament
}) {
  const coinsAwardedRaw = result?.coinsAwarded || 0;
  const [displayedCoins, setDisplayedCoins] = useState(0);

  useEffect(() => {
    if (!result || coinsAwardedRaw <= 0) {
      setDisplayedCoins(0);
      return;
    }
    let frame = 0;
    const steps = 12;
    const timer = setInterval(() => {
      frame += 1;
      setDisplayedCoins(Math.min(coinsAwardedRaw, Math.round((coinsAwardedRaw * frame) / steps)));
      if (frame >= steps) clearInterval(timer);
    }, 38);
    return () => clearInterval(timer);
  }, [result, coinsAwardedRaw]);

  if (!result) return null;

  const { won, reason = '', coinsAwarded = 0, durationSeconds = 0 } = result;
  const isTourn = Boolean(tournamentMatch && tournamentMatch.tournamentId);
  const oppName = opponent?.name || 'Opponent';
  const oppAvatar = opponent?.avatar || '🐯';
  const oppLevel = opponent?.level || 14;
  const oppLines = opponent?.linesCompleted ?? (won ? Math.min(4, Math.max(0, completedLinesCount - 1)) : 5);

  return (
    <div className="match-result-overlay" role="dialog" aria-modal="true">
      <div className={`match-result-card sports-result-card ${won ? 'victory-card' : 'defeat-card'}`} style={{
        background: 'linear-gradient(180deg, #17243A 0%, #101827 100%)',
        border: '1.5px solid rgba(243, 185, 79, 0.4)',
        borderRadius: '24px',
        padding: '24px 20px',
        maxWidth: '440px',
        width: '92%',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.7), 0 0 30px rgba(243, 185, 79, 0.2)',
        textAlign: 'center',
        margin: '0 auto'
      }}>
        <div style={{ margin: '4px 0 2px' }}>
          {won ? <VictoryCrest size={92} /> : <DefeatCrest size={92} />}
        </div>

        {/* Head-to-Head Real Score Card */}
        <div className="match-result-score-block" style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(0, 0, 0, 0.35)',
          border: '1px solid rgba(67, 139, 255, 0.25)',
          borderRadius: '16px',
          padding: '10px 14px',
          margin: '12px 0 8px',
          width: '100%',
          boxSizing: 'border-box',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <AvatarFrame avatar={playerAvatar} level={playerLevel} rank="Challenger" size={38} />
            <div style={{ textAlign: 'left', minWidth: 0 }}>
              <strong style={{ display: 'block', fontSize: '0.84rem', color: '#F4F6FA', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '88px' }}>
                {playerName}
              </strong>
              <span style={{ fontSize: '0.68rem', color: '#F3B94F', fontWeight: 800 }}>Lv. {playerLevel}</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <span style={{ fontSize: '1.6rem', fontWeight: 900, color: won ? '#F3B94F' : '#F4F6FA', fontFamily: 'var(--font-sports-mono, monospace)' }}>
              {completedLinesCount}
            </span>
            <span style={{
              fontSize: '0.68rem',
              fontWeight: 900,
              color: '#F3B94F',
              background: 'rgba(243, 185, 79, 0.2)',
              border: '1px solid rgba(243, 185, 79, 0.4)',
              padding: '2px 7px',
              borderRadius: '9999px'
            }}>
              VS
            </span>
            <span style={{ fontSize: '1.6rem', fontWeight: 900, color: won ? '#8995A8' : '#F3B94F', fontFamily: 'var(--font-sports-mono, monospace)' }}>
              {oppLines}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <div style={{ textAlign: 'right', minWidth: 0 }}>
              <strong style={{ display: 'block', fontSize: '0.84rem', color: '#F4F6FA', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '88px' }}>
                {oppName}
              </strong>
              <span style={{ fontSize: '0.68rem', color: '#8995A8', fontWeight: 800 }}>Lv. {oppLevel}</span>
            </div>
            <AvatarFrame avatar={oppAvatar} level={oppLevel} rank="Opponent" size={38} />
          </div>
        </div>

        {durationSeconds > 0 && (
          <div style={{ fontSize: '0.76rem', color: '#8995A8', marginBottom: '8px' }}>
            Match Duration: <strong style={{ color: '#F4F6FA' }}>{durationSeconds}s</strong>
          </div>
        )}

        {coinsAwarded > 0 && (
          <div style={{
            background: 'rgba(243, 185, 79, 0.1)',
            border: '1px solid rgba(243, 185, 79, 0.35)',
            borderRadius: '14px',
            padding: '8px 14px',
            margin: '6px 0 12px'
          }}>
            <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: '#8995A8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Verified Match Reward
            </span>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <CoinIcon size={18} />
                <span style={{ fontWeight: 900, color: '#F3B94F', fontSize: '1.05rem' }}>
                  +{displayedCoins.toLocaleString()} Coins
                </span>
              </div>
            </div>
          </div>
        )}

        {isTourn && (
          <div style={{
            background: 'rgba(40, 100, 217, 0.15)',
            border: '1px solid rgba(67, 139, 255, 0.35)',
            borderRadius: '12px',
            padding: '10px 14px',
            margin: '0 0 12px',
            textAlign: 'center'
          }}>
            <span style={{ fontSize: '0.76rem', color: '#93C5FD', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              🏆 {tournamentMatch.tournamentName || 'Tournament Match'} • {tournamentMatch.roundTitle || 'Fixture'}
            </span>
            <strong style={{ display: 'block', fontSize: '0.88rem', color: won ? '#32B879' : '#EF4444', marginTop: '2px' }}>
              {won ? '✓ Match Result Verified: You Advanced!' : '✕ Match Result Verified: Match Concluded'}
            </strong>
            <span style={{ display: 'block', fontSize: '0.76rem', color: won ? '#FDE68A' : '#94A3B8', fontWeight: 800, marginTop: '3px' }}>
              {won ? '+2 Tournament Points Credited by Server' : '0 Tournament Points (Standings Updated)'}
            </span>
          </div>
        )}

        <p className="result-reason" style={{ margin: '0 0 14px', fontSize: '0.84rem', color: '#8995A8' }}>
          {reason || (won ? 'Server verified your 5-line BINGO victory!' : 'Opponent completed BINGO first.')}
        </p>

        {isTourn ? (
          <div className="result-actions-row" style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
            <button
              type="button"
              className="btn-tactile btn-gold"
              style={{
                width: '100%',
                minHeight: '44px',
                fontSize: '0.95rem',
                fontWeight: 900,
                background: 'linear-gradient(180deg, #FFF4B8 0%, #F59E0B 45%, #D97706 80%, #78350F 100%)',
                border: '1.5px solid #FFF4B8',
                color: '#000000',
                borderRadius: '9999px',
                cursor: 'pointer'
              }}
              onClick={() => onNavigateTournament && onNavigateTournament(`/tournaments/${tournamentMatch.tournamentId}`)}
            >
              🏆 Tournament Overview
            </button>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', width: '100%' }}>
              <button
                type="button"
                className="btn-tactile btn-primary"
                style={{ minHeight: '40px', fontSize: '0.85rem', fontWeight: 700, borderRadius: '9999px', cursor: 'pointer' }}
                onClick={() => onNavigateTournament && onNavigateTournament(`/tournaments/${tournamentMatch.tournamentId}/table`)}
              >
                📋 Standings
              </button>
              <button
                type="button"
                className="btn-tactile btn-primary"
                style={{ minHeight: '40px', fontSize: '0.85rem', fontWeight: 700, borderRadius: '9999px', cursor: 'pointer' }}
                onClick={() => onNavigateTournament && onNavigateTournament(`/tournaments/${tournamentMatch.tournamentId}/bracket`)}
              >
                ⚔️ Bracket
              </button>
            </div>

            <button
              type="button"
              className="btn-tactile btn-secondary"
              style={{ minHeight: '40px', fontSize: '0.85rem', fontWeight: 700, borderRadius: '9999px', cursor: 'pointer', width: '100%' }}
              onClick={() => onNavigateTournament && onNavigateTournament('/tournaments')}
            >
              ← Back to Tournaments
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
            <button
              type="button"
              className="btn-tactile btn-gold"
              disabled={rematchRequested}
              style={{
                width: '100%',
                minHeight: '46px',
                fontSize: '1rem',
                fontWeight: 900,
                background: 'linear-gradient(180deg, #FFF4B8 0%, #F59E0B 45%, #D97706 80%, #78350F 100%)',
                border: '1.5px solid #FFF4B8',
                color: '#000000',
                borderRadius: '9999px',
                cursor: rematchRequested ? 'default' : 'pointer',
                opacity: rematchRequested ? 0.7 : 1
              }}
              onClick={onRematch}
            >
              {rematchRequested ? '⏳ Waiting for Opponent Rematch...' : '↻ Play Again'}
            </button>
            <button
              type="button"
              className="btn-tactile btn-primary"
              style={{
                width: '100%',
                minHeight: '44px',
                fontSize: '0.92rem',
                fontWeight: 800,
                background: 'linear-gradient(180deg, #438BFF 0%, #2864D9 100%)',
                color: '#F4F6FA',
                borderRadius: '9999px',
                cursor: 'pointer'
              }}
              onClick={onReturnHome}
            >
              Back to Home
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
