import * as THREE from 'three';
import { CameraRig } from './CameraRig';
import { Coin } from './Coin';
import { Environment } from './Environment';
import { Hud } from './Hud';
import type { Screen } from './Hud';
import { Input } from './Input';
import { Kiwi } from './Kiwi';
import { Obstacle } from './Obstacles';
import { Particles } from './Particles';
import { Progress } from './Progress';
import type { PlayerStats } from './Progress';
import { KiwiThumbs } from './KiwiThumbs';
import { ShopUI } from './ShopUI';
import { World } from './World';
import { BEST_KEY, COIN_SCORE, DASH, SHOOT, SPEED } from './config';
import { Sfx } from '../../src/Sfx';

type State = 'title' | 'playing' | 'paused' | 'dying' | 'over' | 'shop';

/** Largest simulation step; keeps fast dashes from tunnelling through obstacles. */
const MAX_STEP = 1 / 90;

/** Ties everything together: owns the loop, the state machine and the score. */
export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private rig = new CameraRig();
  private env: Environment;
  private world = new World();
  private particles = new Particles();
  private hud = new Hud();
  private sfx = new Sfx();
  private progress = new Progress();
  private shop: ShopUI;
  private kiwi: Kiwi;
  private stats: PlayerStats = this.progress.stats();

  private state: State = 'title';
  /** Screen to return to when the shop closes. */
  private shopReturn: 'title' | 'over' = 'title';
  private last = 0;
  private clock = 0;
  private time = 0; // play time, drives difficulty

  private distance = 0;
  private bonus = 0;
  private coins = 0;
  private best = 0;
  private newBest = false;

  private slow = 1;
  private flash = 0;
  private overTimer = 0;
  private hintShown = false;
  private gain = 0;
  private dustTimer = 0;
  private streakTimer = 0;
  private sprayTimer = 0;
  private jetTimer = 0;
  private muzzleTimer = 0;
  private shotSound = 0;
  private jetSound = 0;
  private combo = 0;
  private comboTimer = 0;
  private scrollSpeed = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    // phones have very dense screens: cap the render resolution to keep the frame rate up
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2));
    this.env = new Environment(this.scene);

    this.kiwi = new Kiwi({
      jump: (double) => {
        this.sfx.jump(double);
        if (double) this.particles.landing(this.groundPoint());
      },
      land: () => this.particles.landing(this.groundPoint()),
      dash: () => this.sfx.dash(),
      slide: () => this.sfx.slide(),
      lane: () => this.sfx.lane(),
      fly: () => this.sfx.jump(true),
    });
    this.kiwi.applyStats(this.stats);

    const thumbs = new KiwiThumbs();
    this.shop = new ShopUI(this.progress, (id) => thumbs.get(id), {
      onChange: () => this.applyLoadout(),
      onClose: () => this.closeShop(),
      onBuy: () => this.sfx.coin(6),
    });

    this.scene.add(this.world.group, this.particles.group, this.kiwi.object);
    this.best = this.loadBest();
    this.hud.setTitleBest(this.best);
    this.hud.setBank(this.progress.save.wallet);
    this.hud.onShop(() => {
      this.sfx.unlock();
      this.openShop();
    });
    this.hud.onPause(() => this.onPause());
    this.hud.onMute(() => this.toggleMute());
    this.setState('title');

    new Input(canvas, {
      left: () => this.state === 'playing' && this.kiwi.moveLane(-1),
      right: () => this.state === 'playing' && this.kiwi.moveLane(1),
      jumpPress: () => this.onJump(),
      jumpRelease: (cut) => this.state === 'playing' && this.kiwi.jumpRelease(cut),
      down: () => this.state === 'playing' && this.kiwi.down(),
      dash: () => this.onDash(),
      pause: () => this.onPause(),
      mute: () => this.toggleMute(),
      shop: () => (this.state === 'shop' ? this.closeShop() : this.openShop()),
    });

    window.addEventListener('resize', this.resize);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') this.setState('paused');
    });
    this.resize();
  }

  start(): void {
    this.last = performance.now();
    requestAnimationFrame(this.loop);
  }

  // ---------------------------------------------------------------- input

  private canStart(): boolean {
    return this.state === 'title' || (this.state === 'over' && this.overTimer > 0.6);
  }

  private onJump(): void {
    this.sfx.unlock();
    if (this.canStart()) this.begin();
    else if (this.state === 'playing') this.kiwi.jumpPress();
  }

  private onDash(): void {
    this.sfx.unlock();
    if (this.canStart()) this.begin();
    else if (this.state === 'playing') this.kiwi.dash();
  }

  private toggleMute(): void {
    this.sfx.unlock();
    this.sfx.toggleMute();
  }

  private onPause(): void {
    if (this.state === 'playing') this.setState('paused');
    else if (this.state === 'paused') this.setState('playing');
    else if (this.state === 'shop') this.closeShop();
  }

  private openShop(): void {
    if (this.state !== 'title' && this.state !== 'over') return;
    this.shopReturn = this.state;
    this.setState('shop');
    this.shop.render();
  }

  private closeShop(): void {
    if (this.state !== 'shop') return;
    this.setState(this.shopReturn);
  }

  /** Pushes the chosen kiwi and upgrade levels into the gameplay objects. */
  private applyLoadout(): void {
    this.stats = this.progress.stats();
    this.kiwi.applyStats(this.stats);
    this.hud.setBank(this.progress.save.wallet);
  }

  private setState(s: State): void {
    this.state = s;
    this.hud.show((s === 'dying' ? 'playing' : s) as Screen);
  }

  private begin(): void {
    this.kiwi.reset();
    this.world.reset();
    this.particles.clear();
    this.time = 0;
    this.distance = 0;
    this.bonus = 0;
    this.coins = 0;
    this.gain = 0;
    this.slow = 1;
    this.flash = 0;
    this.combo = 0;
    this.newBest = false;
    this.setState('playing');
  }

  // --------------------------------------------------------------- scoring

  private get score(): number {
    return Math.floor(this.distance * 1.2) + this.bonus + this.coins * COIN_SCORE;
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
    this.update(dt);
    this.renderer.render(this.scene, this.rig.camera);
    requestAnimationFrame(this.loop);
  };

  private update(dt: number): void {
    if (this.state === 'paused') return;
    this.clock += dt;

    switch (this.state) {
      case 'title':
      case 'shop':
        // the kiwi jogs on the spot behind the menus
        this.scrollSpeed = 9;
        this.kiwi.update(dt, 9);
        this.emitDust(dt);
        this.env.update(dt, this.scrollSpeed, this.clock, this.rig.camera);
        this.rig.update(dt, this.kiwi, this.clock, 1.2);
        break;
      case 'playing':
      case 'dying':
        this.updateRun(dt);
        break;
      case 'over':
        this.overTimer += dt;
        if (!this.hintShown && this.overTimer > 0.6) {
          this.hintShown = true;
          this.hud.setGameOver(this.score, this.coins, this.gain, this.best, this.newBest, true);
        }
        this.scrollSpeed = 0;
        this.kiwi.update(dt, 0);
        this.rig.update(dt, this.kiwi, this.clock);
        break;
    }

    this.particles.update(dt, this.scrollSpeed);
    this.flash = Math.max(0, this.flash - dt * 1.8);
    this.hud.setFlash(this.flash);
    if (this.state === 'playing' || this.state === 'dying') this.hud.update(this.hudStats());
  }

  private updateRun(dt: number): void {
    const dying = this.state === 'dying';
    if (dying) {
      this.slow = Math.max(0, this.slow - dt * 1.5);
      this.overTimer += dt;
      if (this.overTimer > 1.1) this.finishRun();
    } else {
      this.time += dt;
    }

    const base = Math.min(SPEED.max, SPEED.start + this.time * SPEED.accel);
    const speed = base * (this.kiwi.dashing ? DASH.speedMultiplier : 1) * this.slow;
    this.scrollSpeed = speed;
    this.distance += speed * dt;

    // dashing boosts the magnet to at least the base dash radius
    const magnet = this.kiwi.dashing ? Math.max(DASH.magnet, this.stats.magnet) : this.stats.magnet;

    const steps = Math.max(1, Math.ceil(dt / MAX_STEP));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      this.world.update(h, speed, base, this.clock);
      this.kiwi.update(h, speed);
      if (!this.kiwi.dead && this.state === 'playing') {
        this.world.collide(this.kiwi, h, magnet, {
          coin: (c) => this.onCoin(c),
          smash: (o) => this.onSmash(o),
          hit: () => this.onHit(),
        });
      }
    }

    // spidey: dashing webs crabs and gulls and drags them into the kiwi
    if (this.state === 'playing' && this.kiwi.dashing && this.stats.web) {
      const c = this.kiwi.center;
      this.world.webPull(this.kiwi.position.z, 30, c.x, c.y, dt);
    }

    // cowboy shootout: the volley sweeps forward and takes out everything in range
    if (this.state === 'playing' && this.kiwi.shootout) {
      const reach = SHOOT.range * Math.min(1, this.kiwi.dashProgress * 2.5);
      this.world.shoot(this.kiwi.position.z, reach, (o) => this.onShot(o));
    }

    this.env.update(dt, speed, this.clock, this.rig.camera);
    this.rig.update(dt, this.kiwi, this.clock);

    if (this.state === 'playing') {
      this.emitDust(dt);
      this.emitDashTrail(dt);
      this.emitSpray(dt);
      this.emitJet(dt);
      this.emitMuzzle(dt);
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }
  }

  /** The run is over: bank the coins and show the results. */
  private finishRun(): void {
    this.overTimer = 0;
    this.hintShown = false;
    this.gain = Math.round(this.coins * this.stats.coinMult);
    this.progress.addCoins(this.gain);
    this.hud.setBank(this.progress.save.wallet);
    this.hud.setGameOver(this.score, this.coins, this.gain, this.best, this.newBest, false);
    this.setState('over');
    this.sfx.gameOver();
  }

  private groundPoint(): THREE.Vector3 {
    return new THREE.Vector3(this.kiwi.x, 0, this.kiwi.position.z);
  }

  private onCoin(c: Coin): void {
    this.coins++;
    this.combo++;
    this.comboTimer = 0.45;
    this.kiwi.refundDash(DASH.coinRefund);
    this.sfx.coin(this.combo);
    this.particles.sparkle(c.object.position);
  }

  private onSmash(o: Obstacle): void {
    this.bonus += o.score;
    this.rig.addShake(0.25);
    this.sfx.smash();
    this.particles.smash(o.object.position.clone().add(new THREE.Vector3(0, 0.5, 0)), o.debris);
  }

  private onHit(): void {
    this.kiwi.hit();
    this.rig.addShake(0.6);
    this.flash = 0.55;
    this.sfx.hit();
    this.particles.feathers(this.kiwi.center);

    if (this.kiwi.hp <= 0) {
      this.kiwi.kill();
      this.setState('dying');
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
    if (this.dustTimer <= 0 && this.kiwi.isGrounded && !this.kiwi.dead && !this.kiwi.sliding) {
      this.dustTimer = 0.06;
      this.particles.dust(this.groundPoint());
    }
  }

  private emitSpray(dt: number): void {
    if (!this.kiwi.sliding) return;
    this.sprayTimer -= dt;
    while (this.sprayTimer <= 0) {
      this.sprayTimer += 0.02;
      this.particles.spray(this.groundPoint());
    }
  }

  /** An obstacle shot by the cowboy: it explodes, scores, and a tracer flies to its lane. */
  private onShot(o: Obstacle): void {
    this.bonus += o.score;
    this.rig.addShake(0.15);
    this.particles.smash(o.object.position.clone().add(new THREE.Vector3(0, 0.5, 0)), o.debris);
    const muzzle = this.kiwi.muzzles[this.bonus % 2];
    this.particles.bullet(muzzle, o.object.position.x);
    this.shotSound -= 1;
    if (this.shotSound <= 0) {
      this.shotSound = 3;
      this.sfx.shot();
    }
  }

  private emitMuzzle(dt: number): void {
    if (!this.kiwi.shootout) return;
    this.muzzleTimer -= dt;
    while (this.muzzleTimer <= 0) {
      this.muzzleTimer += 0.045;
      for (const m of this.kiwi.muzzles) {
        this.particles.muzzle(m);
        this.particles.bullet(m, m.x);
      }
    }
  }

  private emitJet(dt: number): void {
    if (!this.kiwi.thrusting) return;
    this.jetTimer -= dt;
    while (this.jetTimer <= 0) {
      this.jetTimer += 0.02;
      this.particles.flame(this.kiwi.nozzle);
    }
    this.jetSound -= dt;
    if (this.jetSound <= 0) {
      this.jetSound = 0.12;
      this.sfx.jet();
    }
  }

  private emitDashTrail(dt: number): void {
    if (!this.kiwi.dashing) return;
    this.streakTimer -= dt;
    while (this.streakTimer <= 0) {
      this.streakTimer += 0.012;
      this.particles.streak(this.kiwi.center);
    }
  }

  // ------------------------------------------------------------- rendering

  private hudStats() {
    return {
      score: this.score,
      coins: this.coins,
      hp: this.kiwi.hp,
      maxHp: this.stats.maxHp,
      dashCharge: this.kiwi.dashCharge,
      best: this.best,
      muted: this.sfx.muted,
      fuel: this.kiwi.hasJetpack ? this.kiwi.fuel : null,
    };
  }

  private resize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.rig.resize(w, h);
  };
}
