import { PLAYER, SERVER_TICK_MS, round2, type PlayerSnapshot, type StateSnapshot } from '@blockshot/shared';
import { sendAcks } from '../players/movement';
import type { Player } from '../players/player';
import { isTeamRoom } from '../players/teams';
import type { Room } from '../rooms/room';

const MS_PER_S = 1000;

/** Health comes back after PLAYER.regenDelay ms without taking damage. */
function regenerate(p: Player, now: number, dt: number): void {
  if (p.alive && p.hp < p.maxHp && now - p.lastDamage > PLAYER.regenDelay) {
    p.hp = Math.min(p.maxHp, p.hp + PLAYER.regenRate * dt);
  }
}

const playerSnapshot = (p: Player, now: number): PlayerSnapshot => ({
  id: p.id,
  n: p.name,
  c: p.characterId,
  sk: p.skin,
  x: round2(p.x),
  y: round2(p.y),
  z: round2(p.z),
  ry: round2(p.ry),
  rx: round2(p.rx),
  s: p.slot,
  sl: p.sl,
  cr: p.cr,
  a: p.alive ? 1 : 0,
  h: Math.ceil(p.hp),
  pr: p.alive && now < p.protUntil ? 1 : 0,
  k: p.kills,
  d: p.deaths,
  tm: p.team,
  pg: p.ping,
  st: p.streak,
  cp: p.caps,
  lv: p.level,
  mh: p.maxHp,
  ar: Math.ceil(p.armor || 0),
  rd: now < p.radarUntil ? 1 : 0,
});

export function buildSnapshot(room: Room, now: number): StateSnapshot {
  const mode = room.mode.snapshot?.(room, now) ?? {};
  return {
    players: [...room.players.values()].map((p) => playerSnapshot(p, now)),
    ts: isTeamRoom(room) ? room.teamScore : null,
    fl: mode.fl ?? null,
    tg: mode.tg ?? null,
    inf: mode.inf ?? null,
  };
}

/** One snapshot tick for a room: mode rules, regeneration, the snapshot for everyone and each player's ack. */
export function snapshotRoom(room: Room, now: number): void {
  if (!room.matchOver) room.mode.tick?.(room, now);
  const dt = SERVER_TICK_MS / MS_PER_S;
  for (const p of room.players.values()) regenerate(p, now, dt);
  room.channel.broadcastVolatile('state', [buildSnapshot(room, now)]);
  sendAcks(room);
}
