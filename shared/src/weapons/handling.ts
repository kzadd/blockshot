// How weapons handle in the player's hands: swap time, spread, recoil and bloom recovery. The client applies
// them (spread decides where its rays go); they are gameplay, so they live with the rest of the tuning.
export const WEAPON_HANDLING = {
  /** ms to bring up a weapon after switching */
  swapMs: 250,
  /** the scope only counts once aiming is this far up (0..1) */
  scopeReady: 0.85,
  /** aiming speed for weapons without their own adsSpeed */
  defaultAdsSpeed: 16,
  recoil: {
    /** recoil starts coming back this long after the last shot (ms) */
    recoverDelayMs: 90,
    recoverBase: 0.25,
    recoverRate: 6,
    /** aiming reduces the kick by up to this fraction */
    adsCut: 0.35,
    /** random variation of each kick (± half of it) */
    jitter: 0.4,
    /** sideways kick as a fraction of the vertical one */
    yaw: 0.3,
    pitchLimit: 1.55,
  },
  bloom: {
    /** bloom starts recovering this long after the last shot (ms), at this rate (1/s) */
    recoverDelayMs: 140,
    recoverRate: 9,
    /** while aiming, bloom opens half as much */
    adsCut: 0.5,
    /**
     * Urban Terror style (2026-11-04): the recovery rate depends on the posture (bloomRecovery): faster crouched and
     * still, slower running, almost none in the air. Below `stillSpeed` m/s you count as still
     */
    posture: { crouchStill: 1.5, stand: 1, run: 0.4, air: 0.1, stillSpeed: 1 },
  },
  spread: {
    /** hip-fire multipliers (aiming uses each weapon's own moveSpread / airSpread) */
    move: 0.6,
    air: 1.8,
    /** movement opens the spread fully at this speed (m/s) */
    moveFullSpeed: 8,
    // Urban Terror style: standing still or crouched is precise, moving and jumping are not
    crouch: 0.5,
    sprint: 1.5,
  },
} as const;

/** What the bloom recovery looks at: the player's movement state (MoveState fits). */
export interface Posture {
  vx: number;
  vz: number;
  grounded: boolean;
  crouching: boolean;
  sliding: boolean;
}

/**
 * Multiplier of the bloom recovery rate for a posture: ×1.5 crouched and still, ×1 standing (or crouch-walking),
 * ×0.4 running or sliding, ×0.1 in the air. Shared, so the client and the duel simulation recover alike.
 */
export function bloomRecovery(p: Posture): number {
  const k = WEAPON_HANDLING.bloom.posture;
  if (!p.grounded) return k.air;
  const still = Math.hypot(p.vx, p.vz) < k.stillSpeed;
  if (p.sliding) return k.run;
  if (p.crouching) return still ? k.crouchStill : k.stand;
  return still ? k.stand : k.run;
}
