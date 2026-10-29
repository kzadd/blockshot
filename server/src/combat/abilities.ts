// Abilities (key E): what each one puts in the world and how it behaves. The dash is not here: it is part of
// the shared movement simulation (the client predicts it). Smoke canisters fly as grenades (grenades.ts) and
// call popSmoke when their fuse ends.
import {
  ABILITIES,
  CHAR_BY_ID,
  MEDKIT_HP,
  MINE,
  MINE_WEAPON,
  RADAR_MS,
  PLAYER,
  SHIELD,
  SMOKE,
  WALL,
  castShot,
  raySphere,
  clamp,
  floorBelow,
  round2,
  type Collider,
  type DeployableKind,
  type DeployableSnapshot,
  type Team,
  type Vec3,
} from '@blockshot/shared';
import type { Player } from '../players/player';
import { sameTeam } from '../players/teams';
import type { Room } from '../rooms/room';
import { applyDamage } from './damage';
import { throwSmoke } from './grenades';
import { rebuildColliders, resetWorld } from './worldObjects';

export interface Deployable {
  id: number;
  kind: DeployableKind;
  owner: string;
  team: Team;
  pos: Vec3;
  /** wall: 0 = runs along x, 1 = along z */
  along: number;
  /** ms: it goes away (or, for a mine, it is armed from armAt) */
  until: number;
  armAt: number;
}

let seq = 0;
/** The highest a wall may stand above or below the player's feet (no walls floating off a ledge). */
const WALL_MAX_STEP = 1.2;
const BODY_LOW = 0.2;
const BODY_HIGH = 1.6;
const CHEST = 1.1;
/** A shot this close to a mine (m, round its centre) hits it. */
const MINE_HIT_R = 0.45;
/** A mine only notices bodies this close vertically. */
const MINE_REACH_Y = 1.5;

/** Box of a cover wall. */
export function wallBox(d: Pick<Deployable, 'pos' | 'along'>): Collider {
  const [x, y, z] = d.pos;
  const [hx, hz] = d.along === 0 ? [WALL.w / 2, WALL.t / 2] : [WALL.t / 2, WALL.w / 2];
  return { c: 'concrete', min: [x - hx, y, z - hz], max: [x + hx, y + WALL.h, z + hz] };
}

/** Map boxes, standing barrels and crates, plus the cover walls standing now (worldObjects.ts). */
const refreshColliders = rebuildColliders;

const add = (room: Room, d: Omit<Deployable, 'id'>): Deployable => {
  const full = { ...d, id: ++seq };
  room.deployables.push(full);
  return full;
};

/** Ability key: does what the player's character can do, if it is ready. True when it was used. */
export function useAbility(room: Room, p: Player, o: Vec3, d: Vec3, now: number): boolean {
  if (!p.alive || !p.characterId || room.matchOver || now < p.abilityAt) return false;
  const ability = CHAR_BY_ID[p.characterId].ability;
  switch (ability) {
    case 'smoke':
      throwSmoke(room, p, o, d, now);
      break;
    case 'mine':
      // One mine at a time: the old one goes
      room.deployables = room.deployables.filter((m) => !(m.kind === 'mine' && m.owner === p.id));
      add(room, {
        kind: 'mine',
        owner: p.id,
        team: p.team,
        pos: [p.x, p.y, p.z],
        along: 0,
        until: now + MINE.lifeMs,
        armAt: now + MINE.armMs,
      });
      break;
    case 'shield':
      p.shieldUntil = now + SHIELD.durationMs;
      break;
    case 'radar':
      p.radarUntil = now + RADAR_MS;
      break;
    case 'medkit':
      if (p.hp >= p.maxHp) {
        room.channel.to(p.id, 'notice', ['Ya tienes la vida al máximo']);
        return false;
      }
      p.hp = Math.min(p.maxHp, p.hp + MEDKIT_HP);
      room.channel.to(p.id, 'damaged', [{ hp: Math.ceil(p.hp), from: [round2(p.x), round2(p.z)] }]);
      break;
    case 'wall':
      if (!placeWall(room, p, d, now)) {
        room.channel.to(p.id, 'notice', ['No hay sitio para el muro aquí']);
        return false;
      }
      break;
    default:
      return false; // the dash travels with the movement commands
  }
  p.abilityAt = now + ABILITIES[ability].cooldownMs;
  p.protUntil = 0; // like shooting, using an ability ends spawn protection
  return true;
}

/** A wall square to the look direction, in front of the player, on the floor there and not on anybody. */
function placeWall(room: Room, p: Player, d: Vec3, now: number): boolean {
  const alongX = Math.abs(d[2]) >= Math.abs(d[0]); // looking along z: the wall runs along x
  const fx = alongX ? 0 : Math.sign(d[0]);
  const fz = alongX ? Math.sign(d[2]) : 0;
  const x = p.x + fx * WALL.dist;
  const z = p.z + fz * WALL.dist;
  const y = floorBelow(room.map.boxes, x, p.y + WALL_MAX_STEP, z);
  if (Math.abs(y - p.y) > WALL_MAX_STEP) return false;
  const box = wallBox({ pos: [x, y, z], along: alongX ? 0 : 1 });
  const lift = 0.05; // resting on the floor is fine
  const hits = (c: Pick<Collider, 'min' | 'max'>) =>
    box.min[0] < c.max[0] &&
    box.max[0] > c.min[0] &&
    box.min[1] + lift < c.max[1] &&
    box.max[1] > c.min[1] &&
    box.min[2] < c.max[2] &&
    box.max[2] > c.min[2];
  if (room.colliders.some(hits)) return false;
  for (const q of room.players.values()) {
    if (!q.alive) continue;
    const r = PLAYER.radius;
    if (hits({ min: [q.x - r, q.y, q.z - r], max: [q.x + r, q.y + PLAYER.height, q.z + r] })) return false;
  }
  // One wall at a time
  room.deployables = room.deployables.filter((w) => !(w.kind === 'wall' && w.owner === p.id));
  add(room, {
    kind: 'wall',
    owner: p.id,
    team: p.team,
    pos: [x, y, z],
    along: alongX ? 0 : 1,
    until: now + WALL.durationMs,
    armAt: 0,
  });
  refreshColliders(room);
  return true;
}

/** A smoke canister's fuse ended: the cloud appears where it lies. */
export function popSmoke(room: Room, owner: string, team: Team, pos: Vec3, now: number): void {
  // Where it hit a wall the cloud still sits on the floor under it (no floating cloud to crouch under)
  const at: Vec3 = [pos[0], floorBelow(room.map.boxes, pos[0], pos[1] + 0.1, pos[2]), pos[2]];
  add(room, { kind: 'smoke', owner, team, pos: at, along: 0, until: now + SMOKE.durationMs, armAt: 0 });
}

/** True when the segment a → b goes through a smoke cloud (bots cannot see through it). */
export function smokeBlocks(room: Room, a: Vec3, b: Vec3): boolean {
  for (const s of room.deployables) {
    if (s.kind !== 'smoke') continue;
    const ab: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const len2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2 || 1;
    const t = clamp(((s.pos[0] - a[0]) * ab[0] + (s.pos[1] - a[1]) * ab[1] + (s.pos[2] - a[2]) * ab[2]) / len2, 0, 1);
    const dist = Math.hypot(a[0] + ab[0] * t - s.pos[0], a[1] + ab[1] * t - s.pos[1], a[2] + ab[2] * t - s.pos[2]);
    if (dist < SMOKE.radius) return true;
  }
  return false;
}

/** Shield up and the shot coming from in front of the player. */
export function shieldBlocks(victim: Player, from: Vec3, now: number): boolean {
  if (now >= victim.shieldUntil) return false;
  const dx = from[0] - victim.x;
  const dz = from[2] - victim.z;
  const len = Math.hypot(dx, dz) || 1;
  // Facing (-sin yaw, -cos yaw) against the direction to the shooter
  return (-Math.sin(victim.ry) * dx - Math.cos(victim.ry) * dz) / len > SHIELD.arcCos;
}

/** A shot from `o` along `d` that flies `t` m: a rival's mine it crosses is shot away (disarmed, no blast). */
export function shootMines(room: Room, p: Player, o: Vec3, d: Vec3, t: number): void {
  const hit = room.deployables.find((m) => {
    if (m.kind !== 'mine' || m.owner === p.id) return false;
    const owner = room.players.get(m.owner);
    if (owner && sameTeam(room, owner, p)) return false;
    return raySphere(o, d, [m.pos[0], m.pos[1] + 0.1, m.pos[2]], MINE_HIT_R) < t;
  });
  if (hit) room.deployables = room.deployables.filter((m) => m !== hit);
}

function blowMine(room: Room, m: Deployable): void {
  const [x, y, z] = m.pos;
  room.channel.broadcast('boom', [{ x: round2(x), y: round2(y), z: round2(z) }]);
  const owner = room.players.get(m.owner);
  if (!owner) return;
  const at: Vec3 = [x, y + 0.15, z];
  for (const v of room.players.values()) {
    if (!v.alive || v.id === owner.id || sameTeam(room, v, owner)) continue;
    const to: Vec3 = [v.x - x, clamp(at[1], v.y + BODY_LOW, v.y + BODY_HIGH) - at[1], v.z - z];
    const dist = Math.hypot(...to);
    if (dist >= MINE.radius) continue;
    if (dist > 0 && castShot(at, [to[0] / dist, to[1] / dist, to[2] / dist], room.colliders, [], '', dist).hit)
      continue;
    const dmg = MINE.maxDamage - (MINE.maxDamage - MINE.minDamage) * (dist / MINE.radius);
    applyDamage(room, owner, v, dmg, false, MINE_WEAPON, [v.x, v.y + CHEST, v.z]);
  }
}

/** Mines that see a rival go off; anything past its time goes away. */
export function tickAbilities(room: Room, now: number): void {
  if (!room.deployables.length) return;
  const gone = new Set<Deployable>();
  for (const d of room.deployables) {
    if (now >= d.until || !room.players.has(d.owner)) {
      gone.add(d);
      continue;
    }
    if (d.kind !== 'mine' || now < d.armAt || room.matchOver) continue;
    const owner = room.players.get(d.owner)!;
    const near = [...room.players.values()].some(
      (v) =>
        v.alive &&
        v.id !== owner.id &&
        !sameTeam(room, v, owner) &&
        Math.hypot(v.x - d.pos[0], v.z - d.pos[2]) < MINE.trigger &&
        Math.abs(v.y - d.pos[1]) < MINE_REACH_Y,
    );
    if (near) {
      gone.add(d);
      blowMine(room, d);
    }
  }
  if (!gone.size) return;
  const wall = [...gone].some((d) => d.kind === 'wall');
  room.deployables = room.deployables.filter((d) => !gone.has(d));
  if (wall) refreshColliders(room);
}

/** Everything goes when the room changes map or a new match starts (barrels, crates and pickups come back too). */
export function clearAbilities(room: Room): void {
  room.deployables = [];
  resetWorld(room);
}

export const deployableSnapshot = (room: Room): DeployableSnapshot[] =>
  room.deployables.map((d) => [
    d.id,
    d.kind,
    round2(d.pos[0]),
    round2(d.pos[1]),
    round2(d.pos[2]),
    d.along,
    d.team,
    d.owner,
  ]);
