import { PLAYER, isSkinId, type Character, type Spawn } from '@blockshot/shared';
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

/** Puts the player on a spawn point with full health and ammo, and tells its client. */
export function spawnPlayer(room: Room, p: Player, ch: Character, skin: string | undefined): void {
  const now = Date.now();
  const [x, y, z, ry] = pickSpawn(room, p);
  const hp = Math.round(ch.hp * (room.mode.hpFactor?.(p) ?? 1));
  Object.assign(p, {
    characterId: ch.id,
    skin: isSkinId(skin) ? skin : 'base',
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
    lastState: now,
    lastDamage: 0,
    hist: [],
  });
  equip(room, p);
  recordPosition(p, now);
  room.channel.to(p.id, 'player:spawned', [
    { x, y, z, ry: p.ry, characterId: ch.id, skin: p.skin, hp, level: p.level, team: p.team },
  ]);
}
