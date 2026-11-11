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
  flying: boolean;
  thrusting: boolean;
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
  void: { base: '#3b2a63', stroke: 'rgba(190,160,255,0.45)', head: '#54408c', wing: '#2c1f4d' },
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

const glossy = (color: string): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.2, metalness: 0.5 });

/**
 * The kiwi's visual: built from primitives, origin at the feet, facing -z.
 * Pure presentation: all game state lives in `Kiwi`.
 */
export class KiwiModel {
  readonly root = new THREE.Group();
  private rig = new THREE.Group();
  private head = new THREE.Group();
  private flower = new THREE.Group();
  private legs: THREE.Group[] = [];
  private feet: THREE.Mesh[] = [];

  private bodyMat = new THREE.MeshStandardMaterial({ roughness: 0.95 });
  private headMat = std('#9a6e45');
  private wingMat = std('#6b4529');
  private legMat = std('#c08a4a');
  private sneakerMat = std('#f4f4f4', 0.5);

  private headAcc = new THREE.Group();
  private bodyAcc = new THREE.Group();
  private legAcc: THREE.Object3D[] = [];
  private bandTails: THREE.Mesh[] = [];
  private cape: THREE.Mesh | null = null;
  private halo: THREE.Mesh | null = null;
  private flames: THREE.Mesh[] = [];

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
    this.flower.position.set(0.2, 0.25, 0.04);
    const petalGeo = new THREE.SphereGeometry(0.1, 8, 6);
    const petalMat = std('#ff4d6d', 0.5);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const petal = new THREE.Mesh(petalGeo, petalMat);
      petal.scale.y = 0.45;
      petal.position.set(Math.cos(a) * 0.11, 0, Math.sin(a) * 0.11);
      this.flower.add(petal);
    }
    this.flower.add(new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), std('#ffd23c', 0.4)));
    this.head.add(this.flower, this.headAcc);

    // little stubby wings
    const wingGeo = new THREE.SphereGeometry(0.2, 10, 8);
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(wingGeo, this.wingMat);
      wing.scale.set(0.35, 0.8, 1);
      wing.position.set(side * 0.55, 0.8, 0.05);
      this.rig.add(wing);
    }

    // legs
    for (const side of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(side * 0.24, 0.5, 0.08);
      const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.055, 0.5, 8), this.legMat);
      thigh.position.y = -0.22;
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.07, 0.42), this.legMat);
      foot.position.set(0, -0.47, -0.08);
      leg.add(thigh, foot);
      this.feet.push(foot);
      this.legs.push(leg);
      this.root.add(leg);
    }

    this.rig.add(body, this.head, this.bodyAcc);
    this.root.add(this.rig);
    this.setSkin({ texture: 'brown', accessory: 'none' });
  }

  /** Re-colours the bird and rebuilds its accessories. */
  setSkin(skin: KiwiSkin): void {
    const pal = PALETTES[skin.texture];
    this.bodyMat.map = featherTexture(skin.texture);
    this.bodyMat.needsUpdate = true;
    this.headMat.color.set(pal.head);
    this.wingMat.color.set(pal.wing);

    // reset everything an accessory may have changed
    for (const group of [this.headAcc, this.bodyAcc]) group.clear();
    for (const o of this.legAcc) o.removeFromParent();
    this.legAcc = [];
    this.bandTails = [];
    this.flames = [];
    this.cape = null;
    this.halo = null;
    this.flower.visible = true;
    this.feet.forEach((f) => (f.material = this.legMat));

    switch (skin.accessory) {
      case 'headband':
        this.buildHeadband();
        break;
      case 'crown':
        this.buildCrown();
        break;
      case 'belt':
        this.buildBelt();
        break;
      case 'admin':
        this.buildAdmin();
        break;
      case 'jetpack':
        this.buildJetpack();
        break;
      case 'racer':
        this.buildRacer();
        break;
    }
  }

  private buildHeadband(): void {
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
  }

  private buildCrown(): void {
    const gold = new THREE.MeshStandardMaterial({ color: '#ffd23c', metalness: 0.6, roughness: 0.3, emissive: '#7a4a00', emissiveIntensity: 0.4, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.14, 6, 1, true), gold);
    ring.position.set(-0.05, 0.33, 0);
    this.headAcc.add(ring);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.12, 5), gold);
      tip.position.set(-0.05 + Math.cos(a) * 0.18, 0.46, Math.sin(a) * 0.18);
      this.headAcc.add(tip);
    }
  }

  private buildBelt(): void {
    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.08, 10, 28), std('#d62828', 0.6));
    belt.rotation.x = Math.PI / 2;
    belt.scale.set(1, 1.2, 1);
    belt.position.y = 0.55;
    this.bodyAcc.add(belt);
  }

  /** Admin: dark shades, a floating halo and a flowing cape. */
  private buildAdmin(): void {
    const dark = glossy('#0a0a12');
    for (const side of [-1, 1]) {
      const lens = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.11, 0.05), dark);
      lens.position.set(side * 0.13, 0.08, -0.26);
      this.headAcc.add(lens);
    }
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.025, 0.05), dark);
    bridge.position.set(0, 0.11, -0.25);
    this.headAcc.add(bridge);

    this.halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.26, 0.035, 8, 28),
      new THREE.MeshStandardMaterial({ color: '#ffe066', emissive: '#ffb300', emissiveIntensity: 0.9, metalness: 0.4, roughness: 0.3 }),
    );
    this.halo.rotation.x = Math.PI / 2;
    this.halo.position.set(0, 0.5, 0);
    this.headAcc.add(this.halo);

    // cape hangs from the shoulders; visible from the chase camera
    const geo = new THREE.PlaneGeometry(1, 1, 1, 6);
    const pos = geo.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const t = 0.5 - pos.getY(i); // 0 at the shoulders, 1 at the hem
      pos.setXYZ(i, pos.getX(i) * (0.75 + 0.55 * t), -1.1 * t, 0.12 * Math.sin(t * Math.PI));
    }
    geo.computeVertexNormals();
    this.cape = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#8338ec', roughness: 0.6, side: THREE.DoubleSide, emissive: '#2a0a5e', emissiveIntensity: 0.3 }));
    this.cape.position.set(0, 1.22, 0.7);
    this.bodyAcc.add(this.cape);
    const trim = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.07), new THREE.MeshStandardMaterial({ color: '#ffd23c', side: THREE.DoubleSide, metalness: 0.5, roughness: 0.4 }));
    trim.position.set(0, -1.1, 0.004);
    this.cape.add(trim);
  }

  /** Jetpack: twin tanks with nozzles (and flames while firing) plus aviator goggles. */
  private buildJetpack(): void {
    const metal = new THREE.MeshStandardMaterial({ color: '#aab4c2', metalness: 0.6, roughness: 0.35 });
    const orange = std('#ff7b00', 0.5);
    for (const side of [-1, 1]) {
      const x = side * 0.22;
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.72, 14), metal);
      tank.position.set(x, 0.92, 0.66);
      const top = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.16, 14), orange);
      top.position.set(x, 1.36, 0.66);
      const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.15, 0.16, 12), orange);
      nozzle.position.set(x, 0.5, 0.66);
      const flame = new THREE.Mesh(
        new THREE.ConeGeometry(0.13, 0.7, 10).rotateX(Math.PI),
        new THREE.MeshBasicMaterial({ color: '#ffb300' }),
      );
      flame.position.set(x, 0.1, 0.66);
      flame.visible = false;
      this.flames.push(flame);
      this.bodyAcc.add(tank, top, nozzle, flame);
    }
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.1, 0.2), orange);
    frame.position.set(0, 1.0, 0.56);
    this.bodyAcc.add(frame);

    // goggles
    const strap = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.025, 6, 24), std('#5a3a1e'));
    strap.rotation.x = Math.PI / 2;
    strap.position.y = 0.1;
    this.headAcc.add(strap);
    for (const side of [-1, 1]) {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.03, 8, 16), metal);
      rim.position.set(side * 0.14, 0.1, -0.24);
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.095, 16), new THREE.MeshStandardMaterial({ color: '#7fd6ff', transparent: true, opacity: 0.75, roughness: 0.1 }));
      lens.position.set(side * 0.14, 0.1, -0.245);
      lens.rotation.y = Math.PI;
      this.headAcc.add(rim, lens);
    }
  }

  /** Sport: F1-style helmet, red racing suit and white sneakers. */
  private buildRacer(): void {
    // racing suit over the body
    const suit = new THREE.Mesh(new THREE.SphereGeometry(0.575, 28, 20), std('#d62828', 0.45));
    suit.scale.set(1, 0.92, 1.2);
    suit.position.y = 0.74;
    this.bodyAcc.add(suit);
    for (const [y, color] of [[0.9, '#ffffff'], [0.64, '#ffd23c']] as const) {
      const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.565, 0.028, 6, 32), std(color, 0.5));
      stripe.rotation.x = Math.PI / 2;
      stripe.scale.set(1, 1.2, 1);
      stripe.position.y = y;
      this.bodyAcc.add(stripe);
    }

    // helmet with visor, centre stripe and airbox fin
    this.flower.visible = false;
    const white = new THREE.MeshStandardMaterial({ color: '#fbfbfb', roughness: 0.25, metalness: 0 });
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.345, 24, 16), white);
    helmet.scale.set(1, 1, 1.08);
    const visor = new THREE.Mesh(
      new THREE.SphereGeometry(0.352, 18, 8, Math.PI * 1.3, Math.PI * 0.4, Math.PI * 0.32, Math.PI * 0.17),
      glossy('#0b0b10'),
    );
    visor.scale.set(1, 1, 1.08);
    const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.03, 6, 24), std('#d62828', 0.4));
    stripe.rotation.y = Math.PI / 2;
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.26), std('#d62828', 0.4));
    fin.position.set(0, 0.34, 0.1);
    this.headAcc.add(helmet, visor, stripe, fin);

    // sneakers: white with a red toe cap
    const toeMat = std('#d62828', 0.5);
    this.feet.forEach((foot, i) => {
      foot.material = this.sneakerMat;
      const toe = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.075, 0.14), toeMat);
      toe.position.set(0, 0, -0.14);
      foot.add(toe);
      const sole = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.03, 0.44), std('#222222', 0.8));
      sole.position.set(0, -0.045, 0);
      foot.add(sole);
      this.legAcc.push(toe, sole);
      void i;
    });
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
      } else if (p.flying) {
        leg.rotation.x = 0.95 + Math.sin(p.time * 9 + i) * 0.1;
      } else if (p.thrusting) {
        leg.rotation.x = 0.35 + Math.sin(p.time * 20 + i) * 0.1;
      } else if (airborne || p.dashing) {
        leg.rotation.x = (i ? 0.7 : -0.5) + (p.dashing ? 0.4 : 0);
      } else {
        leg.rotation.x = Math.sin(p.runPhase + i * Math.PI) * 1.0;
      }
    });

    // bob while running, lean while dashing / jumping, roll into lane changes
    const bob = p.grounded && !p.dead && !p.sliding ? Math.abs(Math.sin(p.runPhase)) * 0.08 : p.flying ? Math.sin(p.time * 3) * 0.05 : 0;
    this.rig.position.y += ((p.sliding ? -0.12 : bob) - this.rig.position.y) * Math.max(k, p.sliding ? 0.5 : 0);

    const targetTilt = p.sliding ? -1.0 : p.flying ? -0.55 : p.dashing ? -0.35 : airborne ? clamp(p.vy * 0.02, -0.4, 0.4) * 0.8 : 0;
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

    // accessory animation
    this.bandTails.forEach((tail, i) => {
      tail.rotation.x = Math.sin(p.time * 16 + i) * 0.25 - 0.1;
    });
    if (this.cape) {
      const lift = p.flying ? 0.9 : p.dashing ? 0.65 : airborne ? 0.45 : 0.12;
      this.cape.rotation.x += (lift + Math.sin(p.time * 11) * 0.1 - this.cape.rotation.x) * k;
    }
    if (this.halo) {
      this.halo.rotation.z = p.time * 2;
      this.halo.position.y = 0.5 + Math.sin(p.time * 3) * 0.03;
    }
    for (const f of this.flames) {
      f.visible = p.thrusting;
      f.scale.set(1, 0.75 + 0.5 * Math.abs(Math.sin(p.time * 45)), 1);
    }

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
