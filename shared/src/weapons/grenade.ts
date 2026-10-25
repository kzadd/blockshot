// Grenade: one per life (G). The server simulates its flight (it bounces), the fuse and the blast; walls
// between the blast and a player stop the damage. It answers players holding a corner.
import type { ModeId, Team } from '../modes/modes';
import { WEAPONS, type Weapon } from './weapons';

export const GRENADE = {
  /** throw speed (m/s) along the view, plus a little lift */
  speed: 17,
  lift: 3,
  gravity: 22,
  /** ms from the throw to the blast */
  fuseMs: 1800,
  /** blast radius (m): full damage at the centre, `minDamage` at the edge */
  radius: 6,
  maxDamage: 110,
  minDamage: 15,
  /** bounce: velocity kept against the surface hit, and along the floor */
  bounce: 0.35,
  friction: 0.65,
  /** collision half size (m) */
  size: 0.12,
};

/** Grenades carried at spawn: none in gun game (the ladder is the point) nor for the infected. */
export const grenadesFor = (mode: ModeId, team: Team): number =>
  mode === 'gungame' || (mode === 'infect' && team === 2) ? 0 : 1;

/** Kill feed / damage entry for grenade kills (it is not in any loadout). */
export const GRENADE_WEAPON: Weapon = { ...WEAPONS.pistol, name: 'Granada', damage: GRENADE.maxDamage, headMult: 1 };
