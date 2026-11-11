/** Logical game resolution (the canvas is scaled to fit the window). */
export const W = 960;
export const H = 540;

/** Y coordinate of the sand the kiwi runs on (feet position). */
export const GROUND_Y = 452;
export const HORIZON_Y = 300;

export const PHYSICS = {
  gravity: 2600,
  jumpVelocity: 860,
  doubleJumpVelocity: 740,
  /** Multiplier applied to upward velocity when the jump key is released early. */
  jumpCut: 0.5,
};

export const SPEED = {
  start: 330,
  max: 780,
  /** px/s gained per second of play. */
  accel: 6,
};

export const DASH = {
  duration: 0.3,
  cooldown: 1.5,
  speedMultiplier: 2.1,
  lunge: 80,
  /** Cooldown refunded for every coin collected. */
  coinRefund: 0.15,
};

export const MAX_HP = 3;
export const INVULN_TIME = 1.6;
export const COIN_SCORE = 10;
export const BEST_KEY = 'kiwi-rush-best';
