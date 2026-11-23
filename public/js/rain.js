/**
 * public/js/rain.js
 * 
 * Ambient rainy night canvas simulation.
 * Hallmark: ribbon, two-in-the-morning, adapted for a notebook bingo game.
 */

export function initRain(canvasId = 'rain') {
  const cv = document.getElementById(canvasId);
  if (!cv) return;
  const cx = cv.getContext('2d');
  if (!cx) return;

  const rm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W, H, D, rc, live = true;

  function fit() {
    const r = window.devicePixelRatio || 1;
    W = cv.width = window.innerWidth * r;
    H = cv.height = window.innerHeight * r;
    rc = getComputedStyle(document.documentElement).getPropertyValue('--color-rain') || 'rgba(180, 190, 240, 0.2)';
    D = Array.from({ length: Math.round(window.innerWidth / 8) }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      l: (16 + Math.random() * 30) * r,
      v: (1.4 + Math.random() * 2.4) * r
    }));
  }

  function draw() {
    cx.clearRect(0, 0, W, H);
    cx.strokeStyle = rc;
    cx.lineWidth = window.devicePixelRatio || 1;
    cx.beginPath();
    for (const d of D) {
      cx.moveTo(d.x, d.y);
      cx.lineTo(d.x - d.l * 0.1, d.y + d.l);
      if (!rm) {
        d.y += d.v;
        if (d.y > H) {
          d.y = -d.l;
          d.x = Math.random() * W;
        }
      }
    }
    cx.stroke();
  }

  window.addEventListener('resize', () => {
    fit();
    if (rm) draw();
  });

  document.addEventListener('visibilitychange', () => {
    live = !document.hidden;
  });

  fit();
  (function loop() {
    if (live) draw();
    if (!rm) requestAnimationFrame(loop);
  })();
}
