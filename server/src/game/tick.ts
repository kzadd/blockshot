import {
  PLAYER,
  SERVER_TICK_MS,
  regenOf,
  WEAPONS,
  classIndex,
  round2,
  type PlayerSnapshot,
  type StateSnapshot,
} from '@blockshot/shared';
import { deployableSnapshot } from '../combat/abilities';
import { grenadeSnapshot } from '../combat/grenades';
import { objectsSnapshot, powerSnapshot } from '../combat/worldObjects';
import { serverConfig } from '../config';
import { sendAcks } from '../players/movement';
import type { Player } from '../players/player';
import { autoBalance, isTeamRoom } from '../players/teams';
import type { Room } from '../rooms/room';

const MS_PER_S = 1000;
/** Cooldowns go out rounded to this (the HUD counts whole seconds). */
const COOLDOWN_STEP_MS = 100;

/** Health comes back after PLAYER.regenDelay ms without taking damage (sooner and faster with bandages). */
function regenerate(p: Player, now: number, dt: number): void {
  if (!p.alive || p.hp >= p.maxHp) return;
  const [delay, rate] = regenOf(p.cls?.accessory, PLAYER.regenDelay, PLAYER.regenRate);
  if (now - p.lastDamage > delay) p.hp = Math.min(p.maxHp, p.hp + rate * dt);
}

const playerSnapshot = (p: Player, now: number): PlayerSnapshot => ({
  id: p.id,
  n: p.name,
  ab: p.cls?.ability ?? null,
  sk: p.skin,
  co: p.color,
  cm: p.camo,
  fn: p.finish,
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
  pw: p.power,
  wc: choiceIndex(p),
  ax: p.cls?.accessory ?? null,
});

/** The class's weapons as indices into PRIMARIES / SIDEARMS (0 = the default class's). */
export const choiceIndex = (p: Player): [number, number] => (p.cls ? classIndex(p.cls) : [0, 0]);

/** ms until the ability is ready (the dash keeps its timer in the movement state). */
function abilityCooldown(p: Player, now: number): number {
  const ms = p.cls?.ability === 'dash' ? p.move.dashCd * MS_PER_S : p.abilityAt - now;
  return Math.max(0, Math.round(ms / COOLDOWN_STEP_MS) * COOLDOWN_STEP_MS);
}

export function buildSnapshot(room: Room, now: number): StateSnapshot {
  const mode = room.mode.snapshot?.(room, now) ?? {};
  return {
    t: now,
    players: [...room.players.values()].map((p) => playerSnapshot(p, now)),
    ts: isTeamRoom(room) ? room.teamScore : null,
    fl: mode.fl ?? null,
    tg: mode.tg ?? null,
    inf: mode.inf ?? null,
    gr: grenadeSnapshot(room),
    dp: deployableSnapshot(room),
    wo: objectsSnapshot(room),
    pw: powerSnapshot(room),
    dz: mode.dz ?? null,
    rd: mode.rd ?? null,
    ic: mode.ic ?? null,
    bm: mode.bm ?? null,
  };
}

/**
 * Anti-camping: a player who stays within PLAYER.campRadius of the same spot for PLAYER.campMs loses health
 * (never below 1, and no regeneration meanwhile) until it moves away. Not in the race (everybody runs there).
 */
function campCheck(room: Room, p: Player, now: number, dt: number): void {
  if (!serverConfig.campRule || !p.alive || room.modeId === 'race' || room.matchOver) return;
  const [x, y, z] = p.campAt;
  if (!p.campSince || Math.hypot(p.x - x, p.y - y, p.z - z) > PLAYER.campRadius) {
    p.campAt = [p.x, p.y, p.z];
    p.campSince = now;
    return;
  }
  if (now - p.campSince < PLAYER.campMs) return;
  if (now - p.campSince - PLAYER.campMs < dt * MS_PER_S)
    room.channel.to(p.id, 'notice', [
      '¡Muévete! Llevas mucho rato en el mismo sitio: pierdes vida hasta que cambies de lugar',
    ]);
  p.lastDamage = now;
  if (p.hp <= 1) return;
  p.hp = Math.max(1, p.hp - PLAYER.campDrain * dt);
  room.channel.to(p.id, 'damaged', [{ hp: Math.ceil(p.hp), from: [round2(p.x), round2(p.z)] }]);
}

/**
 * A player who has not moved since spawning (reading a menu, or about to click into the game) keeps the spawn
 * protection and starts no anti-camping clock, for up to PLAYER.idleGrace; shooting or an ability (protection
 * dropped) ends that at once.
 */
function holdWhileIdle(p: Player, now: number): void {
  if (!p.idle || !p.alive) return;
  if (!p.protUntil || now - p.spawnTime > PLAYER.idleGrace) {
    p.idle = false;
    return;
  }
  p.protUntil = now + PLAYER.spawnProtection;
  p.campSince = 0;
}

/** One snapshot tick for a room: mode rules, regeneration, the snapshot for everyone and each player's ack. */
export function snapshotRoom(room: Room, now: number): void {
  if (!room.matchOver) room.mode.tick?.(room, now);
  autoBalance(room);
  const dt = SERVER_TICK_MS / MS_PER_S;
  for (const p of room.players.values()) {
    holdWhileIdle(p, now);
    campCheck(room, p, now, dt);
    regenerate(p, now, dt);
  }
  room.channel.broadcastVolatile('state', [buildSnapshot(room, now)]);
  sendAcks(room);
}
