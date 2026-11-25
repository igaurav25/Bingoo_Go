/**
 * src/components/AchievementModal.jsx
 * 
 * Rewards & Achievements Unlock Modal.
 * Recreated with pixel-fidelity from the visual reference board:
 * - "Achievement Unlocked!" header
 * - Radiant Golden Laurel Wreath Crest with Crown & Star
 * - "Tournament Champion" title
 * - "Win a Knockout Tournament" requirement
 * - "+2,000 Coins" golden reward stack
 * - "Claim Reward" tactile golden button
 */

import React from 'react';
import { CoinIcon } from './SportsGraphics.jsx';

export function AchievementModal({
  isOpen = true,
  title = 'Tournament Champion',
  description = 'Win a Knockout Tournament',
  rewardCoins = 2000,
  onClaim,
  onClose
}) {
  if (!isOpen) return null;

  return (
    <div
      className="achievement-modal-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(12, 20, 34, 0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px'
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="achievement-card"
        style={{
          background: 'linear-gradient(180deg, #17243A 0%, #101827 100%)',
          border: '1.5px solid rgba(243, 185, 79, 0.45)',
          borderRadius: '24px',
          padding: '28px 24px',
          maxWidth: '380px',
          width: '100%',
          textAlign: 'center',
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.7), 0 0 35px rgba(243, 185, 79, 0.25)',
          position: 'relative'
        }}
      >
        {/* Close Button */}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              background: 'none',
              border: 'none',
              color: '#8995A8',
              fontSize: '1.2rem',
              cursor: 'pointer',
              padding: '4px'
            }}
            aria-label="Close"
          >
            ✕
          </button>
        )}

        {/* Top Header Badge */}
        <h3
          style={{
            margin: '0 0 16px',
            fontSize: '1.15rem',
            fontWeight: 900,
            color: '#F4F6FA',
            letterSpacing: '0.04em'
          }}
        >
          Achievement Unlocked!
        </h3>

        {/* Radiant Golden Laurel Wreath Crest with Crown & Star */}
        <div style={{ position: 'relative', width: '110px', height: '110px', margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {/* Radial Sunburst Glow */}
          <div style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            background: 'radial-gradient(circle, rgba(243, 185, 79, 0.45) 0%, transparent 70%)',
            borderRadius: '50%',
            pointerEvents: 'none'
          }} />

          <svg width="100" height="100" viewBox="0 0 100 100" fill="none">
            <defs>
              <linearGradient id="crestGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FFF4B8" />
                <stop offset="45%" stopColor="#F3B94F" />
                <stop offset="85%" stopColor="#D97706" />
                <stop offset="100%" stopColor="#92400E" />
              </linearGradient>
            </defs>

            {/* Laurel Wreath Left */}
            <path
              d="M 24 68 C 12 50, 18 28, 36 20 M 20 54 C 14 44, 20 32, 30 26 M 26 40 C 22 34, 28 26, 36 24"
              stroke="url(#crestGoldGrad)"
              strokeWidth="2.5"
              strokeLinecap="round"
            />

            {/* Laurel Wreath Right */}
            <path
              d="M 76 68 C 88 50, 82 28, 64 20 M 80 54 C 86 44, 80 32, 70 26 M 74 40 C 78 34, 72 26, 64 24"
              stroke="url(#crestGoldGrad)"
              strokeWidth="2.5"
              strokeLinecap="round"
            />

            {/* Central Circular Shield */}
            <circle cx="50" cy="50" r="26" fill="#17243A" stroke="url(#crestGoldGrad)" strokeWidth="2.5" />
            <circle cx="50" cy="50" r="22" fill="#101827" />

            {/* Crown & Star */}
            <polygon
              points="38,55 42,43 47,48 50,40 53,48 58,43 62,55"
              fill="url(#crestGoldGrad)"
            />
            <circle cx="50" cy="38" r="2" fill="#FFFFFF" />
            <polygon
              points="50,56 52,60 56,60 53,63 54,67 50,64 46,67 47,63 44,60 48,60"
              fill="#FFFFFF"
            />
          </svg>
        </div>

        {/* Title & Subtitle */}
        <h4
          style={{
            margin: '0 0 4px',
            fontSize: '1.25rem',
            fontWeight: 900,
            color: '#F4F6FA',
            letterSpacing: '-0.01em'
          }}
        >
          {title}
        </h4>
        <p style={{ margin: '0 0 16px', fontSize: '0.85rem', color: '#8995A8' }}>
          {description}
        </p>

        {/* Reward Pill: +2,000 Coins */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(243, 185, 79, 0.15)',
            border: '1px solid rgba(243, 185, 79, 0.4)',
            borderRadius: '9999px',
            padding: '8px 20px',
            marginBottom: '20px'
          }}
        >
          <CoinIcon size={20} />
          <span
            style={{
              fontWeight: 900,
              color: '#F3B94F',
              fontSize: '1.1rem',
              letterSpacing: '0.02em'
            }}
          >
            +{rewardCoins.toLocaleString()} Coins
          </span>
        </div>

        {/* Claim Reward Button */}
        <button
          type="button"
          onClick={onClaim || onClose}
          style={{
            width: '100%',
            minHeight: '48px',
            borderRadius: '9999px',
            background: 'linear-gradient(180deg, #FFF4B8 0%, #F59E0B 45%, #D97706 80%, #78350F 100%)',
            border: '1.5px solid #FFF4B8',
            color: '#000000',
            fontFamily: "'Cabinet Grotesk', system-ui, sans-serif",
            fontWeight: 900,
            fontSize: '1.05rem',
            letterSpacing: '0.04em',
            cursor: 'pointer',
            boxShadow: '0 4px 18px rgba(243, 185, 79, 0.5)'
          }}
        >
          Claim Reward
        </button>
      </div>
    </div>
  );
}
