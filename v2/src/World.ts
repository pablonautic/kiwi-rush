import * as THREE from 'three';
import { Coin } from './Coin';
import { Entity, boxesOverlap } from './Entity';
import { Obstacle } from './Obstacles';
import { Spawner } from './Spawner';
import { Kiwi } from './Kiwi';
import { rand } from '../../src/math';

export interface CollisionHandlers {
  coin(coin: Coin): void;
  smash(obstacle: Obstacle): void;
  hit(obstacle: Obstacle): void;
}

/** Owns every coin and obstacle, spawns new ones and resolves collisions with the kiwi. */
export class World {
  readonly group = new THREE.Group();
  private coins: Coin[] = [];
  private obstacles: Obstacle[] = [];
  private spawner = new Spawner();
  private spawnDist = 30;

  reset(): void {
    for (const e of [...this.coins, ...this.obstacles]) this.group.remove(e.object);
    this.coins = [];
    this.obstacles = [];
    this.spawnDist = 30;
  }

  private add(e: Entity): void {
    this.group.add(e.object);
    if (e instanceof Coin) this.coins.push(e);
    else if (e instanceof Obstacle) this.obstacles.push(e);
  }

  /**
   * @param speed effective scroll speed (includes the dash boost)
   * @param baseSpeed difficulty speed, used to size the gaps between patterns
   */
  update(dt: number, speed: number, baseSpeed: number, time: number): void {
    this.spawnDist -= speed * dt;
    if (this.spawnDist <= 0) {
      const s = this.spawner.next(baseSpeed);
      s.entities.forEach((e) => this.add(e));
      // leave room to land from a jump before the next pattern arrives
      this.spawnDist = s.length + Math.max(16, baseSpeed * 0.8) + rand(0, 8);
    }
    for (const e of this.coins) e.update(dt, speed, time);
    for (const e of this.obstacles) e.update(dt, speed, time);
    this.sweep();
  }

  private sweep(): void {
    const keep = <T extends Entity>(list: T[]): T[] =>
      list.filter((e) => {
        if (e.dead) this.group.remove(e.object);
        return !e.dead;
      });
    this.coins = keep(this.coins);
    this.obstacles = keep(this.obstacles);
  }

  /** @param magnet radius within which coins are pulled towards the kiwi (0 = off) */
  collide(kiwi: Kiwi, dt: number, magnet: number, on: CollisionHandlers): void {
    const kb = kiwi.box;
    const c = kiwi.center;

    for (const coin of this.coins) {
      if (coin.dead) continue;
      if (magnet > 0 && coin.object.position.distanceTo(c) < magnet) coin.pull(c, dt);
      if (boxesOverlap(kb, coin.box)) {
        coin.dead = true;
        on.coin(coin);
      }
    }

    for (const o of this.obstacles) {
      if (o.dead || !boxesOverlap(kb, o.box)) continue;
      if (kiwi.dashing) {
        o.dead = true;
        on.smash(o);
      } else if (kiwi.invuln <= 0 && !kiwi.dead) {
        on.hit(o);
      }
    }
    this.sweep();
  }
}
