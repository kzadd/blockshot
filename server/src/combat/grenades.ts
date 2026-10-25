// Grenades in flight: simulated at the movement rate, they bounce off colliders and explode after the fuse.
import {
  GRENADE,
  GRENADE_WEAPON,
  SHOOT_THROUGH,
  castShot,
  clamp,
  round2,
  type Collider,
  type GrenadeSnapshot,
  type Vec3,
} from '@blockshot/shared';
import type { Player } from '../players/player';
import { sameTeam } from '../players/teams';
import type { Room } from '../rooms/room';
import { applyDamage } from './damage';

/** Body height range a blast measures to, from the feet (the lowest point stays above the floor). */
const BODY_LOW = 0.2;
const BODY_HIGH = 1.6;
const CHEST = 1.1;
/** Grenades that fall out of the world are dropped. */
const FLOOR_LIMIT = -20;

export interface Grenade {
  id: number;
  owner: string;
  pos: Vec3;
  vel: Vec3;
  explodeAt: number;
}

let seq = 0;

/** Throws from `o` (the eye) along the unit vector `d`; the caller already checked the player may. */
export function throwGrenade(room: Room, p: Player, o: Vec3, d: Vec3, now: number): void {
  p.grenades--;
  p.protUntil = 0; // throwing removes spawn protection, like shooting
  room.grenades.push({
    id: ++seq,
    owner: p.id,
    pos: [o[0], o[1], o[2]],
    vel: [d[0] * GRENADE.speed + p.move.vx, d[1] * GRENADE.speed + GRENADE.lift, d[2] * GRENADE.speed + p.move.vz],
    explodeAt: now + GRENADE.fuseMs,
  });
}

const s = GRENADE.size;
const inside = (pos: Vec3, c: Collider) =>
  pos[0] > c.min[0] - s &&
  pos[0] < c.max[0] + s &&
  pos[1] > c.min[1] - s &&
  pos[1] < c.max[1] + s &&
  pos[2] > c.min[2] - s &&
  pos[2] < c.max[2] + s;

/** One step: gravity, then each axis moved on its own and bounced back if it entered a collider. */
function step(g: Grenade, colliders: readonly Collider[], dt: number): void {
  g.vel[1] -= GRENADE.gravity * dt;
  for (const axis of [0, 1, 2] as const) {
    const before = g.pos[axis];
    g.pos[axis] += g.vel[axis] * dt;
    if (!colliders.some((c) => !SHOOT_THROUGH.has(c.c) && inside(g.pos, c))) continue;
    g.pos[axis] = before;
    g.vel[axis] = -g.vel[axis] * GRENADE.bounce;
    // Hitting the floor also slows it down along the ground
    if (axis === 1) {
      g.vel[0] *= GRENADE.friction;
      g.vel[2] *= GRENADE.friction;
    }
  }
}

/** Damage at `dist` m from the blast (0 outside the radius). */
export const blastDamage = (dist: number): number =>
  dist >= GRENADE.radius ? 0 : GRENADE.maxDamage - (GRENADE.maxDamage - GRENADE.minDamage) * (dist / GRENADE.radius);

function explode(room: Room, g: Grenade): void {
  const [x, y, z] = g.pos;
  room.channel.broadcast('boom', [{ x: round2(x), y: round2(y), z: round2(z) }]);
  const owner = room.players.get(g.owner);
  if (!owner || room.matchOver) return;
  for (const v of room.players.values()) {
    // No self damage and no friendly fire
    if (!v.alive || v.id === owner.id || sameTeam(room, v, owner)) continue;
    // Distance to the closest point of the body (a grenade at your feet is as bad as one at your chest)
    const to: Vec3 = [v.x - x, clamp(y, v.y + BODY_LOW, v.y + BODY_HIGH) - y, v.z - z];
    const dist = Math.hypot(...to);
    const dmg = blastDamage(dist);
    if (!dmg) continue;
    // A wall in between shelters the player
    if (dist > 0 && castShot(g.pos, [to[0] / dist, to[1] / dist, to[2] / dist], room.colliders, [], '', dist).hit)
      continue;
    applyDamage(room, owner, v, dmg, false, GRENADE_WEAPON, [v.x, v.y + CHEST, v.z]);
  }
}

export function tickGrenades(room: Room, dt: number, now: number): void {
  if (!room.grenades.length) return;
  for (const g of room.grenades) step(g, room.colliders, dt);
  const done = room.grenades.filter((g) => now >= g.explodeAt || g.pos[1] < FLOOR_LIMIT);
  if (!done.length) return;
  room.grenades = room.grenades.filter((g) => !done.includes(g));
  for (const g of done) if (g.pos[1] >= FLOOR_LIMIT) explode(room, g);
}

export const grenadeSnapshot = (room: Room): GrenadeSnapshot[] =>
  room.grenades.map((g) => [g.id, round2(g.pos[0]), round2(g.pos[1]), round2(g.pos[2])]);
