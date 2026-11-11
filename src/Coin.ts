import { Entity } from './Entity';
import { rand } from './math';

export const COIN_SIZE = 28;

export class Coin extends Entity {
  private phase = rand(0, Math.PI * 2);

  /** @param cx,cy centre of the coin */
  constructor(cx: number, cy: number) {
    super(cx - COIN_SIZE / 2, cy - COIN_SIZE / 2, COIN_SIZE, COIN_SIZE);
  }

  get cx(): number {
    return this.x + this.w / 2;
  }
  get cy(): number {
    return this.y + this.h / 2;
  }

  update(dt: number, speed: number): void {
    this.x -= speed * dt;
    this.phase += dt * 6;
    if (this.offscreen) this.dead = true;
  }

  /** Pulls the coin towards a point (used by the dash magnet). */
  pull(tx: number, ty: number, dt: number): void {
    const k = Math.min(1, dt * 10);
    this.x += (tx - this.cx) * k;
    this.y += (ty - this.cy) * k;
  }

  draw(g: CanvasRenderingContext2D, time: number): void {
    const cx = this.cx;
    const cy = this.cy + Math.sin(time * 4 + this.x * 0.02) * 2;
    const r = COIN_SIZE / 2;
    const sx = Math.max(0.18, Math.abs(Math.cos(this.phase)));

    g.save();
    g.translate(cx, cy);
    g.scale(sx, 1);
    g.fillStyle = '#c98a10';
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#ffd23c';
    g.beginPath();
    g.arc(0, 0, r - 2.5, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#e6a91c';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(0, 0, r - 7, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.65)';
    g.beginPath();
    g.ellipse(-r * 0.35, -r * 0.4, r * 0.22, r * 0.12, -0.7, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
}
