import { rand } from './math';

type Shape = 'circle' | 'feather' | 'star' | 'streak';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  gravity: number;
  drag: number;
  shape: Shape;
  rot: number;
  vr: number;
}

type Spawn = Partial<Particle> & { x: number; y: number; color: string };

const MAX_PARTICLES = 500;

/** Lightweight particle system for dust, sparkles, feathers and speed streaks. */
export class Particles {
  private list: Particle[] = [];

  clear(): void {
    this.list.length = 0;
  }

  emit(o: Spawn): void {
    if (this.list.length >= MAX_PARTICLES) return;
    const life = o.life ?? 0.6;
    this.list.push({
      vx: 0,
      vy: 0,
      size: 4,
      gravity: 0,
      drag: 0,
      shape: 'circle',
      rot: 0,
      vr: 0,
      ...o,
      life,
      maxLife: life,
    });
  }

  dust(x: number, y: number): void {
    this.emit({
      x, y,
      vx: rand(-90, -30), vy: rand(-60, -20),
      life: rand(0.25, 0.45), size: rand(3, 6),
      color: '#f1d79a', gravity: 80, drag: 2,
    });
  }

  landing(x: number, y: number): void {
    for (let i = 0; i < 8; i++) {
      this.emit({
        x: x + rand(-14, 14), y,
        vx: rand(-160, 160), vy: rand(-90, -20),
        life: rand(0.3, 0.5), size: rand(3, 7),
        color: '#f1d79a', gravity: 300, drag: 2,
      });
    }
  }

  sparkle(x: number, y: number): void {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + rand(-0.3, 0.3);
      const s = rand(80, 200);
      this.emit({
        x, y,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: rand(0.3, 0.5), size: rand(4, 8),
        color: i % 2 ? '#fff6a8' : '#ffd23c', shape: 'star', drag: 3,
        rot: rand(0, 3), vr: rand(-6, 6),
      });
    }
  }

  feathers(x: number, y: number): void {
    for (let i = 0; i < 14; i++) {
      this.emit({
        x, y,
        vx: rand(-260, 260), vy: rand(-380, -80),
        life: rand(0.8, 1.4), size: rand(6, 10),
        color: i % 3 ? '#8b5e3c' : '#b88454', shape: 'feather', gravity: 500, drag: 1.5,
        rot: rand(0, 6), vr: rand(-8, 8),
      });
    }
  }

  smash(x: number, y: number, color: string): void {
    for (let i = 0; i < 16; i++) {
      this.emit({
        x, y,
        vx: rand(-100, 420), vy: rand(-340, 60),
        life: rand(0.4, 0.8), size: rand(4, 9),
        color, gravity: 900, drag: 0.5,
      });
    }
  }

  streak(x: number, y: number): void {
    this.emit({
      x, y,
      vx: rand(-900, -600), vy: 0,
      life: rand(0.12, 0.22), size: rand(18, 40),
      color: 'rgba(255,255,255,0.8)', shape: 'streak',
    });
  }

  update(dt: number): void {
    for (const p of this.list) {
      p.life -= dt;
      p.vy += p.gravity * dt;
      const d = Math.max(0, 1 - p.drag * dt);
      p.vx *= d;
      p.vy *= d;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
    this.list = this.list.filter((p) => p.life > 0);
  }

  draw(g: CanvasRenderingContext2D): void {
    for (const p of this.list) {
      const k = Math.max(0, p.life / p.maxLife);
      g.globalAlpha = Math.min(1, k * 1.6);
      g.fillStyle = p.color;
      switch (p.shape) {
        case 'circle':
          g.beginPath();
          g.arc(p.x, p.y, p.size * (0.4 + 0.6 * k), 0, Math.PI * 2);
          g.fill();
          break;
        case 'feather':
          g.save();
          g.translate(p.x, p.y);
          g.rotate(p.rot);
          g.beginPath();
          g.ellipse(0, 0, p.size, p.size * 0.35, 0, 0, Math.PI * 2);
          g.fill();
          g.restore();
          break;
        case 'star': {
          const s = p.size * (0.5 + 0.5 * k);
          g.save();
          g.translate(p.x, p.y);
          g.rotate(p.rot);
          g.beginPath();
          g.moveTo(0, -s);
          g.quadraticCurveTo(0, 0, s, 0);
          g.quadraticCurveTo(0, 0, 0, s);
          g.quadraticCurveTo(0, 0, -s, 0);
          g.quadraticCurveTo(0, 0, 0, -s);
          g.fill();
          g.restore();
          break;
        }
        case 'streak':
          g.fillRect(p.x, p.y, p.size, 2.5);
          break;
      }
    }
    g.globalAlpha = 1;
  }
}
