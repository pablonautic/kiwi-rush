import { Entity } from './Entity';
import { GROUND_Y, W } from './config';
import type { Rect } from './math';
import { rand } from './math';

/** Base class for everything that can hurt the kiwi (and be smashed by a dash). */
export abstract class Obstacle extends Entity {
  /** Score awarded when smashed with a dash. */
  readonly score: number = 25;
  /** Colour of the debris particles when smashed. */
  abstract readonly debris: string;
  /** Extra leftward speed (px/s) on top of the world scroll. */
  protected extraSpeed = 0;

  update(dt: number, speed: number): void {
    this.x -= (speed + this.extraSpeed) * dt;
    if (this.offscreen) this.dead = true;
  }

  /** Shrinks the box a little so near-misses feel fair. */
  get hitbox(): Rect {
    return { x: this.x + 5, y: this.y + 4, w: this.w - 10, h: this.h - 6 };
  }
}

function groundShadow(g: CanvasRenderingContext2D, cx: number, rx: number): void {
  g.fillStyle = 'rgba(90,60,20,0.25)';
  g.beginPath();
  g.ellipse(cx, GROUND_Y + 3, rx, 5, 0, 0, Math.PI * 2);
  g.fill();
}

export class Rock extends Obstacle {
  readonly debris = '#8a929c';

  constructor(x: number) {
    super(x, GROUND_Y - 38, 50, 38);
  }

  draw(g: CanvasRenderingContext2D): void {
    const { x, y, w, h } = this;
    groundShadow(g, x + w / 2, w * 0.6);
    g.lineJoin = 'round';
    g.fillStyle = '#7d8590';
    g.strokeStyle = '#5d646d';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(x, y + h);
    g.lineTo(x + 3, y + h * 0.5);
    g.lineTo(x + w * 0.28, y + 3);
    g.lineTo(x + w * 0.7, y);
    g.lineTo(x + w - 2, y + h * 0.45);
    g.lineTo(x + w, y + h);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = '#9aa2ac';
    g.beginPath();
    g.moveTo(x + 7, y + h * 0.55);
    g.lineTo(x + w * 0.3, y + 8);
    g.lineTo(x + w * 0.55, y + 6);
    g.lineTo(x + w * 0.3, y + h * 0.6);
    g.closePath();
    g.fill();
    g.fillStyle = '#5fa04a';
    g.beginPath();
    g.ellipse(x + w * 0.72, y + 6, 11, 4, 0.2, 0, Math.PI * 2);
    g.fill();
  }
}

export class Crab extends Obstacle {
  readonly debris = '#e2482f';
  protected override extraSpeed = 70;
  private phase = rand(0, 6);

  constructor(x: number) {
    super(x, GROUND_Y - 30, 52, 30);
  }

  override update(dt: number, speed: number): void {
    super.update(dt, speed);
    this.phase += dt * 14;
  }

  draw(g: CanvasRenderingContext2D): void {
    const cx = this.x + this.w / 2;
    const by = this.y + this.h - 6;
    groundShadow(g, cx, 28);

    // legs
    g.strokeStyle = '#b5321e';
    g.lineWidth = 3;
    g.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const s = Math.sin(this.phase + i * 1.3) * 3;
      for (const d of [-1, 1]) {
        g.beginPath();
        g.moveTo(cx + d * 10, by - 4);
        g.lineTo(cx + d * (20 + i * 2), by + 2 + s);
        g.lineTo(cx + d * (25 + i * 2), by + 7);
        g.stroke();
      }
    }
    // claws
    const wave = Math.sin(this.phase * 0.5) * 0.25;
    for (const d of [-1, 1]) {
      g.save();
      g.translate(cx + d * 22, by - 14);
      g.rotate(d * (0.3 + wave));
      g.fillStyle = '#e2482f';
      g.beginPath();
      g.arc(0, 0, 8, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#08222e';
      g.beginPath();
      g.moveTo(0, -2);
      g.lineTo(d * 6, -9);
      g.lineTo(d * 1, -1);
      g.closePath();
      g.fill();
      g.restore();
    }
    // body
    g.fillStyle = '#ee5a3c';
    g.beginPath();
    g.ellipse(cx, by - 8, 20, 13, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.25)';
    g.beginPath();
    g.ellipse(cx - 5, by - 13, 9, 4, -0.2, 0, Math.PI * 2);
    g.fill();
    // eyes
    for (const d of [-1, 1]) {
      g.strokeStyle = '#b5321e';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(cx + d * 7, by - 17);
      g.lineTo(cx + d * 7, by - 23);
      g.stroke();
      g.fillStyle = '#fff';
      g.beginPath();
      g.arc(cx + d * 7, by - 25, 4, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#111';
      g.beginPath();
      g.arc(cx + d * 7 - 1, by - 25, 1.8, 0, Math.PI * 2);
      g.fill();
    }
  }
}

export class Seagull extends Obstacle {
  readonly debris = '#f4f4f4';
  protected override extraSpeed = 90;
  private phase = rand(0, 6);
  private baseY: number;

  /** @param cy centre height of the gull */
  constructor(x: number, cy: number) {
    super(x, cy - 14, 56, 28);
    this.baseY = this.y;
  }

  override update(dt: number, speed: number): void {
    super.update(dt, speed);
    this.phase += dt * 9;
    this.y = this.baseY + Math.sin(this.phase * 0.5) * 6;
  }

  draw(g: CanvasRenderingContext2D): void {
    const cx = this.x + this.w / 2;
    const cy = this.y + this.h / 2;
    const flap = Math.sin(this.phase) * 16;

    // far wing
    g.fillStyle = '#d9dfe5';
    g.beginPath();
    g.moveTo(cx - 6, cy - 2);
    g.quadraticCurveTo(cx - 4, cy - 24 - flap, cx + 10, cy - 20 - flap);
    g.quadraticCurveTo(cx + 6, cy - 8, cx + 8, cy - 2);
    g.fill();
    // body
    g.fillStyle = '#fafafa';
    g.beginPath();
    g.ellipse(cx, cy + 2, 24, 10, -0.05, 0, Math.PI * 2);
    g.fill();
    // head
    g.beginPath();
    g.arc(cx - 22, cy - 3, 8, 0, Math.PI * 2);
    g.fill();
    // beak
    g.fillStyle = '#f5a623';
    g.beginPath();
    g.moveTo(cx - 28, cy - 5);
    g.lineTo(cx - 40, cy - 1);
    g.lineTo(cx - 28, cy);
    g.fill();
    // eye
    g.fillStyle = '#111';
    g.beginPath();
    g.arc(cx - 24, cy - 5, 1.7, 0, Math.PI * 2);
    g.fill();
    // tail
    g.fillStyle = '#e6eaee';
    g.beginPath();
    g.moveTo(cx + 20, cy);
    g.lineTo(cx + 34, cy - 2);
    g.lineTo(cx + 32, cy + 6);
    g.closePath();
    g.fill();
    // near wing
    g.fillStyle = '#ffffff';
    g.strokeStyle = '#9aa5b1';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(cx - 8, cy);
    g.quadraticCurveTo(cx - 2, cy - 28 + flap, cx + 20, cy - 22 + flap);
    g.quadraticCurveTo(cx + 12, cy - 8, cx + 14, cy);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = '#5b6672';
    g.beginPath();
    g.moveTo(cx + 12, cy - 21 + flap);
    g.lineTo(cx + 22, cy - 22 + flap);
    g.lineTo(cx + 16, cy - 12 + flap * 0.6);
    g.closePath();
    g.fill();
  }
}

/** A coconut that drops from the palms once it enters the screen, then rolls at the kiwi. */
export class Coconut extends Obstacle {
  readonly debris = '#7a4a22';
  protected override extraSpeed = 140;
  private state: 'waiting' | 'falling' | 'rolling' = 'waiting';
  private vy = 0;
  private bounced = false;
  private rot = 0;

  constructor(x: number) {
    super(x, -80, 34, 34);
  }

  override get hitbox(): Rect {
    return { x: this.x + 4, y: this.y + 4, w: this.w - 8, h: this.h - 8 };
  }

  override update(dt: number, speed: number): void {
    if (this.state === 'waiting') {
      // scrolls like scenery until it comes into view, then drops
      this.x -= speed * dt;
      if (this.x < W - 60) {
        this.state = 'falling';
        this.y = -40;
      }
      return;
    }
    this.x -= (speed + this.extraSpeed * (this.state === 'rolling' ? 1 : 0.3)) * dt;
    this.rot -= dt * (speed + this.extraSpeed) / 17;
    if (this.state === 'falling') {
      this.vy += 1500 * dt;
      this.y += this.vy * dt;
      const floor = GROUND_Y - this.h;
      if (this.y >= floor) {
        this.y = floor;
        if (!this.bounced) {
          this.bounced = true;
          this.vy = -this.vy * 0.3;
        } else {
          this.state = 'rolling';
          this.vy = 0;
        }
      }
    }
    if (this.offscreen) this.dead = true;
  }

  draw(g: CanvasRenderingContext2D): void {
    if (this.state === 'waiting') return;
    const cx = this.x + this.w / 2;
    const cy = this.y + this.h / 2;
    const r = this.w / 2;

    // warning shadow grows as the coconut drops
    const height = Math.max(0, GROUND_Y - this.y - this.h);
    const k = 1 - Math.min(1, height / 420);
    g.fillStyle = `rgba(80,40,10,${0.15 + 0.3 * k})`;
    g.beginPath();
    g.ellipse(cx, GROUND_Y + 3, r * (0.7 + 0.5 * k), 5, 0, 0, Math.PI * 2);
    g.fill();

    g.save();
    g.translate(cx, cy);
    g.rotate(this.rot);
    g.fillStyle = '#7a4a22';
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#5a3416';
    g.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.arc(0, 0, r - 3 - i * 4, i, i + 1.6);
      g.stroke();
    }
    g.fillStyle = '#2b1808';
    for (const [dx, dy] of [[-4, -3], [4, -3], [0, 4]]) {
      g.beginPath();
      g.arc(dx, dy, 2.4, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }
}
