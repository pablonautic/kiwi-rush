import * as THREE from 'three';
import type { Kiwi } from './Kiwi';

/** Chase camera: sits behind and above the kiwi, follows lane changes smoothly and kicks out when dashing. */
export class CameraRig {
  readonly camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.1, 900);
  private baseFov = 62;
  private look = new THREE.Vector3(0, 1.2, -8);
  private shake = 0;

  constructor() {
    this.camera.position.set(0, 3.6, 7.6);
  }

  addShake(amount: number): void {
    this.shake = Math.max(this.shake, amount);
  }

  resize(width: number, height: number): void {
    const aspect = width / height;
    this.camera.aspect = aspect;
    // keep all 3 lanes visible on narrow / portrait screens
    this.baseFov = aspect >= 1.4 ? 62 : Math.min(100, 62 * (1.4 / aspect) * 0.85 + 62 * 0.15);
    this.camera.updateProjectionMatrix();
  }

  update(dt: number, kiwi: Kiwi, time: number, sway = 0): void {
    const k = 1 - Math.exp(-7 * dt);
    const dash = kiwi.dashAmount;

    const targetX = kiwi.x * 0.6 + sway * Math.sin(time * 0.6);
    const targetY = 3.7 + kiwi.y * 0.35 - (kiwi.sliding ? 0.35 : 0);
    const targetZ = 7.8 + dash * 1.6;
    const cam = this.camera.position;
    cam.x += (targetX - cam.x) * k;
    cam.y += (targetY - cam.y) * k;
    cam.z += (targetZ - cam.z) * k;

    if (this.shake > 0) {
      cam.x += (Math.random() - 0.5) * this.shake;
      cam.y += (Math.random() - 0.5) * this.shake;
      this.shake = Math.max(0, this.shake - dt * 2.2);
    }

    this.look.x += (kiwi.x * 0.45 - this.look.x) * k;
    this.look.y += (1.0 + kiwi.y * 0.3 - this.look.y) * k;
    this.camera.lookAt(this.look);

    const fov = this.baseFov + dash * 12;
    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  }
}
