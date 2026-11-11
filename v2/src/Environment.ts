import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PalmFactory } from './Palm3D';
import { TRACK_HALF } from './config';
import { rand } from '../../src/math';

const SAND_HALF = 22; // sand plane half-width; the sea starts beyond it
const PLANE_LEN = 320;
const PLANE_CZ = -145;
const RECYCLE_RANGE = 150;
const FOG_COLOR = '#cdeff0';

function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

function radialSprite(inner: string, outer: string, size = 128): THREE.CanvasTexture {
  const tex = canvasTexture(size, size, (g) => {
    const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, inner);
    grad.addColorStop(1, outer);
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
  });
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

interface Scroller {
  group: THREE.Object3D;
  reset(): void;
}

/** The tropical island: sky, sea, sand track, palms and beach props — everything but gameplay. */
export class Environment {
  private scene: THREE.Scene;
  private skyGroup = new THREE.Group();
  private clouds: THREE.Sprite[] = [];
  private sandTex: THREE.CanvasTexture;
  private trackTex: THREE.CanvasTexture;
  private seaTex: THREE.CanvasTexture;
  private foam: THREE.Mesh[] = [];
  private scrollers: Scroller[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    scene.background = new THREE.Color(FOG_COLOR);
    scene.fog = new THREE.Fog(FOG_COLOR, 35, 165);

    this.addLights();
    this.buildSky();

    this.sandTex = canvasTexture(256, 256, (g) => {
      g.fillStyle = '#f0d99c';
      g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 2200; i++) {
        g.fillStyle = Math.random() < 0.5 ? 'rgba(200,160,90,0.25)' : 'rgba(255,248,215,0.3)';
        g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
      }
    });
    this.sandTex.repeat.set(11, PLANE_LEN / 4);

    this.trackTex = canvasTexture(128, 256, (g) => {
      g.fillStyle = '#f8e5b2';
      g.fillRect(0, 0, 128, 256);
      for (let i = 0; i < 1200; i++) {
        g.fillStyle = Math.random() < 0.5 ? 'rgba(210,170,100,0.22)' : 'rgba(255,252,230,0.35)';
        g.fillRect(Math.random() * 128, Math.random() * 256, 2, 2);
      }
      // wet darker edges
      for (const [x0, x1] of [[0, 9], [119, 128]]) {
        const grad = g.createLinearGradient(x0, 0, x1, 0);
        grad.addColorStop(0, x0 === 0 ? 'rgba(190,150,85,0.55)' : 'rgba(190,150,85,0)');
        grad.addColorStop(1, x0 === 0 ? 'rgba(190,150,85,0)' : 'rgba(190,150,85,0.55)');
        g.fillStyle = grad;
        g.fillRect(x0, 0, x1 - x0, 256);
      }
      // dashed lane markers (lane edges sit at +-1.2 of an 8.4 wide track)
      g.fillStyle = 'rgba(214,176,108,0.8)';
      for (const u of [0.357, 0.643]) {
        for (let y = 20; y < 256; y += 128) {
          g.fillRect(u * 128 - 2, y, 4, 64);
        }
      }
    });
    this.trackTex.repeat.set(1, PLANE_LEN / 6);

    this.seaTex = canvasTexture(128, 128, (g) => {
      g.fillStyle = '#1aa9c4';
      g.fillRect(0, 0, 128, 128);
      g.strokeStyle = 'rgba(255,255,255,0.35)';
      g.lineWidth = 2;
      for (let i = 0; i < 14; i++) {
        const x = Math.random() * 128;
        const y = Math.random() * 128;
        g.beginPath();
        g.moveTo(x, y);
        g.quadraticCurveTo(x + 8, y - 3, x + 18, y);
        g.stroke();
      }
    });
    this.seaTex.repeat.set(90, 90);

    this.buildGround();
    this.buildPalms();
    this.buildProps();
  }

  private addLights(): void {
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#f2d9a0', 1.9));
    const sun = new THREE.DirectionalLight('#fff1cc', 2.2);
    sun.position.set(8, 16, 10);
    this.scene.add(sun);
  }

  private buildSky(): void {
    const geo = new THREE.SphereGeometry(600, 32, 16);
    const colors: number[] = [];
    const pos = geo.getAttribute('position');
    const stops = [new THREE.Color('#d9f5f0'), new THREE.Color('#8fdcf2'), new THREE.Color('#2aa8e6')];
    for (let i = 0; i < pos.count; i++) {
      const t = Math.max(0, pos.getY(i) / 600);
      const c = t < 0.25 ? stops[0].clone().lerp(stops[1], t / 0.25) : stops[1].clone().lerp(stops[2], Math.min(1, (t - 0.25) / 0.6));
      colors.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const sky = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    sky.renderOrder = -10;
    this.skyGroup.add(sky);

    // sun and glow
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialSprite('rgba(255,248,200,0.9)', 'rgba(255,240,170,0)', 256), fog: false, depthWrite: false }));
    glow.scale.set(420, 420, 1);
    glow.position.set(150, 190, -480);
    const discTex = canvasTexture(64, 64, (g) => {
      g.fillStyle = '#fffbe0';
      g.beginPath();
      g.arc(32, 32, 30, 0, Math.PI * 2);
      g.fill();
    });
    discTex.wrapS = discTex.wrapT = THREE.ClampToEdgeWrapping;
    const disc = new THREE.Sprite(new THREE.SpriteMaterial({ map: discTex, fog: false, depthWrite: false }));
    disc.scale.set(70, 70, 1);
    disc.position.copy(glow.position);
    this.skyGroup.add(glow, disc);

    // distant islands (unlit and un-fogged so they stay as hazy silhouettes)
    const hill = new THREE.MeshBasicMaterial({ color: '#6fb59c', fog: false });
    for (const [x, s, w] of [[-260, 70, 150], [120, 45, 100], [330, 90, 170]]) {
      const isle = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), hill);
      isle.scale.set(w, s, 60);
      isle.position.set(x, -2, -430);
      this.skyGroup.add(isle);
    }

    // drifting clouds
    const cloudTex = radialSprite('rgba(255,255,255,0.95)', 'rgba(255,255,255,0)', 128);
    for (let i = 0; i < 12; i++) {
      const cloud = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, fog: false, depthWrite: false, transparent: true, opacity: 0.9 }));
      const s = rand(60, 130);
      cloud.scale.set(s * 1.8, s * 0.6, 1);
      cloud.position.set(rand(-420, 420), rand(60, 140), rand(-420, -200));
      this.clouds.push(cloud);
      this.skyGroup.add(cloud);
    }
    this.scene.add(this.skyGroup);
  }

  private buildGround(): void {
    const flat = (w: number, d: number): THREE.PlaneGeometry => new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2);

    const sea = new THREE.Mesh(
      flat(1400, 1400),
      new THREE.MeshStandardMaterial({ map: this.seaTex, roughness: 0.3, emissive: '#0a5a6a', emissiveIntensity: 0.35 }),
    );
    sea.position.y = -0.7;
    this.scene.add(sea);

    const sand = new THREE.Mesh(flat(SAND_HALF * 2, PLANE_LEN), new THREE.MeshStandardMaterial({ map: this.sandTex, roughness: 1 }));
    sand.position.set(0, 0, PLANE_CZ);
    this.scene.add(sand);

    const track = new THREE.Mesh(flat(TRACK_HALF * 2, PLANE_LEN), new THREE.MeshStandardMaterial({ map: this.trackTex, roughness: 1 }));
    track.position.set(0, 0.02, PLANE_CZ);
    this.scene.add(track);

    // wet sand + foam along both beaches
    for (const side of [-1, 1]) {
      const wet = new THREE.Mesh(flat(3, PLANE_LEN), new THREE.MeshStandardMaterial({ color: '#d9b97a', roughness: 0.6 }));
      wet.position.set(side * (SAND_HALF + 1.4), -0.1, PLANE_CZ);
      this.scene.add(wet);
      const foam = new THREE.Mesh(
        flat(1.4, PLANE_LEN),
        new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7, depthWrite: false }),
      );
      foam.position.set(side * (SAND_HALF + 3.4), -0.05, PLANE_CZ);
      this.foam.push(foam);
      this.scene.add(foam);
    }
  }

  private buildPalms(): void {
    const factory = new PalmFactory({ leaves: ['#2fa14a', '#3cb857', '#238a3c'] });
    const place = (palm: THREE.Group, z: number): void => {
      const side = Math.random() < 0.5 ? -1 : 1;
      palm.position.set(side * rand(5.8, 17), 0, z);
      const s = rand(0.9, 1.5);
      palm.scale.set(s * (Math.random() < 0.5 ? -1 : 1), s, s); // mirrored so palms lean both ways
      palm.rotation.y = rand(-0.4, 0.4);
    };
    for (let i = 0; i < 30; i++) {
      const palm = factory.create();
      place(palm, -(i / 30) * RECYCLE_RANGE - rand(0, 4) + 10);
      this.scene.add(palm);
      this.scrollers.push({
        group: palm,
        reset: () => place(palm, palm.position.z - RECYCLE_RANGE),
      });
    }
  }

  /** Grass tufts, fallen coconuts and starfish along the track edges. */
  private buildProps(): void {
    // a grass tuft is five blades baked into one geometry (one draw call each)
    const blades: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 5; i++) {
      const blade = new THREE.ConeGeometry(0.07, 0.7, 4);
      blade.rotateZ((i - 2) * 0.18);
      blade.translate((i - 2) * 0.12, 0.3, (i % 2) * 0.08);
      blades.push(blade);
    }
    const grassGeo = mergeGeometries(blades, false)!;
    const grassMat = new THREE.MeshStandardMaterial({ color: '#3d9a47', roughness: 0.8 });
    const nutGeo = new THREE.SphereGeometry(0.3, 10, 8);
    const nutMat = new THREE.MeshStandardMaterial({ color: '#7a4a22', roughness: 0.8 });
    const starGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.05, 5);
    const starMat = new THREE.MeshStandardMaterial({ color: '#ff8a5c', roughness: 0.7 });

    const make = (kind: number): THREE.Group => {
      const g = new THREE.Group();
      if (kind === 0) {
        g.add(new THREE.Mesh(grassGeo, grassMat));
      } else if (kind === 1) {
        const nut = new THREE.Mesh(nutGeo, nutMat);
        nut.position.y = 0.28;
        g.add(nut);
      } else {
        const star = new THREE.Mesh(starGeo, starMat);
        star.position.y = 0.04;
        star.rotation.y = rand(0, 3);
        g.add(star);
      }
      return g;
    };
    const place = (g: THREE.Group, z: number): void => {
      const side = Math.random() < 0.5 ? -1 : 1;
      g.position.set(side * rand(TRACK_HALF + 0.4, 12), 0, z);
    };
    for (let i = 0; i < 60; i++) {
      const g = make(i % 3 === 0 ? 1 : i % 5 === 0 ? 2 : 0);
      place(g, -rand(0, RECYCLE_RANGE) + 10);
      this.scene.add(g);
      this.scrollers.push({ group: g, reset: () => place(g, g.position.z - RECYCLE_RANGE) });
    }
  }

  update(dt: number, speed: number, time: number, camera: THREE.Camera): void {
    this.sandTex.offset.y += (speed * dt) / 4;
    this.trackTex.offset.y += (speed * dt) / 6;
    this.seaTex.offset.x += dt * 0.01;
    this.seaTex.offset.y += (speed * dt) / (1400 / 90);

    for (const s of this.scrollers) {
      s.group.position.z += speed * dt;
      if (s.group.position.z > 14) s.reset();
    }
    this.foam.forEach((f, i) => ((f.material as THREE.MeshBasicMaterial).opacity = 0.5 + 0.25 * Math.sin(time * 1.6 + i * 2)));

    // the sky follows the camera so it never moves in parallax
    this.skyGroup.position.set(camera.position.x, 0, camera.position.z);
    for (const c of this.clouds) {
      c.position.x += dt * 2.5;
      if (c.position.x > 460) c.position.x = -460;
    }
  }
}
