import * as THREE from 'three';
import { Entity } from './Entity';
import { rand } from '../../src/math';

let geometry: THREE.BufferGeometry | null = null;
let material: THREE.Material | null = null;

export class Coin extends Entity {
  private baseY: number;
  private spin = rand(0, Math.PI * 2);

  constructor(x: number, y: number, z: number) {
    super(new THREE.Vector3(0.45, 0.45, 0.4), 0);
    geometry ??= new THREE.CylinderGeometry(0.4, 0.4, 0.1, 24).rotateX(Math.PI / 2);
    material ??= new THREE.MeshStandardMaterial({
      color: '#ffd23c',
      emissive: '#a86b00',
      emissiveIntensity: 0.55,
      metalness: 0.6,
      roughness: 0.3,
    });
    const mesh = new THREE.Mesh(geometry, material);
    // raised rim so the coin reads as a coin from every angle
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.05, 8, 24), material);
    this.object.add(mesh, rim);
    this.object.position.set(x, y, z);
    this.baseY = y;
  }

  override update(dt: number, speed: number, time: number): void {
    super.update(dt, speed, time);
    this.spin += dt * 4;
    this.object.rotation.y = this.spin;
    this.object.position.y = this.baseY + Math.sin(time * 4 + this.object.position.z * 0.4) * 0.08;
  }

  /** Pulls the coin towards a point (the dash magnet). */
  pull(target: THREE.Vector3, dt: number): void {
    const k = Math.min(1, dt * 12);
    this.object.position.lerp(target, k);
    this.baseY = this.object.position.y;
  }
}
