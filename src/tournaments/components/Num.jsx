/**
 * src/tournaments/components/Num.jsx
 * 
 * Shared tabular number component.
 * Rules:
 * - font-variant-numeric: tabular-nums lining-nums; white-space: nowrap; flex: none;
 * - min-width: 3ch (fits "120"); text-align: end in aligned columns.
 * - Never a fixed px width on a number container.
 * - No overflow: hidden, text-overflow: ellipsis or line-clamp on this element or ancestors.
 * - Responsive sizing with clamp(), floors: digits >= 14px, scores >= 16px.
 */

import React from 'react';

export function Num({
  value,
  align = 'end',
  variant = 'default', // 'default' | 'score' | 'rank' | 'points' | 'ratio'
  prefix = '',
  suffix = '',
  className = '',
  style = {}
}) {
  const isScore = variant === 'score';
  const isRank = variant === 'rank';

  const baseClasses = `tournament-num ${isScore ? 'num-score' : ''} ${isRank ? 'num-rank' : ''} ${className}`.trim();

  return (
    <span
      data-num="true"
      className={baseClasses}
      style={{
        fontVariantNumeric: 'tabular-nums lining-nums',
        whiteSpace: 'nowrap',
        flex: 'none',
        minWidth: '3ch',
        textAlign: align,
        display: 'inline-block',
        ...style
      }}
    >
      {prefix}{value !== undefined && value !== null ? value : '-'}{suffix}
    </span>
  );
}
