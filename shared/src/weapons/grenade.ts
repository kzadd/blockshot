// Grenade: one per life (G). The server simulates its flight (it bounces), the fuse and the blast; walls
// between the blast and a player stop the damage. It answers players holding a corner.
import type { Vec3 } from '../core/math';
import type { ModeId, Team } from '../modes/modes';
import { SHOOT_THROUGH, type Collider } from '../physics/raycast';
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

/** Grenade launcher rounds: fast and flat, they blow up on contact (or after the fuse), smaller blast. */
export const LAUNCHER = { speed: 34, lift: 1, gravity: 9, fuseMs: 3000, radius: 3.8, maxDamage: 95, minDamage: 25 };

/** Starting velocity of a throw from the look direction `d` (unit) by a player moving at (vx, vz). */
export const throwVelocity = (d: Vec3, vx: number, vz: number): Vec3 => [
  d[0] * GRENADE.speed + vx,
  d[1] * GRENADE.speed + GRENADE.lift,
  d[2] * GRENADE.speed + vz,
];

const s = GRENADE.size;
const inside = (pos: Vec3, c: Collider) =>
  pos[0] > c.min[0] - s &&
  pos[0] < c.max[0] + s &&
  pos[1] > c.min[1] - s &&
  pos[1] < c.max[1] + s &&
  pos[2] > c.min[2] - s &&
  pos[2] < c.max[2] + s;

/**
 * One flight step (shared: the server simulates it, the client draws the same arc while aiming): gravity, then
 * each axis moved on its own and bounced back if it entered a collider. Mutates `pos` and `vel`.
 */
export function stepGrenade(
  pos: Vec3,
  vel: Vec3,
  colliders: readonly Collider[],
  dt: number,
  gravity = GRENADE.gravity,
): boolean {
  let bounced = false;
  vel[1] -= gravity * dt;
  for (const axis of [0, 1, 2] as const) {
    const before = pos[axis];
    pos[axis] += vel[axis] * dt;
    if (!colliders.some((c) => !SHOOT_THROUGH.has(c.c ?? '') && inside(pos, c))) continue;
    pos[axis] = before;
    vel[axis] = -vel[axis] * GRENADE.bounce;
    bounced = true;
    // Hitting the floor also slows it down along the ground
    if (axis === 1) {
      vel[0] *= GRENADE.friction;
      vel[2] *= GRENADE.friction;
    }
  }
  return bounced;
}

/** Grenades carried at spawn: none in gun game (the ladder is the point) nor for the infected. */
export const grenadesFor = (mode: ModeId, team: Team): number =>
  mode === 'gungame' || (mode === 'infect' && team === 2) ? 0 : 1;

/** Kill feed / damage entry for grenade kills (it is not in any loadout). */
export const GRENADE_WEAPON: Weapon = { ...WEAPONS.pistol, name: 'Granada', damage: GRENADE.maxDamage, headMult: 1 };
