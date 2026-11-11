import * as THREE from 'three';
import { rand } from '../../src/math';

interface Particle {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
  gravity: number;
  drag: number;
  /** Move with the scrolling world (dust, debris) rather than staying in place. */
  scroll: boolean;
  spin: number;
}

interface Spawn {
  pos: THREE.Vector3;
  vel?: THREE.Vector3;
  life: number;
  size: number;
  color: string;
  gravity?: number;
  drag?: number;
  scroll?: boolean;
  spin?: number;
  /** Stretched streak instead of a chunk. */
  streak?: boolean;
}

const POOL = 260;

/** Pooled 3D particles for dust, sparkles, feathers, debris and dash speed-lines. */
export class Particles {
  readonly group = new THREE.Group();
  private pool: Particle[] = [];
  private chunkGeo = new THREE.IcosahedronGeometry(0.5, 0);
  private streakGeo = new THREE.BoxGeometry(0.05, 0.05, 1);

  constructor() {
    for (let i = 0; i < POOL; i++) {
      const mesh = new THREE.Mesh(this.chunkGeo, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }));
      mesh.visible = false;
      this.group.add(mesh);
      this.pool.push({
        mesh,
        vel: new THREE.Vector3(),
        life: 0,
        maxLife: 1,
        size: 1,
        gravity: 0,
        drag: 0,
        scroll: true,
        spin: 0,
      });
    }
  }

  clear(): void {
    for (const p of this.pool) {
      p.life = 0;
      p.mesh.visible = false;
    }
  }

  private emit(s: Spawn): void {
    const p = this.pool.find((q) => q.life <= 0);
    if (!p) return;
    p.life = p.maxLife = s.life;
    p.size = s.size;
    p.gravity = s.gravity ?? 0;
    p.drag = s.drag ?? 0;
    p.scroll = s.scroll ?? true;
    p.spin = s.spin ?? 0;
    p.vel.copy(s.vel ?? new THREE.Vector3());
    p.mesh.geometry = s.streak ? this.streakGeo : this.chunkGeo;
    (p.mesh.material as THREE.MeshBasicMaterial).color.set(s.color);
    p.mesh.position.copy(s.pos);
    p.mesh.rotation.set(0, 0, 0);
    p.mesh.visible = true;
  }

  dust(at: THREE.Vector3): void {
    this.emit({
      pos: at.clone().add(new THREE.Vector3(rand(-0.2, 0.2), 0.05, 0.3)),
      vel: new THREE.Vector3(rand(-0.6, 0.6), rand(0.8, 1.8), rand(1, 3)),
      life: rand(0.3, 0.5),
      size: rand(0.12, 0.24),
      color: '#f1d79a',
      gravity: -4,
      drag: 2,
    });
  }

  /** Sand thrown up by a sliding kiwi. */
  spray(at: THREE.Vector3): void {
    for (let i = 0; i < 2; i++) {
      this.emit({
        pos: at.clone().add(new THREE.Vector3(rand(-0.3, 0.3), 0.08, 0.2)),
        vel: new THREE.Vector3(rand(-2.5, 2.5), rand(1.5, 3.5), rand(2, 6)),
        life: rand(0.25, 0.45),
        size: rand(0.1, 0.22),
        color: '#f1d79a',
        gravity: -10,
        drag: 1.5,
      });
    }
  }

  landing(at: THREE.Vector3): void {
    for (let i = 0; i < 10; i++) {
      this.emit({
        pos: at.clone().add(new THREE.Vector3(rand(-0.3, 0.3), 0.05, rand(-0.3, 0.3))),
        vel: new THREE.Vector3(rand(-3, 3), rand(1, 3), rand(-2, 2)),
        life: rand(0.3, 0.55),
        size: rand(0.12, 0.26),
        color: '#f1d79a',
        gravity: -9,
        drag: 2,
      });
    }
  }

  sparkle(at: THREE.Vector3): void {
    for (let i = 0; i < 9; i++) {
      this.emit({
        pos: at.clone(),
        vel: new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize().multiplyScalar(rand(2, 5)),
        life: rand(0.3, 0.5),
        size: rand(0.08, 0.16),
        color: i % 2 ? '#fff6a8' : '#ffd23c',
        drag: 3,
        scroll: false,
      });
    }
  }

  feathers(at: THREE.Vector3): void {
    for (let i = 0; i < 16; i++) {
      this.emit({
        pos: at.clone(),
        vel: new THREE.Vector3(rand(-4, 4), rand(2, 7), rand(-3, 3)),
        life: rand(0.8, 1.4),
        size: rand(0.14, 0.26),
        color: i % 3 ? '#8b5e3c' : '#b88454',
        gravity: -9,
        drag: 1.2,
        spin: rand(-8, 8),
        scroll: false,
      });
    }
  }

  smash(at: THREE.Vector3, color: string): void {
    for (let i = 0; i < 18; i++) {
      this.emit({
        pos: at.clone(),
        vel: new THREE.Vector3(rand(-5, 5), rand(1, 7), rand(-6, 2)),
        life: rand(0.4, 0.8),
        size: rand(0.12, 0.3),
        color,
        gravity: -16,
        drag: 0.5,
        spin: rand(-10, 10),
      });
    }
  }

  /** Speed-lines whipping past the camera while dashing. */
  streak(around: THREE.Vector3): void {
    this.emit({
      pos: around.clone().add(new THREE.Vector3(rand(-3.5, 3.5), rand(-0.3, 3), rand(-3, 2))),
      vel: new THREE.Vector3(0, 0, rand(60, 90)),
      life: rand(0.12, 0.2),
      size: rand(2, 5),
      color: '#ffffff',
      scroll: false,
      streak: true,
    });
  }

  update(dt: number, speed: number): void {
    for (const p of this.pool) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.mesh.visible = false;
        continue;
      }
      p.vel.y += p.gravity * dt;
      const d = Math.max(0, 1 - p.drag * dt);
      p.vel.x *= d;
      p.vel.y *= d;
      if (p.mesh.geometry === this.chunkGeo) p.vel.z *= d;
      p.mesh.position.addScaledVector(p.vel, dt);
      if (p.scroll) p.mesh.position.z += speed * dt;
      if (p.mesh.position.y < 0.03 && p.gravity < 0) {
        p.mesh.position.y = 0.03;
        p.vel.y *= -0.3;
      }
      p.mesh.rotation.x += p.spin * dt;
      p.mesh.rotation.z += p.spin * dt;

      const k = p.life / p.maxLife;
      const mat = p.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.min(1, k * 1.8);
      if (p.mesh.geometry === this.streakGeo) p.mesh.scale.set(1, 1, p.size);
      else p.mesh.scale.setScalar(p.size * (0.4 + 0.6 * k));
    }
  }
}
