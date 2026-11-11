import * as THREE from 'three';
import { DESPAWN_Z } from './config';

/** Axis-aligned collision box described by its centre and half extents. */
export interface Box {
  cx: number;
  cy: number;
  cz: number;
  hx: number;
  hy: number;
  hz: number;
}

export const boxesOverlap = (a: Box, b: Box): boolean =>
  Math.abs(a.cx - b.cx) < a.hx + b.hx &&
  Math.abs(a.cy - b.cy) < a.hy + b.hy &&
  Math.abs(a.cz - b.cz) < a.hz + b.hz;

let shadowTexture: THREE.CanvasTexture | null = null;

/** A soft dark disc that sits on the ground below an object. */
export function createShadow(radius: number): THREE.Mesh {
  if (!shadowTexture) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(32, 32, 2, 32, 32, 32);
    grad.addColorStop(0, 'rgba(60,35,10,0.55)');
    grad.addColorStop(1, 'rgba(60,35,10,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    shadowTexture = new THREE.CanvasTexture(c);
  }
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false }),
  );
  mesh.scale.set(radius, 1, radius);
  mesh.position.y = 0.04;
  mesh.renderOrder = 1;
  return mesh;
}

/** Anything that scrolls towards the camera: coins and obstacles. */
export abstract class Entity {
  readonly object = new THREE.Group();
  dead = false;

  /** @param half collision half-extents  @param yOffset height of the box centre above the object origin */
  constructor(protected half: THREE.Vector3, protected yOffset: number) {}

  get box(): Box {
    const p = this.object.position;
    return { cx: p.x, cy: p.y + this.yOffset, cz: p.z, hx: this.half.x, hy: this.half.y, hz: this.half.z };
  }

  /** @param speed current world scroll speed in units/s */
  update(dt: number, speed: number, _time: number): void {
    this.object.position.z += speed * dt;
    if (this.object.position.z > DESPAWN_Z) this.dead = true;
  }
}
