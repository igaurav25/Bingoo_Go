/**
 * src/components/BingoButton.jsx
 * 
 * Central Tactile Golden BINGO Claim Button.
 * Recreated with high fidelity from visual reference board:
 * - Rich 3D golden bevel gradient with luminous highlight
 * - Status progress pips (1-5 lines)
 * - Pulsates with golden corona when 5 lines are complete
 */

import React from 'react';

export function BingoButton({ isActive, isSubmitting = false, completedLinesCount = 0, onClick }) {
  const progressPips = [0, 1, 2, 3, 4];
  const count = Math.min(5, Math.max(0, completedLinesCount));

  return (
    <div className="bingo-claim-wrap sports-bingo-claim-wrap">
      <button
        type="button"
        className={`bingo-claim-btn sports-gold-bingo-btn ${isSubmitting ? 'submitting' : isActive ? 'active-pulse' : 'locked'}`}
        disabled={!isActive || isSubmitting}
        onClick={onClick}
        aria-label="Claim BINGO Victory"
        aria-busy={isSubmitting}
        style={{
          width: '100%',
          maxWidth: '320px',
          minHeight: '52px',
          borderRadius: '9999px',
          background: isActive
            ? 'linear-gradient(180deg, #FFF4B8 0%, #F59E0B 45%, #D97706 80%, #92400E 100%)'
            : 'rgba(20, 28, 58, 0.85)',
          border: isActive ? '2px solid #FFF4B8' : '1.5px solid rgba(139, 92, 246, 0.35)',
          boxShadow: isActive
            ? '0 6px 26px rgba(245, 158, 11, 0.65), inset 0 2px 2px rgba(255, 255, 255, 0.8)'
            : '0 4px 12px rgba(0, 0, 0, 0.35)',
          color: isActive ? '#000000' : '#94A3B8',
          cursor: isActive ? 'pointer' : 'not-allowed',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '8px 20px',
          transition: 'transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease, opacity 0.2s ease',
          margin: '0 auto'
        }}
      >
        {isSubmitting ? (
          <span className="bingo-btn-spinner" aria-hidden="true" />
        ) : (
          <span
            className="bingo-btn-text"
            style={{
              fontFamily: "'Cabinet Grotesk', system-ui, sans-serif",
              fontWeight: 900,
              fontSize: '1.4rem',
              letterSpacing: '0.08em',
              lineHeight: 1,
              textShadow: '0 1px 0 rgba(255, 255, 255, 0.5)'
            }}
          >
            BINGO!
          </span>
        )}
        <div className="bingo-pips-row" aria-hidden="true" style={{ display: 'flex', gap: '4px', marginTop: '3px' }}>
          {progressPips.map((pip) => (
            <span
              key={pip}
              className={`bingo-pip ${pip < count ? 'filled' : ''}`}
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: pip < count ? (isActive ? '#000000' : '#FBBF24') : 'rgba(148, 163, 184, 0.35)',
                boxShadow: pip < count && !isActive ? '0 0 6px rgba(251, 191, 36, 0.6)' : 'none'
              }}
            />
          ))}
        </div>
      </button>

      {/* Contextual Explanation Subtitle */}
      <div className="bingo-claim-help-text" aria-live="polite" style={{ marginTop: '6px', textAlign: 'center' }}>
        {isSubmitting ? (
          <span className="help-submitting" style={{ color: '#F3B94F', fontSize: '0.8rem', fontWeight: 800 }}>⏳ Server checking your 5-line win...</span>
        ) : isActive ? (
          <span className="help-active" style={{ color: '#F3B94F', fontSize: '0.85rem', fontWeight: 900 }}>⚡ 5 Lines Complete! Tap BINGO to Claim Win!</span>
        ) : (
          <span className="help-locked" style={{ color: '#8995A8', fontSize: '0.78rem' }}>🔒 {count}/5 lines complete • Complete 5 lines to unlock</span>
        )}
      </div>
    </div>
  );
}
