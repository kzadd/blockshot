// Grenades in flight: simulated at the movement rate, they bounce off colliders and explode after the fuse.
import {
  GRENADE,
  GL_ROUND,
  GRENADE_WEAPON,
  LAUNCHER,
  SMOKE,
  WEAPONS,
  castShot,
  clamp,
  round2,
  stepGrenade,
  throwVelocity,
  type GrenadeSnapshot,
  type Vec3,
  type Weapon,
} from '@blockshot/shared';
import type { Player } from '../players/player';
import { sameTeam } from '../players/teams';
import type { Room } from '../rooms/room';
import { popSmoke } from './abilities';
import { applyDamage } from './damage';
import { blastObjects } from './worldObjects';

/** Body height range a blast measures to, from the feet (the lowest point stays above the floor). */
const BODY_LOW = 0.2;
const BODY_HIGH = 1.6;
const CHEST = 1.1;
/** A launcher round hits a body within this (m, horizontally) up to its head height. */
const ROUND_HIT_R = 0.45;
const BODY_TOP = 1.9;
/** Grenades that fall out of the world are dropped. */
const FLOOR_LIMIT = -20;

export interface Grenade {
  id: number;
  owner: string;
  /** a smoke canister makes a cloud instead of a blast */
  smoke?: boolean;
  /** a bazooka rocket: blows up on contact, with its own blast */
  round?: boolean;
  /** a grenade launcher round: bounces, blows up on its short fuse or on touching a rival (GL_ROUND) */
  lob?: boolean;
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
    vel: throwVelocity(d, p.move.vx, p.move.vz),
    explodeAt: now + GRENADE.fuseMs,
  });
}

/** Grenade launcher: the round leaves from the eye along the aim. */
export function launchRound(room: Room, p: Player, o: Vec3, d: Vec3, now: number): void {
  room.grenades.push({
    id: ++seq,
    owner: p.id,
    round: true,
    pos: [o[0], o[1], o[2]],
    vel: [d[0] * LAUNCHER.speed, d[1] * LAUNCHER.speed + LAUNCHER.lift, d[2] * LAUNCHER.speed],
    explodeAt: now + LAUNCHER.fuseMs,
  });
}

/** Grenade launcher: a bouncing grenade lobbed from the eye along the aim, on a short fuse. */
export function lobRound(room: Room, p: Player, o: Vec3, d: Vec3, now: number): void {
  room.grenades.push({
    id: ++seq,
    owner: p.id,
    lob: true,
    pos: [o[0], o[1], o[2]],
    vel: [d[0] * GL_ROUND.speed, d[1] * GL_ROUND.speed + GL_ROUND.lift, d[2] * GL_ROUND.speed],
    explodeAt: now + GL_ROUND.fuseMs,
  });
}

/** Soldado's smoke canister: thrown like a grenade (shorter fuse), it does no damage. */
export function throwSmoke(room: Room, p: Player, o: Vec3, d: Vec3, now: number): void {
  room.grenades.push({
    id: ++seq,
    owner: p.id,
    smoke: true,
    pos: [o[0], o[1], o[2]],
    vel: throwVelocity(d, p.move.vx, p.move.vz),
    explodeAt: now + SMOKE.fuseMs,
  });
}

export type Blast = Pick<typeof GRENADE, 'radius' | 'maxDamage' | 'minDamage'>;

/** Damage at `dist` m from the blast (0 outside the radius). */
export const blastDamage = (dist: number, b: Blast = GRENADE): number =>
  dist >= b.radius ? 0 : b.maxDamage - (b.maxDamage - b.minDamage) * (dist / b.radius);

function explode(room: Room, g: Grenade, now: number): void {
  if (g.smoke) return popSmoke(room, g.owner, room.players.get(g.owner)?.team ?? 0, g.pos, now);
  const [blast, weapon] = g.round
    ? [LAUNCHER, WEAPONS.launcher]
    : g.lob
      ? [GL_ROUND, WEAPONS.grenadelauncher]
      : [GRENADE, GRENADE_WEAPON];
  blastAt(room, room.players.get(g.owner), g.pos, blast, weapon, now);
}

/** A blast at `pos` credited to `owner`: rivals in the radius are hurt (walls shelter them), and so are barrels and
 * crates. No self or team damage. */
export function blastAt(room: Room, owner: Player | undefined, pos: Vec3, b: Blast, weapon: Weapon, now: number): void {
  const [x, y, z] = pos;
  room.channel.broadcast('boom', [{ x: round2(x), y: round2(y), z: round2(z) }]);
  if (!owner || room.matchOver) return;
  for (const v of room.players.values()) {
    // No self damage and no friendly fire
    if (!v.alive || v.id === owner.id || sameTeam(room, v, owner)) continue;
    // Distance to the closest point of the body (a grenade at your feet is as bad as one at your chest)
    const to: Vec3 = [v.x - x, clamp(y, v.y + BODY_LOW, v.y + BODY_HIGH) - y, v.z - z];
    const dist = Math.hypot(...to);
    const dmg = blastDamage(dist, b);
    if (!dmg) continue;
    // A wall in between shelters the player
    if (dist > 0 && castShot(pos, [to[0] / dist, to[1] / dist, to[2] / dist], room.colliders, [], '', dist).hit)
      continue;
    applyDamage(room, owner, v, dmg, false, weapon, [v.x, v.y + CHEST, v.z]);
  }
  blastObjects(room, owner, pos, b.radius, b.maxDamage, now);
}

export function tickGrenades(room: Room, dt: number, now: number): void {
  if (!room.grenades.length) return;
  const hit = new Set<Grenade>();
  for (const g of room.grenades) {
    const bounced = stepGrenade(g.pos, g.vel, room.colliders, dt, g.round ? LAUNCHER.gravity : GRENADE.gravity);
    // A rocket blows up on whatever it touches: a wall, the floor or a rival. A lobbed round bounces off walls and
    // floor but blows up on a rival. Smoke pops where it lands
    if (g.round && (bounced || touchesRival(room, g))) hit.add(g);
    if (g.lob && touchesRival(room, g)) hit.add(g);
    if (g.smoke && bounced) hit.add(g);
  }
  const done = room.grenades.filter((g) => hit.has(g) || now >= g.explodeAt || g.pos[1] < FLOOR_LIMIT);
  if (!done.length) return;
  room.grenades = room.grenades.filter((g) => !done.includes(g));
  for (const g of done) if (g.pos[1] >= FLOOR_LIMIT) explode(room, g, now);
}

/** A launcher round (rocket or lobbed grenade) touching a rival's body. */
function touchesRival(room: Room, g: Grenade): boolean {
  const owner = room.players.get(g.owner);
  for (const v of room.players.values()) {
    if (!v.alive || v.id === g.owner || (owner && sameTeam(room, v, owner))) continue;
    const [x, y, z] = g.pos;
    if (Math.abs(x - v.x) < ROUND_HIT_R && Math.abs(z - v.z) < ROUND_HIT_R && y > v.y && y < v.y + BODY_TOP)
      return true;
  }
  return false;
}

export const grenadeSnapshot = (room: Room): GrenadeSnapshot[] =>
  room.grenades.map((g) => [g.id, round2(g.pos[0]), round2(g.pos[1]), round2(g.pos[2])]);
