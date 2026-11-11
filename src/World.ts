import { Coin } from './Coin';
import { Obstacle } from './Obstacles';
import { Spawner } from './Spawner';
import { Kiwi } from './Kiwi';
import { W } from './config';
import { overlap, rand } from './math';

export interface CollisionHandlers {
  coin(coin: Coin): void;
  smash(obstacle: Obstacle): void;
  hit(obstacle: Obstacle): void;
}

/** Owns every coin and obstacle, spawns new ones and resolves collisions with the kiwi. */
export class World {
  coins: Coin[] = [];
  obstacles: Obstacle[] = [];
  private spawner = new Spawner();
  private spawnDist = 500;

  reset(): void {
    this.coins = [];
    this.obstacles = [];
    this.spawnDist = 500;
  }

  /**
   * @param speed effective scroll speed (includes dash boost)
   * @param baseSpeed difficulty speed, used to size the gaps between patterns
   */
  update(dt: number, speed: number, baseSpeed: number): void {
    this.spawnDist -= speed * dt;
    if (this.spawnDist <= 0) {
      const s = this.spawner.next(W + 60, baseSpeed);
      this.coins.push(...s.coins);
      this.obstacles.push(...s.obstacles);
      // leave enough room to land from a jump before the next pattern arrives
      this.spawnDist = s.width + Math.max(300, baseSpeed * 0.85) + rand(0, 180);
    }
    for (const e of this.coins) e.update(dt, speed);
    for (const e of this.obstacles) e.update(dt, speed);
    this.coins = this.coins.filter((e) => !e.dead);
    this.obstacles = this.obstacles.filter((e) => !e.dead);
  }

  collide(kiwi: Kiwi, dt: number, on: CollisionHandlers): void {
    const kb = kiwi.bounds;
    const c = kiwi.center;

    for (const coin of this.coins) {
      // dashing acts like a coin magnet
      if (kiwi.dashing && Math.hypot(coin.cx - c.x, coin.cy - c.y) < 170) coin.pull(c.x, c.y, dt);
      if (overlap(kb, coin)) {
        coin.dead = true;
        on.coin(coin);
      }
    }

    for (const o of this.obstacles) {
      if (o.dead || !overlap(kb, o.hitbox)) continue;
      if (kiwi.dashing) {
        o.dead = true;
        on.smash(o);
      } else if (kiwi.invuln <= 0 && !kiwi.dead) {
        on.hit(o);
      }
    }
  }

  draw(g: CanvasRenderingContext2D, time: number): void {
    for (const o of this.obstacles) o.draw(g, time);
    for (const c of this.coins) c.draw(g, time);
  }
}
