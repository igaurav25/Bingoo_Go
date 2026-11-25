/**
 * src/tournaments/components/PageShell.jsx
 * 
 * Standard Responsive Shell for Tournament Pages.
 * Rules:
 * - Back button returns to the previous tournament page.
 * - Respects safe-area insets.
 * - Handles loading skeleton, error, offline, and empty states.
 * - No horizontal page scroll (overflow-x: clip / hidden).
 */

import React from 'react';

export function PageShell({
  title,
  subtitle,
  badge,
  onBack,
  backLabel = 'Back',
  actions,
  tabs,
  loading = false,
  error = null,
  empty = false,
  emptyMessage = 'No data available',
  children
}) {
  return (
    <div className="tournament-page-shell">
      {/* Top Header Bar */}
      <header className="tournament-page-header">
        <div className="tournament-header-top-row">
          {onBack && (
            <button
              type="button"
              className="tournament-back-btn"
              onClick={onBack}
              aria-label={backLabel}
            >
              <span className="back-arrow" aria-hidden="true">←</span>
              <span className="back-text">{backLabel}</span>
            </button>
          )}

          <div className="tournament-header-actions">
            {actions}
          </div>
        </div>

        <div className="tournament-header-title-row">
          <div className="tournament-title-wrap">
            <h1 className="tournament-main-title">{title}</h1>
            {badge && <div className="tournament-title-badge">{badge}</div>}
          </div>
          {subtitle && <p className="tournament-main-subtitle">{subtitle}</p>}
        </div>

        {/* Sub-navigation tabs if provided */}
        {tabs && (
          <nav className="tournament-nav-tabs" aria-label="Tournament navigation">
            {tabs}
          </nav>
        )}
      </header>

      {/* Main Content Area */}
      <main className="tournament-page-content">
        {loading ? (
          <div className="tournament-loading-skeleton" aria-busy="true">
            <div className="skeleton-line title" />
            <div className="skeleton-card" />
            <div className="skeleton-card" />
          </div>
        ) : error ? (
          <div className="tournament-state-card error-card" role="alert">
            <span className="state-icon">⚠️</span>
            <h3>Something went wrong</h3>
            <p>{typeof error === 'string' ? error : error.message || 'Failed to load tournament data'}</p>
            {onBack && (
              <button type="button" className="btn-tactile btn-secondary" onClick={onBack}>
                Go Back
              </button>
            )}
          </div>
        ) : empty ? (
          <div className="tournament-state-card empty-card">
            <span className="state-icon">📋</span>
            <h3>{emptyMessage}</h3>
          </div>
        ) : (
          children
        )}
      </main>
    </div>
  );
}
