import * as THREE from 'three';
import { KiwiModel } from './KiwiModel';
import { KIWIS, computeStats } from './Progress';
import type { KiwiId } from './Progress';

const SIZE = 160;

/**
 * Renders a small portrait of every kiwi from its real 3D model.
 * All thumbnails are drawn once, on first use, with a throw-away renderer.
 */
export class KiwiThumbs {
  private cache = new Map<KiwiId, string>();

  /** Data URL of the kiwi's portrait ('' if WebGL is unavailable). */
  get(id: KiwiId): string {
    if (this.cache.size === 0) this.renderAll();
    return this.cache.get(id) ?? '';
  }

  private renderAll(): void {
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    } catch {
      this.cache.set('classic', '');
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(SIZE, SIZE, false);
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight('#ffffff', '#f2d9a0', 1.9));
    const sun = new THREE.DirectionalLight('#fff1cc', 2.2);
    sun.position.set(3, 6, -4);
    scene.add(sun);

    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);

    for (const def of KIWIS) {
      const stats = computeStats({ dashCooldown: 0, dashLength: 0, magnet: 0, heart: 0, coinValue: 0 }, def.id);
      const model = new KiwiModel();
      model.setSkin(stats.skin);
      model.root.scale.setScalar(stats.scale);
      // a standing, mid-stride pose
      model.update({
        dt: 1, runPhase: 0.9, grounded: true, vy: 0, dashing: false, sliding: false, flying: false, thrusting: false,
        lateral: 0, squash: 0, dead: false, deadTime: 0, time: 0.4,
      });
      scene.add(model.root);

      // three-quarter view from the front, so the long beak shows
      if (stats.skin.accessory === 'jetpack' || stats.skin.accessory === 'admin') {
        // gear is on the back: look from the side and slightly behind
        camera.position.set(3.1, 1.5, 1.5);
        camera.lookAt(0, 0.85, 0);
      } else {
        camera.position.set(2.1, 1.55, -3.4);
        camera.lookAt(0, 0.85, -0.45);
      }
      renderer.render(scene, camera);
      this.cache.set(def.id, renderer.domElement.toDataURL('image/png'));
      scene.remove(model.root);
    }

    renderer.dispose();
    renderer.forceContextLoss();
  }
}
