/**
 * src/components/StrikeThroughOverlay.jsx
 * 
 * Precise SVG Strike-Through Overlay for BINGO ("copy ke last page wala Bingo").
 * 
 * Authentic Notebook Pen Strikes:
 * - One continuous slanted red-pen stroke per completed row or column.
 * - Slanted geometry: lower-left to upper-right for rows, upper-left to lower-right for columns.
 * - Ballpoint red-pen aesthetic: vibrant stroke (var(--pen-red)), illuminated inner ink core (var(--pen-red-lit)).
 * - Smooth stroke-dashoffset animation simulating authentic pen drawing.
 * - Overshoot coordinates (-15 to 515) rendered without clipping via viewBox="-25 -25 550 550".
 */

import React, { useEffect, useRef, useState } from 'react';
import { lineGeometry } from '../../shared/lineModel.js';

export function StrikeThroughOverlay({ completedLines = [], newlyStruckLineId = null }) {
  const svgRef = useRef(null);
  const [boardDimensions, setBoardDimensions] = useState({ width: 500, height: 500 });

  // ResizeObserver to ensure SVG tracks board dimensions accurately
  useEffect(() => {
    if (!svgRef.current) return;
    const parent = svgRef.current.parentElement;
    if (!parent) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setBoardDimensions({ width, height });
        }
      }
    });

    ro.observe(parent);
    return () => ro.disconnect();
  }, []);

  return (
    <svg
      ref={svgRef}
      className="bingo-strike-overlay"
      viewBox="-25 -25 550 550"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <defs>
        {/* Soft pen ink drop shadow */}
        <filter id="pen-ink-depth" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="rgba(153, 27, 27, 0.4)" />
        </filter>
        {/* Lit red pen core glow */}
        <filter id="pen-red-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="rgba(239, 68, 68, 0.5)" />
        </filter>
      </defs>

      {completedLines.map((line) => {
        const geom = lineGeometry(line.id, 100);
        const isNew = line.id === newlyStruckLineId;
        const lineLength = 535; // approx length of slanted stroke with overshoot

        return (
          <g key={line.id} className="strike-line-group" data-line-id={line.id}>
            {/* Background shadow stroke for depth */}
            <line
              x1={geom.x1}
              y1={geom.y1}
              x2={geom.x2}
              y2={geom.y2}
              stroke="rgba(139, 92, 246, 0.35)"
              strokeWidth="14"
              strokeLinecap="round"
              className="strike-bg-shadow"
            />

            {/* Main continuous coral-crimson stroke */}
            <line
              x1={geom.x1}
              y1={geom.y1}
              x2={geom.x2}
              y2={geom.y2}
              stroke="var(--pen-red, #F43F5E)"
              strokeWidth="8.5"
              strokeLinecap="round"
              filter="url(#pen-red-glow)"
              className={`strike-main-line pen-red-stroke ${isNew ? 'animate-strike' : 'settled'}`}
              style={{
                strokeDasharray: lineLength,
                strokeDashoffset: isNew ? lineLength : 0,
                '--line-length': lineLength
              }}
            />

            {/* Inner luminous gold-coral ink core */}
            <line
              x1={geom.x1}
              y1={geom.y1}
              x2={geom.x2}
              y2={geom.y2}
              stroke="#FDE68A"
              strokeWidth="3"
              strokeLinecap="round"
              className={`strike-core-line ${isNew ? 'animate-strike' : 'settled'}`}
              style={{
                strokeDasharray: lineLength,
                strokeDashoffset: isNew ? lineLength : 0,
                '--line-length': lineLength
              }}
            />
          </g>
        );
      })}
    </svg>
  );
}
