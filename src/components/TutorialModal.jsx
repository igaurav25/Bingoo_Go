/**
 * src/components/TutorialModal.jsx
 * 
 * Interactive 5-Step Visual Tutorial for First-Time BINGO Players.
 * Step 1: Understand the Board (5x5, 1-25)
 * Step 2: Mark Numbers (Calling, Marked vs Unmarked states)
 * Step 3: Complete a Line (Row/Col continuous strike-through)
 * Step 4: Complete BINGO (B-I-N-G-O letter sequence)
 * Step 5: Claim Victory (Golden button unlock & server validation)
 */

import React, { useState, useEffect, useCallback } from 'react';

export function TutorialModal({
  isOpen = false,
  onClose = null,
  onComplete = null
}) {
  const [currentStep, setCurrentStep] = useState(1);
  const [markedDemo, setMarkedDemo] = useState(false);
  const [claimDemo, setClaimDemo] = useState(false);

  // Sync state & reset on open
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1);
      setMarkedDemo(false);
      setClaimDemo(false);
    }
  }, [isOpen]);

  const handleFinish = useCallback(() => {
    try {
      localStorage.setItem('bingo_tutorial_seen', 'true');
    } catch {}
    if (onComplete) onComplete();
    if (onClose) onClose();
  }, [onComplete, onClose]);

  const handleNext = () => {
    if (currentStep < 5) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleFinish();
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="tutorial-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutorial-step-title"
    >
      <div className="tutorial-card">
        {/* Top Header & Step Indicator */}
        <div className="tutorial-header">
          <div className="tutorial-step-badge">
            Step {currentStep} of 5
          </div>
          <button
            type="button"
            className="tutorial-skip-btn"
            onClick={handleFinish}
            aria-label="Skip tutorial"
          >
            Skip Tutorial ✕
          </button>
        </div>

        {/* Step Progress Dots */}
        <div className="tutorial-progress-bar" role="progressbar" aria-valuenow={currentStep} aria-valuemin="1" aria-valuemax="5">
          {[1, 2, 3, 4, 5].map(step => (
            <button
              key={step}
              type="button"
              className={`tutorial-step-dot ${step === currentStep ? 'active' : ''} ${step < currentStep ? 'completed' : ''}`}
              onClick={() => setCurrentStep(step)}
              aria-label={`Jump to step ${step}`}
            />
          ))}
        </div>

        {/* Dynamic Visual Content Per Step */}
        <div className="tutorial-body">
          {currentStep === 1 && (
            <div className="tutorial-slide">
              <div className="tutorial-icon-box">📋</div>
              <h2 id="tutorial-step-title" className="tutorial-title">Step 1 — Understand the Board</h2>
              <p className="tutorial-desc">
                Your game board is a classic <strong>5×5 notebook paper grid</strong> containing 25 squares filled with 
                numbers from <strong>1 to 25</strong> in any custom or randomized order.
              </p>

              {/* Interactive Miniature 5x5 Grid Demonstration */}
              <div className="tutorial-demo-box">
                <div className="tutorial-mini-grid">
                  {[
                    7, 14, 21, 3, 25,
                    12, 1, 18, 9, 22,
                    15, 20, 5, 24, 11,
                    2, 16, 8, 23, 10,
                    19, 4, 17, 13, 6
                  ].map((n, i) => (
                    <div key={i} className={`tutorial-mini-cell ${i === 6 ? 'highlighted' : ''}`}>
                      {n}
                    </div>
                  ))}
                </div>
                <div className="tutorial-caption">
                  💡 Tip: Before the match begins, you can tap any two cells to swap them or tap <strong>Auto Arrange</strong>.
                </div>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="tutorial-slide">
              <div className="tutorial-icon-box">🎯</div>
              <h2 id="tutorial-step-title" className="tutorial-title">Step 2 — Mark Numbers</h2>
              <p className="tutorial-desc">
                Players take turns calling numbers. When a number is called by either player, it must be marked on your card.
                Tap the number to see the blue ink stamp circle!
              </p>

              {/* Interactive Marking Demonstration */}
              <div className="tutorial-demo-box">
                <div className="tutorial-call-banner">
                  <span>Current Call:</span>
                  <span className="call-number-badge">14</span>
                </div>

                <div className="tutorial-compare-row">
                  <div className="compare-card">
                    <span className="compare-label">Unmarked</span>
                    <div className="tutorial-demo-tile unmarked">14</div>
                    <span className="compare-sub">Clean notebook cell</span>
                  </div>

                  <div className="compare-arrow">➔</div>

                  <div
                    className="compare-card"
                    onClick={() => setMarkedDemo(!markedDemo)}
                    style={{ cursor: 'pointer' }}
                  >
                    <span className="compare-label">Marked (Tap me!)</span>
                    <div className={`tutorial-demo-tile marked ${markedDemo ? 'demo-tapped' : ''}`}>
                      14
                      <span className="demo-ink-stamp"></span>
                    </div>
                    <span className="compare-sub">Circled in ink for both players</span>
                  </div>
                </div>

                <div className="tutorial-caption">
                  ✅ Both players mark the same called number on their own cards simultaneously.
                </div>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="tutorial-slide">
              <div className="tutorial-icon-box">⚡</div>
              <h2 id="tutorial-step-title" className="tutorial-title">Step 3 — Complete a Line</h2>
              <p className="tutorial-desc">
                When you mark all 5 numbers across any <strong>horizontal row</strong>, <strong>vertical column</strong>, or 
                <strong>diagonal</strong>, it counts as one completed line!
              </p>

              {/* Continuous Red Pen Stroke Demonstration */}
              <div className="tutorial-demo-box">
                <div className="tutorial-line-demo-container">
                  <div className="tutorial-mini-grid line-active">
                    {[
                      7, 14, 21, 3, 25,
                      12, 1, 18, 9, 22,
                      15, 20, 5, 24, 11,
                      2, 16, 8, 23, 10,
                      19, 4, 17, 13, 6
                    ].map((n, i) => {
                      const isRow2 = i >= 5 && i <= 9;
                      return (
                        <div key={i} className={`tutorial-mini-cell ${isRow2 ? 'marked' : ''}`}>
                          {n}
                        </div>
                      );
                    })}
                  </div>

                  {/* Animated SVG Strike-through Overlay */}
                  <svg className="tutorial-svg-overlay" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <line
                      x1="0"
                      y1="30"
                      x2="100"
                      y2="30"
                      stroke="#ef4444"
                      strokeWidth="5"
                      strokeLinecap="round"
                      className="tutorial-animated-stroke"
                    />
                  </svg>
                </div>

                <div className="tutorial-caption">
                  🖋️ A continuous red ink strike-through connects all 5 cells instantly.
                </div>
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="tutorial-slide">
              <div className="tutorial-icon-box">🔤</div>
              <h2 id="tutorial-step-title" className="tutorial-title">Step 4 — Complete BINGO</h2>
              <p className="tutorial-desc">
                Every completed line strikes out one letter in sequence: <strong>B → I → N → G → O</strong>.
                Each unique line counts exactly once toward your 5 letters.
              </p>

              {/* BINGO Word Progression Demonstration */}
              <div className="tutorial-demo-box">
                <div className="tutorial-bingo-strip">
                  {[
                    { letter: 'B', struck: true, note: 'Line 1' },
                    { letter: 'I', struck: true, note: 'Line 2' },
                    { letter: 'N', struck: true, note: 'Line 3' },
                    { letter: 'G', struck: false, note: 'Pending' },
                    { letter: 'O', struck: false, note: 'Pending' }
                  ].map((item, idx) => (
                    <div key={idx} className={`tutorial-letter-tile ${item.struck ? 'struck' : ''}`}>
                      <span className="letter-char">{item.letter}</span>
                      {item.struck && <span className="letter-cut-line"></span>}
                      <span className="letter-step-label">{item.note}</span>
                    </div>
                  ))}
                </div>

                <div className="tutorial-caption">
                  📊 Strike all 5 letters to unlock your golden Victory Claim button!
                </div>
              </div>
            </div>
          )}

          {currentStep === 5 && (
            <div className="tutorial-slide">
              <div className="tutorial-icon-box">🏆</div>
              <h2 id="tutorial-step-title" className="tutorial-title">Step 5 — Claim Victory!</h2>
              <p className="tutorial-desc">
                As soon as all five letters are struck, the central <strong>BINGO button turns golden and pulses</strong>.
                Tap it immediately to submit your winning claim!
              </p>

              {/* Golden Claim Button Simulation */}
              <div className="tutorial-demo-box">
                <div className="tutorial-claim-stage">
                  <button
                    type="button"
                    className={`tutorial-claim-btn ${claimDemo ? 'validated' : 'ready'}`}
                    onClick={() => setClaimDemo(true)}
                  >
                    <span>{claimDemo ? '🎉 BINGO CLAIM VERIFIED!' : 'BINGO! (Tap to Claim)'}</span>
                    <div className="claim-pips-row">
                      <span className="claim-pip filled"></span>
                      <span className="claim-pip filled"></span>
                      <span className="claim-pip filled"></span>
                      <span className="claim-pip filled"></span>
                      <span className="claim-pip filled"></span>
                    </div>
                  </button>
                </div>

                <div className="tutorial-caption">
                  🛡️ <strong>Server-Authoritative:</strong> The server verifies your 5 lines in real time and awards your match victory and XP!
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation Buttons */}
        <div className="tutorial-footer">
          <button
            type="button"
            className="btn-tactile btn-secondary tutorial-prev-btn"
            onClick={handlePrev}
            disabled={currentStep === 1}
          >
            ← Previous
          </button>

          <button
            type="button"
            className="btn-tactile btn-primary tutorial-next-btn"
            onClick={handleNext}
          >
            {currentStep === 5 ? "Got It! Let's Play 🚀" : "Next Step →"}
          </button>
        </div>
      </div>
    </div>
  );
}
