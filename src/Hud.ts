import { H, W } from './config';

const FONT = '"Trebuchet MS", "Segoe UI", Verdana, sans-serif';

export interface HudData {
  score: number;
  coins: number;
  hp: number;
  maxHp: number;
  dashCharge: number;
  dashReady: boolean;
  best: number;
  muted: boolean;
}

function text(
  g: CanvasRenderingContext2D,
  str: string,
  x: number,
  y: number,
  size: number,
  opts: { align?: CanvasTextAlign; fill?: string; stroke?: string; weight?: number } = {},
): void {
  g.font = `${opts.weight ?? 800} ${size}px ${FONT}`;
  g.textAlign = opts.align ?? 'left';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.lineWidth = Math.max(3, size * 0.22);
  g.strokeStyle = opts.stroke ?? 'rgba(10,50,60,0.85)';
  g.strokeText(str, x, y);
  g.fillStyle = opts.fill ?? '#fff';
  g.fillText(str, x, y);
}

function heart(g: CanvasRenderingContext2D, x: number, y: number, s: number, full: boolean): void {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  g.beginPath();
  g.moveTo(0, 6);
  g.bezierCurveTo(-14, -4, -8, -14, 0, -7);
  g.bezierCurveTo(8, -14, 14, -4, 0, 6);
  g.closePath();
  g.fillStyle = full ? '#ff4d6d' : 'rgba(0,0,0,0.35)';
  g.fill();
  g.lineWidth = 1.6;
  g.strokeStyle = full ? '#8e1030' : 'rgba(255,255,255,0.35)';
  g.stroke();
  g.restore();
}

function coinIcon(g: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  g.fillStyle = '#c98a10';
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#ffd23c';
  g.beginPath();
  g.arc(x, y, r - 2.5, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#e6a91c';
  g.lineWidth = 2;
  g.beginPath();
  g.arc(x, y, r - 7, 0, Math.PI * 2);
  g.stroke();
}

function dim(g: CanvasRenderingContext2D, alpha: number): void {
  g.fillStyle = `rgba(4,40,52,${alpha})`;
  g.fillRect(0, 0, W, H);
}

/** Draws every piece of 2D UI: the in-game HUD and the title / pause / game-over screens. */
export class Hud {
  drawPlaying(g: CanvasRenderingContext2D, d: HudData): void {
    text(g, String(d.score), 28, 36, 38, { fill: '#fff' });
    text(g, `BEST ${d.best}`, 30, 68, 16, { fill: '#ffe9a8', weight: 700 });
    for (let i = 0; i < d.maxHp; i++) heart(g, 40 + i * 34, 102, 1.5, i < d.hp);

    coinIcon(g, W - 100, 38, 15);
    text(g, `× ${d.coins}`, W - 76, 38, 28);

    // dash meter
    const bx = 28;
    const by = H - 40;
    const bw = 190;
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(bx, by, bw, 14);
    g.fillStyle = d.dashReady ? '#7dffd2' : '#3fb6e8';
    g.fillRect(bx, by, bw * d.dashCharge, 14);
    g.strokeStyle = 'rgba(255,255,255,0.8)';
    g.lineWidth = 2;
    g.strokeRect(bx, by, bw, 14);
    text(g, d.dashReady ? 'DASH READY' : 'DASH', bx, by - 14, 15, { fill: d.dashReady ? '#7dffd2' : '#fff' });
    if (d.muted) text(g, 'MUTED', W - 24, H - 24, 14, { align: 'right', weight: 700 });
  }

  drawTitle(g: CanvasRenderingContext2D, time: number, best: number): void {
    dim(g, 0.28);
    const bob = Math.sin(time * 2.2) * 5;
    text(g, 'KIWI RUSH', W / 2, 150 + bob, 92, { align: 'center', fill: '#ffe066', stroke: '#6b3a10' });
    text(g, 'an infinite island dash', W / 2, 212 + bob, 24, { align: 'center', weight: 700 });

    const pulse = 0.6 + 0.4 * Math.sin(time * 4);
    g.globalAlpha = pulse;
    text(g, 'PRESS SPACE OR TAP TO START', W / 2, 300, 30, { align: 'center' });
    g.globalAlpha = 1;

    const rows = [
      ['SPACE / ↑ / W  or  tap left', 'Jump (press again for a double jump)'],
      ['SHIFT / → / D  or  tap right', 'Dash — smash obstacles, magnetise coins'],
      ['P  pause      M  mute', best > 0 ? `Best score: ${best}` : 'Collect coins, avoid rocks, crabs, gulls & coconuts'],
    ];
    rows.forEach(([a, b], i) => {
      text(g, a, W / 2 - 14, 372 + i * 32, 18, { align: 'right', fill: '#ffe9a8', weight: 700 });
      text(g, b, W / 2 + 14, 372 + i * 32, 18, { align: 'left', weight: 600 });
    });
  }

  drawPaused(g: CanvasRenderingContext2D): void {
    dim(g, 0.45);
    text(g, 'PAUSED', W / 2, H / 2 - 16, 72, { align: 'center' });
    text(g, 'press P to resume', W / 2, H / 2 + 44, 24, { align: 'center', weight: 700 });
  }

  drawGameOver(g: CanvasRenderingContext2D, time: number, d: HudData, newBest: boolean, canRestart: boolean): void {
    dim(g, 0.5);
    text(g, 'OH NO, KIWI!', W / 2, 140, 70, { align: 'center', fill: '#ffb4a0', stroke: '#5a1c10' });
    text(g, `SCORE  ${d.score}`, W / 2, 230, 52, { align: 'center' });
    text(g, newBest ? '★ NEW BEST! ★' : `BEST  ${d.best}`, W / 2, 285, 28, {
      align: 'center',
      fill: newBest ? '#ffe066' : '#ffe9a8',
    });
    coinIcon(g, W / 2 - 40, 338, 14);
    text(g, `× ${d.coins}`, W / 2 - 18, 338, 26);

    if (canRestart) {
      g.globalAlpha = 0.6 + 0.4 * Math.sin(time * 4);
      text(g, 'PRESS SPACE OR TAP TO RUN AGAIN', W / 2, 410, 28, { align: 'center' });
      g.globalAlpha = 1;
    }
  }
}
