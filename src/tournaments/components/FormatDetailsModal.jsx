/**
 * src/tournaments/components/FormatDetailsModal.jsx
 * 
 * Interactive Educational Modal Explaining Tournament Formats Visually.
 * Explains League, Knockout, and Hybrid progression, rules, scoring, and qualification.
 */

import React, { useState } from 'react';

export function FormatDetailsModal({
  isOpen = false,
  initialFormat = 'LEAGUE',
  onClose = null,
  onCreateFormat = null,
  onJoin = null
}) {
  const [activeFormat, setActiveFormat] = useState(initialFormat || 'LEAGUE');

  if (!isOpen) return null;

  return (
    <div
      className="tourn-details-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="format-details-title"
    >
      <div className="tourn-details-modal-card">
        {/* Header */}
        <div className="format-modal-header">
          <div className="format-modal-title-group">
            <span className="format-modal-icon">📖</span>
            <div>
              <h3 id="format-details-title" className="format-modal-title">How Tournaments Work</h3>
              <p className="format-modal-sub">Everything you need to know before joining or creating</p>
            </div>
          </div>
          <button
            type="button"
            className="format-modal-close"
            onClick={onClose}
            aria-label="Close details"
          >
            ✕
          </button>
        </div>

        {/* Format Selector Tabs */}
        <div className="format-tabs-row" role="tablist">
          {[
            { id: 'LEAGUE', label: '🏆 League Tournament', badge: 'Points Based' },
            { id: 'KNOCKOUT', label: '🥊 Knockout Cup', badge: 'Single Elimination' },
            { id: 'HYBRID', label: '🛡️ Hybrid Format', badge: 'League + Playoffs' }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeFormat === tab.id}
              className={`format-tab-btn ${activeFormat === tab.id ? 'active' : ''}`}
              onClick={() => setActiveFormat(tab.id)}
            >
              <span className="tab-title">{tab.label}</span>
              <span className="tab-badge">{tab.badge}</span>
            </button>
          ))}
        </div>

        {/* Format Content */}
        <div className="format-modal-body">
          {activeFormat === 'LEAGUE' && (
            <div className="format-content-view">
              <div className="format-hero-box league-hero">
                <div className="hero-emoji">🏆</div>
                <div>
                  <h4 className="hero-headline">League Championship</h4>
                  <p className="hero-text">"Play multiple matches, earn points, and qualify for the playoffs."</p>
                </div>
              </div>

              {/* Visual Progression Stages */}
              <div className="format-flow-section">
                <h5 className="section-title">📊 Visual Progression Flow</h5>
                <div className="flow-steps-strip">
                  <div className="flow-step-item">
                    <div className="step-num-bubble">1</div>
                    <div className="step-content">
                      <strong>Group Fixtures</strong>
                      <span>All players play scheduled rounds</span>
                    </div>
                  </div>
                  <div className="flow-step-arrow">➔</div>
                  <div className="flow-step-item">
                    <div className="step-num-bubble">2</div>
                    <div className="step-content">
                      <strong>Points Table</strong>
                      <span>Wins: +3 pts • Win diff updates rank</span>
                    </div>
                  </div>
                  <div className="flow-step-arrow">➔</div>
                  <div className="flow-step-item">
                    <div className="step-num-bubble">3</div>
                    <div className="step-content">
                      <strong>Playoffs</strong>
                      <span>Top 4 advance to Semifinals</span>
                    </div>
                  </div>
                  <div className="flow-step-arrow">➔</div>
                  <div className="flow-step-item champion-step">
                    <div className="step-num-bubble">🏆</div>
                    <div className="step-content">
                      <strong>Finals</strong>
                      <span>Grand Final declares Champion</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Rules & Points Explanation */}
              <div className="format-rules-grid">
                <div className="rule-box">
                  <strong>🎯 Points System</strong>
                  <ul>
                    <li><strong>Win:</strong> +3 points</li>
                    <li><strong>Draw / Simultaneous:</strong> +1 point</li>
                    <li><strong>Loss / Forfeit:</strong> 0 points</li>
                  </ul>
                </div>

                <div className="rule-box">
                  <strong>📋 Table Columns Explained</strong>
                  <ul>
                    <li><strong>P (Played):</strong> Total matches completed</li>
                    <li><strong>W (Won):</strong> Matches won</li>
                    <li><strong>L (Lost):</strong> Matches lost</li>
                    <li><strong>PTS (Points):</strong> Total earned points for qualification</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {activeFormat === 'KNOCKOUT' && (
            <div className="format-content-view">
              <div className="format-hero-box knockout-hero">
                <div className="hero-emoji">🥊</div>
                <div>
                  <h4 className="hero-headline">Knockout Cup</h4>
                  <p className="hero-text">"Win your match to advance. Lose and you are eliminated."</p>
                </div>
              </div>

              {/* Visual Progression Stages */}
              <div className="format-flow-section">
                <h5 className="section-title">🌳 Bracket Tree Stages</h5>
                <div className="flow-steps-strip">
                  <div className="flow-step-item">
                    <div className="step-num-bubble">1</div>
                    <div className="step-content">
                      <strong>Round 1 / Quarters</strong>
                      <span>Paired 1v1 duels. Byes advance automatically</span>
                    </div>
                  </div>
                  <div className="flow-step-arrow">➔</div>
                  <div className="flow-step-item">
                    <div className="step-num-bubble">2</div>
                    <div className="step-content">
                      <strong>Semifinals</strong>
                      <span>Winners clash for final spots</span>
                    </div>
                  </div>
                  <div className="flow-step-arrow">➔</div>
                  <div className="flow-step-item champion-step">
                    <div className="step-num-bubble">👑</div>
                    <div className="step-content">
                      <strong>Grand Final</strong>
                      <span>Sole survivor crowned Champion</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Rules Grid */}
              <div className="format-rules-grid">
                <div className="rule-box">
                  <strong>⚡ Knockout Rules</strong>
                  <ul>
                    <li>1v1 single elimination matches.</li>
                    <li>Winner advances immediately to next bracket round.</li>
                    <li>Loser is eliminated but can spectate remaining games.</li>
                  </ul>
                </div>

                <div className="rule-box">
                  <strong>🎟️ Automatic Byes</strong>
                  <ul>
                    <li>For odd participant counts (5, 6, 10, 12 players), top seeds receive a first-round Bye and auto-advance.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {activeFormat === 'HYBRID' && (
            <div className="format-content-view">
              <div className="format-hero-box hybrid-hero">
                <div className="hero-emoji">🛡️</div>
                <div>
                  <h4 className="hero-headline">Hybrid Championship</h4>
                  <p className="hero-text">"Play the league stage first, then qualify for the knockout rounds."</p>
                </div>
              </div>

              {/* Visual Progression Stages */}
              <div className="format-flow-section">
                <h5 className="section-title">🔄 Complete 2-Stage Progression</h5>
                <div className="flow-steps-strip">
                  <div className="flow-step-item">
                    <div className="step-num-bubble">Stage 1</div>
                    <div className="step-content">
                      <strong>League Stage</strong>
                      <span>Round-robin group matches earn table points</span>
                    </div>
                  </div>
                  <div className="flow-step-arrow">➔</div>
                  <div className="flow-step-item">
                    <div className="step-num-bubble">Stage 2</div>
                    <div className="step-content">
                      <strong>Knockout Playoffs</strong>
                      <span>Top 4 table seeds battle in Semis (1v4, 2v3)</span>
                    </div>
                  </div>
                  <div className="flow-step-arrow">➔</div>
                  <div className="flow-step-item champion-step">
                    <div className="step-num-bubble">🏆</div>
                    <div className="step-content">
                      <strong>Trophy Final</strong>
                      <span>Championship cup awarded</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Rules Grid */}
              <div className="format-rules-grid">
                <div className="rule-box">
                  <strong>⭐ Why Hybrid?</strong>
                  <ul>
                    <li>Guarantees every player gets multiple games in the league.</li>
                    <li>Top performers earn coveted playoff knockout berths.</li>
                  </ul>
                </div>

                <div className="rule-box">
                  <strong>📈 Qualification Rules</strong>
                  <ul>
                    <li>Top 4 seeds from the points table advance.</li>
                    <li>Playoff match pairings: Seed 1 vs Seed 4, Seed 2 vs Seed 3.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer CTAs */}
        <div className="format-modal-footer">
          <button
            type="button"
            className="btn-tactile btn-secondary"
            onClick={onClose}
          >
            Close Guide
          </button>

          {onJoin && (
            <button
              type="button"
              className="btn-tactile btn-amber"
              onClick={() => {
                if (onClose) onClose();
                onJoin();
              }}
            >
              <span>🔑</span> Join with Code
            </button>
          )}

          {onCreateFormat && (
            <button
              type="button"
              className="btn-tactile btn-primary"
              onClick={() => {
                if (onClose) onClose();
                onCreateFormat(activeFormat);
              }}
            >
              <span>➕</span> Host a {activeFormat} Tournament →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
