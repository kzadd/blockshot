// One ability per character (key E), with its own cooldown. They are tools, not kills: only the mine hurts,
// and it cannot kill a player at full health.
import type { Weapon } from '../weapons/weapons';
import { WEAPONS } from '../weapons/weapons';

export type AbilityId = 'smoke' | 'mine' | 'shield' | 'dash' | 'wall' | 'radar' | 'medkit';

export interface Ability {
  id: AbilityId;
  name: string;
  desc: string;
  cooldownMs: number;
}

export const ABILITIES: Record<AbilityId, Ability> = {
  smoke: {
    id: 'smoke',
    name: 'Humo',
    desc: 'Lanza un bote que suelta una nube espesa: nadie ve a través de ella. Perfecto contra francotiradores.',
    cooldownMs: 25000,
  },
  mine: {
    id: 'mine',
    name: 'Mina trampa',
    desc: 'Deja una mina a tus pies que estalla si un rival se acerca. Te cubre la espalda (una a la vez).',
    cooldownMs: 20000,
  },
  shield: {
    id: 'shield',
    name: 'Escudo',
    desc: 'Un escudo frontal para las balas que te llegan de delante durante unos segundos.',
    cooldownMs: 26000,
  },
  dash: {
    id: 'dash',
    name: 'Impulso',
    desc: 'Sales disparado unos 7 metros hacia donde te mueves, sin caer. Entra, dispara y sal.',
    cooldownMs: 10000,
  },
  radar: {
    id: 'radar',
    name: 'Radar',
    desc: 'Marca a todos los rivales en el minimapa durante unos segundos (y a tu equipo también).',
    cooldownMs: 24000,
  },
  medkit: {
    id: 'medkit',
    name: 'Botiquín',
    desc: 'Te cura de golpe una buena parte de la vida. Úsalo a cubierto.',
    cooldownMs: 22000,
  },
  wall: {
    id: 'wall',
    name: 'Muro',
    desc: 'Levanta un muro de cobertura delante de ti que para balas y jugadores.',
    cooldownMs: 25000,
  },
};

/** Smoke canister: thrown like a grenade, it pops where it first lands (or after the fuse) into a cloud. */
export const SMOKE = { fuseMs: 1100, radius: 4.5, durationMs: 9000 };
/** Mine: armed after `armMs`, it goes off when a rival comes within `trigger` m. */
export const MINE = { armMs: 1000, trigger: 1.8, radius: 4, maxDamage: 85, minDamage: 30, lifeMs: 90000 };
export const MINE_WEAPON: Weapon = { ...WEAPONS.pistol, name: 'Mina', damage: MINE.maxDamage, headMult: 1 };
/** Shield: blocks shots coming from the front half (within `arcCos` of the facing) for `durationMs`. */
export const SHIELD = { durationMs: 2500, arcCos: 0.2 };
/** Dash: `timeS` seconds at `speed` m/s along the move direction without falling (~7 m), then it leaves you
 * at `exit` m/s. Cooldown in s (it is part of the shared movement simulation, so the client predicts it). */
export const DASH = { speed: 30, timeS: 0.22, exit: 11, cooldownS: ABILITIES.dash.cooldownMs / 1000 };
/** Radar: how long the rivals show on the minimap. Medkit: health it gives back. */
export const RADAR_MS = 7000;
export const MEDKIT_HP = 40;
/** Cover wall: size (along, height, thickness), distance in front of the player and how long it stands. */
export const WALL = { w: 2.6, h: 1.9, t: 0.4, dist: 1.7, durationMs: 10000 };
