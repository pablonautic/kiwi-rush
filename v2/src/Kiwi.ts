import * as THREE from 'three';
import type { Box } from './Entity';
import { createShadow } from './Entity';
import { KiwiModel } from './KiwiModel';
import { computeStats } from './Progress';
import type { PlayerStats } from './Progress';
import { DASH, INVULN_TIME, PHYSICS, laneX } from './config';
import { clamp } from '../../src/math';

export interface KiwiEvents {
  jump(double: boolean): void;
  land(impactSpeed: number): void;
  dash(): void;
  slide(): void;
  lane(): void;
}

/** The player: a kiwi that switches between 3 lanes, jumps (twice), slides and dashes. */
export class Kiwi {
  readonly object = new THREE.Group();

  lane = 0;
  x = 0;
  y = 0;
  vy = 0;
  hp = 3;
  invuln = 0;
  dead = false;

  private stats: PlayerStats = computeStats({ dashCooldown: 0, dashLength: 0, magnet: 0, heart: 0, coinValue: 0 }, 'classic');
  private model = new KiwiModel();
  private shadow = createShadow(0.9);
  private grounded = true;
  private jumpsLeft = 2;
  private cutDone = false;
  private dashTimer = 0;
  private dashCd = 0;
  private dashBlend = 0;
  private slideTimer = 0;
  private runPhase = 0;
  private squash = 0;
  private deadTime = 0;
  private t = 0;

  constructor(private events: KiwiEvents) {
    this.object.add(this.model.root);
    this.object.add(this.shadow);
    this.applyStats(this.stats);
  }

  /** Applies the chosen kiwi + upgrades (skin, size and gameplay numbers). */
  applyStats(stats: PlayerStats): void {
    this.stats = stats;
    this.model.setSkin(stats.skin);
    this.model.root.scale.setScalar(stats.scale);
    this.dashCd = Math.min(this.dashCd, stats.dashCooldown);
  }

  reset(): void {
    this.lane = 0;
    this.x = 0;
    this.y = 0;
    this.vy = 0;
    this.hp = this.stats.maxHp;
    this.invuln = 0;
    this.dead = false;
    this.grounded = true;
    this.jumpsLeft = 2;
    this.dashTimer = 0;
    this.dashCd = 0;
    this.dashBlend = 0;
    this.slideTimer = 0;
    this.deadTime = 0;
    this.model.root.rotation.set(0, 0, 0);
    this.sync();
  }

  get dashing(): boolean {
    return this.dashTimer > 0;
  }
  get sliding(): boolean {
    return this.slideTimer > 0;
  }
  /** 0..1, smoothed: drives camera FOV and effects. */
  get dashAmount(): number {
    return this.dashBlend;
  }
  get dashCharge(): number {
    return 1 - clamp(this.dashCd / this.stats.dashCooldown, 0, 1);
  }
  get isGrounded(): boolean {
    return this.grounded;
  }
  get position(): THREE.Vector3 {
    return this.object.position;
  }
  get box(): Box {
    const p = this.object.position;
    const s = this.stats.scale;
    // sliding shrinks the box so the kiwi fits under low obstacles
    if (this.sliding) return { cx: p.x, cy: p.y + 0.3 * s, cz: p.z, hx: 0.42 * s, hy: 0.3 * s, hz: 0.55 * s };
    return { cx: p.x, cy: p.y + 0.58 * s, cz: p.z, hx: 0.42 * s, hy: 0.58 * s, hz: 0.5 * s };
  }
  get center(): THREE.Vector3 {
    return new THREE.Vector3(this.x, this.y + (this.sliding ? 0.3 : 0.7) * this.stats.scale, this.object.position.z);
  }

  moveLane(dir: -1 | 1): void {
    if (this.dead) return;
    const next = clamp(this.lane + dir, -1, 1);
    if (next === this.lane) return;
    this.lane = next;
    this.events.lane();
  }

  jumpPress(): void {
    if (this.dead || this.jumpsLeft <= 0) return;
    const first = this.jumpsLeft === 2;
    this.vy = (first ? PHYSICS.jumpVelocity : PHYSICS.doubleJumpVelocity) * this.stats.jumpMul;
    this.jumpsLeft--;
    this.grounded = false;
    this.cutDone = false;
    this.slideTimer = 0;
    this.events.jump(!first);
  }

  /** Releasing the key early gives a shorter hop. */
  jumpRelease(): void {
    if (!this.cutDone && this.vy > 4 && !this.dead) this.vy *= PHYSICS.jumpCut;
    this.cutDone = true;
  }

  /** Down: slide along the sand, or slam back down when airborne. */
  down(): void {
    if (this.dead) return;
    if (this.grounded) {
      if (!this.sliding) this.events.slide();
      this.slideTimer = this.stats.slideDuration;
    } else {
      this.vy = Math.min(this.vy, PHYSICS.fastFall);
    }
  }

  dash(): boolean {
    if (this.dead || this.dashCd > 0) return false;
    this.dashTimer = this.stats.dashDuration;
    this.dashCd = this.stats.dashCooldown;
    this.slideTimer = 0;
    this.vy = Math.max(this.vy, 0) * 0.3;
    this.events.dash();
    return true;
  }

  refundDash(seconds: number): void {
    this.dashCd = Math.max(0, this.dashCd - seconds);
  }

  hit(): void {
    this.hp--;
    this.invuln = INVULN_TIME;
    this.vy = 8;
    this.grounded = false;
    this.jumpsLeft = 1;
    this.dashTimer = 0;
    this.slideTimer = 0;
  }

  kill(): void {
    this.dead = true;
    this.vy = 10;
    this.grounded = false;
    this.dashTimer = 0;
    this.slideTimer = 0;
    this.invuln = 0;
  }

  update(dt: number, speed: number): void {
    this.t += dt;
    this.dashTimer = Math.max(0, this.dashTimer - dt);
    this.dashCd = Math.max(0, this.dashCd - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.slideTimer = Math.max(0, this.slideTimer - dt);
    this.squash = Math.max(0, this.squash - dt * 5);
    this.dashBlend += ((this.dashing ? 1 : 0) - this.dashBlend) * Math.min(1, dt * (this.dashing ? 14 : 5));
    if (this.dead) this.deadTime += dt;

    // smooth lane change
    this.x += (laneX(this.lane) - this.x) * (1 - Math.exp(-16 * dt));

    // dashing makes the kiwi glide almost horizontally
    this.vy -= PHYSICS.gravity * (this.dashing ? 0.06 : 1) * dt;
    if (this.dashing) this.vy *= Math.pow(0.9, dt * 90);
    this.y += this.vy * dt;

    if (this.y <= 0) {
      this.y = 0;
      if (!this.grounded && this.vy < -4) {
        this.squash = 1;
        this.events.land(-this.vy);
      }
      this.vy = 0;
      this.grounded = true;
      this.jumpsLeft = 2;
    } else {
      this.grounded = false;
      this.slideTimer = 0;
    }

    if (this.grounded && !this.dead) this.runPhase += dt * (6 + speed * 0.45);
    this.sync(dt);
  }

  private sync(dt = 0): void {
    this.object.position.set(this.x, this.y, -DASH.lunge * this.dashBlend);
    this.model.root.visible = !(this.invuln > 0 && !this.dead && Math.floor(this.t * 16) % 2 === 0);

    this.shadow.position.set(0, 0.04 - this.y, 0);
    const s = Math.max(0.4, 1 - this.y * 0.12) * this.stats.scale;
    this.shadow.scale.set(0.9 * s, 1, 0.9 * s);

    this.model.update({
      dt,
      runPhase: this.runPhase,
      grounded: this.grounded,
      vy: this.vy,
      dashing: this.dashing,
      sliding: this.sliding,
      lateral: laneX(this.lane) - this.x,
      squash: this.squash,
      dead: this.dead,
      deadTime: this.deadTime,
      time: this.t,
    });
  }
}
