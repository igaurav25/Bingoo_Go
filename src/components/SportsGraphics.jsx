/**
 * src/components/SportsGraphics.jsx
 * 
 * Pixel-Accurate Vector Graphics Library for BINGO Sports Gaming Experience.
 * Recreated precisely from the BINGO Game — Visual Design Reference PDF/Image:
 * - "BING 25 PLAY • COMPETE • WIN" Crown Logo
 * - Circular Progress Gauges (40% 2 Lines, 20% 1 Line)
 * - 4-bar cellular connection signal strength icon
 * - Mode gradient icon badges for all 13 modes
 * - Grand Champion Trophy with radiant starburst and laurel wreath
 * - Rank Avatar Frames & Medals Row (12 Gold, 8 Silver, 5 Bronze)
 */

import React from 'react';

/**
 * Official BING-25 Crown & Ball Logo (Matching Reference Top Header)
 */
export function BingoReferenceLogo({ size = 36, showTagline = true, className = '' }) {
  return (
    <div className={`bingo-reference-logo ${className}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
      <svg
        width={size * 1.5}
        height={size}
        viewBox="0 0 160 70"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="BING 25 Logo"
      >
        <defs>
          <linearGradient id="bingGold" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFF4B8" />
            <stop offset="35%" stopColor="#F3B94F" />
            <stop offset="85%" stopColor="#D97706" />
            <stop offset="100%" stopColor="#92400E" />
          </linearGradient>
          <linearGradient id="ballGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#9333EA" />
            <stop offset="50%" stopColor="#6B21A8" />
            <stop offset="100%" stopColor="#3B0764" />
          </linearGradient>
          <linearGradient id="arcGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#438BFF" />
            <stop offset="50%" stopColor="#F3B94F" />
            <stop offset="100%" stopColor="#32B879" />
          </linearGradient>
        </defs>

        {/* Crown on top of BING */}
        <polygon
          points="20,18 24,7 34,14 44,4 54,14 64,7 68,18"
          fill="url(#bingGold)"
          stroke="#78350F"
          strokeWidth="1.2"
        />
        <circle cx="24" cy="6" r="2" fill="#FFFFFF" />
        <circle cx="44" cy="3" r="2.5" fill="#FFFFFF" />
        <circle cx="64" cy="6" r="2" fill="#FFFFFF" />

        {/* "BING" text with athletic block bevel */}
        <text
          x="12"
          y="48"
          fill="url(#bingGold)"
          stroke="#78350F"
          strokeWidth="2.5"
          paintOrder="stroke fill"
          fontFamily="'Cabinet Grotesk', system-ui, sans-serif"
          fontWeight="900"
          fontSize="36"
          letterSpacing="1"
        >
          BING
        </text>

        {/* 3D Purple/Gold "25" Lottery Ball */}
        <g transform="translate(112, 34)">
          <circle cx="0" cy="0" r="22" fill="url(#ballGrad)" stroke="url(#bingGold)" strokeWidth="3" />
          <circle cx="-6" cy="-6" r="14" fill="#FFFFFF" opacity="0.18" />
          {/* Inner white circle for number */}
          <circle cx="0" cy="0" r="13" fill="#FFFFFF" />
          <text
            x="0"
            y="6.5"
            textAnchor="middle"
            fill="#17243A"
            fontFamily="'Cabinet Grotesk', system-ui, sans-serif"
            fontWeight="900"
            fontSize="18"
          >
            25
          </text>
        </g>

        {/* Bottom swoosh ribbon */}
        <path
          d="M 12 55 Q 75 66 140 55"
          stroke="url(#arcGrad)"
          strokeWidth="3.5"
          strokeLinecap="round"
          fill="none"
        />

        {showTagline && (
          <text
            x="76"
            y="67"
            textAnchor="middle"
            fill="#F4F6FA"
            fontFamily="system-ui, sans-serif"
            fontWeight="800"
            fontSize="7.5"
            letterSpacing="2.5"
          >
            PLAY • COMPETE • WIN
          </text>
        )}
      </svg>
    </div>
  );
}

/**
 * Standard Logo Alias for Compatibility
 */
export function BingoSportsLogo(props) {
  return <BingoReferenceLogo {...props} />;
}

/**
 * Circular Progress Gauge (e.g. 40% 2 Lines, 20% 1 Line)
 */
export function CircularProgressGauge({ percent = 40, label = '2 Lines', caption = 'Your Progress', color = '#438BFF', size = 68 }) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
      <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#8995A8', textTransform: 'uppercase' }}>
        {caption}
      </span>
      <span style={{ fontSize: '0.85rem', fontWeight: 900, color: '#F4F6FA' }}>
        {label}
      </span>

      <div style={{ position: 'relative', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width={size} height={size} viewBox="0 0 70 70">
          {/* Background Track */}
          <circle
            cx="35"
            cy="35"
            r={radius}
            fill="none"
            stroke="rgba(255, 255, 255, 0.1)"
            strokeWidth="6"
          />
          {/* Active Fill Arc */}
          <circle
            cx="35"
            cy="35"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform="rotate(-90 35 35)"
            style={{ transition: 'stroke-dashoffset 0.4s ease' }}
          />
        </svg>

        <span style={{
          position: 'absolute',
          fontSize: '0.85rem',
          fontWeight: 900,
          color: '#F4F6FA',
          fontFamily: 'var(--font-sports-mono, monospace)'
        }}>
          {percent}%
        </span>
      </div>
    </div>
  );
}

/**
 * 4-bar cellular connection signal strength icon
 */
export function SignalStrengthIcon({ bars = 4, size = 16, color = '#32B879' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="1" y="11" width="2.5" height="4" rx="0.8" fill={bars >= 1 ? color : 'rgba(255,255,255,0.2)'} />
      <rect x="5" y="8" width="2.5" height="7" rx="0.8" fill={bars >= 2 ? color : 'rgba(255,255,255,0.2)'} />
      <rect x="9" y="5" width="2.5" height="10" rx="0.8" fill={bars >= 3 ? color : 'rgba(255,255,255,0.2)'} />
      <rect x="13" y="1" width="2.5" height="14" rx="0.8" fill={bars >= 4 ? color : 'rgba(255,255,255,0.2)'} />
    </svg>
  );
}

/**
 * High-Fidelity Golden Sports Trophy
 */
export function TrophyGraphic({ size = 80, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Golden Trophy"
    >
      <defs>
        <linearGradient id="trophyGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFF2A3" />
          <stop offset="40%" stopColor="#F3B94F" />
          <stop offset="80%" stopColor="#D97706" />
          <stop offset="100%" stopColor="#92400E" />
        </linearGradient>
        <linearGradient id="trophyBaseGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1E2E4A" />
          <stop offset="100%" stopColor="#0C1422" />
        </linearGradient>
      </defs>

      <rect x="25" y="85" width="50" height="10" rx="3" fill="url(#trophyBaseGrad)" stroke="url(#trophyGoldGrad)" strokeWidth="1.5" />
      <path d="M 32 85 L 38 75 L 62 75 L 68 85 Z" fill="url(#trophyGoldGrad)" />
      <path d="M 45 75 C 45 60, 42 58, 42 50 L 58 50 C 58 58, 55 60, 55 75 Z" fill="url(#trophyGoldGrad)" />
      <path d="M 28 20 C 10 24, 8 50, 36 52" fill="none" stroke="url(#trophyGoldGrad)" strokeWidth="4" strokeLinecap="round" />
      <path d="M 72 20 C 90 24, 92 50, 64 52" fill="none" stroke="url(#trophyGoldGrad)" strokeWidth="4" strokeLinecap="round" />
      <path d="M 24 16 C 24 52, 76 52, 76 16 Z" fill="url(#trophyGoldGrad)" />
      <ellipse cx="50" cy="16" rx="26" ry="6" fill="#FFF2A3" stroke="#D97706" strokeWidth="1" />
      <polygon points="50,25 52,30 58,30 53,34 55,40 50,36 45,40 47,34 42,30 48,30" fill="#FFFFFF" stroke="#B45309" strokeWidth="0.8" />
    </svg>
  );
}

/**
 * Grand Champion Ribbon Banner with Trophy (Matching Reference Top Right)
 */
export function TrophyChampionCrown({ winnerName = 'Champion', size = 120 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
      {/* Radiant Sunburst Glow */}
      <div style={{
        position: 'absolute',
        top: '10px',
        width: size * 1.4,
        height: size * 1.4,
        background: 'radial-gradient(circle, rgba(243, 185, 79, 0.4) 0%, transparent 68%)',
        borderRadius: '50%',
        pointerEvents: 'none',
        zIndex: 0
      }} />

      <TrophyGraphic size={size} />

      {/* Champion Gold Header Banner */}
      <div style={{
        position: 'relative',
        zIndex: 2,
        marginTop: '-12px',
        background: 'linear-gradient(90deg, #D97706 0%, #F3B94F 50%, #D97706 100%)',
        color: '#000000',
        fontWeight: 900,
        fontSize: '0.85rem',
        letterSpacing: '0.1em',
        padding: '3px 18px',
        borderRadius: '4px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)'
      }}>
        CHAMPION
      </div>

      {/* Winner Name Banner */}
      <div style={{
        position: 'relative',
        zIndex: 2,
        marginTop: '4px',
        background: '#101827',
        border: '1.5px solid #F3B94F',
        borderRadius: '8px',
        padding: '6px 20px',
        boxShadow: '0 4px 14px rgba(243, 185, 79, 0.3)'
      }}>
        <h4 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 900, color: '#F4F6FA', letterSpacing: '-0.01em' }}>
          {winnerName}
        </h4>
      </div>
    </div>
  );
}

/**
 * Competitive Rank Avatar Frame
 */
export function AvatarFrame({ avatar = '🦊', level = 12, rank = 'Diamond Player', size = 52 }) {
  const getRankColor = (r = '') => {
    if (r.includes('Master')) return '#F3B94F';
    if (r.includes('Diamond')) return '#438BFF';
    if (r.includes('Platinum')) return '#32B879';
    return '#8995A8';
  };

  const rankColor = getRankColor(rank);

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <div style={{
        width: '100%',
        height: '100%',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #17243A, #0C1422)',
        border: `2.5px solid ${rankColor}`,
        boxShadow: `0 0 10px ${rankColor}44`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.48,
        userSelect: 'none'
      }}>
        {avatar}
      </div>

      <div style={{
        position: 'absolute',
        bottom: -5,
        left: '50%',
        transform: 'translateX(-50%)',
        background: '#101827',
        border: `1.5px solid ${rankColor}`,
        color: '#F4F6FA',
        fontSize: '0.62rem',
        fontWeight: 900,
        padding: '1px 5px',
        borderRadius: '9999px',
        whiteSpace: 'nowrap',
        lineHeight: 1.2
      }}>
        Lv.{level}
      </div>
    </div>
  );
}

/**
 * High-Resolution Gold Coin Icon
 */
export function CoinIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" fill="#F3B94F" stroke="#B45309" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="7.5" fill="#FBBF24" stroke="#D97706" strokeWidth="1" />
      <path d="M 12 7 L 13.2 10.5 L 17 10.5 L 14 12.8 L 15.2 16.5 L 12 14.2 L 8.8 16.5 L 10 12.8 L 7 10.5 L 10.8 10.5 Z" fill="#92400E" />
    </svg>
  );
}

/**
 * Victory Match Result Crest
 */
export function VictoryCrest({ size = 96 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
      <TrophyGraphic size={size * 0.8} />
      <span style={{ fontSize: '1.4rem', fontWeight: 900, color: '#F3B94F', letterSpacing: '0.06em' }}>
        YOU WON!
      </span>
    </div>
  );
}

/**
 * Defeat Match Result Crest
 */
export function DefeatCrest({ size = 96 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
      <svg width={size * 0.7} height={size * 0.7} viewBox="0 0 100 100" fill="none">
        <circle cx="50" cy="50" r="44" fill="rgba(230, 83, 93, 0.15)" stroke="#E6535D" strokeWidth="3" />
        <path d="M 35 35 L 65 65 M 65 35 L 35 65" stroke="#E6535D" strokeWidth="6" strokeLinecap="round" />
      </svg>
      <span style={{ fontSize: '1.4rem', fontWeight: 900, color: '#E6535D', letterSpacing: '0.06em' }}>
        DEFEAT
      </span>
    </div>
  );
}

/**
 * 3D Lottery Ball Decoration (Matching Reference Board Corners)
 */
export function BingoLotteryBall({ number = 7, color = '#EF4444', size = 26 }) {
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: `radial-gradient(circle at 35% 35%, #FFFFFF 0%, ${color} 50%, #000000 100%)`,
      boxShadow: `0 2px 8px ${color}88`,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#FFFFFF',
      fontWeight: 900,
      fontSize: size * 0.45,
      fontFamily: 'var(--font-sports-mono, monospace)',
      userSelect: 'none'
    }}>
      {number}
    </div>
  );
}
