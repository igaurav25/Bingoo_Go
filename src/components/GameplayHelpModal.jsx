/**
 * src/components/GameplayHelpModal.jsx
 * 
 * Compact, Non-Obstructive In-Match Help Panel.
 * Accessible via (?) button during live matches without forfeiting or leaving.
 */

import React from 'react';

export function GameplayHelpModal({
  isOpen = false,
  onClose = null,
  onReplayTutorial = null,
  onExitMatch = null,
  isPractice = false
}) {
  if (!isOpen) return null;

  return (
    <div
      className="gameplay-help-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gameplay-help-title"
    >
      <div className="gameplay-help-card">
        {/* Header */}
        <div className="gameplay-help-header">
          <div className="help-header-title-group">
            <span className="help-header-icon">❓</span>
            <h3 id="gameplay-help-title" className="help-header-title">Match Rules & Controls</h3>
          </div>
          <button
            type="button"
            className="help-close-btn"
            onClick={onClose}
            aria-label="Close help"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="gameplay-help-content">
          {/* Quick Guide Strip */}
          <div className="help-section-card">
            <h4 className="help-sec-title">🎯 How to Play & Mark Numbers</h4>
            <p className="help-sec-text">
              Players alternate turns calling numbers. When it is your turn, tap any remaining uncalled number on your 5×5 card. 
              The called number will be circled in ink on cards for <strong>both players</strong>.
            </p>
          </div>

          <div className="help-section-card">
            <h4 className="help-sec-title">⚡ How Lines are Counted</h4>
            <p className="help-sec-text">
              Any completed 5-number horizontal row, vertical column, or diagonal slashes an animated continuous red/green pen strike.
              Each completed line counts <strong>only once</strong>.
            </p>
          </div>

          <div className="help-section-card">
            <h4 className="help-sec-title">🔤 What BINGO Letters Mean</h4>
            <p className="help-sec-text">
              Completed lines strike out letters sequentially: <strong>B → I → N → G → O</strong>.
              You need 5 completed lines to strike all 5 letters.
            </p>
          </div>

          <div className="help-section-card">
            <h4 className="help-sec-title">🏆 How to Claim Victory</h4>
            <p className="help-sec-text">
              As soon as all 5 letters are struck, the central <strong>BINGO</strong> button unlocks with golden glow and pips.
              Tap it immediately! The server validates your claim in real time and awards your win.
            </p>
          </div>

          <div className="help-section-card">
            <h4 className="help-sec-title">🚪 Match Exit Rules</h4>
            <p className="help-sec-text">
              {isPractice 
                ? "You are playing in Practice mode. You can exit anytime without penalties."
                : "In multiplayer or tournament duels, exiting an active match forfeits the game and records a loss."}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="gameplay-help-footer">
          {onReplayTutorial && (
            <button
              type="button"
              className="btn-tactile btn-secondary help-tutorial-btn"
              onClick={() => {
                if (onClose) onClose();
                onReplayTutorial();
              }}
            >
              <span>🎓</span> Replay Interactive Tutorial
            </button>
          )}

          <div className="help-footer-row">
            {onExitMatch && (
              <button
                type="button"
                className="btn-tactile btn-danger"
                style={{ flex: 1 }}
                onClick={() => {
                  if (onClose) onClose();
                  onExitMatch();
                }}
              >
                Forfeit & Exit
              </button>
            )}

            <button
              type="button"
              className="btn-tactile btn-primary"
              style={{ flex: 1.5 }}
              onClick={onClose}
            >
              Resume Match →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
