/** World units are roughly metres. The kiwi runs towards -z; the world scrolls towards +z. */
export const LANE_W = 2.4;
export const laneX = (lane: number): number => lane * LANE_W;
/** Half-width of the sand track (3 lanes plus a margin). */
export const TRACK_HALF = 4.2;

export const PHYSICS = {
  gravity: 44,
  jumpVelocity: 15.5,
  doubleJumpVelocity: 13,
  /** Multiplier applied to upward velocity when the jump key is released early. */
  jumpCut: 0.5,
  fastFall: -24,
};

export const SPEED = {
  start: 15,
  max: 36,
  /** units/s gained per second of play. */
  accel: 0.3,
};

export const DASH = {
  duration: 0.32,
  /** Base cooldown in seconds (upgrades and kiwis shorten it). */
  cooldown: 4,
  speedMultiplier: 2.2,
  /** How far forward (towards -z) the kiwi lunges while dashing. */
  lunge: 1.8,
  /** Cooldown refunded for every coin collected. */
  coinRefund: 0.2,
  /** Coins within this distance are pulled in while dashing. */
  magnet: 6,
};

export const SLIDE = {
  /** Base slide length in seconds. */
  duration: 0.7,
};

/** Admin kiwi: press jump twice to fly. */
export const FLY = {
  /** Climb speed while the jump key is held (units/s). */
  climb: 7.5,
  /** How quickly vertical speed follows the target (higher = snappier). */
  smooth: 6,
  maxY: 6.5,
};

/** Jetpack kiwi: hold jump in the air to thrust. */
export const JET = {
  /** Upward acceleration while thrusting (gravity is 44). */
  thrust: 72,
  maxClimb: 8,
  maxY: 6.5,
  /** Seconds of continuous thrust on a full tank. */
  fuelSeconds: 1.8,
  /** Seconds on the ground to refill an empty tank. */
  refillSeconds: 1,
};

export const INVULN_TIME = 1.6;
export const COIN_SCORE = 10;
export const BEST_KEY = 'kiwi-rush-3d-best';

/** Where new things appear (hidden by fog) and where they are removed (behind the camera). */
export const SPAWN_Z = -125;
export const DESPAWN_Z = 12;
