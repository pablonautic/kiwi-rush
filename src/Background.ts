import { H, HORIZON_Y, W } from './config';
import { drawFrond, drawPalm, FAR_PALETTE, NEAR_PALETTE } from './Palm';
import type { PalmPalette } from './Palm';
import { pick, rand, Rng } from './math';

/** Sprites are rendered at 2x so they stay crisp on HiDPI screens. */
const RES = 2;

const BEACH_FAR_Y = 418;
const SAND_Y = 438;

interface Sprite {
  canvas: HTMLCanvasElement;
  w: number;
  h: number;
}

function makeSprite(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(w * RES);
  canvas.height = Math.ceil(h * RES);
  const g = canvas.getContext('2d')!;
  g.scale(RES, RES);
  draw(g);
  return { canvas, w, h };
}

function palmSprite(h: number, lean: number, pal: PalmPalette, seed: number): Sprite {
  const w = h * 1.25 + 40;
  const sh = h + 40;
  return makeSprite(w, sh, (g) => drawPalm(g, w / 2 - lean / 2, sh - 2, h, lean, pal, new Rng(seed)));
}

function cloudSprite(seed: number): Sprite {
  const rng = new Rng(seed);
  const w = 220;
  const h = 90;
  return makeSprite(w, h, (g) => {
    g.fillStyle = 'rgba(255,255,255,0.92)';
    const blobs = 6 + Math.floor(rng.range(0, 3));
    for (let i = 0; i < blobs; i++) {
      const t = i / (blobs - 1);
      const r = 18 + Math.sin(t * Math.PI) * 22 + rng.range(-4, 6);
      g.beginPath();
      g.arc(24 + t * (w - 48), h - 24 - Math.sin(t * Math.PI) * 14 * rng.range(0.6, 1), r, 0, Math.PI * 2);
      g.fill();
    }
    g.fillRect(24, h - 30, w - 48, 22);
  });
}

function islandSprite(seed: number): Sprite {
  const rng = new Rng(seed);
  const w = 360;
  const h = 130;
  return makeSprite(w, h, (g) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#4f9c86');
    grad.addColorStop(1, '#7fc0a8');
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(0, h);
    g.bezierCurveTo(40, h - 10, 70, h - 60, 130, h - 78);
    g.bezierCurveTo(170, h - 120, 210, h - 100, 240, h - 70);
    g.bezierCurveTo(290, h - 55, 320, h - 25, w, h);
    g.closePath();
    g.fill();
    // tiny palms on the ridge
    const pal: PalmPalette = { ...FAR_PALETTE, leaves: ['#3f8f78', '#4aa085'] };
    const spots: [number, number, number][] = [
      [100, h - 66, 30], [214, h - 88, 34], [258, h - 62, 26], [60, h - 34, 22],
    ];
    for (const [px, py, ph] of spots) drawPalm(g, px, py + 6, ph, rng.range(-8, 8), pal, rng);
  });
}

interface Prop {
  sprite: Sprite;
  x: number; // centre
  y: number; // top
}

/** A horizontally scrolling strip of randomly chosen sprites, moving at a fraction of the world speed. */
class ParallaxLayer {
  private props: Prop[] = [];

  constructor(
    private sprites: Sprite[],
    private factor: number,
    private gap: [number, number],
    private placeY: (s: Sprite) => number,
    private alpha = 1,
  ) {
    let x = -120;
    while (x < W + 250) {
      this.add(x);
      x += rand(gap[0], gap[1]);
    }
  }

  private add(x: number): void {
    const sprite = pick(this.sprites);
    this.props.push({ sprite, x, y: this.placeY(sprite) });
  }

  update(dt: number, speed: number): void {
    const dx = speed * this.factor * dt;
    for (const p of this.props) p.x -= dx;
    this.props = this.props.filter((p) => p.x + p.sprite.w / 2 > -60);
    let last = this.props.length ? this.props[this.props.length - 1].x : 0;
    while (last < W + 250) {
      last += rand(this.gap[0], this.gap[1]);
      this.add(last);
    }
  }

  draw(g: CanvasRenderingContext2D): void {
    g.globalAlpha = this.alpha;
    for (const p of this.props) g.drawImage(p.sprite.canvas, p.x - p.sprite.w / 2, p.y, p.sprite.w, p.sprite.h);
    g.globalAlpha = 1;
  }
}

type DecoType = 'pebble' | 'shell' | 'star' | 'grass';

interface Deco {
  type: DecoType;
  x: number;
  y: number;
  s: number;
}

/** The tropical island scenery: sky, sea, parallax palms and the scrolling beach. */
export class Background {
  private sky: HTMLCanvasElement;
  private clouds: ParallaxLayer;
  private islands: ParallaxLayer;
  private farPalms: ParallaxLayer;
  private nearPalms: ParallaxLayer;
  private decos: Deco[] = [];
  private scroll = 0;

  constructor() {
    this.sky = this.renderSky();

    this.clouds = new ParallaxLayer([1, 2, 3, 4].map(cloudSprite), 0.03, [220, 460], () => rand(30, 170), 0.95);
    this.islands = new ParallaxLayer([islandSprite(11), islandSprite(23)], 0.02, [520, 900], (s) => HORIZON_Y - s.h + 10, 0.9);
    this.farPalms = new ParallaxLayer(
      [0, 1, 2, 3].map((i) => palmSprite(150 + i * 18, (i % 2 ? -1 : 1) * (22 + i * 6), FAR_PALETTE, 100 + i)),
      0.16,
      [90, 240],
      (s) => BEACH_FAR_Y + 10 - s.h,
    );
    this.nearPalms = new ParallaxLayer(
      [0, 1, 2, 3].map((i) => palmSprite(270 + i * 22, (i % 2 ? -1 : 1) * (36 + i * 10), NEAR_PALETTE, 200 + i)),
      0.45,
      [260, 560],
      (s) => SAND_Y + 6 - s.h,
    );

    let x = 0;
    while (x < W + 100) {
      this.decos.push(this.makeDeco(x));
      x += rand(35, 120);
    }
  }

  private makeDeco(x: number): Deco {
    const type = pick<DecoType>(['pebble', 'pebble', 'shell', 'star', 'grass', 'grass']);
    const y = type === 'grass' ? rand(SAND_Y + 6, SAND_Y + 14) : rand(466, H - 14);
    return { type, x, y, s: rand(0.8, 1.3) };
  }

  private renderSky(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = W * RES;
    c.height = H * RES;
    const g = c.getContext('2d')!;
    g.scale(RES, RES);

    const sky = g.createLinearGradient(0, 0, 0, HORIZON_Y);
    sky.addColorStop(0, '#2aa8e6');
    sky.addColorStop(0.65, '#8fdcf2');
    sky.addColorStop(1, '#d9f5f0');
    g.fillStyle = sky;
    g.fillRect(0, 0, W, HORIZON_Y + 1);

    // sun with soft glow
    const glow = g.createRadialGradient(740, 110, 10, 740, 110, 230);
    glow.addColorStop(0, 'rgba(255,248,200,0.95)');
    glow.addColorStop(0.25, 'rgba(255,240,170,0.45)');
    glow.addColorStop(1, 'rgba(255,240,170,0)');
    g.fillStyle = glow;
    g.fillRect(0, 0, W, HORIZON_Y);
    g.fillStyle = '#fffbe0';
    g.beginPath();
    g.arc(740, 110, 44, 0, Math.PI * 2);
    g.fill();

    // sea
    const sea = g.createLinearGradient(0, HORIZON_Y, 0, BEACH_FAR_Y);
    sea.addColorStop(0, '#46cfd6');
    sea.addColorStop(0.5, '#1ab3c9');
    sea.addColorStop(1, '#0c8fb0');
    g.fillStyle = sea;
    g.fillRect(0, HORIZON_Y, W, H - HORIZON_Y);

    // sun reflection on the water
    const refl = g.createLinearGradient(0, HORIZON_Y, 0, BEACH_FAR_Y);
    refl.addColorStop(0, 'rgba(255,250,210,0.55)');
    refl.addColorStop(1, 'rgba(255,250,210,0)');
    g.fillStyle = refl;
    g.beginPath();
    g.moveTo(700, HORIZON_Y);
    g.lineTo(780, HORIZON_Y);
    g.lineTo(830, BEACH_FAR_Y);
    g.lineTo(650, BEACH_FAR_Y);
    g.closePath();
    g.fill();

    g.fillStyle = 'rgba(255,255,255,0.5)';
    g.fillRect(0, HORIZON_Y, W, 1.5);
    return c;
  }

  update(dt: number, speed: number): void {
    this.scroll += speed * dt;
    this.clouds.update(dt, speed);
    this.islands.update(dt, speed);
    this.farPalms.update(dt, speed);
    this.nearPalms.update(dt, speed);

    for (const d of this.decos) d.x -= speed * dt;
    this.decos = this.decos.filter((d) => d.x > -40);
    let last = this.decos.length ? this.decos[this.decos.length - 1].x : 0;
    while (last < W + 60) {
      last += rand(35, 120);
      this.decos.push(this.makeDeco(last));
    }
  }

  draw(g: CanvasRenderingContext2D, time: number): void {
    g.drawImage(this.sky, 0, 0, W, H);
    this.clouds.draw(g);
    this.islands.draw(g);
    this.drawSparkles(g, time);
    this.drawFarBeach(g, time);
    this.farPalms.draw(g);
    this.nearPalms.draw(g);
    this.drawSand(g);
  }

  /** Big fronds hanging into the corners of the screen, drawn above everything. */
  drawForeground(g: CanvasRenderingContext2D, time: number): void {
    const sway = Math.sin(time * 0.9) * 0.04;
    g.globalAlpha = 0.95;
    drawFrond(g, -30, -20, 0.7 + sway, 230, 100, '#1c7a3a', '#0f4e24', 0.55);
    drawFrond(g, -30, -20, 0.25 - sway, 190, 80, '#238a3c', '#0f4e24', 0.7);
    drawFrond(g, W + 30, -20, Math.PI - 0.7 - sway, 230, 100, '#1c7a3a', '#0f4e24', 0.55);
    g.globalAlpha = 1;
  }

  private drawSparkles(g: CanvasRenderingContext2D, time: number): void {
    g.fillStyle = '#fff';
    for (let i = 0; i < 40; i++) {
      const bx = (i * 157) % W;
      const x = (((bx - this.scroll * 0.05 * (1 + (i % 3) * 0.4)) % W) + W) % W;
      const y = HORIZON_Y + 10 + ((i * 53) % (BEACH_FAR_Y - HORIZON_Y - 25));
      g.globalAlpha = 0.15 + 0.3 * Math.max(0, Math.sin(time * 2 + i * 1.7));
      g.fillRect(x, y, 8 + (i % 3) * 6, 2);
    }
    g.globalAlpha = 1;
  }

  private drawFarBeach(g: CanvasRenderingContext2D, time: number): void {
    const wave = (x: number, o: number): number =>
      BEACH_FAR_Y + o + Math.sin((x + time * 40) * 0.035) * 3 + Math.sin(x * 0.08 - time * 2) * 1.5;

    g.fillStyle = '#ecd495';
    g.beginPath();
    g.moveTo(0, H);
    for (let x = 0; x <= W; x += 12) g.lineTo(x, wave(x, 0));
    g.lineTo(W, H);
    g.closePath();
    g.fill();

    g.lineWidth = 3;
    g.strokeStyle = 'rgba(255,255,255,0.85)';
    g.beginPath();
    for (let x = 0; x <= W; x += 12) g.lineTo(x, wave(x, 0));
    g.stroke();
    g.lineWidth = 2;
    g.strokeStyle = 'rgba(255,255,255,0.35)';
    g.beginPath();
    for (let x = 0; x <= W; x += 12) g.lineTo(x, wave(x + 90, -9));
    g.stroke();
  }

  private drawSand(g: CanvasRenderingContext2D): void {
    const sand = g.createLinearGradient(0, SAND_Y, 0, H);
    sand.addColorStop(0, '#f8e3a6');
    sand.addColorStop(1, '#e2bd77');
    g.fillStyle = sand;
    g.fillRect(0, SAND_Y, W, H - SAND_Y);
    g.fillStyle = 'rgba(255,248,215,0.9)';
    g.fillRect(0, SAND_Y, W, 2);
    const shade = g.createLinearGradient(0, SAND_Y, 0, SAND_Y + 14);
    shade.addColorStop(0, 'rgba(150,110,50,0.22)');
    shade.addColorStop(1, 'rgba(150,110,50,0)');
    g.fillStyle = shade;
    g.fillRect(0, SAND_Y + 2, W, 14);

    for (const d of this.decos) this.drawDeco(g, d);
  }

  private drawDeco(g: CanvasRenderingContext2D, d: Deco): void {
    g.save();
    g.translate(d.x, d.y);
    g.scale(d.s, d.s);
    switch (d.type) {
      case 'pebble':
        g.fillStyle = '#b9a27a';
        g.beginPath();
        g.ellipse(0, 0, 6, 3.5, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = 'rgba(255,255,255,0.4)';
        g.beginPath();
        g.ellipse(-1.5, -1, 2.5, 1, 0, 0, Math.PI * 2);
        g.fill();
        break;
      case 'shell':
        g.fillStyle = '#ffd9d0';
        g.beginPath();
        g.arc(0, 0, 6, Math.PI, 0);
        g.closePath();
        g.fill();
        g.strokeStyle = '#e9a99a';
        g.lineWidth = 1;
        for (let i = -4; i <= 4; i += 2) {
          g.beginPath();
          g.moveTo(0, 0);
          g.lineTo(i, -5.5);
          g.stroke();
        }
        break;
      case 'star':
        g.fillStyle = '#ff8a5c';
        g.beginPath();
        for (let i = 0; i < 10; i++) {
          const r = i % 2 ? 3 : 8;
          const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
          g.lineTo(Math.cos(a) * r, Math.sin(a) * r * 0.6);
        }
        g.closePath();
        g.fill();
        break;
      case 'grass':
        g.strokeStyle = '#3d9a47';
        g.lineWidth = 2;
        g.lineCap = 'round';
        for (let i = -2; i <= 2; i++) {
          g.beginPath();
          g.moveTo(i * 2.5, 0);
          g.quadraticCurveTo(i * 3.5, -8, i * 6, -14 + Math.abs(i) * 2);
          g.stroke();
        }
        break;
    }
    g.restore();
  }
}
