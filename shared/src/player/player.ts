// Player movement and survival tuning. Values are shared by the client prediction and the server.
export const PLAYER = {
  radius: 0.35,
  height: 1.8,
  eye: 1.6,
  slideEye: 1.05,
  gravity: 26,
  jump: 9.2,
  /** steps you walk up without jumping */
  stepUp: 0.55,
  /** crouching (C) or sliding */
  crouchHeight: 1.25,
  /** speed multiplier while crouching */
  crouchSpeed: 0.5,
  /** s you can still jump after leaving a ledge */
  coyote: 0.1,
  /** s a jump press is remembered before touching the ground */
  jumpBuffer: 0.15,
  /** air control (fraction of speed); turning while strafing gains speed */
  airCap: 0.3,
  airAccel: 6,
  // Horizontal speed (× character speed). Above softCap the ground brakes gradually (overFriction);
  // in the air speed is kept. maxSpeed is the absolute cap with slide + bunny hop
  softCap: 1.7,
  overFriction: 2.2,
  maxSpeed: 2.6,
  /** sprint multiplier (Shift) */
  sprint: 1.3,
  /** stamina (false = like Krunker: unlimited sprint and slide) */
  useStamina: false,
  stamina: 100,
  /** per second while sprinting (about 6.5 s in a row) */
  staminaDrain: 15,
  /** per second while resting */
  staminaRegen: 25,
  /** ms without sprinting before it recovers */
  staminaDelay: 700,
  /** when exhausted, this much is needed to sprint again */
  staminaMin: 25,
  /** stamina cost per slide (with useStamina) */
  slideCost: 20,
  // Slide: duration, friction, minimum boost (× speed) and the gain of each chained slide
  slideTime: 1.05,
  slideFriction: 0.9,
  slideBoost: 1.55,
  slideGain: 1.12,
  /** s between slides (so it cannot be spammed in place) */
  slideCooldown: 0.25,
  respawnDelay: 3000,
  /** ms without taking damage before regenerating */
  regenDelay: 5000,
  /** hp per second */
  regenRate: 15,
  /** ms invulnerable after spawning (lost when shooting) */
  spawnProtection: 4000,
};

/** Jump pads (boxes of kind 'pad'): vertical impulse when stepped on. */
export const PAD = { power: 17, h: 0.3, size: 1.8 };
