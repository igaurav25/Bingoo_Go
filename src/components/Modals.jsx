/**
 * src/components/Modals.jsx
 * 
 * Global Interactive Modals:
 * 1. SettingsModal (Sound, vibration, graphics quality)
 * 2. HowToPlayModal (Rules & 5-line guide)
 * 3. DailyRewardModal (Coin gift claim)
 * 4. ExitConfirmModal (Match forfeit warning)
 * 5. PassPhoneModal (Offline 2-player pass phone veil)
 */

import React, { useState } from 'react';

// ==================== SETTINGS MODAL ====================
export function SettingsModal({
  isOpen = false,
  onClose = null,
  isMuted = false,
  onToggleMute = null,
  musicEnabled = false,
  onToggleMusic = null,
  volume = 0.75,
  onChangeVolume = null,
  theme = 'dark',
  onToggleTheme = null,
  vibration = true,
  onToggleVibration = null,
  quality = 'auto',
  onSetQuality = null
}) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h3 style={{ margin: 0, fontFamily: 'var(--font-sports-display)', fontSize: '1.25rem', fontWeight: 900, color: 'var(--sports-white)' }}>
            ⚙️ Game &amp; Audio Settings
          </h3>
          <button type="button" className="icon-btn-round sports-icon-btn" onClick={onClose} aria-label="Close settings">
            ✕
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Visual Theme Toggle */}
          {onToggleTheme && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'rgba(139, 92, 246, 0.1)', border: '1px solid var(--sports-border)', borderRadius: '14px' }}>
              <div>
                <strong style={{ display: 'block', fontSize: '0.92rem', color: 'var(--sports-white)' }}>Arena Appearance</strong>
                <span style={{ fontSize: '0.75rem', color: 'var(--sports-slate)' }}>Switch between Dark Navy and Light Arena</span>
              </div>
              <button
                type="button"
                className={`btn-tactile ${theme === 'light' ? 'btn-gold' : 'btn-primary'}`}
                onClick={onToggleTheme}
                style={{ padding: '7px 14px', fontSize: '0.8rem', minHeight: '36px' }}
              >
                {theme === 'light' ? '☀️ Light' : '🌙 Dark'}
              </button>
            </div>
          )}

          {/* Sound FX Toggle */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'rgba(59, 130, 246, 0.08)', border: '1px solid var(--sports-border)', borderRadius: '14px' }}>
            <div>
              <strong style={{ display: 'block', fontSize: '0.92rem', color: 'var(--sports-white)' }}>Sound Effects</strong>
              <span style={{ fontSize: '0.75rem', color: 'var(--sports-slate)' }}>Number taps, line strikes, claims &amp; fanfares</span>
            </div>
            <button
              type="button"
              className={`btn-tactile ${isMuted ? 'btn-secondary' : 'btn-primary'}`}
              onClick={onToggleMute}
              style={{ padding: '7px 14px', fontSize: '0.8rem', minHeight: '36px' }}
            >
              {isMuted ? '🔇 Muted' : '🔊 On'}
            </button>
          </div>

          {/* Ambient Music Toggle */}
          {onToggleMusic && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'rgba(59, 130, 246, 0.08)', border: '1px solid var(--sports-border)', borderRadius: '14px' }}>
              <div>
                <strong style={{ display: 'block', fontSize: '0.92rem', color: 'var(--sports-white)' }}>Ambient Arena Music</strong>
                <span style={{ fontSize: '0.75rem', color: 'var(--sports-slate)' }}>Subtle synth lounge chords during sessions</span>
              </div>
              <button
                type="button"
                className={`btn-tactile ${musicEnabled ? 'btn-mint' : 'btn-secondary'}`}
                onClick={onToggleMusic}
                style={{ padding: '7px 14px', fontSize: '0.8rem', minHeight: '36px' }}
              >
                {musicEnabled ? '🎵 On' : 'Off'}
              </button>
            </div>
          )}

          {/* Master Volume Slider */}
          {onChangeVolume && (
            <div style={{ padding: '12px 14px', background: 'rgba(59, 130, 246, 0.08)', border: '1px solid var(--sports-border)', borderRadius: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <strong style={{ fontSize: '0.92rem', color: 'var(--sports-white)' }}>Master Volume</strong>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--sports-gold)' }}>
                  {Math.round((volume ?? 0.75) * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round((volume ?? 0.75) * 100)}
                onChange={(e) => onChangeVolume(Number(e.target.value) / 100)}
                aria-label="Master Volume"
                style={{ width: '100%', accentColor: '#3B82F6', cursor: 'pointer' }}
              />
            </div>
          )}

          {/* Haptic Vibration */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'rgba(59, 130, 246, 0.08)', border: '1px solid var(--sports-border)', borderRadius: '14px' }}>
            <div>
              <strong style={{ display: 'block', fontSize: '0.92rem', color: 'var(--sports-white)' }}>Haptic Feedback</strong>
              <span style={{ fontSize: '0.75rem', color: 'var(--sports-slate)' }}>Tactile pulse on marks &amp; BINGO strikes</span>
            </div>
            <button
              type="button"
              className={`btn-tactile ${!vibration ? 'btn-secondary' : 'btn-primary'}`}
              onClick={onToggleVibration}
              style={{ padding: '7px 14px', fontSize: '0.8rem', minHeight: '36px' }}
            >
              {vibration ? '📳 On' : 'Off'}
            </button>
          </div>

          {/* Graphics Quality */}
          <div style={{ padding: '12px 14px', background: 'rgba(59, 130, 246, 0.08)', border: '1px solid var(--sports-border)', borderRadius: '14px' }}>
            <strong style={{ display: 'block', fontSize: '0.92rem', marginBottom: '8px', color: 'var(--sports-white)' }}>Graphics &amp; Ambient FX</strong>
            <div style={{ display: 'flex', gap: '6px' }}>
              {['auto', 'high', 'low'].map((q) => (
                <button
                  key={q}
                  type="button"
                  className={`select-chip ${quality === q ? 'active' : ''}`}
                  onClick={() => onSetQuality && onSetQuality(q)}
                  style={{ flex: 1, padding: '7px 10px', fontSize: '0.76rem', minHeight: '34px' }}
                >
                  {q === 'auto' ? 'Auto (60fps)' : q === 'high' ? 'High' : 'Low Power'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          type="button"
          className="btn-tactile btn-primary"
          onClick={onClose}
          style={{ width: '100%', marginTop: '16px', padding: '10px', minHeight: '44px' }}
        >
          Done
        </button>
      </div>
    </div>
  );
}

// ==================== HOW TO PLAY MODAL ====================
export function HowToPlayModal({ isOpen = false, onClose = null }) {
  const [step, setStep] = useState(1);
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 800 }}>
            📖 How to Play BINGO
          </h3>
          <button type="button" className="icon-btn-round" onClick={onClose} aria-label="Close tutorial">
            ✕
          </button>
        </div>

        <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
          {[1, 2, 3, 4, 5].map((s) => (
            <div
              key={s}
              style={{
                flex: 1,
                height: '4px',
                borderRadius: '2px',
                background: s <= step ? 'var(--primary-blue)' : 'var(--border-color)'
              }}
            />
          ))}
        </div>

        {step === 1 && (
          <div>
            <h4 style={{ margin: '0 0 6px', fontSize: '1.05rem', color: 'var(--primary-blue)' }}>Step 1: The 5×5 Grid</h4>
            <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Your Bingo card contains 25 squares filled with unique numbers from <strong>1 to 25</strong>. Before the match starts, you can manually arrange your lucky numbers or tap <strong>Random Arrange</strong> to auto-generate a card.
            </p>
          </div>
        )}

        {step === 2 && (
          <div>
            <h4 style={{ margin: '0 0 6px', fontSize: '1.05rem', color: 'var(--primary-blue)' }}>Step 2: Calling Numbers</h4>
            <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Players take turns calling one number at a time. When a number is called by either player, it is marked on <strong>both</strong> players' boards with a green ink dab. You have 30 seconds per turn.
            </p>
          </div>
        )}

        {step === 3 && (
          <div>
            <h4 style={{ margin: '0 0 6px', fontSize: '1.05rem', color: 'var(--primary-blue)' }}>Step 3: Cutting Complete Lines</h4>
            <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              When all 5 numbers in any <strong>horizontal row</strong> or <strong>vertical column</strong> are marked, an animated continuous strike-through line cuts through the numbers.
            </p>
          </div>
        )}

        {step === 4 && (
          <div>
            <h4 style={{ margin: '0 0 6px', fontSize: '1.05rem', color: 'var(--primary-blue)' }}>Step 4: B-I-N-G-O Letters</h4>
            <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Each completed line sequentially strikes one letter at the top of your board:
              <br />
              <strong>1 Line = B • 2 Lines = I • 3 Lines = N • 4 Lines = G • 5 Lines = O!</strong>
            </p>
          </div>
        )}

        {step === 5 && (
          <div>
            <h4 style={{ margin: '0 0 6px', fontSize: '1.05rem', color: 'var(--coral-red)' }}>Step 5: Shout BINGO to Win!</h4>
            <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              As soon as all 5 letters are struck, the glowing <strong>BINGO BUTTON</strong> unlocks! Tap it immediately. The server verifies your 5 lines and declares you the Match Champion with coin rewards!
            </p>
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', marginTop: '18px' }}>
          {step > 1 && (
            <button
              type="button"
              className="btn-tactile btn-secondary"
              onClick={() => setStep(step - 1)}
              style={{ flex: 1, minHeight: '40px' }}
            >
              ← Back
            </button>
          )}
          {step < 5 ? (
            <button
              type="button"
              className="btn-tactile btn-primary"
              onClick={() => setStep(step + 1)}
              style={{ flex: 1, minHeight: '40px' }}
            >
              Next Step →
            </button>
          ) : (
            <button
              type="button"
              className="btn-tactile btn-gold"
              onClick={onClose}
              style={{ flex: 1, minHeight: '40px' }}
            >
              ✓ Got It, Let's Play!
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ==================== DAILY REWARD MODAL ====================
export function DailyRewardModal({
  isOpen = false,
  onClose = null,
  claimed = false,
  onClaim = null
}) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center', maxWidth: '380px' }}>
        <div style={{ fontSize: '3.5rem', marginBottom: '8px', animation: 'bounce 0.8s ease infinite alternate' }}>
          🎁
        </div>
        <h3 style={{ margin: '0 0 6px', fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 800 }}>
          Daily Coin Gift
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 16px' }}>
          Welcome back! Claim your daily attendance reward of 100 gold coins.
        </p>

        <div style={{ padding: '16px', background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.35)', borderRadius: '14px', marginBottom: '16px' }}>
          <span style={{ fontSize: '2rem', fontWeight: 900, color: '#FBBF24', display: 'block' }}>
            +100 🪙
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--sports-slate)' }}>Daily Bonus Added to Wallet</span>
        </div>

        <button
          type="button"
          className="btn-tactile btn-gold"
          disabled={claimed}
          onClick={() => {
            onClaim && onClaim();
          }}
          style={{ width: '100%', minHeight: '44px', fontSize: '1rem' }}
        >
          {claimed ? '✓ Claimed Today!' : '🪙 Claim 100 Coins'}
        </button>
      </div>
    </div>
  );
}

// ==================== EXIT CONFIRM MODAL ====================
export function ExitConfirmModal({
  isOpen = false,
  onClose = null,
  onConfirmExit = null
}) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center', maxWidth: '380px' }}>
        <div style={{ fontSize: '3rem', marginBottom: '4px' }}>⚠️</div>
        <h3 style={{ margin: '0 0 6px', fontFamily: 'var(--font-sports-display)', fontSize: '1.35rem', fontWeight: 900, color: '#F87171' }}>
          Abandon Match?
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--sports-slate)', margin: '0 0 16px' }}>
          You are currently in an active game. Leaving now will forfeit the match and record a loss.
        </p>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            className="btn-tactile btn-secondary"
            onClick={onClose}
            style={{ flex: 1, minHeight: '44px' }}
          >
            Keep Playing
          </button>
          <button
            type="button"
            className="btn-tactile btn-danger"
            onClick={onConfirmExit}
            style={{ flex: 1, minHeight: '44px' }}
          >
            Exit & Forfeit
          </button>
        </div>
      </div>
    </div>
  );
}
