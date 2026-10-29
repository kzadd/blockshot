// Player movement as a pure, deterministic simulation. The server runs it as the authority and the client
// runs the very same code to predict its own player, so both agree step by step.
import type { Vec3 } from '../core/math';
import { DASH } from '../abilities/abilities';
import { LADDER, ZIPLINE } from '../maps/objects';
import type { MapZipline } from '../maps/types';
import { PAD, PLAYER } from '../player/player';
import type { Collider } from '../physics/raycast';

/** Fixed simulation step (s). Client prediction and server authority both step at this rate. */
export const FIXED_DT = 1 / 60;

// Input buttons (bit flags of MoveInput.b)
export const BTN_JUMP = 1;
/** jump key went down during this step (remembered for PLAYER.jumpBuffer) */
export const BTN_JUMP_PRESSED = 2;
export const BTN_CROUCH = 4;
export const BTN_SPRINT = 8;
export const BTN_AIM = 16;
export const BTN_FIRE = 32;
/** a shot was fired: blocks sprinting for SPRINT_BLOCK_S */
export const BTN_SHOT = 64;
/** the ability key went down (Rayo's dash is part of the movement) */
export const BTN_DASH = 128;

/** One simulation step of player input (Command pattern): what the player wanted to do. */
export interface MoveInput {
  /** sequence number, increasing */
  seq: number;
  /** forward (+1) / back (-1) */
  f: number;
  /** right (+1) / left (-1) */
  s: number;
  yaw: number;
  pitch: number;
  /** BTN_* bit flags */
  b: number;
  /** weapon slot held (its weight changes the speed) */
  slot: number;
}

export interface MoveState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  grounded: boolean;
  crouching: boolean;
  sliding: boolean;
  /** crouch key was held on the previous step (a slide starts on the press, or when landing) */
  crouchHeld: boolean;
  justLanded: boolean;
  sprinting: boolean;
  staminaLock: boolean;
  height: number;
  /** s left of the current slide */
  slideTime: number;
  /** s since the last slide ended */
  slideSince: number;
  /** s left to still jump after leaving a ledge */
  coyote: number;
  /** s left of a remembered jump press */
  jumpBuffer: number;
  /** s left during which sprinting is blocked (after shooting) */
  sprintBlock: number;
  stamina: number;
  /** s since stamina was last spent */
  staminaIdle: number;
  /** m walked since the last footstep sound */
  stepDist: number;
  /** s until the dash can be used again */
  dashCd: number;
  /** s left of the dash in progress and its direction */
  dashT: number;
  dashX: number;
  dashZ: number;
  /** on a ladder this step */
  climbing: boolean;
  /** zipline being ridden (-1 = none), how far along it (0 at its first point, 1 at the second) */
  zip: number;
  zipT: number;
  /** s before a zipline can be grabbed again after letting go */
  zipCd: number;
}

/** What the environment and the player's loadout impose on a step. */
export interface MoveContext {
  colliders: readonly Collider[];
  /** walking speed with the held weapon (m/s), already including mode bonuses */
  walk: number;
  /** speed multiplier while aiming with the held weapon */
  adsMove: number;
  /** where to put the player back if it falls out of the map */
  fallback: Vec3;
  /** the character's ability is the dash */
  dash?: boolean;
  /** climbing volumes in front of the map's ladders (ladderVolume) */
  ladders?: readonly Collider[];
  ziplines?: readonly MapZipline[];
}

/** Things that happened during a step (sounds and camera effects for the client). */
export interface MoveEvents {
  jump: boolean;
  slide: boolean;
  pad: boolean;
  /** footstep volume (0 = no step) */
  step: number;
  /** landing fall speed (m/s, negative) when it was hard enough to be felt; 0 otherwise */
  land: number;
  dash: boolean;
  /** grabbed a zipline */
  zip: boolean;
}

/** Ground acceleration (exponential approach to the wanted speed). */
const GROUND_ACCEL = 14;
/** A slide needs at least this fraction of the walking speed. */
const SLIDE_MIN_SPEED = 0.6;
const STEP_MIN_SPEED = 2;
const STEP_DISTANCE = 2.2;
const STEP_DISTANCE_CROUCHED = 2.6;
const STEP_VOLUME_CROUCHED = 0.35;
const MAX_FALL_SPEED = 50;
/** Landings faster than this (m/s) are felt (sound and camera dip). */
const HARD_LANDING = 7;
/** A jump needs the vertical speed to be (almost) zero or falling. */
const JUMP_MAX_VY = 0.01;
/** Sprinting only counts as moving above this speed (stamina). */
const SPRINT_MIN_SPEED = 1;
const SPRINT_BLOCK_S = 0.4;
const FALL_OUT_Y = -20;
/** Small gaps that keep boxes from touching after a collision. */
const STEP_UP_GAP = 0.001;
const SKIN = 1e-4;
const MS_PER_S = 1000;
/** "Long ago" for timers. Finite on purpose: Infinity does not survive JSON (it becomes null). */
const LONG_AGO_S = 1e6;

export function createMoveState(x: number, y: number, z: number): MoveState {
  return {
    x,
    y,
    z,
    vx: 0,
    vy: 0,
    vz: 0,
    grounded: false,
    crouching: false,
    sliding: false,
    crouchHeld: false,
    justLanded: false,
    sprinting: false,
    staminaLock: false,
    height: PLAYER.height,
    slideTime: 0,
    slideSince: LONG_AGO_S,
    coyote: 0,
    jumpBuffer: 0,
    sprintBlock: 0,
    stamina: PLAYER.stamina,
    staminaIdle: LONG_AGO_S,
    stepDist: 0,
    dashCd: 0,
    dashT: 0,
    dashX: 0,
    dashZ: 0,
    climbing: false,
    zip: -1,
    zipT: 0,
    zipCd: 0,
  };
}

const damp = (k: number, dt: number) => 1 - Math.exp(-k * dt);

function overlaps(cols: readonly Collider[], x: number, y: number, z: number, h: number): boolean {
  const r = PLAYER.radius;
  for (const b of cols) {
    if (
      x - r < b.max[0] &&
      x + r > b.min[0] &&
      y < b.max[1] &&
      y + h > b.min[1] &&
      z - r < b.max[2] &&
      z + r > b.min[2]
    ) {
      return true;
    }
  }
  return false;
}

type Axis = 0 | 1 | 2;
const POS = ['x', 'y', 'z'] as const;
const VEL = ['vx', 'vy', 'vz'] as const;

/** Moves along one axis and resolves collisions. Returns true if the player landed on a jump pad. */
function moveAxis(st: MoveState, cols: readonly Collider[], axis: Axis, d: number, wasGrounded: boolean): boolean {
  if (d === 0) return false;
  const r = PLAYER.radius;
  const h = st.height;
  let onPad = false;
  st[POS[axis]] += d;
  for (const b of cols) {
    if (!(
      st.x - r < b.max[0] &&
      st.x + r > b.min[0] &&
      st.y < b.max[1] &&
      st.y + h > b.min[1] &&
      st.z - r < b.max[2] &&
      st.z + r > b.min[2]
    ))
      continue;
    if (axis === 1) {
      if (d < 0) {
        st.y = b.max[1];
        st.grounded = true;
        if (b.c === 'pad') onPad = true;
      } else st.y = b.min[1] - h;
      st.vy = 0;
    } else {
      // Walk up steps automatically
      const step = b.max[1] - st.y;
      if (wasGrounded && step > 0 && step <= PLAYER.stepUp && !overlaps(cols, st.x, b.max[1] + STEP_UP_GAP, st.z, h)) {
        st.y = b.max[1] + STEP_UP_GAP;
        continue;
      }
      st[POS[axis]] = d > 0 ? b.min[axis] - r - SKIN : b.max[axis] + r + SKIN;
      st[VEL[axis]] = 0;
    }
  }
  return onPad;
}

function updateStamina(st: MoveState, dt: number, speed: number): void {
  if (st.sprinting && speed > SPRINT_MIN_SPEED && PLAYER.useStamina) {
    st.stamina = Math.max(0, st.stamina - PLAYER.staminaDrain * dt);
    st.staminaIdle = 0;
    if (st.stamina <= 0) {
      st.staminaLock = true;
      st.sprinting = false;
    }
  } else if (st.staminaIdle * MS_PER_S > PLAYER.staminaDelay) {
    st.stamina = Math.min(PLAYER.stamina, st.stamina + PLAYER.staminaRegen * dt);
  }
}

/** Looking further down than this (rad), "forward" on a ladder climbs down. */
const LADDER_LOOK_DOWN = -0.6;

const touching = (st: MoveState, b: Collider) => {
  const r = PLAYER.radius;
  return (
    st.x - r < b.max[0] &&
    st.x + r > b.min[0] &&
    st.y < b.max[1] &&
    st.y + st.height > b.min[1] &&
    st.z - r < b.max[2] &&
    st.z + r > b.min[2]
  );
};

/** Grabs the zipline within reach of the hands, if any: its index and where along it. */
function grabZipline(st: MoveState, lines: readonly MapZipline[]): [number, number] | null {
  const hx = st.x;
  const hy = st.y + st.height + 0.1;
  const hz = st.z;
  for (let i = 0; i < lines.length; i++) {
    const [a, b] = lines[i]!;
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const len2 = ab[0]! ** 2 + ab[1]! ** 2 + ab[2]! ** 2 || 1;
    const t = Math.min(1, Math.max(0, ((hx - a[0]) * ab[0]! + (hy - a[1]) * ab[1]! + (hz - a[2]) * ab[2]!) / len2));
    const d = Math.hypot(a[0] + ab[0]! * t - hx, a[1] + ab[1]! * t - hy, a[2] + ab[2]! * t - hz);
    if (d < ZIPLINE.grab && t > 0 && t < 1) return [i, t];
  }
  return null;
}

/** One step hanging from a zipline: slides towards its lower end; jump or crouch lets go, as does the end. */
function rideZipline(st: MoveState, lines: readonly MapZipline[], letGo: boolean, dt: number): void {
  const [a, b] = lines[st.zip]!;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  const len = Math.hypot(dx, dy, dz) || 1;
  const sign = dy <= 0 ? 1 : -1; // towards the lower end
  st.zipT += (sign * ZIPLINE.speed * dt) / len;
  const end = st.zipT <= 0 || st.zipT >= 1;
  st.zipT = Math.min(1, Math.max(0, st.zipT));
  st.x = a[0] + dx * st.zipT;
  st.y = a[1] + dy * st.zipT - ZIPLINE.hang;
  st.z = a[2] + dz * st.zipT;
  const v = (sign * ZIPLINE.speed) / len;
  st.vx = dx * v;
  st.vy = dy * v;
  st.vz = dz * v;
  st.grounded = false;
  st.sliding = false;
  st.sprinting = false;
  if (end || letGo) {
    st.zip = -1;
    st.zipCd = ZIPLINE.letGoS;
    if (letGo && !end) st.vy = Math.max(st.vy, PLAYER.jump * 0.5);
  }
}

/** Advances the player by one step of `dt` seconds. Mutates `st` and returns what happened. */
export function stepMovement(st: MoveState, input: MoveInput, dt: number, ctx: MoveContext): MoveEvents {
  const ev: MoveEvents = { jump: false, slide: false, pad: false, step: 0, land: 0, dash: false, zip: false };
  const cols = ctx.colliders;
  const held = (bit: number) => (input.b & bit) !== 0;
  const f = Math.sign(input.f);
  const s = Math.sign(input.s);
  const sin = Math.sin(input.yaw);
  const cos = Math.cos(input.yaw);
  let wx = -sin * f + cos * s;
  let wz = -cos * f - sin * s;
  const wl = Math.hypot(wx, wz);
  if (wl > 0) {
    wx /= wl;
    wz /= wl;
  }
  if (held(BTN_JUMP_PRESSED)) st.jumpBuffer = PLAYER.jumpBuffer;
  if (held(BTN_SHOT)) st.sprintBlock = SPRINT_BLOCK_S;
  const hs = Math.hypot(st.vx, st.vz);
  const crouchKey = held(BTN_CROUCH);
  const wantJump = held(BTN_JUMP) || st.jumpBuffer > 0;

  // Ziplines: jump at a cable (hands within reach) to grab it; jump or crouch again to let go
  const lines = ctx.ziplines;
  if (lines?.length) {
    let grabbed = false;
    if (st.zip < 0 && st.zipCd <= 0 && held(BTN_JUMP) && !st.grounded) {
      const g = grabZipline(st, lines);
      if (g) {
        [st.zip, st.zipT] = g;
        st.dashT = 0;
        grabbed = true;
        ev.zip = true;
      }
    }
    if (st.zip >= 0 && st.zip < lines.length) {
      rideZipline(st, lines, !grabbed && (held(BTN_JUMP_PRESSED) || crouchKey), dt);
      st.climbing = false;
      st.jumpBuffer = 0;
      st.dashCd = Math.max(0, st.dashCd - dt);
      st.sprintBlock = Math.max(0, st.sprintBlock - dt);
      st.slideSince = Math.min(LONG_AGO_S, st.slideSince + dt);
      st.staminaIdle = Math.min(LONG_AGO_S, st.staminaIdle + dt);
      updateStamina(st, dt, 0);
      return ev;
    }
    st.zip = -1;
  }

  // Crouch (C). Standing up needs room above the head
  if (crouchKey) st.crouching = true;
  else if (st.crouching && !overlaps(cols, st.x, st.y + STEP_UP_GAP, st.z, PLAYER.height)) st.crouching = false;

  // Sprint (Shift): forwards only, not while aiming or shooting
  if (!PLAYER.useStamina) st.stamina = PLAYER.stamina;
  if (st.staminaLock && st.stamina >= PLAYER.staminaMin) st.staminaLock = false;
  const canSprint =
    held(BTN_SPRINT) &&
    f > 0 &&
    !held(BTN_AIM) &&
    !held(BTN_FIRE) &&
    !st.crouching &&
    !st.sliding &&
    st.sprintBlock <= 0;
  st.sprinting = canSprint && !st.staminaLock && st.stamina > 0 && (st.grounded || st.sprinting);
  updateStamina(st, dt, hs);

  // Heavy weapons slow you down; aiming is slower (adsMove of each weapon)
  const walk = ctx.walk;
  const base = walk * (held(BTN_AIM) ? ctx.adsMove : st.sprinting ? PLAYER.sprint : 1);
  const speed = base * (st.crouching && !st.sliding ? PLAYER.crouchSpeed : 1);

  if (st.grounded) {
    st.coyote = PLAYER.coyote;
    // Slide: crouch while running (also when landing with the key held: slide-hop).
    // Chaining jump + slide gains a bit of speed every time (slideGain)
    const slideReady = st.slideSince > PLAYER.slideCooldown && (!PLAYER.useStamina || st.stamina >= PLAYER.slideCost);
    if (crouchKey && (!st.crouchHeld || st.justLanded) && hs > walk * SLIDE_MIN_SPEED && !st.sliding && slideReady) {
      st.sliding = true;
      st.slideTime = PLAYER.slideTime;
      if (PLAYER.useStamina) {
        st.stamina -= PLAYER.slideCost;
        st.staminaIdle = 0;
      }
      st.sprinting = false;
      const boost = Math.max(hs * (st.justLanded ? PLAYER.slideGain : 1), walk * PLAYER.slideBoost);
      const dx = wl > 0 ? wx : st.vx / hs;
      const dz = wl > 0 ? wz : st.vz / hs;
      st.vx = dx * boost;
      st.vz = dz * boost;
      ev.slide = true;
    }
    if (st.sliding) {
      // Above the soft cap the slide brakes harder (overFriction)
      const fr = Math.exp(-(hs > walk * PLAYER.softCap ? PLAYER.overFriction : PLAYER.slideFriction) * dt);
      st.vx *= fr;
      st.vz *= fr;
      st.slideTime -= dt;
      if (st.slideTime <= 0 || !crouchKey) {
        st.sliding = false;
        st.slideSince = 0;
      }
    } else if (!(wantJump && hs > speed)) {
      // Chained jumps do not brake: that is how bunny hop works
      const a = damp(GROUND_ACCEL, dt);
      st.vx += (wx * speed - st.vx) * a;
      st.vz += (wz * speed - st.vz) * a;
    }
    // Footsteps
    if (!st.sliding && hs > STEP_MIN_SPEED) {
      st.stepDist += hs * dt;
      if (st.stepDist > (st.crouching ? STEP_DISTANCE_CROUCHED : STEP_DISTANCE)) {
        st.stepDist = 0;
        ev.step = st.crouching ? STEP_VOLUME_CROUCHED : 1;
      }
    }
  } else {
    st.coyote -= dt;
    // Quake-style air control: strafing while turning gains some speed
    if (wl > 0) {
      const add = speed * PLAYER.airCap - (st.vx * wx + st.vz * wz);
      if (add > 0) {
        const acc = Math.min(PLAYER.airAccel * speed * dt, add);
        st.vx += wx * acc;
        st.vz += wz * acc;
      }
    }
  }
  // Absolute cap (the soft cap only brakes on the ground; in the air speed is kept)
  const nh = Math.hypot(st.vx, st.vz);
  const max = walk * PLAYER.maxSpeed;
  if (nh > max) {
    st.vx *= max / nh;
    st.vz *= max / nh;
  }

  // Dash (Rayo): a short flight along the move direction (forward when standing still), above the speed cap
  if (ctx.dash && held(BTN_DASH) && st.dashCd <= 0) {
    st.dashX = wl > 0 ? wx : -sin;
    st.dashZ = wl > 0 ? wz : -cos;
    st.dashT = DASH.timeS;
    st.sliding = false;
    st.dashCd = DASH.cooldownS;
    ev.dash = true;
  }
  if (st.dashT > 0) {
    st.dashT -= dt;
    const v = st.dashT > 0 ? DASH.speed : DASH.exit;
    st.vx = st.dashX * v;
    st.vz = st.dashZ * v;
    st.vy = Math.max(st.vy, PLAYER.gravity * dt); // gravity below cancels it: no fall while dashing
  }

  // Jump (with coyote time after a ledge and a remembered key press)
  if (wantJump && st.coyote > 0 && st.vy <= JUMP_MAX_VY) {
    st.vy = PLAYER.jump; // keeps the momentum: slide + jump = very fast
    st.grounded = false;
    st.coyote = 0;
    st.jumpBuffer = 0;
    if (st.sliding) st.slideSince = 0;
    st.sliding = false;
    ev.jump = true;
  }
  st.crouchHeld = crouchKey;
  st.height = st.crouching || st.sliding ? PLAYER.crouchHeight : PLAYER.height;

  // Ladders: forward climbs (down when looking down), back climbs down; no gravity while on one
  st.climbing = !ev.jump && f !== 0 && !!ctx.ladders?.some((l) => touching(st, l));
  if (st.climbing) {
    st.vy = (f > 0 && input.pitch > LADDER_LOOK_DOWN ? 1 : -1) * LADDER.speed;
    st.sliding = false;
  } else st.vy = Math.max(-MAX_FALL_SPEED, st.vy - PLAYER.gravity * dt);
  const fall = st.vy;
  const wasGrounded = st.grounded;
  st.grounded = false;
  moveAxis(st, cols, 0, st.vx * dt, wasGrounded);
  moveAxis(st, cols, 2, st.vz * dt, wasGrounded);
  // Jump pad: upward impulse keeping the horizontal speed
  if (moveAxis(st, cols, 1, st.vy * dt, wasGrounded)) {
    st.vy = PAD.power;
    st.grounded = false;
    st.coyote = 0;
    st.sliding = false;
    ev.pad = true;
  }
  st.justLanded = st.grounded && !wasGrounded;
  if (st.justLanded && fall < -HARD_LANDING) ev.land = fall;
  // If you do not fit standing up after a slide, you stay crouched
  if (!st.sliding && !st.crouching && st.height < PLAYER.height) {
    if (overlaps(cols, st.x, st.y + STEP_UP_GAP, st.z, PLAYER.height)) st.crouching = true;
    else st.height = PLAYER.height;
  }
  if (st.y < FALL_OUT_Y) [st.x, st.y, st.z] = ctx.fallback;

  // Timers
  st.jumpBuffer = Math.max(0, st.jumpBuffer - dt);
  st.dashCd = Math.max(0, st.dashCd - dt);
  st.sprintBlock = Math.max(0, st.sprintBlock - dt);
  st.slideSince = Math.min(LONG_AGO_S, st.slideSince + dt);
  st.staminaIdle = Math.min(LONG_AGO_S, st.staminaIdle + dt);
  st.zipCd = Math.max(0, st.zipCd - dt);
  return ev;
}
