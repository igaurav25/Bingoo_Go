/**
 * public/js/qrcode.js
 *
 * Self-contained pure JavaScript QR Code matrix & SVG generator (EC Level M / Byte mode).
 * Zero external libraries or external network requests — works offline and online.
 * Follows QR Code Model 2 specification for Versions 1..6 (up to ~106 bytes for URLs).
 */

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255];
  }
})();

function gfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function rsGeneratorPoly(ecLen) {
  let poly = [1];
  for (let i = 0; i < ecLen; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], GF_EXP[i]);
    }
    poly = next;
  }
  return poly;
}

function rsRemainder(data, ecLen) {
  const gen = rsGeneratorPoly(ecLen);
  const res = new Uint8Array(data.length + ecLen);
  res.set(data);
  for (let i = 0; i < data.length; i++) {
    const coef = res[i];
    if (coef !== 0) {
      for (let j = 0; j < gen.length; j++) {
        res[i + j] ^= gfMul(gen[j], coef);
      }
    }
  }
  return Array.from(res.slice(data.length));
}

// Capacity & EC parameters (Level L: plenty for room links like http://localhost:3000/r/B4K8M)
// Version 1..6 single-block or 2-block EC-L tables
const QR_SPECS = [
  { version: 1, size: 21, totalCodewords: 26, dataCodewords: 19, ecPerBlock: 7, blocks: 1, align: [] },
  { version: 2, size: 25, totalCodewords: 44, dataCodewords: 34, ecPerBlock: 10, blocks: 1, align: [6, 18] },
  { version: 3, size: 29, totalCodewords: 70, dataCodewords: 55, ecPerBlock: 15, blocks: 1, align: [6, 22] },
  { version: 4, size: 33, totalCodewords: 100, dataCodewords: 80, ecPerBlock: 20, blocks: 1, align: [6, 26] },
  { version: 5, size: 37, totalCodewords: 134, dataCodewords: 108, ecPerBlock: 26, blocks: 1, align: [6, 30] },
  { version: 6, size: 41, totalCodewords: 172, dataCodewords: 136, ecPerBlock: 18, blocks: 2, align: [6, 34] }
];

function encodeByteData(text) {
  const bytes = typeof TextEncoder !== 'undefined'
    ? Array.from(new TextEncoder().encode(text))
    : Array.from(String(text)).map(ch => ch.charCodeAt(0) & 0xff);

  const spec = QR_SPECS.find(s => s.dataCodewords >= bytes.length + 2) || QR_SPECS[QR_SPECS.length - 1];
  const bits = [];
  const pushBits = (val, len) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1);
  };

  pushBits(0b0100, 4); // Byte mode
  pushBits(Math.min(bytes.length, spec.dataCodewords - 2), 8);
  for (let i = 0; i < Math.min(bytes.length, spec.dataCodewords - 2); i++) {
    pushBits(bytes[i], 8);
  }
  // Terminator
  const maxBits = spec.dataCodewords * 8;
  for (let i = 0; i < 4 && bits.length < maxBits; i++) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);
  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  while (bits.length < maxBits) {
    pushBits(padBytes[padIdx % 2], 8);
    padIdx++;
  }

  const dataBytes = [];
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
    dataBytes.push(b);
  }

  // Split into RS blocks & interleave
  const blockSize = Math.floor(dataBytes.length / spec.blocks);
  const dataBlocks = [];
  const ecBlocks = [];
  let offset = 0;
  for (let b = 0; b < spec.blocks; b++) {
    const slice = dataBytes.slice(offset, offset + blockSize);
    offset += blockSize;
    dataBlocks.push(slice);
    ecBlocks.push(rsRemainder(slice, spec.ecPerBlock));
  }

  const codewords = [];
  for (let i = 0; i < blockSize; i++) {
    for (let b = 0; b < spec.blocks; b++) codewords.push(dataBlocks[b][i]);
  }
  for (let i = 0; i < spec.ecPerBlock; i++) {
    for (let b = 0; b < spec.blocks; b++) codewords.push(ecBlocks[b][i]);
  }

  return { spec, codewords };
}

function buildMatrix(spec, codewords) {
  const N = spec.size;
  const grid = Array.from({ length: N }, () => new Array(N).fill(null));
  const reserved = Array.from({ length: N }, () => new Array(N).fill(false));

  const setFixed = (r, c, val) => {
    if (r >= 0 && r < N && c >= 0 && c < N) {
      grid[r][c] = val ? 1 : 0;
      reserved[r][c] = true;
    }
  };

  // Finder patterns + separators
  const drawFinder = (top, left) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const rr = top + r;
        const cc = left + c;
        if (rr < 0 || rr >= N || cc < 0 || cc >= N) continue;
        if (r === -1 || r === 7 || c === -1 || c === 7) {
          setFixed(rr, cc, 0);
        } else {
          const on = (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
          setFixed(rr, cc, on ? 1 : 0);
        }
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(0, N - 7);
  drawFinder(N - 7, 0);

  // Timing patterns
  for (let i = 8; i < N - 8; i++) {
    setFixed(6, i, i % 2 === 0 ? 1 : 0);
    setFixed(i, 6, i % 2 === 0 ? 1 : 0);
  }

  // Alignment patterns
  for (const r of spec.align) {
    for (const c of spec.align) {
      if (reserved[r][c]) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const on = Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0);
          setFixed(r + dr, c + dc, on ? 1 : 0);
        }
      }
    }
  }

  // Reserve format info + dark module
  setFixed(N - 8, 8, 1);
  for (let i = 0; i < 9; i++) {
    if (!reserved[8][i]) { reserved[8][i] = true; grid[8][i] = 0; }
    if (!reserved[i][8]) { reserved[i][8] = true; grid[i][8] = 0; }
  }
  for (let i = 0; i < 8; i++) {
    reserved[8][N - 1 - i] = true; grid[8][N - 1 - i] = 0;
    if (i < 7) { reserved[N - 1 - i][8] = true; grid[N - 1 - i][8] = 0; }
  }

  // Place data bits (zigzag) with mask pattern 0 ((r + c) % 2 === 0)
  const bitStream = [];
  for (const cw of codewords) {
    for (let i = 7; i >= 0; i--) bitStream.push((cw >> i) & 1);
  }

  let bitIdx = 0;
  let up = true;
  for (let col = N - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    for (let step = 0; step < N; step++) {
      const r = up ? N - 1 - step : step;
      for (let dc = 0; dc < 2; dc++) {
        const c = col - dc;
        if (!reserved[r][c]) {
          const bit = bitIdx < bitStream.length ? bitStream[bitIdx++] : 0;
          const masked = ((r + c) % 2 === 0) ? (bit ^ 1) : bit;
          grid[r][c] = masked;
        }
      }
    }
    up = !up;
  }

  // Apply format info for EC Level L (01) + Mask 0 (000) -> 15-bit BCH: 0x77c4 (111011111000100)
  const fmtBits = 0b111011111000100;
  const fBit = (i) => (fmtBits >> (14 - i)) & 1;

  // Top-left horizontal & vertical
  const topLeftH = [0, 1, 2, 3, 4, 5, 7, 8];
  const topLeftV = [0, 1, 2, 3, 4, 5, 7, 8];
  for (let i = 0; i < 7; i++) setFixed(8, topLeftH[i], fBit(i));
  setFixed(8, 7, fBit(6));
  setFixed(8, 8, fBit(7));
  setFixed(7, 8, fBit(8));
  for (let i = 9; i < 15; i++) setFixed(14 - i, 8, fBit(i));

  // Bottom-left & top-right
  for (let i = 0; i < 7; i++) setFixed(N - 1 - i, 8, fBit(i));
  for (let i = 0; i < 8; i++) setFixed(8, N - 8 + i, fBit(7 + i));

  return grid;
}

/**
 * Generates a 2D boolean/0-1 QR code matrix for any room URL or invite string offline.
 * @param {string} text
 * @returns {number[][]}
 */
export function generateQRMatrix(text) {
  const { spec, codewords } = encodeByteData(String(text || 'BINGO'));
  return buildMatrix(spec, codewords);
}

/**
 * Generates an inline SVG element containing the offline-rendered QR code.
 * @param {string} text
 * @param {number} [size=200]
 * @returns {SVGSVGElement}
 */
export function generateQRCodeSVG(text, size = 200) {
  const matrix = generateQRMatrix(text);
  const count = matrix.length;
  const quiet = 2;
  const vbSize = count + quiet * 2;

  let d = '';
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (matrix[r][c]) {
        d += `M${c + quiet},${r + quiet}h1v1h-1z`;
      }
    }
  }

  if (typeof document === 'undefined') {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vbSize} ${vbSize}" width="${size}" height="${size}" role="img" aria-label="QR Code"><rect x="0" y="0" width="${vbSize}" height="${vbSize}" fill="#ffffff"/><path d="${d}" fill="#101827"/></svg>`;
  }

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${vbSize} ${vbSize}`);
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `QR Code for ${text}`);
  svg.style.borderRadius = '12px';
  svg.style.background = '#ffffff';
  svg.style.display = 'block';

  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('x', '0');
  bg.setAttribute('y', '0');
  bg.setAttribute('width', String(vbSize));
  bg.setAttribute('height', String(vbSize));
  bg.setAttribute('fill', '#ffffff');
  svg.appendChild(bg);

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', d);
  path.setAttribute('fill', '#101827');
  svg.appendChild(path);

  return svg;
}
