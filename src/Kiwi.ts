import { DASH, GROUND_Y, INVULN_TIME, MAX_HP, PHYSICS } from './config';
import { clamp } from './math';
import type { Rect } from './math';

/** Visual scale of the sprite (hitbox is scaled to match). */
const SCALE = 1.2;

export interface KiwiEvents {
  jump(double: boolean): void;
  land(impactSpeed: number): void;
  dash(): void;
}

/** The player: a kiwi bird that runs, jumps (twice) and dashes. Origin is the feet, +x faces forward. */
export class Kiwi {
  static readonly BASE_X = 190;

  x = Kiwi.BASE_X;
  y = GROUND_Y;
  vy = 0;
  hp = MAX_HP;
  invuln = 0;
  dead = false;

  private onGround = true;
  private jumpsLeft = 2;
  private cutDone = false;
  private dashTimer = 0;
  private dashCd = 0;
  private runPhase = 0;
  private squash = 0;
  private spin = 0;
  private t = 0;

  constructor(private events: KiwiEvents) {}

  reset(): void {
    this.x = Kiwi.BASE_X;
    this.y = GROUND_Y;
    this.vy = 0;
    this.hp = MAX_HP;
    this.invuln = 0;
    this.dead = false;
    this.onGround = true;
    this.jumpsLeft = 2;
    this.dashTimer = 0;
    this.dashCd = 0;
    this.spin = 0;
  }

  get dashing(): boolean {
    return this.dashTimer > 0;
  }
  get dashCharge(): number {
    return 1 - clamp(this.dashCd / DASH.cooldown, 0, 1);
  }
  get grounded(): boolean {
    return this.onGround;
  }
  get bounds(): Rect {
    return { x: this.x - 20 * SCALE, y: this.y - 40 * SCALE, w: 40 * SCALE, h: 38 * SCALE };
  }
  /** Centre of the body, handy for effects. */
  get center(): { x: number; y: number } {
    return { x: this.x, y: this.y - 22 * SCALE };
  }

  jumpPress(): void {
    if (this.dead || this.jumpsLeft <= 0) return;
    const first = this.jumpsLeft === 2;
    this.vy = -(first ? PHYSICS.jumpVelocity : PHYSICS.doubleJumpVelocity);
    this.jumpsLeft--;
    this.onGround = false;
    this.cutDone = false;
    this.events.jump(!first);
  }

  /** Releasing early makes for a shorter hop. */
  jumpRelease(): void {
    if (!this.cutDone && this.vy < -150 && !this.dead) this.vy *= PHYSICS.jumpCut;
    this.cutDone = true;
  }

  dash(): boolean {
    if (this.dead || this.dashCd > 0) return false;
    this.dashTimer = DASH.duration;
    this.dashCd = DASH.cooldown;
    this.vy = Math.min(this.vy, 0) * 0.3;
    this.events.dash();
    return true;
  }

  refundDash(seconds: number): void {
    this.dashCd = Math.max(0, this.dashCd - seconds);
  }

  hit(): void {
    this.hp--;
    this.invuln = INVULN_TIME;
    this.vy = -480;
    this.onGround = false;
    this.jumpsLeft = 1;
    this.dashTimer = 0;
  }

  kill(): void {
    this.dead = true;
    this.vy = -620;
    this.onGround = false;
    this.dashTimer = 0;
    this.invuln = 0;
  }

  update(dt: number, speed: number): void {
    this.t += dt;
    this.dashTimer = Math.max(0, this.dashTimer - dt);
    this.dashCd = Math.max(0, this.dashCd - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.squash = Math.max(0, this.squash - dt * 5);

    const targetX = this.dashing ? Kiwi.BASE_X + DASH.lunge : Kiwi.BASE_X;
    this.x += (targetX - this.x) * Math.min(1, dt * 12);

    // dashing makes the kiwi glide almost horizontally
    this.vy += PHYSICS.gravity * (this.dashing ? 0.06 : 1) * dt;
    if (this.dashing) this.vy *= 0.9;
    this.y += this.vy * dt;

    if (this.y >= GROUND_Y) {
      this.y = GROUND_Y;
      if (!this.onGround && this.vy > 200) {
        this.squash = 1;
        this.events.land(this.vy);
      }
      this.vy = 0;
      this.onGround = true;
      this.jumpsLeft = 2;
      this.spin = 0;
    } else {
      this.onGround = false;
    }

    if (this.onGround && !this.dead) this.runPhase += dt * speed * 0.034;
    if (this.dead && !this.onGround) this.spin += dt * 9;
  }

  draw(g: CanvasRenderingContext2D): void {
    if (this.invuln > 0 && !this.dead && Math.floor(this.t * 16) % 2 === 0) return;

    // ground shadow shrinks while airborne
    const height = GROUND_Y - this.y;
    g.fillStyle = 'rgba(90,60,20,0.28)';
    g.beginPath();
    g.ellipse(this.x, GROUND_Y + 3, Math.max(8, 30 - height * 0.06), 5, 0, 0, Math.PI * 2);
    g.fill();

    const tilt = this.dashing ? 0.3 : this.onGround ? 0 : clamp(this.vy * 0.0004, -0.3, 0.4);
    const sx = 1 + this.squash * 0.22 + (this.dashing ? 0.12 : 0);
    const sy = 1 - this.squash * 0.22;

    g.save();
    g.translate(this.x, this.y);
    g.translate(0, -22 * SCALE);
    g.rotate(tilt + this.spin);
    g.scale(sx * SCALE, sy * SCALE);
    g.translate(0, 22);
    this.drawBody(g);
    g.restore();

    if (this.dead && this.onGround) this.drawDizzy(g);
  }

  private drawBody(g: CanvasRenderingContext2D): void {
    g.lineCap = 'round';

    // legs
    const airborne = !this.onGround;
    for (let i = 0; i < 2; i++) {
      const hipX = -3 + i * 6;
      const phase = this.runPhase + i * Math.PI;
      let footX: number;
      let footY: number;
      if (airborne || this.dashing) {
        footX = hipX - 9 + i * 12;
        footY = -9 - (i ? 0 : 3);
      } else {
        footX = hipX + Math.sin(phase) * 15;
        footY = -2 - Math.max(0, -Math.cos(phase)) * 9;
      }
      g.strokeStyle = i ? '#c08a4a' : '#a8743a';
      g.lineWidth = 4.5;
      g.beginPath();
      g.moveTo(hipX, -13);
      g.lineTo(footX, footY);
      g.stroke();
      g.lineWidth = 3;
      for (const toe of [-4, 2, 7]) {
        g.beginPath();
        g.moveTo(footX, footY);
        g.lineTo(footX + 4 + toe * 0.5, footY + 1.5 + (toe === 2 ? 0 : 1));
        g.stroke();
      }
    }

    // body
    const grad = g.createLinearGradient(0, -46, 0, -2);
    grad.addColorStop(0, '#a37a52');
    grad.addColorStop(1, '#6b4529');
    g.fillStyle = grad;
    g.beginPath();
    g.ellipse(0, -24, 25, 21, 0, 0, Math.PI * 2);
    g.fill();

    // feather strokes
    g.strokeStyle = 'rgba(70,42,20,0.45)';
    g.lineWidth = 1.6;
    for (let i = 0; i < 15; i++) {
      const row = Math.floor(i / 5);
      const fx = -17 + (i % 5) * 8 + (row % 2) * 4;
      const fy = -35 + row * 9;
      g.beginPath();
      g.moveTo(fx, fy);
      g.quadraticCurveTo(fx + 3, fy + 5, fx + 7, fy + 1);
      g.stroke();
    }

    // head + beak
    g.fillStyle = '#9a6e45';
    g.beginPath();
    g.arc(21, -36, 9.5, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#e0a63c';
    g.strokeStyle = '#8a5a14';
    g.lineWidth = 1.5;
    g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(28, -41);
    g.quadraticCurveTo(46, -38, 60, -25);
    g.lineTo(57.5, -22.5);
    g.quadraticCurveTo(44, -31, 28, -33);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = '#6e4510';
    g.beginPath();
    g.arc(55, -26, 1.2, 0, Math.PI * 2);
    g.fill();

    // eye
    g.fillStyle = '#1b1b1b';
    g.beginPath();
    g.arc(24, -39, 2.8, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fff';
    g.beginPath();
    g.arc(25, -40, 0.95, 0, Math.PI * 2);
    g.fill();

    // hibiscus
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      g.fillStyle = '#ff4d6d';
      g.beginPath();
      g.arc(13 + Math.cos(a) * 4.2, -46 + Math.sin(a) * 4.2, 3.6, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#ffd23c';
    g.beginPath();
    g.arc(13, -46, 2.2, 0, Math.PI * 2);
    g.fill();
  }

  private drawDizzy(g: CanvasRenderingContext2D): void {
    for (let i = 0; i < 3; i++) {
      const a = this.t * 5 + (i * Math.PI * 2) / 3;
      const sx = this.x + 20 + Math.cos(a) * 18;
      const sy = this.y - 58 + Math.sin(a) * 6;
      g.fillStyle = '#ffd23c';
      g.beginPath();
      g.moveTo(sx, sy - 5);
      g.quadraticCurveTo(sx, sy, sx + 5, sy);
      g.quadraticCurveTo(sx, sy, sx, sy + 5);
      g.quadraticCurveTo(sx, sy, sx - 5, sy);
      g.quadraticCurveTo(sx, sy, sx, sy - 5);
      g.fill();
    }
  }
}
