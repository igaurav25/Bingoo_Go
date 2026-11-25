/**
 * src/components/QRCodeSVG.jsx
 *
 * Offline crisp SVG QR code component powered by public/js/qrcode.js.
 */

import React, { useMemo } from 'react';
import { generateQRMatrix } from '../../public/js/qrcode.js';

export function QRCodeSVG({ value = '', size = 156, label = 'Scan to join room' }) {
  const { modules, count } = useMemo(() => {
    const matrix = generateQRMatrix(String(value || 'BINGO'));
    return { modules: matrix, count: matrix.length || 21 };
  }, [value]);

  const quietZone = 2;
  const viewSize = count + quietZone * 2;

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
      <div
        style={{
          background: '#FFFFFF',
          padding: '8px',
          borderRadius: '14px',
          border: '2px solid rgba(243, 185, 79, 0.5)',
          boxShadow: '0 6px 20px rgba(0,0,0,0.35)',
          display: 'inline-flex'
        }}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${viewSize} ${viewSize}`}
          role="img"
          aria-label={label}
          shapeRendering="crispEdges"
        >
          <rect x="0" y="0" width={viewSize} height={viewSize} fill="#FFFFFF" />
          {modules.map((row, r) =>
            row.map((cell, c) =>
              cell ? (
                <rect
                  key={`${r}-${c}`}
                  x={c + quietZone}
                  y={r + quietZone}
                  width="1"
                  height="1"
                  fill="#0C1422"
                />
              ) : null
            )
          )}
        </svg>
      </div>
      {label && (
        <span style={{ fontSize: '0.72rem', color: '#8995A8', fontWeight: 700 }}>
          {label}
        </span>
      )}
    </div>
  );
}
