import type { Rng } from './math';

export interface PalmPalette {
  trunk: string;
  trunkDark: string;
  leaves: string[];
  rib: string;
  coconut: string;
}

export const NEAR_PALETTE: PalmPalette = {
  trunk: '#b07a3e',
  trunkDark: '#7b4f24',
  leaves: ['#2fa14a', '#3cb857', '#238a3c'],
  rib: '#17652c',
  coconut: '#6b3f1c',
};

export const FAR_PALETTE: PalmPalette = {
  trunk: '#7f6a4c',
  trunkDark: '#5e4d36',
  leaves: ['#3a9a7a', '#45ab87', '#2f8668'],
  rib: '#247058',
  coconut: '#5b3a1e',
};

/** Draws one feathery palm frond as a curved, tapered leaf with leaflet ticks. */
export function drawFrond(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  len: number,
  width: number,
  color: string,
  rib: string,
  droop: number,
): void {
  const N = 14;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const upper: [number, number][] = [];
  const lower: [number, number][] = [];
  const mid: [number, number][] = [];

  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const px = x + dx * len * t;
    const py = y + dy * len * t + droop * len * t * t;
    // tangent of the curve, then its normal
    let tx = dx * len;
    let ty = dy * len + 2 * droop * len * t;
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl;
    ty /= tl;
    const half = Math.sin(Math.PI * Math.pow(t, 0.65)) * width * 0.5;
    mid.push([px, py]);
    upper.push([px - ty * half, py + tx * half]);
    lower.push([px + ty * half, py - tx * half]);
  }

  g.fillStyle = color;
  g.beginPath();
  g.moveTo(upper[0][0], upper[0][1]);
  for (const [px, py] of upper) g.lineTo(px, py);
  for (let i = N; i >= 0; i--) g.lineTo(lower[i][0], lower[i][1]);
  g.closePath();
  g.fill();

  g.strokeStyle = rib;
  g.lineWidth = Math.max(1, width * 0.04);
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(mid[0][0], mid[0][1]);
  for (const [px, py] of mid) g.lineTo(px, py);
  g.stroke();

  // leaflet ticks
  g.globalAlpha = 0.45;
  g.lineWidth = Math.max(0.8, width * 0.02);
  g.beginPath();
  for (let i = 2; i < N; i += 1) {
    g.moveTo(mid[i][0], mid[i][1]);
    g.lineTo(upper[i + 1][0], upper[i + 1][1]);
    g.moveTo(mid[i][0], mid[i][1]);
    g.lineTo(lower[i + 1][0], lower[i + 1][1]);
  }
  g.stroke();
  g.globalAlpha = 1;
}

/**
 * Draws a whole palm tree: a curved ringed trunk, a crown of fronds and a cluster of coconuts.
 * (cx, baseY) is the bottom centre of the trunk, `lean` the horizontal offset of the crown.
 */
export function drawPalm(
  g: CanvasRenderingContext2D,
  cx: number,
  baseY: number,
  h: number,
  lean: number,
  pal: PalmPalette,
  rng: Rng,
): void {
  const p0 = { x: cx, y: baseY };
  const p1 = { x: cx + lean * 0.1, y: baseY - h * 0.55 };
  const p2 = { x: cx + lean, y: baseY - h };
  const at = (t: number): { x: number; y: number } => ({
    x: (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * p1.x + t * t * p2.x,
    y: (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * p1.y + t * t * p2.y,
  });

  // trunk, tapering upward
  const steps = 22;
  g.lineCap = 'round';
  for (let i = 0; i < steps; i++) {
    const a = at(i / steps);
    const b = at((i + 1) / steps);
    const w = h * (0.062 - 0.026 * (i / steps));
    g.strokeStyle = pal.trunk;
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(a.x, a.y);
    g.lineTo(b.x, b.y);
    g.stroke();
    // shaded side + growth rings
    g.strokeStyle = pal.trunkDark;
    g.lineWidth = w * 0.35;
    g.beginPath();
    g.moveTo(a.x + w * 0.25, a.y);
    g.lineTo(b.x + w * 0.25, b.y);
    g.stroke();
    if (i % 2 === 0) {
      g.lineWidth = Math.max(1, h * 0.008);
      g.beginPath();
      g.moveTo(a.x - w * 0.5, a.y);
      g.lineTo(a.x + w * 0.5, a.y + w * 0.15);
      g.stroke();
    }
  }

  const top = at(1);
  const frondCount = 9;
  const frondLen = h * 0.46;
  // back row first (darker), then the front row
  for (let pass = 0; pass < 2; pass++) {
    for (let k = 0; k < frondCount; k++) {
      if (k % 2 !== pass) continue;
      const angle = -3.05 + (k / (frondCount - 1)) * 2.9 + rng.range(-0.1, 0.1);
      const droop = 0.25 + 0.75 * Math.abs(Math.cos(angle));
      const len = frondLen * rng.range(0.85, 1.12);
      const color = pal.leaves[(k + pass) % pal.leaves.length];
      drawFrond(g, top.x, top.y, angle, len, h * 0.2, color, pal.rib, droop);
    }
  }

  // coconut cluster
  g.fillStyle = pal.coconut;
  for (const [dx, dy] of [[-6, 6], [5, 8], [0, 12], [-1, 3]]) {
    const r = Math.max(2.5, h * 0.03);
    g.beginPath();
    g.arc(top.x + dx * (h / 200), top.y + dy * (h / 200) * 1.2, r, 0, Math.PI * 2);
    g.fill();
  }
}
