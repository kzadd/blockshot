// Player movement and survival tuning. Values are shared by the client prediction and the server.
export const PLAYER = {
  radius: 0.35,
  height: 1.8,
  eye: 1.6,
  slideEye: 1.05,
  // Urban Terror 4 (Quake 3 engine, values as in the AltUrT clone): gravity 800 u/s², jump 364 u/s with a 69 u tall
  // player, so 1 u = 1.8 / 69 m (a 2.2 m jump). Playtested too high: the jump is lowered to 1.85 m (0.84 s), same gravity
  gravity: 20.9,
  jump: 8.8,
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
  /** Quake 3 air control: you accelerate towards where you steer up to airCap × your speed, at airAccel × speed per
   * second. Strafing while turning keeps adding speed (strafe jumping) and braking in the air is slow */
  airCap: 1,
  /** Urban Terror style: jump off a wall in the air (up to wallJumps before landing, never twice off the same
   * wall). Each one goes up wallJumpUp m/s, keeps your speed and adds wallJumpPush m/s off the wall and as much along it
   * where you steer (Urban Terror: a diagonal bounce, mostly upwards); for wallJumpCooldown s air control cannot
   * brake that. And pull yourself up onto ledges up to mantleReach m above your feet */
  wallJumps: 3,
  wallJumpUp: 11,
  wallJumpPush: 4.3,
  wallJumpCooldown: 0.25,
  /** Stamina per jump and per wall jump (with useStamina). Without enough, wall jumps fail and jumps are lower */
  jumpCost: 5,
  wallJumpCost: 8,
  /** ms before stamina recovers after a jump: shorter than a hop, so a good bunny hop barely tires you */
  jumpRestDelay: 500,
  tiredJump: 0.8,
  mantleReach: 2.4,
  mantleUp: 6.2,
  airAccel: 1,
  /** CPMA / Urban Terror air control: holding only forward (or back) in the air turns your flight towards where you
   * look, keeping its speed (m/s² of sideways pull when already facing it); with a strafe key you strafe jump instead */
  airControl: 125,
  /** Quake 3 ground: friction (per s, at least stopSpeed m/s of it) then acceleration (× speed per s), so landing
   * fast you slide out of it instead of snapping to walking speed */
  friction: 5,
  stopSpeed: 2.6,
  groundAccel: 6,
  // Horizontal speed (× character speed). Above softCap the ground brakes gradually (overFriction);
  // in the air speed is kept. maxSpeed is the absolute cap with slide + bunny hop
  softCap: 1.7,
  overFriction: 2.2,
  maxSpeed: 2.2,
  /** sprint multiplier (Shift) */
  sprint: 1.3,
  /** stamina (false = like Krunker: unlimited sprint and slide) */
  useStamina: true,
  stamina: 100,
  /** per second while sprinting (about 4.5 s in a row) */
  staminaDrain: 22,
  /** per second while resting */
  staminaRegen: 20,
  /** ms without sprinting before it recovers */
  staminaDelay: 800,
  /** when exhausted, this much is needed to sprint again */
  staminaMin: 25,
  /** stamina cost per slide (with useStamina) */
  slideCost: 20,
  /** Exhausted (stamina ran out, until it is back to staminaMin): you move at tiredSpeed of your speed */
  tiredSpeed: 0.7,
  /** Powerslide: while sliding you steer with the mouse / keys, turning the slide up to slideTurn rad/s, speed kept */
  slideTurn: 5,
  // Slide: duration, friction, minimum boost (× speed) and the gain of each chained slide
  slideTime: 1.05,
  slideFriction: 0.9,
  slideBoost: 1.55,
  slideGain: 1.06,
  /** s between slides (so it cannot be spammed in place) */
  slideCooldown: 0.6,
  respawnDelay: 3000,
  /** ms without taking damage before regenerating */
  regenDelay: 5000,
  /** Anti-camping: the zone is anchored where you stopped and only leaving it (further than campRadius m) resets it.
   * After campWarnMs in it you are warned; from campMs rivals see you on the minimap and you lose campDrain hp/s,
   * which can kill you */
  campRadius: 8,
  campWarnMs: 10000,
  campMs: 15000,
  campDrain: 10,
  /** hp per second */
  regenRate: 15,
  /** ms invulnerable after spawning (lost when shooting) */
  spawnProtection: 4000,
  /** Until the player first moves or jumps (still reading a menu, or clicking into the game), for up to idleGrace
   * ms, the spawn protection does not run down and the anti-camping clock does not start */
  idleGrace: 10000,
};

/**
 * Pushes with no damage (race shots and the shove key V): `push` m/s away along the hit and `lift` m/s up. The shove
 * reaches whoever is within `range` m in front (cosine of the cone's half angle `cone`), once every `cooldownMs`.
 */
export const SHOVE = { push: 7, lift: 4, range: 1.6, cone: 0.6, cooldownMs: 1000 };

/** Jump pads (boxes of kind 'pad'): vertical impulse when stepped on. */
export const PAD = { power: 17, h: 0.3, size: 1.8 };

/**
 * Heavier weapons tire you more (2026-11-04): sprinting drains, and jumps and wall jumps cost, this many times more
 * with the weapon in hand: 1 / weight, never below 1 (pistols and the knife) nor above `max`. The M60 (0.9) ×1.11.
 */
export const WEIGHT_STAMINA = { max: 1.3 } as const;
export const staminaMult = (weight: number): number => Math.min(WEIGHT_STAMINA.max, Math.max(1, 1 / weight));
