/**
 * public/js/confetti.js
 * 
 * Lightweight 60fps canvas confetti and gold coin particle generator.
 * Zero external dependencies.
 */

export class ConfettiCelebration {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.particles = [];
    this.animationId = null;

    if (this.canvas) {
      this._resize();
      window.addEventListener('resize', () => this._resize());
    }
  }

  _resize() {
    if (!this.canvas) return;
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  /**
   * Spawns a victory explosion of gold coins and neon confetti.
   */
  burst(particleCount = 100) {
    if (!this.canvas || !this.ctx) return;
    this._resize();

    const colors = ['#00f0ff', '#8a2be2', '#ffd166', '#ff3366', '#ffffff', '#00b4d8'];

    for (let i = 0; i < particleCount; i++) {
      this.particles.push({
        x: this.canvas.width / 2,
        y: this.canvas.height / 2,
        vx: (Math.random() - 0.5) * 16,
        vy: (Math.random() - 0.8) * 18,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        vRot: (Math.random() - 0.5) * 12,
        gravity: 0.35,
        opacity: 1,
        fadeSpeed: Math.random() * 0.012 + 0.008,
        isCoin: Math.random() > 0.6
      });
    }

    if (!this.animationId) {
      this._animate();
    }
  }

  _animate() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.rotation += p.vRot;
      p.opacity -= p.fadeSpeed;

      if (p.opacity <= 0 || p.y > this.canvas.height + 20) {
        this.particles.splice(i, 1);
        continue;
      }

      this.ctx.save();
      this.ctx.globalAlpha = p.opacity;
      this.ctx.translate(p.x, p.y);
      this.ctx.rotate((p.rotation * Math.PI) / 180);

      if (p.isCoin) {
        // Gold coin circle
        this.ctx.fillStyle = '#ffd166';
        this.ctx.beginPath();
        this.ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.strokeStyle = '#f77f00';
        this.ctx.lineWidth = 1.5;
        this.ctx.stroke();
      } else {
        // Confetti rectangle
        this.ctx.fillStyle = p.color;
        this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.5);
      }

      this.ctx.restore();
    }

    if (this.particles.length > 0) {
      this.animationId = requestAnimationFrame(() => this._animate());
    } else {
      this.animationId = null;
    }
  }
}
