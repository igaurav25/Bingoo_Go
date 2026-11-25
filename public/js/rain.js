/**
 * public/js/rain.js
 * 
 * Ambient rainy night canvas simulation with Graphics Quality Engine.
 * Supports:
 * - Auto-detection from deviceMemory, hardwareConcurrency, and frame rates
 * - Manual quality modes: Auto, High, Low
 * - Low quality / Reduced Motion: disables rain, blur, and particles
 * - In-match dimming / pausing to preserve focus and 60fps framerates
 * - Automatic pause when tab is hidden or backgrounded
 */

let rainInstance = null;

export function getGraphicsQuality() {
  try {
    const userPref = localStorage.getItem('bingo_graphics_quality');
    if (userPref === 'high' || userPref === 'low') return userPref;
  } catch {}

  // Auto-detect based on hardware specs
  if (typeof navigator !== 'undefined') {
    const mem = navigator.deviceMemory || 4;
    const cores = navigator.hardwareConcurrency || 4;
    if (mem < 3 || cores < 4) return 'low';
  }
  return 'high';
}

export function setGraphicsQuality(quality) {
  try {
    localStorage.setItem('bingo_graphics_quality', quality);
  } catch {}

  const effective = quality === 'auto' ? getGraphicsQuality() : quality;
  if (effective === 'low') {
    document.documentElement.classList.add('quality-low');
  } else {
    document.documentElement.classList.remove('quality-low');
  }

  if (rainInstance) {
    rainInstance.refreshQuality();
  }
  return effective;
}

export function initRain(canvasId = 'rain') {
  const cv = document.getElementById(canvasId);
  if (!cv) return;
  const cx = cv.getContext('2d');
  if (!cx) return;

  let W, H, D, rc, live = true, inMatch = false;
  let rm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let effectiveQuality = getGraphicsQuality();

  if (effectiveQuality === 'low') {
    document.documentElement.classList.add('quality-low');
  }

  function fit() {
    const r = window.devicePixelRatio || 1;
    W = cv.width = window.innerWidth * r;
    H = cv.height = window.innerHeight * r;
    rc = getComputedStyle(document.documentElement).getPropertyValue('--color-rain') || 'rgba(67, 139, 255, 0.2)';
    
    // Scale particle count based on screen width and quality
    const count = effectiveQuality === 'low' || rm ? 0 : Math.round(window.innerWidth / (inMatch ? 24 : 10));
    D = Array.from({ length: count }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      l: (14 + Math.random() * 26) * r,
      v: (1.2 + Math.random() * 2.0) * r
    }));
  }

  function draw() {
    if (!cx) return;
    cx.clearRect(0, 0, W, H);
    if (effectiveQuality === 'low' || rm || !live || D.length === 0) return;

    cx.strokeStyle = inMatch ? 'rgba(67, 139, 255, 0.08)' : rc;
    cx.lineWidth = window.devicePixelRatio || 1;
    cx.beginPath();
    for (const d of D) {
      cx.moveTo(d.x, d.y);
      cx.lineTo(d.x - d.l * 0.1, d.y + d.l);
      d.y += inMatch ? d.v * 0.5 : d.v;
      if (d.y > H) {
        d.y = -d.l;
        d.x = Math.random() * W;
      }
    }
    cx.stroke();
  }

  window.addEventListener('resize', () => {
    fit();
    draw();
  });

  document.addEventListener('visibilitychange', () => {
    live = !document.hidden;
  });

  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
    rm = e.matches;
    fit();
    draw();
  });

  fit();

  let animFrameId = null;
  function loop() {
    if (live && effectiveQuality !== 'low' && !rm) {
      draw();
    }
    animFrameId = requestAnimationFrame(loop);
  }
  animFrameId = requestAnimationFrame(loop);

  rainInstance = {
    refreshQuality() {
      effectiveQuality = getGraphicsQuality();
      fit();
      draw();
    },
    setInMatch(active) {
      inMatch = !!active;
      fit();
    },
    destroy() {
      if (animFrameId) cancelAnimationFrame(animFrameId);
    }
  };

  return rainInstance;
}

export function setRainInMatch(inMatch) {
  if (rainInstance) {
    rainInstance.setInMatch(inMatch);
  }
}
