import { Coin } from './Coin';
import { Coconut, Crab, Obstacle, Rock, Seagull } from './Obstacles';
import { GROUND_Y } from './config';
import { pick, randInt } from './math';

export interface Spawned {
  coins: Coin[];
  obstacles: Obstacle[];
  /** Horizontal extent of the pattern in px. */
  width: number;
}

const COIN_LINE_Y = GROUND_Y - 30;

type Pattern = (x: number) => Spawned;

/** Builds hand-designed obstacle + coin patterns, unlocking harder ones as speed increases. */
export class Spawner {
  next(x: number, speed: number): Spawned {
    const patterns: Pattern[] = [this.coinRow, this.rockArc, this.crabArc, this.highRow];
    if (speed > 400) patterns.push(this.lowGull, this.highGull);
    if (speed > 450) patterns.push(this.coconutDrop);
    if (speed > 520) patterns.push(this.doubleRock);
    return pick(patterns)(x);
  }

  /** `n` coins along a parabola peaking `peak` px above the running line. */
  private arc(x: number, width: number, n: number, peak: number): Coin[] {
    const coins: Coin[] = [];
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      coins.push(new Coin(x + t * width, COIN_LINE_Y - 4 * peak * t * (1 - t)));
    }
    return coins;
  }

  private line(x: number, y: number, n: number, spacing = 40): Coin[] {
    return Array.from({ length: n }, (_, i) => new Coin(x + i * spacing, y));
  }

  private coinRow = (x: number): Spawned => {
    const n = randInt(5, 9);
    return { coins: this.line(x, COIN_LINE_Y, n), obstacles: [], width: n * 40 };
  };

  private highRow = (x: number): Spawned => ({
    coins: this.line(x, GROUND_Y - 175, 5, 44),
    obstacles: [],
    width: 220,
  });

  private rockArc = (x: number): Spawned => ({
    coins: this.arc(x, 190, 7, 150),
    obstacles: [new Rock(x + 95 - 25)],
    width: 190,
  });

  private crabArc = (x: number): Spawned => ({
    coins: this.arc(x, 210, 7, 135),
    obstacles: [new Crab(x + 105 - 26)],
    width: 210,
  });

  private doubleRock = (x: number): Spawned => ({
    coins: this.arc(x, 330, 9, 200),
    obstacles: [new Rock(x + 90), new Rock(x + 190)],
    width: 330,
  });

  /** A gull flying at running height: jump it, or dash through it. */
  private lowGull = (x: number): Spawned => ({
    coins: this.arc(x, 230, 7, 150),
    obstacles: [new Seagull(x + 115, GROUND_Y - 44)],
    width: 230,
  });

  /** A gull circling above a coin trail: stay low and run underneath. */
  private highGull = (x: number): Spawned => ({
    coins: this.line(x, COIN_LINE_Y, 6),
    obstacles: [new Seagull(x + 100, GROUND_Y - 130)],
    width: 240,
  });

  private coconutDrop = (x: number): Spawned => ({
    coins: this.line(x + 120, COIN_LINE_Y, 4),
    obstacles: [new Coconut(x + 40)],
    width: 300,
  });
}
