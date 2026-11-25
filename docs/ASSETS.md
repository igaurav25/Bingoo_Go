# Asset Registry & Attribution (`docs/ASSETS.md`)

This document catalogs all fonts, graphics, audio, animations, and licenses used in the project.

---

## 1. Typography & Fonts

All fonts are open-source and free for commercial and non-commercial use:
- **Instrument Sans**: Display font for titles, headings, and prominent pills. Licensed under SIL Open Font License (OFL).
- **Figtree**: Body typography, user interface labels, cards, and modal dialogs. Licensed under SIL Open Font License (OFL).
- **Kalam**: Authentic handwriting cursive font used for 1–25 digits on the copybook paper grid. Licensed under SIL Open Font License (OFL).
- **Noto Sans Devanagari**: Devanagari script font providing fallback support for Hindi translations. Licensed under SIL Open Font License (OFL).

---

## 2. Audio Architecture (Procedural Synthesis)

To guarantee zero external audio file downloads, zero latency, and zero licensing restrictions, all sounds are synthesized via the **Web Audio API** in `public/js/audio.js`:
- **Paper / Pencil Mark Sound**: High-frequency bandpass-filtered noise burst (duration ~40ms, cutoff 2800 Hz) simulating graphite on paper.
- **Red Pen Stroke Sound**: Swept bandpass oscillator (450 Hz -> 180 Hz) paired with white noise envelope simulating a continuous pen slash.
- **Button Tap**: Gentle sine wave chirp (600 Hz -> 400 Hz) with exponential decay (~30ms).
- **Letter Strike Sound**: Snappy dual-tone pop (750 Hz and 1100 Hz).
- **BINGO Ready Sound**: Golden shimmer arpeggio (C5 -> E5 -> G5 -> C6).
- **Victory Fanfare**: Major triad brass simulation (F4 -> A4 -> C5 -> F5).

---

## 3. Visual Effects & Canvas Animations

- **Ambient Rain Canvas** (`public/js/rain.js`):
  - Procedural rain streak simulation with perspective depth layers.
  - Automatically paused when the browser tab loses focus (`document.hidden`).
  - Paused and disabled when `prefers-reduced-motion` or low-quality graphics are selected.
- **Confetti Celebration Canvas** (`public/index.html`):
  - Lightweight 1.2s particle burst for match victories and tournament championships.
- **SVG Line Cutting Overlay** (`src/components/StrikeThroughOverlay.jsx`):
  - Relative grid-unit geometry (`viewBox="-25 -25 550 550"`).
  - Pure SVG vector rendering with no raster artifacts.

---

## 4. App Icons & PWA Manifest Assets

- `public/assets/icon-192.svg`: Scalable 192×192 vector icon with dark blue night background, golden paper sheet, and vibrant red BINGO line.
- `public/assets/icon-512.svg`: Scalable 512×512 vector icon with maskable safe zones.
- `public/assets/og-image.svg`: Open Graph preview image (1200×630) for social link previews.
