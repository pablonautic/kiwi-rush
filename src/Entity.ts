import type { Rect } from './math';

/** Anything that scrolls through the world: coins and obstacles. */
export abstract class Entity implements Rect {
  dead = false;

  constructor(public x: number, public y: number, public w: number, public h: number) {}

  /** @param speed current world scroll speed in px/s */
  abstract update(dt: number, speed: number): void;
  abstract draw(g: CanvasRenderingContext2D, time: number): void;

  /** Collision box (subclasses may shrink it for fairness). */
  get hitbox(): Rect {
    return this;
  }

  protected get offscreen(): boolean {
    return this.x + this.w < -80;
  }
}
