import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Rng } from '../../src/math';

/** A single arched, tapered palm frond lying along +z (origin at its base). */
function frondGeometry(length: number, width: number): THREE.BufferGeometry {
  const N = 10;
  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const y = length * (0.55 * t - 0.75 * t * t); // rises, then droops
    const z = length * t;
    const half = Math.sin(Math.PI * Math.pow(t, 0.7)) * width * 0.5;
    positions.push(-half, y, z, half, y, z);
    if (i < N) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function trunkTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 16;
  const g = c.getContext('2d')!;
  g.fillStyle = '#b07a3e';
  g.fillRect(0, 0, 64, 16);
  g.fillStyle = '#7b4f24';
  g.fillRect(0, 0, 64, 16);
  g.fillStyle = '#b07a3e';
  g.fillRect(0, 0, 50, 16); // ring bands along the length
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(16, 1);
  return tex;
}

/** Curved, tapered trunk built from a tube so each palm has its own lean. */
function trunkGeometry(height: number, lean: number): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(lean * 0.15, height * 0.5, 0),
    new THREE.Vector3(lean, height, 0),
  ]);
  const ts = 14;
  const rs = 8;
  const geo = new THREE.TubeGeometry(curve, ts, 0.3, rs, false);
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const ring = Math.floor(i / (rs + 1));
    const t = Math.min(1, ring / ts);
    const centre = curve.getPointAt(t);
    const k = 1 - 0.45 * t; // taper towards the crown
    pos.setXYZ(
      i,
      centre.x + (pos.getX(i) - centre.x) * k,
      centre.y + (pos.getY(i) - centre.y) * k,
      centre.z + (pos.getZ(i) - centre.z) * k,
    );
  }
  geo.computeVertexNormals();
  return geo;
}

export interface PalmOptions {
  leaves: string[];
}

const TRUNK_LEAN = [-1.6, -0.7, 0.8, 1.8];
const TRUNK_HEIGHT = [7, 8.5, 7.5, 9];
const CROWNS_PER_TRUNK = 2;

/**
 * Builds palm trees cheaply: every crown (fronds + coconuts) is baked into ONE
 * vertex-coloured mesh, so a whole palm costs two draw calls (trunk + crown)
 * and all palms share a handful of geometries. That matters on phones.
 */
export class PalmFactory {
  private trunks: THREE.BufferGeometry[];
  private crowns: THREE.BufferGeometry[] = [];
  private trunkMat = new THREE.MeshStandardMaterial({ map: trunkTexture(), roughness: 0.9 });
  private crownMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, side: THREE.DoubleSide });
  private rng = new Rng(7);

  constructor(opts: PalmOptions) {
    this.trunks = TRUNK_LEAN.map((lean, i) => trunkGeometry(TRUNK_HEIGHT[i], lean));
    const frond = frondGeometry(4.6, 1.7);
    for (let t = 0; t < this.trunks.length; t++) {
      for (let c = 0; c < CROWNS_PER_TRUNK; c++) this.crowns.push(this.buildCrown(frond, opts.leaves));
    }
  }

  /** Bakes 9 randomised fronds and 3 coconuts into a single geometry. */
  private buildCrown(frond: THREE.BufferGeometry, leaves: string[]): THREE.BufferGeometry {
    const r = this.rng;
    const parts: THREE.BufferGeometry[] = [];
    const colored = (geo: THREE.BufferGeometry, color: THREE.Color): THREE.BufferGeometry => {
      const n = geo.getAttribute('position').count;
      const arr = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) color.toArray(arr, i * 3);
      geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
      geo.deleteAttribute('uv'); // all merged parts must share the same attributes
      return geo;
    };

    const count = 9;
    for (let i = 0; i < count; i++) {
      const color = new THREE.Color(leaves[i % leaves.length]).multiplyScalar(r.range(0.9, 1.1));
      const g = frond.clone();
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(r.range(-0.15, 0.25), (i / count) * Math.PI * 2 + r.range(-0.2, 0.2), 0)),
        new THREE.Vector3().setScalar(r.range(0.85, 1.15)),
      );
      g.applyMatrix4(m);
      parts.push(colored(g, color));
    }
    const nut = new THREE.Color('#6b3f1c');
    for (const [dx, dz] of [[0.2, 0.1], [-0.15, 0.2], [0, -0.2]]) {
      const g = new THREE.SphereGeometry(0.2, 8, 6);
      g.translate(dx, -0.3, dz);
      parts.push(colored(g, nut));
    }
    return mergeGeometries(parts, false)!;
  }

  create(): THREE.Group {
    const variant = Math.floor(this.rng.range(0, this.trunks.length));
    const palm = new THREE.Group();
    palm.add(new THREE.Mesh(this.trunks[variant], this.trunkMat));

    const crown = new THREE.Mesh(this.crowns[variant * CROWNS_PER_TRUNK + Math.floor(this.rng.range(0, CROWNS_PER_TRUNK))], this.crownMat);
    crown.position.set(TRUNK_LEAN[variant], TRUNK_HEIGHT[variant], 0);
    palm.add(crown);
    return palm;
  }
}
