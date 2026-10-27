import {
  CHAR_BY_ID,
  PLAYER,
  SERVER_TICK_MS,
  WEAPONS,
  round2,
  type PlayerSnapshot,
  type StateSnapshot,
} from '@blockshot/shared';
import { deployableSnapshot } from '../combat/abilities';
import { grenadeSnapshot } from '../combat/grenades';
import { sendAcks } from '../players/movement';
import type { Player } from '../players/player';
import { autoBalance, isTeamRoom } from '../players/teams';
import type { Room } from '../rooms/room';

const MS_PER_S = 1000;
/** Cooldowns go out rounded to this (the HUD counts whole seconds). */
const COOLDOWN_STEP_MS = 100;

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
  co: p.color,
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
  md: p.medals,
  sh: p.alive && now < p.shieldUntil ? 1 : 0,
  gl: p.alive && p.aiming && WEAPONS[p.loadout[p.slot] ?? 'knife']?.scope ? 1 : 0,
  ac: abilityCooldown(p, now),
});

/** ms until the ability is ready (the dash keeps its timer in the movement state). */
function abilityCooldown(p: Player, now: number): number {
  const ms =
    p.characterId && CHAR_BY_ID[p.characterId].ability === 'dash' ? p.move.dashCd * MS_PER_S : p.abilityAt - now;
  return Math.max(0, Math.round(ms / COOLDOWN_STEP_MS) * COOLDOWN_STEP_MS);
}

export function buildSnapshot(room: Room, now: number): StateSnapshot {
  const mode = room.mode.snapshot?.(room, now) ?? {};
  return {
    players: [...room.players.values()].map((p) => playerSnapshot(p, now)),
    ts: isTeamRoom(room) ? room.teamScore : null,
    fl: mode.fl ?? null,
    tg: mode.tg ?? null,
    inf: mode.inf ?? null,
    gr: grenadeSnapshot(room),
    dp: deployableSnapshot(room),
    dz: mode.dz ?? null,
    rd: mode.rd ?? null,
  };
}

/** One snapshot tick for a room: mode rules, regeneration, the snapshot for everyone and each player's ack. */
export function snapshotRoom(room: Room, now: number): void {
  if (!room.matchOver) room.mode.tick?.(room, now);
  autoBalance(room);
  const dt = SERVER_TICK_MS / MS_PER_S;
  for (const p of room.players.values()) regenerate(p, now, dt);
  room.channel.broadcastVolatile('state', [buildSnapshot(room, now)]);
  sendAcks(room);
}
