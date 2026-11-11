import { Coin } from './Coin';
import { Entity } from './Entity';
import { Coconut, Crab, Driftwood, Rock, Seagull } from './Obstacles';
import { SPAWN_Z, laneX } from './config';
import { pick, randInt } from '../../src/math';

export interface Spawned {
  entities: Entity[];
  /** Depth of the pattern in world units. */
  length: number;
}

const COIN_Y = 0.75;

/** Builds hand-designed lane patterns, unlocking harder ones as speed increases. */
export class Spawner {
  next(speed: number): Spawned {
    const patterns: Array<() => Spawned> = [this.coinLine, this.coinSnake, this.rockJump, this.crabLanes];
    if (speed > 17) patterns.push(this.slideGate);
    if (speed > 19) patterns.push(this.lowGull, this.highGull, this.coconutRoll);
    if (speed > 24) patterns.push(this.rockWall, this.gateWall);
    if (speed > 28) patterns.push(this.doubleRock);
    return pick(patterns)();
  }

  private lane(): number {
    return randInt(-1, 1);
  }

  /** z for something `dz` units behind the pattern's leading edge. */
  private z(dz: number): number {
    return SPAWN_Z - dz;
  }

  private line(lane: number, n: number, spacing: number, dz0 = 0, y = COIN_Y): Coin[] {
    return Array.from({ length: n }, (_, i) => new Coin(laneX(lane), y, this.z(dz0 + i * spacing)));
  }

  /** `n` coins over `length` units, rising to `peak` above the running height. */
  private arc(lane: number, n: number, length: number, peak: number): Coin[] {
    return Array.from({ length: n }, (_, i) => {
      const t = i / (n - 1);
      return new Coin(laneX(lane), COIN_Y + 4 * peak * t * (1 - t), this.z(t * length));
    });
  }

  private coinLine = (): Spawned => {
    const n = randInt(6, 9);
    return { entities: this.line(this.lane(), n, 2.2), length: n * 2.2 };
  };

  /** Coins zig-zagging across the lanes: practice for lane switching. */
  private coinSnake = (): Spawned => {
    const order = [-1, 0, 1, 0, -1, 0, 1, 0];
    const flip = Math.random() < 0.5 ? -1 : 1;
    const entities = order.map((l, i) => new Coin(laneX(l * flip), COIN_Y, this.z(i * 3)));
    return { entities, length: order.length * 3 };
  };

  /** A rock to hop over, with coins arcing above it. */
  private rockJump = (): Spawned => {
    const lane = this.lane();
    return {
      entities: [new Rock(laneX(lane), this.z(7)), ...this.arc(lane, 7, 14, 2.3)],
      length: 14,
    };
  };

  /** Crabs in two lanes, coins in the free one. */
  private crabLanes = (): Spawned => {
    const free = this.lane();
    const entities: Entity[] = this.line(free, 6, 2, 0);
    for (const l of [-1, 0, 1]) if (l !== free) entities.push(new Crab(laneX(l), this.z(4)));
    return { entities, length: 12 };
  };

  /** A full row of rocks: jump or dash through it. */
  private rockWall = (): Spawned => ({
    entities: [-1, 0, 1].map((l) => new Rock(laneX(l), this.z(3))),
    length: 6,
  });

  /** A log on posts with coins underneath: slide beneath it. */
  private slideGate = (): Spawned => {
    const lane = this.lane();
    return {
      entities: [new Driftwood(laneX(lane), this.z(5)), ...this.line(lane, 6, 1.6, 0, 0.4)],
      length: 10,
    };
  };

  /** Logs across every lane: no way around, so slide (or dash) through. */
  private gateWall = (): Spawned => ({
    entities: [-1, 0, 1].map((l) => new Driftwood(laneX(l), this.z(3))),
    length: 6,
  });

  /** Two rocks in a row with coins high above: needs a double jump. */
  private doubleRock = (): Spawned => {
    const lane = this.lane();
    return {
      entities: [new Rock(laneX(lane), this.z(4)), new Rock(laneX(lane), this.z(12)), ...this.arc(lane, 9, 18, 3.4)],
      length: 18,
    };
  };

  /** A gull at running height: jump it, dash through it, or switch lanes. */
  private lowGull = (): Spawned => {
    const lane = this.lane();
    return {
      entities: [new Seagull(laneX(lane), 0.85, this.z(7)), ...this.arc(lane, 7, 14, 2.2)],
      length: 14,
    };
  };

  /** A gull circling high above a coin trail: stay low and run underneath. */
  private highGull = (): Spawned => {
    const lane = this.lane();
    return {
      entities: [new Seagull(laneX(lane), 2.9, this.z(8)), ...this.line(lane, 7, 2.3, 0)],
      length: 16,
    };
  };

  /** A coconut rolling down one lane, coins in another. */
  private coconutRoll = (): Spawned => {
    const lane = this.lane();
    const other = lane === 1 ? 0 : lane + 1;
    return {
      entities: [new Coconut(laneX(lane), this.z(0)), ...this.line(other, 5, 2.2, 0)],
      length: 11,
    };
  };
}
