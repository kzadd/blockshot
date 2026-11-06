// Infectados extras: infected types, the Paciente cero's scream, survivors' barricades, the last survivor's finale
// and the blackouts. The base rules (INFECT, respawnDelayOf) are in modes.ts.

/** Types an infected picks on the death screen (keys 1-3); the first infected are the Paciente cero instead. */
export type ZombieType = 'runner' | 'tank' | 'leaper';
export type ZombieKind = ZombieType | 'alpha';

export interface ZombieInfo {
  name: string;
  /** walking speed and max health multipliers (they replace INFECT.speed / INFECT.hp) */
  speed: number;
  hp: number;
  /** how big the model is drawn (the hitbox does not change) */
  scale: number;
  desc: string;
}

/**
 * Balance (2026-11-05), against the old single infected (×1.25 speed, ×2 health): the Corredor trades health for speed,
 * the Tanque speed for health, the Saltador some of both for its jump. The Paciente cero is the old infected a bit
 * tougher, plus the scream.
 */
export const ZOMBIES: Record<ZombieKind, ZombieInfo> = {
  runner: { name: 'Corredor', speed: 1.4, hp: 1.5, scale: 0.95, desc: 'Muy rápido, poca vida' },
  tank: {
    name: 'Tanque',
    speed: 1.05,
    hp: 3,
    scale: 1.12,
    desc: 'Lento y duro; no lo empujan y rompe barricadas el doble de rápido',
  },
  leaper: { name: 'Saltador', speed: 1.2, hp: 1.75, scale: 1, desc: 'Salta muy alto y rebota en paredes sin cansarse' },
  alpha: { name: 'Paciente cero', speed: 1.25, hp: 2.5, scale: 1.15, desc: 'Más grande y duro; grito con F' },
};
export const ZOMBIE_TYPES: readonly ZombieType[] = ['runner', 'tank', 'leaper'];
export const isZombieType = (v: unknown): v is ZombieType => ZOMBIE_TYPES.includes(v as ZombieType);

/** Saltador: jump speed multiplier (×1.69 the height, ~3.1 m: over a barricade), wall jumps cost no stamina and may
 * bounce off the same wall again. Part of the shared movement (MoveContext.leap), so the client predicts it. */
export const LEAP = { jump: 1.3 };

/** Paciente cero's scream (key F): survivors within `radius` m in sight walk at `slow` of their speed for `slowMs`. */
export const SCREAM = { radius: 12, slow: 0.6, slowMs: 2500, cooldownMs: 20000 };

/**
 * Barricade (key F, survivors): planks across a door or gap, `w` wide and `h` tall (too tall to climb; the Saltador
 * jumps it), `dist` m in front. It stops players and bullets; only the infected damage it (`hp`, the Tanque ×tankMult).
 * One per survivor, it falls apart after `lifeMs`.
 */
export const BARRICADE = { w: 2.4, h: 2.6, t: 0.25, dist: 1.2, hp: 250, tankMult: 2, cooldownMs: 15000, lifeMs: 60000 };

/** Last survivor (against two or more infected): ×hp health, armour, a power weapon, and everybody sees him. */
export const LAST_STAND = { hp: 2, armor: 100, bannerMs: 5000 };

/** Blackouts once the infection started: the first after `firstMs`, then every `everyMs`; warned `warnMs` before,
 * dark for `darkMs`. */
export const BLACKOUT = { firstMs: 45000, everyMs: 60000, warnMs: 3000, darkMs: 8000 };
