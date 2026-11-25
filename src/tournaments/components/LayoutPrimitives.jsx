/**
 * src/tournaments/components/LayoutPrimitives.jsx
 * 
 * Reusable layout components: Section, CardGrid, Stack, Cluster.
 * Follows mobile-first responsive architecture without hardcoded pixels.
 */

import React from 'react';

export function Section({ title, subtitle, action, children, className = '' }) {
  return (
    <section className={`tournament-section ${className}`.trim()}>
      {(title || subtitle || action) && (
        <div className="tournament-section-header">
          <div>
            {title && <h2 className="tournament-section-title">{title}</h2>}
            {subtitle && <p className="tournament-section-subtitle">{subtitle}</p>}
          </div>
          {action && <div className="tournament-section-action">{action}</div>}
        </div>
      )}
      <div className="tournament-section-body">
        {children}
      </div>
    </section>
  );
}

export function CardGrid({ children, minWidth = '17rem', gap = '1rem', className = '' }) {
  return (
    <div
      className={`tournament-card-grid ${className}`.trim()}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${minWidth}), 1fr))`,
        gap
      }}
    >
      {children}
    </div>
  );
}

export function Stack({ children, gap = '0.75rem', align = 'stretch', className = '' }) {
  return (
    <div
      className={`tournament-stack ${className}`.trim()}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap,
        alignItems: align
      }}
    >
      {children}
    </div>
  );
}

export function Cluster({ children, gap = '0.5rem', justify = 'flex-start', align = 'center', className = '' }) {
  return (
    <div
      className={`tournament-cluster ${className}`.trim()}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap,
        justifyContent: justify,
        alignItems: align
      }}
    >
      {children}
    </div>
  );
}
