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
    recoverRate: 7,
    /** while aiming, bloom opens half as much */
    adsCut: 0.5,
  },
  spread: {
    /** hip-fire multipliers (aiming uses each weapon's own moveSpread / airSpread) */
    move: 0.6,
    air: 1.8,
    /** movement opens the spread fully at this speed (m/s) */
    moveFullSpeed: 8,
    crouch: 0.7,
    sprint: 1.5,
  },
} as const;
