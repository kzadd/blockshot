import {
  BODY,
  DEFAULT_OUTFIT_COLOR,
  PLAYER,
  classOf,
  createMoveState,
  grenadesFor,
  isCamoId,
  isFinishId,
  isOutfitColor,
  isSkinId,
  type ClassChoice,
  type Spawn,
} from '@blockshot/shared';
import type { Room } from '../rooms/room';
import { recordPosition } from './history';
import { equip } from './loadout';
import type { Player } from './player';
import { sameTeam } from './teams';

/** Spawns are picked at random among this many best candidates. */
const SPAWN_CANDIDATES = 3;
/** How much being near teammates counts compared to being far from enemies. */
const MATE_PULL = 0.3;
/** Score range used when there are no enemies (random order). */
const NO_ENEMY_SCORE = 100;

/** The spawn point furthest from enemies (a bit closer to teammates), among the best few. */
export function pickSpawn(room: Room, me: Player): Spawn {
  const others = [...room.players.values()].filter((p) => p.alive && p.id !== me.id);
  const enemies = others.filter((p) => !sameTeam(room, p, me));
  const mates = others.filter((p) => sameTeam(room, p, me));
  const near = (list: Player[], s: Spawn) => Math.min(...list.map((e) => Math.hypot(e.x - s[0], e.z - s[2])));
  let spawns = room.map.spawns;
  if (room.mode.filterSpawns) spawns = room.mode.filterSpawns(room, me, spawns);
  const scored = spawns.map((s) => ({
    s,
    d:
      (enemies.length ? near(enemies, s) : Math.random() * NO_ENEMY_SCORE) -
      (mates.length ? near(mates, s) * MATE_PULL : 0),
  }));
  scored.sort((a, b) => b.d - a.d);
  return scored[Math.floor(Math.random() * Math.min(SPAWN_CANDIDATES, scored.length))]!.s;
}

/** A spawn request from the class screen: the class and the looks (untrusted, any field may be missing). */
export interface SpawnRequest extends ClassChoice {
  skin?: string;
  color?: string;
  camo?: string;
  finish?: string;
}

/**
 * Puts the player on a spawn point with full health and ammo, and tells its client. With a `req` (the class screen)
 * each part is checked on its own and anything missing or not allowed falls back to the default; without one (a
 * mode respawning the player) the player keeps its class and looks, or takes the class picked in the in-match
 * loadout menu (`nextCls`, checked the same way).
 */
export function spawnPlayer(room: Room, p: Player, req?: SpawnRequest): void {
  const now = Date.now();
  const [x, y, z, ry] = pickSpawn(room, p);
  const hp = Math.round(BODY.hp * (room.mode.hpFactor?.(p) ?? 1));
  const r: SpawnRequest = req ?? {
    ...p.cls,
    ...p.nextCls,
    skin: p.skin,
    color: p.color,
    camo: p.camo,
    finish: p.finish,
  };
  const cls = classOf(r);
  const { primary, secondary, ability, accessory } = cls;
  Object.assign(p, {
    cls,
    nextCls: null,
    skin: isSkinId(r.skin) ? r.skin : 'base',
    color: isOutfitColor(r.color) ? r.color : DEFAULT_OUTFIT_COLOR,
    camo: isCamoId(r.camo) ? r.camo : 'liso',
    finish: isFinishId(r.finish) ? r.finish : 'estandar',
    alive: true,
    hp,
    maxHp: hp,
    armor: 0,
    x,
    y,
    z,
    ry,
    rx: 0,
    sl: 0,
    cr: 0,
    spawnTime: now,
    protUntil: now + PLAYER.spawnProtection,
    lastDamage: 0,
    hist: [],
    move: createMoveState(x, y, z),
    inputs: [],
    lastSeq: -1, // a new client engine (new map after a vote) numbers its commands from 0 again
    simBudget: 0,
    life: p.life + 1,
    abilityAt: 0, // every life starts with the ability ready
    shieldUntil: 0,
    campSince: 0, // the anti-camping clock starts again
    idle: true,
  });
  p.grenades = grenadesFor(room.modeId, p.team, accessory);
  equip(room, p);
  p.played = true;
  // Only a primary the mode really hands out (not in InstaGib, race, gun game nor as a zombie)
  if (p.loadout.includes(primary)) p.picks[primary] = (p.picks[primary] ?? 0) + 1;
  recordPosition(p, now);
  room.channel.to(p.id, 'player:spawned', [
    {
      x,
      y,
      z,
      ry: p.ry,
      skin: p.skin,
      color: p.color,
      camo: p.camo,
      finish: p.finish,
      primary,
      secondary,
      ability,
      accessory,
      hp,
      level: p.level,
      team: p.team,
      life: p.life,
    },
  ]);
}
