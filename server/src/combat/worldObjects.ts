// Map objects with a life of their own (shared maps/objects.ts): health and armour on the floor that come back after
// a while, explosive barrels that blow up when shot and wooden crates that break. Barrels and crates are colliders
// while they stand, so the room's collider list is rebuilt whenever one falls or comes back.
import {
  BARREL,
  BARREL_WEAPON,
  CRATE,
  HAZARD,
  PICKUP,
  PLAYER,
  POWER,
  POWER_WEAPONS,
  TILE,
  WEAPONS,
  castShot,
  clamp,
  hazardHit,
  liveColliders,
  round2,
  type MapBox,
  type ObjectsSnapshot,
  type Vec3,
  type WeaponId,
} from '@blockshot/shared';
import { givePower } from '../players/loadout';
import type { Player } from '../players/player';
import { sameTeam } from '../players/teams';
import type { Room } from '../rooms/room';
import { wallBox } from './abilities';
import { applyDamage } from './damage';

export interface WorldObjects {
  barrelHp: number[];
  crateHp: number[];
  /** ms when a fallen barrel / crate stands again (0 = standing) */
  barrelBack: number[];
  crateBack: number[];
  /** ms when a taken pickup is back (0 = there) */
  pickupBack: number[];
  /** the power weapon lying on the map (spot index and weapon), when the next one appears and whose turn it is */
  power: { spot: number; id: WeaponId } | null;
  powerAt: number;
  powerTurn: number;
  /** dropping tiles: ms when a stepped-on tile drops (0 = not stepped on) and when a dropped one is back (0 = up) */
  tileDrop: number[];
  tileBack: number[];
  /** when each player was last knocked by a moving obstacle (ms) */
  knockedAt: Map<string, number>;
}

const BODY_LOW = 0.2;
const BODY_HIGH = 1.6;
const CHEST = 1.1;
/** A shot that ends this close to a barrel or crate hit it (m). */
const SURFACE = 0.06;
/** A pickup is taken by bodies this close vertically (m). */
const PICKUP_REACH_Y = 1.5;

export function resetWorld(room: Room): void {
  const m = room.map;
  room.world = {
    barrelHp: m.barrels.map(() => BARREL.hp),
    crateHp: m.crates.map(() => CRATE.hp),
    barrelBack: m.barrels.map(() => 0),
    crateBack: m.crates.map(() => 0),
    pickupBack: m.pickups.map(() => 0),
    power: null,
    powerAt: Date.now() + POWER.firstMs,
    powerTurn: 0,
    tileDrop: m.tiles.map(() => 0),
    tileBack: m.tiles.map(() => 0),
    knockedAt: new Map(),
  };
  rebuildColliders(room);
}

const downSet = (back: number[]) => new Set(back.flatMap((t, i) => (t ? [i] : [])));

/** Map boxes, the barrels and crates standing and the cover walls: what movement, bullets and grenades use. */
export function rebuildColliders(room: Room): void {
  const w = room.world;
  room.colliders = [
    ...liveColliders(
      room.map,
      w && { barrels: downSet(w.barrelBack), crates: downSet(w.crateBack), tiles: downSet(w.tileBack) },
    ),
    ...room.deployables.filter((d) => d.kind === 'wall' || d.kind === 'plank').map(wallBox),
  ];
}

const inside = (b: MapBox, p: Vec3, pad: number) =>
  Math.abs(p[0] - b.x) <= b.w / 2 + pad &&
  p[1] >= b.y - pad &&
  p[1] <= b.y + b.h + pad &&
  Math.abs(p[2] - b.z) <= b.d / 2 + pad;

/** A shot by `by` ended at `point`: if it was on a standing barrel or crate, that one takes `dmg`. */
export function hitObjectAt(room: Room, by: Player, point: Vec3, dmg: number, now: number): void {
  const w = room.world;
  room.map.barrels.forEach((b, i) => {
    if (!w.barrelBack[i] && inside(b, point, SURFACE)) damageBarrel(room, i, by, dmg, now);
  });
  room.map.crates.forEach((b, i) => {
    if (!w.crateBack[i] && inside(b, point, SURFACE)) damageCrate(room, i, dmg, now);
  });
}

/** A blast at `pos` also hurts the barrels and crates around it (full damage at the centre, none at `radius`). */
export function blastObjects(
  room: Room,
  by: Player | undefined,
  pos: Vec3,
  radius: number,
  maxDmg: number,
  now: number,
): void {
  const w = room.world;
  const reach = (b: MapBox) => {
    const c: Vec3 = [b.x, b.y + b.h / 2, b.z];
    const d = Math.hypot(c[0] - pos[0], c[1] - pos[1], c[2] - pos[2]) - b.w / 2;
    return d >= radius ? 0 : maxDmg * (1 - Math.max(0, d) / radius);
  };
  room.map.crates.forEach((b, i) => {
    const dmg = w.crateBack[i] ? 0 : reach(b);
    if (dmg) damageCrate(room, i, dmg * CRATE.blast, now);
  });
  room.map.barrels.forEach((b, i) => {
    const dmg = w.barrelBack[i] ? 0 : reach(b);
    if (dmg && by) damageBarrel(room, i, by, dmg, now);
  });
}

function damageCrate(room: Room, i: number, dmg: number, now: number): void {
  const w = room.world;
  w.crateHp[i]! -= dmg;
  if (w.crateHp[i]! > 0) return;
  w.crateBack[i] = now + CRATE.respawnMs;
  const b = room.map.crates[i]!;
  room.channel.broadcast('crate', [{ i, x: b.x, y: b.y + b.h / 2, z: b.z }]);
  rebuildColliders(room);
}

/** The barrel blows up, credited to whoever made it: players around it are hurt like by a grenade (no self or
 * team damage), and the blast reaches other barrels (chain) and crates. */
function damageBarrel(room: Room, i: number, by: Player, dmg: number, now: number): void {
  const w = room.world;
  w.barrelHp[i]! -= dmg;
  if (w.barrelHp[i]! > 0) return;
  w.barrelBack[i] = now + BARREL.respawnMs;
  rebuildColliders(room);
  const b = room.map.barrels[i]!;
  const pos: Vec3 = [b.x, b.y + b.h / 2, b.z];
  room.channel.broadcast('boom', [{ x: round2(pos[0]), y: round2(pos[1]), z: round2(pos[2]) }]);
  if (!room.matchOver) {
    for (const v of room.players.values()) {
      if (!v.alive || v.id === by.id || sameTeam(room, v, by)) continue;
      const to: Vec3 = [v.x - pos[0], clamp(pos[1], v.y + BODY_LOW, v.y + BODY_HIGH) - pos[1], v.z - pos[2]];
      const dist = Math.hypot(...to);
      if (dist >= BARREL.radius) continue;
      if (dist > 0 && castShot(pos, [to[0] / dist, to[1] / dist, to[2] / dist], room.colliders, [], '', dist).hit)
        continue;
      const hurt = BARREL.maxDamage - (BARREL.maxDamage - BARREL.minDamage) * (dist / BARREL.radius);
      applyDamage(room, by, v, hurt, false, BARREL_WEAPON, [v.x, v.y + CHEST, v.z]);
    }
  }
  blastObjects(room, by, pos, BARREL.radius, BARREL.maxDamage, now);
}

const bodyIn = (room: Room, b: MapBox) => {
  const r = PLAYER.radius;
  for (const p of room.players.values()) {
    if (
      p.alive &&
      Math.abs(p.x - b.x) < b.w / 2 + r &&
      Math.abs(p.z - b.z) < b.d / 2 + r &&
      p.y < b.y + b.h &&
      p.y + PLAYER.height > b.y
    )
      return true;
  }
  return false;
};

/** Pickups taken by whoever walks over them; fallen barrels and crates stand again once nobody is in the way. */
export function tickWorld(room: Room, now: number): void {
  tickTiles(room, now);
  tickHazards(room, now);
  tickPower(room, now);
  const w = room.world;
  let changed = false;
  const stand = (back: number[], boxes: MapBox[], hp: number[], full: number) => {
    for (let i = 0; i < back.length; i++) {
      if (!back[i] || now < back[i]! || bodyIn(room, boxes[i]!)) continue;
      back[i] = 0;
      hp[i] = full;
      changed = true;
    }
  };
  stand(w.barrelBack, room.map.barrels, w.barrelHp, BARREL.hp);
  stand(w.crateBack, room.map.crates, w.crateHp, CRATE.hp);
  if (changed) rebuildColliders(room);

  room.map.pickups.forEach((k, i) => {
    if (w.pickupBack[i] && now < w.pickupBack[i]!) return;
    w.pickupBack[i] = 0;
    for (const p of room.players.values()) {
      if (!p.alive || Math.hypot(p.x - k.x, p.z - k.z) > PICKUP.reach || Math.abs(p.y - k.y) > PICKUP_REACH_Y) continue;
      if (k.k === 'hp') {
        if (p.hp >= p.maxHp) continue;
        p.hp = Math.min(p.maxHp, p.hp + PICKUP.hp);
        room.channel.to(p.id, 'damaged', [{ hp: Math.ceil(p.hp), from: [round2(p.x), round2(p.z)] }]);
      } else {
        if ((p.armor || 0) >= PICKUP.armor) continue;
        p.armor = PICKUP.armor;
      }
      w.pickupBack[i] = now + PICKUP.respawnMs;
      room.channel.to(p.id, 'pickup', [k.k]);
      break;
    }
  });
}

/** Power weapons: one appears on a spot of the map now and then (announced to everybody); whoever walks over it
 * takes it into a slot of its own, and the next one comes a while later. */
function tickPower(room: Room, now: number): void {
  const w = room.world;
  const spots = room.map.powerSpots;
  if (!spots.length || room.matchOver || room.mode.powerWeapons === false) return;
  if (!w.power) {
    if (now < w.powerAt) return;
    const id = POWER_WEAPONS[w.powerTurn++ % POWER_WEAPONS.length]!;
    w.power = { spot: Math.floor(Math.random() * spots.length), id };
    room.channel.broadcast('notice', [`¡Ha aparecido un arma de poder: ${WEAPONS[id].name}! (mira el minimapa)`]);
    return;
  }
  const at = spots[w.power.spot]!;
  for (const p of room.players.values()) {
    if (!p.alive || Math.hypot(p.x - at[0], p.z - at[2]) > POWER.reach || Math.abs(p.y - at[1]) > PICKUP_REACH_Y)
      continue;
    givePower(p, w.power.id);
    room.channel.broadcast('notice', [`${p.name} tiene la ${WEAPONS[w.power.id].name}`]);
    room.channel.to(p.id, 'pickup', ['power']);
    w.power = null;
    w.powerAt = now + POWER.everyMs;
    return;
  }
}

export const powerSnapshot = (room: Room): [number, WeaponId] | null =>
  room.world.power ? [room.world.power.spot, room.world.power.id] : null;

/** Dropping tiles: one a player stands on shakes, then drops (out of the colliders) and comes back later. */
function tickTiles(room: Room, now: number): void {
  const w = room.world;
  const tiles = room.map.tiles;
  if (!tiles.length) return;
  let changed = false;
  for (let i = 0; i < tiles.length; i++) {
    const t = tiles[i]!;
    if (w.tileBack[i]) {
      if (now >= w.tileBack[i]! && !bodyIn(room, t)) {
        w.tileBack[i] = 0;
        changed = true;
      }
      continue;
    }
    if (w.tileDrop[i]) {
      if (now < w.tileDrop[i]!) continue;
      w.tileDrop[i] = 0;
      w.tileBack[i] = now + TILE.goneMs;
      changed = true;
      continue;
    }
    const top = t.y + t.h;
    for (const p of room.players.values()) {
      if (
        p.alive &&
        p.move.grounded &&
        Math.abs(p.y - top) < 0.05 &&
        Math.abs(p.x - t.x) < t.w / 2 &&
        Math.abs(p.z - t.z) < t.d / 2
      ) {
        w.tileDrop[i] = now + TILE.shakeMs;
        break;
      }
    }
  }
  if (changed) rebuildColliders(room);
}

/** Moving obstacles knock whoever they touch (away along their motion, and up a little). */
function tickHazards(room: Room, now: number): void {
  const hz = room.map.hazards;
  if (!hz.length) return;
  const w = room.world;
  for (const p of room.players.values()) {
    if (!p.alive || now - (w.knockedAt.get(p.id) ?? -1e9) < HAZARD.againMs) continue;
    for (const h of hz) {
      const dir = hazardHit(h, now, p.x, p.y, p.z, PLAYER.radius, p.move.height);
      if (!dir) continue;
      p.move.vx = dir[0] * HAZARD.knock;
      p.move.vz = dir[1] * HAZARD.knock;
      p.move.vy = HAZARD.lift;
      p.move.grounded = false;
      p.move.sliding = false;
      p.move.zip = -1;
      w.knockedAt.set(p.id, now);
      room.channel.to(p.id, 'knocked', [{ x: dir[0], z: dir[1] }]);
      break;
    }
  }
}

/** Which barrels and crates are down and which pickups are taken (indices), for the clients. */
export const objectsSnapshot = (room: Room): ObjectsSnapshot => {
  const w = room.world;
  const down = (back: number[]) => back.flatMap((t, i) => (t ? [i] : []));
  return [down(w.barrelBack), down(w.crateBack), down(w.pickupBack), down(w.tileBack), down(w.tileDrop)];
};
