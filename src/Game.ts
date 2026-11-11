import { Background } from './Background';
import { Coin } from './Coin';
import { Hud } from './Hud';
import type { HudData } from './Hud';
import { Input } from './Input';
import { Kiwi } from './Kiwi';
import { Obstacle } from './Obstacles';
import { Particles } from './Particles';
import { Sfx } from './Sfx';
import { World } from './World';
import { BEST_KEY, COIN_SCORE, DASH, GROUND_Y, H, MAX_HP, SPEED, W } from './config';
import { clamp } from './math';

type State = 'title' | 'playing' | 'paused' | 'dying' | 'over';

/** Ties everything together: owns the loop, the state machine and the score. */
export class Game {
  private g: CanvasRenderingContext2D;
  private state: State = 'title';

  private sfx = new Sfx();
  private particles = new Particles();
  private background = new Background();
  private world = new World();
  private hud = new Hud();
  private kiwi: Kiwi;

  private scale = 1;
  private last = 0;
  private time = 0;
  private clock = 0; // wall-clock for animated UI, keeps ticking while paused

  private distance = 0;
  private bonus = 0;
  private coins = 0;
  private best = 0;
  private newBest = false;

  private slow = 1;
  private shake = 0;
  private flash = 0;
  private overTimer = 0;
  private dustTimer = 0;
  private streakTimer = 0;
  private combo = 0;
  private comboTimer = 0;

  constructor(private canvas: HTMLCanvasElement) {
    this.g = canvas.getContext('2d')!;
    this.kiwi = new Kiwi({
      jump: (double) => {
        this.sfx.jump(double);
        if (double) this.particles.landing(this.kiwi.x, this.kiwi.y + 2);
      },
      land: () => {
        this.particles.landing(this.kiwi.x, GROUND_Y);
      },
      dash: () => this.sfx.dash(),
    });
    this.best = this.loadBest();

    new Input(canvas, {
      jumpPress: () => this.onJumpPress(),
      jumpRelease: () => {
        if (this.state === 'playing') this.kiwi.jumpRelease();
      },
      dash: () => this.onDash(),
      pause: () => this.togglePause(),
      mute: () => {
        this.sfx.unlock();
        this.sfx.toggleMute();
      },
    });

    window.addEventListener('resize', this.resize);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') this.state = 'paused';
    });
    this.resize();
    canvas.focus();
  }

  start(): void {
    this.last = performance.now();
    requestAnimationFrame(this.loop);
  }

  // ---------------------------------------------------------------- input

  private onJumpPress(): void {
    this.sfx.unlock();
    if (this.state === 'title' || (this.state === 'over' && this.overTimer > 0.6)) this.begin();
    else if (this.state === 'playing') this.kiwi.jumpPress();
  }

  private onDash(): void {
    this.sfx.unlock();
    if (this.state === 'title' || (this.state === 'over' && this.overTimer > 0.6)) this.begin();
    else if (this.state === 'playing') this.kiwi.dash();
  }

  private togglePause(): void {
    if (this.state === 'playing') this.state = 'paused';
    else if (this.state === 'paused') this.state = 'playing';
  }

  private begin(): void {
    this.kiwi.reset();
    this.world.reset();
    this.particles.clear();
    this.time = 0;
    this.distance = 0;
    this.bonus = 0;
    this.coins = 0;
    this.slow = 1;
    this.shake = 0;
    this.flash = 0;
    this.combo = 0;
    this.newBest = false;
    this.state = 'playing';
  }

  // --------------------------------------------------------------- scoring

  private get score(): number {
    return Math.floor(this.distance / 12) + this.bonus + this.coins * COIN_SCORE;
  }

  private loadBest(): number {
    try {
      return Number(localStorage.getItem(BEST_KEY)) || 0;
    } catch {
      return 0;
    }
  }

  private saveBest(): void {
    try {
      localStorage.setItem(BEST_KEY, String(this.best));
    } catch {
      /* storage unavailable: ignore */
    }
  }

  // ------------------------------------------------------------ game logic

  private loop = (now: number): void => {
    const dt = Math.min((now - this.last) / 1000, 1 / 30);
    this.last = now;
    this.clock += dt;
    this.update(dt);
    this.render();
    requestAnimationFrame(this.loop);
  };

  private update(dt: number): void {
    switch (this.state) {
      case 'title':
        this.background.update(dt, 160);
        this.kiwi.update(dt, 160);
        this.emitDust(dt);
        break;
      case 'playing':
      case 'dying':
        this.updateRun(dt);
        break;
      case 'over':
        this.overTimer += dt;
        this.kiwi.update(dt, 0);
        break;
      case 'paused':
        return;
    }
    this.particles.update(dt);
    this.shake = Math.max(0, this.shake - dt * 30);
    this.flash = Math.max(0, this.flash - dt * 1.6);
  }

  private updateRun(dt: number): void {
    const dying = this.state === 'dying';
    if (dying) {
      this.slow = Math.max(0, this.slow - dt * 1.5);
      this.overTimer += dt;
      if (this.overTimer > 1.1) {
        this.state = 'over';
        this.overTimer = 0;
        this.sfx.gameOver();
      }
    } else {
      this.time += dt;
    }

    const base = Math.min(SPEED.max, SPEED.start + this.time * SPEED.accel);
    const speed = base * (this.kiwi.dashing ? DASH.speedMultiplier : 1) * this.slow;
    this.distance += speed * dt;

    this.background.update(dt, speed);
    this.world.update(dt, speed, base);
    this.kiwi.update(dt, speed);

    if (!dying) {
      this.world.collide(this.kiwi, dt, {
        coin: (c) => this.onCoin(c),
        smash: (o) => this.onSmash(o),
        hit: () => this.onHit(),
      });
      this.emitDust(dt);
      this.emitDashTrail(dt);
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }
  }

  private onCoin(c: Coin): void {
    this.coins++;
    this.combo++;
    this.comboTimer = 0.45;
    this.kiwi.refundDash(DASH.coinRefund);
    this.sfx.coin(this.combo);
    this.particles.sparkle(c.cx, c.cy);
  }

  private onSmash(o: Obstacle): void {
    this.bonus += o.score;
    this.shake = 7;
    this.sfx.smash();
    this.particles.smash(o.x + o.w / 2, o.y + o.h / 2, o.debris);
  }

  private onHit(): void {
    this.kiwi.hit();
    this.shake = 16;
    this.flash = 0.55;
    this.sfx.hit();
    const c = this.kiwi.center;
    this.particles.feathers(c.x, c.y);

    if (this.kiwi.hp <= 0) {
      this.kiwi.kill();
      this.state = 'dying';
      this.overTimer = 0;
      if (this.score > this.best) {
        this.best = this.score;
        this.newBest = true;
        this.saveBest();
      }
    }
  }

  private emitDust(dt: number): void {
    this.dustTimer -= dt;
    if (this.dustTimer <= 0 && this.kiwi.grounded && !this.kiwi.dead) {
      this.dustTimer = 0.07;
      this.particles.dust(this.kiwi.x - 14, GROUND_Y);
    }
  }

  private emitDashTrail(dt: number): void {
    if (!this.kiwi.dashing) return;
    this.streakTimer -= dt;
    while (this.streakTimer <= 0) {
      this.streakTimer += 0.018;
      this.particles.streak(this.kiwi.x - 10 + Math.random() * 30, this.kiwi.y - 45 + Math.random() * 50);
    }
  }

  // ------------------------------------------------------------- rendering

  private resize = (): void => {
    const dpr = window.devicePixelRatio || 1;
    const s = Math.min(window.innerWidth / W, window.innerHeight / H);
    this.canvas.style.width = `${W * s}px`;
    this.canvas.style.height = `${H * s}px`;
    this.canvas.width = Math.round(W * s * dpr);
    this.canvas.height = Math.round(H * s * dpr);
    this.scale = (s * dpr);
  };

  private hudData(): HudData {
    return {
      score: this.score,
      coins: this.coins,
      hp: this.kiwi.hp,
      maxHp: MAX_HP,
      dashCharge: this.kiwi.dashCharge,
      dashReady: this.kiwi.dashCharge >= 1,
      best: this.best,
      muted: this.sfx.muted,
    };
  }

  private render(): void {
    const g = this.g;
    g.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    g.clearRect(0, 0, W, H);

    g.save();
    if (this.shake > 0) g.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    this.background.draw(g, this.clock);
    this.world.draw(g, this.clock);
    this.kiwi.draw(g);
    this.particles.draw(g);
    this.background.drawForeground(g, this.clock);
    g.restore();

    if (this.flash > 0) {
      g.fillStyle = `rgba(255,60,60,${clamp(this.flash, 0, 1) * 0.5})`;
      g.fillRect(0, 0, W, H);
    }

    switch (this.state) {
      case 'title':
        this.hud.drawTitle(g, this.clock, this.best);
        break;
      case 'playing':
      case 'dying':
        this.hud.drawPlaying(g, this.hudData());
        break;
      case 'paused':
        this.hud.drawPlaying(g, this.hudData());
        this.hud.drawPaused(g);
        break;
      case 'over':
        this.hud.drawGameOver(g, this.clock, this.hudData(), this.newBest, this.overTimer > 0.6);
        break;
    }
  }
}
