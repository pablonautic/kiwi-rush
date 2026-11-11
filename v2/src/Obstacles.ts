import * as THREE from 'three';
import { Entity, createShadow } from './Entity';
import { rand } from '../../src/math';

const mat = (color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });

/** Base class for everything that hurts the kiwi (and can be smashed by a dash). */
export abstract class Obstacle extends Entity {
  /** Score awarded when smashed with a dash. */
  readonly score: number = 25;
  /** Colour of the debris particles when smashed. */
  abstract readonly debris: string;
  /** Extra speed towards the camera on top of the world scroll. */
  protected extraSpeed = 0;

  override update(dt: number, speed: number, time: number): void {
    super.update(dt, speed + this.extraSpeed, time);
  }
}

// ------------------------------------------------------------------ rock

const rockGeo = new THREE.DodecahedronGeometry(1, 0);
const rockMat = mat('#7d8590', { flatShading: true });
const mossMat = mat('#5fa04a', { flatShading: true });

export class Rock extends Obstacle {
  readonly debris = '#8a929c';

  constructor(x: number, z: number) {
    super(new THREE.Vector3(0.78, 0.55, 0.72), 0.55);
    const rock = new THREE.Mesh(rockGeo, rockMat);
    rock.scale.set(0.85, 0.65, 0.78);
    rock.position.y = 0.5;
    rock.rotation.y = rand(0, Math.PI);
    const moss = new THREE.Mesh(rockGeo, mossMat);
    moss.scale.set(0.45, 0.16, 0.4);
    moss.position.set(0.15, 1.05, 0.1);
    this.object.add(rock, moss, createShadow(1.1));
    this.object.position.set(x, 0, z);
  }
}

// ------------------------------------------------------------------ crab

const crabMat = mat('#ee5a3c');
const crabDark = mat('#b5321e');

export class Crab extends Obstacle {
  readonly debris = '#e2482f';
  protected override extraSpeed = 3;
  private baseX: number;
  private phase = rand(0, 6);
  private legs: THREE.Mesh[] = [];
  private claws: THREE.Group[] = [];

  constructor(x: number, z: number) {
    super(new THREE.Vector3(0.7, 0.36, 0.5), 0.36);
    this.baseX = x;

    const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), crabMat);
    body.scale.set(1.15, 0.55, 0.85);
    body.position.y = 0.4;
    this.object.add(body);

    // legs and claws (crab walks sideways, so legs sit on the left/right)
    const legGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.5, 5);
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const leg = new THREE.Mesh(legGeo, crabDark);
        leg.position.set(side * 0.55, 0.22, -0.2 + i * 0.22);
        leg.rotation.z = side * 1.0;
        this.legs.push(leg);
        this.object.add(leg);
      }
      const claw = new THREE.Group();
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.4, 6), crabDark);
      arm.rotation.x = Math.PI / 2;
      arm.position.z = -0.2;
      const pincer = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), crabMat);
      pincer.scale.set(1, 0.7, 1.2);
      pincer.position.z = -0.45;
      const gap = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, 0.2), mat('#222'));
      gap.position.set(0, 0, -0.62);
      claw.add(arm, pincer, gap);
      claw.position.set(side * 0.5, 0.55, -0.2);
      claw.rotation.y = side * 0.35;
      this.claws.push(claw);
      this.object.add(claw);

      // eye stalk
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.22, 5), crabDark);
      stalk.position.set(side * 0.18, 0.72, -0.3);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), mat('#ffffff'));
      eye.position.set(side * 0.18, 0.86, -0.3);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), mat('#111'));
      pupil.position.set(side * 0.18, 0.87, -0.38);
      this.object.add(stalk, eye, pupil);
    }
    this.object.add(createShadow(1.0));
    this.object.position.set(x, 0, z);
  }

  override update(dt: number, speed: number, time: number): void {
    super.update(dt, speed, time);
    this.phase += dt * 12;
    // scuttle from side to side within the lane
    this.object.position.x = this.baseX + Math.sin(time * 2.2 + this.baseX * 3) * 0.6;
    this.legs.forEach((leg, i) => {
      const side = i < 3 ? -1 : 1;
      leg.rotation.z = side * (1.0 + Math.sin(this.phase + i * 1.3) * 0.25);
    });
    this.claws.forEach((claw, i) => {
      claw.rotation.x = Math.sin(this.phase * 0.5 + i * 2) * 0.3;
    });
  }
}

// --------------------------------------------------------------- seagull

const gullWhite = mat('#fafafa', { roughness: 0.6 });
const gullGrey = mat('#9aa5b1');
const gullBeak = mat('#f5a623');

export class Seagull extends Obstacle {
  readonly debris = '#f4f4f4';
  protected override extraSpeed = 4;
  private wings: THREE.Group[] = [];
  private phase = rand(0, 6);
  private baseY: number;
  private shadow: THREE.Mesh;

  /** @param y flight height of the gull's centre */
  constructor(x: number, y: number, z: number) {
    super(new THREE.Vector3(0.85, 0.3, 0.55), 0);
    this.baseY = y;

    const body = new THREE.Mesh(new THREE.SphereGeometry(0.4, 14, 10), gullWhite);
    body.scale.set(0.85, 0.75, 1.5);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), gullWhite);
    head.position.set(0, 0.12, 0.55);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.3, 8).rotateX(Math.PI / 2), gullBeak);
    beak.position.set(0, 0.08, 0.85);
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), mat('#111'));
    eyeL.position.set(0.1, 0.18, 0.7);
    const eyeR = eyeL.clone();
    eyeR.position.x = -0.1;
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.05, 0.4), gullGrey);
    tail.position.set(0, 0.02, -0.65);
    this.object.add(body, head, beak, eyeL, eyeR, tail);

    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.25, 0.12, 0);
      const wing = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.05, 0.5), gullWhite);
      wing.position.x = side * 0.5;
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.052, 0.45), gullGrey);
      tip.position.x = side * 0.95;
      pivot.add(wing, tip);
      this.wings.push(pivot);
      this.object.add(pivot);
    }

    this.shadow = createShadow(0.9);
    this.object.add(this.shadow);
    this.object.position.set(x, y, z);
  }

  override update(dt: number, speed: number, time: number): void {
    super.update(dt, speed, time);
    this.phase += dt * 10;
    const flap = Math.sin(this.phase) * 0.7;
    this.wings[0].rotation.z = -flap;
    this.wings[1].rotation.z = flap;
    this.object.position.y = this.baseY + Math.sin(time * 3 + this.baseY) * 0.12;
    this.shadow.position.y = 0.04 - this.object.position.y;
  }
}

// --------------------------------------------------------------- coconut

const coconutGeo = new THREE.SphereGeometry(0.45, 16, 12);
const coconutMat = mat('#7a4a22');
const dotGeo = new THREE.SphereGeometry(0.06, 8, 6);
const dotMat = mat('#2b1808');

/** A coconut that comes rolling down the lane, faster than the scenery. */
export class Coconut extends Obstacle {
  readonly debris = '#7a4a22';
  protected override extraSpeed = 9;
  private ball = new THREE.Group();

  constructor(x: number, z: number) {
    super(new THREE.Vector3(0.45, 0.45, 0.45), 0.45);
    this.ball.add(new THREE.Mesh(coconutGeo, coconutMat));
    for (const [dx, dy, dz] of [[-0.14, 0.3, 0.3], [0.14, 0.3, 0.3], [0, 0.12, 0.42]]) {
      const dot = new THREE.Mesh(dotGeo, dotMat);
      dot.position.set(dx, dy, dz);
      this.ball.add(dot);
    }
    this.ball.position.y = 0.45;
    this.object.add(this.ball, createShadow(0.7));
    this.object.position.set(x, 0, z);
  }

  override update(dt: number, speed: number, time: number): void {
    super.update(dt, speed, time);
    this.ball.rotation.x += ((speed + this.extraSpeed) * dt) / 0.45;
  }
}

// ------------------------------------------------------------- driftwood

const logMat = mat('#8a5a2b');
const logEnd = mat('#d9b27a');
const beamGeo = new THREE.CylinderGeometry(0.5, 0.5, 2.5, 14).rotateZ(Math.PI / 2);
const postGeo = new THREE.CylinderGeometry(0.17, 0.23, 1.9, 8);
const capGeo = new THREE.CircleGeometry(0.46, 14);

/** A log held up on two posts: too low to run under, so slide beneath it (or dash through). */
export class Driftwood extends Obstacle {
  readonly debris = '#9c6b3c';

  constructor(x: number, z: number) {
    super(new THREE.Vector3(1.25, 0.5, 0.55), 1.35);
    const beam = new THREE.Mesh(beamGeo, logMat);
    beam.position.y = 1.35;
    this.object.add(beam);
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(postGeo, logMat);
      post.position.set(side * 1.25, 0.95, 0);
      const cap = new THREE.Mesh(capGeo, logEnd);
      cap.position.set(side * 1.251, 1.35, 0);
      cap.rotation.y = side * Math.PI / 2;
      this.object.add(post, cap);
    }
    this.object.add(createShadow(1.7));
    this.object.position.set(x, 0, z);
  }
}
