/**
 * public/js/renderOverlay.js
 * 
 * Manages the SVG line-strike overlay and B-I-N-G-O word letter strikes.
 * Implements single continuous pen strokes (450ms ease-out, 120ms settle),
 * pathLength="1" dashoffset drawing, letter strike-throughs with pop effect,
 * and instant hydration for reconnects/resumes.
 */

import { lineGeometry, BINGO_LETTERS } from '/shared/lineModel.js';
import { soundManager } from './audio.js';

// SVG Namespace
const SVG_NS = 'http://www.w3.org/2000/svg';

export class RenderOverlay {
  /**
   * @param {SVGSVGElement} svgElement - Grid overlay SVG
   * @param {HTMLElement} playerWordContainer - Container holding 5 letter elements for player
   * @param {HTMLElement} opponentWordContainer - Container holding 5 letter elements for opponent
   */
  constructor(svgElement, playerWordContainer, opponentWordContainer) {
    this.svg = svgElement;
    this.playerWordContainer = playerWordContainer;
    this.opponentWordContainer = opponentWordContainer;

    // Track rendered lines and letters to prevent duplicate rendering
    this.renderedLineIds = new Set();
    this.playerLetterStrikes = 0; // count of struck letters
    this.opponentLetterStrikes = 0;

    this.prefersReducedMotion = false;
    if (typeof window !== 'undefined' && window.matchMedia) {
      const media = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.prefersReducedMotion = media.matches;
      media.addEventListener('change', (e) => {
        this.prefersReducedMotion = e.matches;
      });
    }

    this._ensureGradients();
  }

  _ensureGradients() {
    let defs = this.svg.querySelector('defs');
    if (!defs) {
      defs = document.createElementNS(SVG_NS, 'defs');
      this.svg.appendChild(defs);
    }

    if (!this.svg.querySelector('#pen-gradient')) {
      const grad = document.createElementNS(SVG_NS, 'linearGradient');
      grad.setAttribute('id', 'pen-gradient');
      grad.setAttribute('x1', '0%');
      grad.setAttribute('y1', '0%');
      grad.setAttribute('x2', '100%');
      grad.setAttribute('y2', '100%');

      const stop1 = document.createElementNS(SVG_NS, 'stop');
      stop1.setAttribute('offset', '0%');
      stop1.setAttribute('stop-color', '#d62828');

      const stop2 = document.createElementNS(SVG_NS, 'stop');
      stop2.setAttribute('offset', '100%');
      stop2.setAttribute('stop-color', '#ba181b');

      grad.appendChild(stop1);
      grad.appendChild(stop2);
      defs.appendChild(grad);
    }
  }

  /**
   * Hydrates existing lines and letters instantly without animations.
   * @param {string[]} lineIds - local player's completed lines
   * @param {number} opponentCount - opponent's linesCompleted count
   */
  hydrate(lineIds = [], opponentCount = 0) {
    // 1. Draw all player lines instantly
    for (const id of lineIds) {
      if (!this.renderedLineIds.has(id)) {
        this._drawLineInstant(id);
      }
    }

    // 2. Mark player BINGO letters instantly
    const playerLettersToStrike = Math.min(5, lineIds.length);
    for (let i = 1; i <= playerLettersToStrike; i++) {
      if (i > this.playerLetterStrikes) {
        this._strikeLetterInstant(this.playerWordContainer, i - 1);
        this.playerLetterStrikes = i;
      }
    }

    // 3. Mark opponent BINGO letters instantly
    const oppLettersToStrike = Math.min(5, opponentCount);
    for (let i = 1; i <= oppLettersToStrike; i++) {
      if (i > this.opponentLetterStrikes) {
        this._strikeLetterInstant(this.opponentWordContainer, i - 1);
        this.opponentLetterStrikes = i;
      }
    }
  }

  _drawLineInstant(lineId) {
    this.renderedLineIds.add(lineId);
    const geom = lineGeometry(lineId);

    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('x1', String(geom.x1));
    line.setAttribute('y1', String(geom.y1));
    line.setAttribute('x2', String(geom.x2));
    line.setAttribute('y2', String(geom.y2));
    line.setAttribute('pathLength', '1');
    line.setAttribute('stroke-dasharray', '1 1');
    line.setAttribute('stroke-dashoffset', '0');
    line.setAttribute('stroke', 'url(#pen-gradient)');
    line.setAttribute('stroke-width', '14');
    line.setAttribute('stroke-linecap', 'round');
    line.setAttribute('class', 'bingo-pen-stroke settled');
    line.dataset.lineId = lineId;

    this.svg.appendChild(line);
  }

  _strikeLetterInstant(container, letterIndex) {
    if (!container) return;
    const letterEl = container.children[letterIndex];
    if (!letterEl) return;

    letterEl.classList.add('struck', 'instant');
    const strikeLine = letterEl.querySelector('.letter-strike-line');
    if (strikeLine) {
      strikeLine.style.transform = 'scaleX(1)';
    }
  }

  /**
   * Animates a single line strike-through (450ms ease-out + 120ms settle),
   * followed by letter strike if within 1..5.
   * 
   * @param {{ id: string, type: string, index: number, order: number, letter: string | null }} lineInfo
   * @param {boolean} isAccelerated - true if queue is fast-forwarding
   * @returns {Promise<void>}
   */
  async animateLineStrike(lineInfo, isAccelerated = false) {
    if (this.renderedLineIds.has(lineInfo.id)) {
      return;
    }
    this.renderedLineIds.add(lineInfo.id);

    const duration = this.prefersReducedMotion ? 0 : (isAccelerated ? 220 : 450);
    const settleDuration = this.prefersReducedMotion ? 0 : (isAccelerated ? 60 : 120);

    const geom = lineGeometry(lineInfo.id);

    // Create SVG Line
    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('x1', String(geom.x1));
    line.setAttribute('y1', String(geom.y1));
    line.setAttribute('x2', String(geom.x2));
    line.setAttribute('y2', String(geom.y2));
    line.setAttribute('pathLength', '1');
    line.setAttribute('stroke-dasharray', '1 1');
    line.setAttribute('stroke-dashoffset', '1');
    line.setAttribute('stroke', 'url(#pen-gradient)');
    line.setAttribute('stroke-width', '14');
    line.setAttribute('stroke-linecap', 'round');
    line.setAttribute('class', 'bingo-pen-stroke');
    line.dataset.lineId = lineInfo.id;

    this.svg.appendChild(line);

    // Audio cue
    soundManager.playLineStroke(duration);

    // Animate stroke-dashoffset from 1 to 0
    if (duration > 0) {
      const anim = line.animate(
        [
          { strokeDashoffset: '1' },
          { strokeDashoffset: '0' }
        ],
        {
          duration,
          easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
          fill: 'forwards'
        }
      );
      await anim.finished;
    } else {
      line.setAttribute('stroke-dashoffset', '0');
    }

    // Settle phase (~120ms)
    line.classList.add('settled');
    if (settleDuration > 0) {
      await new Promise(r => setTimeout(r, settleDuration));
    }

    // If this corresponds to letter B, I, N, G, O (order 1..5), animate the letter strike!
    if (lineInfo.order <= 5 && lineInfo.order > this.playerLetterStrikes) {
      await this.animateLetterStrike(this.playerWordContainer, lineInfo.order - 1, isAccelerated);
      this.playerLetterStrikes = lineInfo.order;
    }
  }

  /**
   * Animates striking through a letter in the B-I-N-G-O word.
   * @param {HTMLElement} container
   * @param {number} letterIndex - 0..4
   * @param {boolean} isAccelerated
   */
  async animateLetterStrike(container, letterIndex, isAccelerated = false) {
    if (!container) return;
    const letterEl = container.children[letterIndex];
    if (!letterEl) return;

    const duration = this.prefersReducedMotion ? 0 : (isAccelerated ? 160 : 300);
    soundManager.playLetterStrike();

    letterEl.classList.add('striking');
    const strikeLine = letterEl.querySelector('.letter-strike-line');

    if (strikeLine && duration > 0) {
      const anim = strikeLine.animate(
        [
          { transform: 'scaleX(0)' },
          { transform: 'scaleX(1.15)' },
          { transform: 'scaleX(1)' }
        ],
        {
          duration,
          easing: 'ease-out',
          fill: 'forwards'
        }
      );
      await anim.finished;
    } else if (strikeLine) {
      strikeLine.style.transform = 'scaleX(1)';
    }

    // Dim to 45% with small pop
    letterEl.classList.remove('striking');
    letterEl.classList.add('struck');
  }

  /**
   * Updates opponent's BINGO letters from public linesCompleted count.
   * @param {number} newCount
   * @param {boolean} isAccelerated
   */
  async syncOpponentLines(newCount, isAccelerated = false) {
    const target = Math.min(5, newCount);
    while (this.opponentLetterStrikes < target) {
      const idx = this.opponentLetterStrikes;
      await this.animateLetterStrike(this.opponentWordContainer, idx, isAccelerated);
      this.opponentLetterStrikes++;
    }
  }

  /**
   * Clears overlay state.
   */
  clear() {
    this.renderedLineIds.clear();
    this.playerLetterStrikes = 0;
    this.opponentLetterStrikes = 0;
    // Remove rendered lines
    const strokes = this.svg.querySelectorAll('.bingo-pen-stroke');
    strokes.forEach(s => s.remove());

    // Reset letters
    [this.playerWordContainer, this.opponentWordContainer].forEach(container => {
      if (container) {
        Array.from(container.children).forEach(el => {
          el.classList.remove('struck', 'striking', 'instant');
          const strikeLine = el.querySelector('.letter-strike-line');
          if (strikeLine) {
            strikeLine.style.transform = 'scaleX(0)';
          }
        });
      }
    });
  }
}
