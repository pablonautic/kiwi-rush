import * as THREE from 'three';
import type { KiwiSkin } from './Progress';
import { clamp } from '../../src/math';

export interface KiwiPose {
  dt: number;
  runPhase: number;
  grounded: boolean;
  vy: number;
  dashing: boolean;
  sliding: boolean;
  /** Distance (in x) still to travel to the target lane: leans the bird into the turn. */
  lateral: number;
  squash: number;
  dead: boolean;
  deadTime: number;
  time: number;
}

interface Palette {
  base: string;
  stroke: string;
  head: string;
  wing: string;
}

const PALETTES: Record<KiwiSkin['texture'], Palette> = {
  brown: { base: '#80583a', stroke: 'rgba(55,32,14,0.5)', head: '#9a6e45', wing: '#6b4529' },
  gold: { base: '#e2b13c', stroke: 'rgba(130,85,10,0.55)', head: '#f0c553', wing: '#c8962a' },
  slate: { base: '#6c6f7d', stroke: 'rgba(35,38,50,0.5)', head: '#7f8394', wing: '#555968' },
};

const textureCache = new Map<string, THREE.CanvasTexture>();

function featherTexture(kind: KiwiSkin['texture']): THREE.CanvasTexture {
  const cached = textureCache.get(kind);
  if (cached) return cached;
  const pal = PALETTES[kind];
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = pal.base;
  g.fillRect(0, 0, 256, 128);
  g.strokeStyle = pal.stroke;
  g.lineWidth = 2;
  for (let row = 0; row < 12; row++) {
    for (let col = 0; col < 18; col++) {
      g.beginPath();
      g.arc(col * 15 + (row % 2) * 7.5, row * 11, 8, 0.15 * Math.PI, 0.85 * Math.PI);
      g.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(kind, tex);
  return tex;
}

const std = (color: string, roughness = 0.9): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({ color, roughness });

/**
 * The kiwi's visual: built from primitives, origin at the feet, facing -z.
 * Pure presentation: all game state lives in `Kiwi`.
 */
export class KiwiModel {
  readonly root = new THREE.Group();
  private rig = new THREE.Group();
  private head = new THREE.Group();
  private legs: THREE.Group[] = [];

  private bodyMat = new THREE.MeshStandardMaterial({ roughness: 0.95 });
  private headMat = std('#9a6e45');
  private wingMat = std('#6b4529');

  private headAcc = new THREE.Group();
  private bodyAcc = new THREE.Group();
  private bandTails: THREE.Mesh[] = [];

  constructor() {
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 28, 20), this.bodyMat);
    body.scale.set(1, 0.92, 1.2);
    body.position.y = 0.74;

    // head (kiwis have a small head and a very long beak)
    this.head.position.set(0, 1.16, -0.62);
    this.head.add(new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 14), this.headMat));

    const beakPivot = new THREE.Group();
    beakPivot.rotation.x = -0.3;
    const beak = new THREE.Mesh(
      new THREE.ConeGeometry(0.085, 1.05, 10).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: '#e0a63c', roughness: 0.5 }),
    );
    beak.position.z = -0.6;
    beakPivot.add(beak);
    this.head.add(beakPivot);

    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), std('#111', 0.3));
      eye.position.set(side * 0.2, 0.08, -0.17);
      const glint = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6), std('#fff', 0.2));
      glint.position.set(side * 0.21, 0.1, -0.22);
      this.head.add(eye, glint);
    }

    // hibiscus
    const flower = new THREE.Group();
    flower.position.set(0.2, 0.25, 0.04);
    const petalGeo = new THREE.SphereGeometry(0.1, 8, 6);
    const petalMat = std('#ff4d6d', 0.5);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const petal = new THREE.Mesh(petalGeo, petalMat);
      petal.scale.y = 0.45;
      petal.position.set(Math.cos(a) * 0.11, 0, Math.sin(a) * 0.11);
      flower.add(petal);
    }
    flower.add(new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), std('#ffd23c', 0.4)));
    this.head.add(flower, this.headAcc);

    // little stubby wings
    const wingGeo = new THREE.SphereGeometry(0.2, 10, 8);
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(wingGeo, this.wingMat);
      wing.scale.set(0.35, 0.8, 1);
      wing.position.set(side * 0.55, 0.8, 0.05);
      this.rig.add(wing);
    }

    // legs
    const legMat = std('#c08a4a');
    for (const side of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(side * 0.24, 0.5, 0.08);
      const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.055, 0.5, 8), legMat);
      thigh.position.y = -0.22;
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.07, 0.42), legMat);
      foot.position.set(0, -0.47, -0.08);
      leg.add(thigh, foot);
      this.legs.push(leg);
      this.root.add(leg);
    }

    this.rig.add(body, this.head, this.bodyAcc);
    this.root.add(this.rig);
    this.setSkin({ texture: 'brown', accessory: 'none' });
  }

  /** Re-colours the bird and rebuilds its accessory. */
  setSkin(skin: KiwiSkin): void {
    const pal = PALETTES[skin.texture];
    this.bodyMat.map = featherTexture(skin.texture);
    this.bodyMat.needsUpdate = true;
    this.headMat.color.set(pal.head);
    this.wingMat.color.set(pal.wing);

    for (const group of [this.headAcc, this.bodyAcc]) group.clear();
    this.bandTails = [];

    if (skin.accessory === 'headband') {
      const red = std('#e63946', 0.6);
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.045, 8, 24), red);
      band.rotation.x = Math.PI / 2;
      band.position.y = 0.1;
      this.headAcc.add(band);
      for (const side of [-1, 1]) {
        const tail = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.03, 0.5), red);
        tail.geometry.translate(0, 0, 0.25); // pivot at the knot
        tail.position.set(side * 0.06, 0.1, 0.27);
        tail.rotation.y = side * 0.25;
        this.bandTails.push(tail);
        this.headAcc.add(tail);
      }
    } else if (skin.accessory === 'crown') {
      const gold = new THREE.MeshStandardMaterial({ color: '#ffd23c', metalness: 0.6, roughness: 0.3, emissive: '#7a4a00', emissiveIntensity: 0.4 });
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.14, 6, 1, true), gold);
      ring.material.side = THREE.DoubleSide;
      ring.position.set(-0.05, 0.33, 0);
      this.headAcc.add(ring);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const tip = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.12, 5), gold);
        tip.position.set(-0.05 + Math.cos(a) * 0.18, 0.46, Math.sin(a) * 0.18);
        this.headAcc.add(tip);
      }
    } else if (skin.accessory === 'belt') {
      const belt = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.08, 10, 28), std('#d62828', 0.6));
      belt.rotation.x = Math.PI / 2;
      belt.scale.set(1, 1.2, 1);
      belt.position.y = 0.55;
      this.bodyAcc.add(belt);
    }
  }

  update(p: KiwiPose): void {
    const airborne = !p.grounded;
    const k = 1 - Math.exp(-14 * p.dt);

    // legs
    this.legs.forEach((leg, i) => {
      if (p.dead) {
        leg.rotation.x = 0.3 * (i ? 1 : -1);
      } else if (p.sliding) {
        leg.rotation.x = 1.25;
      } else if (airborne || p.dashing) {
        leg.rotation.x = (i ? 0.7 : -0.5) + (p.dashing ? 0.4 : 0);
      } else {
        leg.rotation.x = Math.sin(p.runPhase + i * Math.PI) * 1.0;
      }
    });

    // bob while running, lean while dashing / jumping, roll into lane changes
    const bob = p.grounded && !p.dead && !p.sliding ? Math.abs(Math.sin(p.runPhase)) * 0.08 : 0;
    this.rig.position.y += ((p.sliding ? -0.12 : bob) - this.rig.position.y) * Math.max(k, p.sliding ? 0.5 : 0);

    const targetTilt = p.sliding ? -1.0 : p.dashing ? -0.35 : airborne ? clamp(p.vy * 0.02, -0.4, 0.4) * 0.8 : 0;
    this.rig.rotation.x += (targetTilt - this.rig.rotation.x) * k;

    const targetRoll = clamp(-p.lateral * 0.12, -0.45, 0.45);
    this.root.rotation.z += (targetRoll - this.root.rotation.z) * k;
    this.root.rotation.y += (clamp(-p.lateral * 0.1, -0.4, 0.4) - this.root.rotation.y) * k;

    const sy = p.sliding ? 0.62 : 1 - p.squash * 0.22;
    const sx = p.sliding ? 1.08 : 1 + p.squash * 0.22;
    const sz = p.dashing ? 1.18 : p.sliding ? 1.1 : 1;
    this.rig.scale.x += (sx - this.rig.scale.x) * k;
    this.rig.scale.y += (sy - this.rig.scale.y) * k;
    this.rig.scale.z += (sz - this.rig.scale.z) * k;

    // headband tails flutter in the wind
    this.bandTails.forEach((tail, i) => {
      tail.rotation.x = Math.sin(p.time * 16 + i) * 0.25 - 0.1;
    });

    if (p.dead) {
      const d = Math.min(1, p.deadTime * 3);
      this.rig.rotation.z = (Math.PI / 2) * d;
      this.rig.position.x = 0.55 * d;
      this.rig.position.y = 0.2 * d;
    } else {
      this.rig.rotation.z = 0;
      this.rig.position.x = 0;
    }
  }
}
