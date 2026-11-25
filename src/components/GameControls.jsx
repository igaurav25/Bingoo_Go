/**
 * src/components/GameControls.jsx
 * 
 * Game Controls Component.
 * Supports Arranging (Random, Shuffle, Clear, Ready/Start)
 * and Gameplay (Leave/Forfeit, Reaction Emotes).
 * Every control has self-explanatory labels and contextual visual feedback.
 */

import React from 'react';

export function GameControls({
  isArranging = true,
  onRandomArrange,
  onShuffle,
  onClear,
  onLockBoard,
  onExitMatch,
  onSendReaction
}) {
  const emotes = ['🔥', '👏', '😮', '😂', '⚡'];

  if (isArranging) {
    return (
      <div className="game-controls-container arranging-controls">
        <button
          type="button"
          className="btn-tactile btn-secondary"
          onClick={onRandomArrange}
          title="Fills the 5x5 board with numbers 1 to 25 automatically"
          aria-label="Random Arrange numbers 1 to 25"
        >
          <span>🎲</span>
          <span>Auto Arrange</span>
        </button>

        <button
          type="button"
          className="btn-tactile btn-secondary"
          onClick={onShuffle}
          title="Shuffles the positions of all numbers on your card"
          aria-label="Shuffle card numbers"
        >
          <span>🔀</span>
          <span>Shuffle</span>
        </button>

        <button
          type="button"
          className="btn-tactile btn-warning"
          onClick={onClear}
          title="Empties the board so you can place numbers manually"
          aria-label="Clear card"
        >
          <span>🧹</span>
          <span>Clear Board</span>
        </button>

        <button
          type="button"
          className="btn-tactile btn-primary btn-lock-ready"
          onClick={onLockBoard}
          title="Confirms your board arrangement and enters the match"
          aria-label="Lock board and play"
        >
          <span>🔒</span>
          <span>Lock Board & Play →</span>
        </button>
      </div>
    );
  }

  return (
    <div className="game-controls-container playing-controls">
      <button
        type="button"
        className="btn-match-exit"
        onClick={onExitMatch}
        title="Forfeit match and return to menu"
        aria-label="Leave match"
      >
        <span>🚪</span>
        <span>Forfeit & Leave</span>
      </button>

      {/* Quick Reaction Emotes with title hints */}
      <div className="reaction-emotes-bar" aria-label="Send Reaction Emotes to Opponent">
        <span className="reaction-label">Emotes:</span>
        {emotes.map((emoji) => (
          <button
            key={emoji}
            type="button"
            className="emote-btn"
            onClick={() => onSendReaction && onSendReaction(emoji)}
            aria-label={`Send emote ${emoji}`}
            title={`Send ${emoji} to opponent`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
