// Practice bots for the server's own PC: they spawn, walk to the nearest rival, strafe once it is in sight and shoot
// with the same rules as a player (fire rate, ammo, damage), only less accurately.
import { BTN_JUMP, CHARACTERS, PLAYER, castShot, type MoveInput, type Vec3 } from '@blockshot/shared';
import { handleReload, handleShoot } from '../combat/shooting';
import type { RoomRegistry } from '../rooms/registry';
import type { Room } from '../rooms/room';
import { weaponOf } from './loadout';
import { queueInputs } from './movement';
import type { Player } from './player';
import { spawnPlayer } from './spawn';
import { sameTeam } from './teams';

export const BOT_PREFIX = 'bot:';
/** A room never gets more bots than this (they are for testing, not to fill matches). */
export const MAX_BOTS = 4;
/** Time a rival must stay in sight before the bot starts firing (ms): gives you a chance to react. */
const REACTION_MS = 450;
/** Aim error (radians) added to the weapon's own spread: hits often, misses sometimes. */
const AIM_ERROR = 0.035;
/** The bot changes strafing direction every STRAFE_MS ± half. */
const STRAFE_MS = 1200;
/** Chest height of the target, from its feet (m). */
const CHEST = 1.1;
const SIGHT_RANGE = 80;
/** Below this horizontal speed (m/s) a chasing bot counts as blocked. */
const STUCK_SPEED = 1;

interface Brain {
  seq: number;
  strafe: number;
  strafeUntil: number;
  targetId: string | null;
  seenSince: number;
}

const brains = new WeakMap<Player, Brain>();
let botCount = 0;

export const isBot = (p: Player): boolean => p.id.startsWith(BOT_PREFIX);

/** Adds a bot to the room; returns an error message when it cannot. */
export function addBot(registry: RoomRegistry, room: Room): string | null {
  const bots = [...room.players.values()].filter(isBot).length;
  if (bots >= MAX_BOTS) return `Ya hay ${MAX_BOTS} bots en la sala.`;
  if (room.players.size >= room.max) return 'La sala está llena.';
  const n = ++botCount;
  registry.addPlayer(room, `${BOT_PREFIX}${n}`, `Bot ${bots + 1}`);
  return null;
}

export function removeBots(registry: RoomRegistry, room: Room): number {
  const ids = [...room.players.values()].filter(isBot).map((p) => p.id);
  for (const id of ids) registry.removePlayer(room, id);
  return ids.length;
}

const forward = (yaw: number, pitch: number): Vec3 => [
  -Math.sin(yaw) * Math.cos(pitch),
  Math.sin(pitch),
  -Math.cos(yaw) * Math.cos(pitch),
];

interface Aim {
  p: Player;
  yaw: number;
  pitch: number;
  dist: number;
}

/** Nearest living rival the bot can see (to shoot) and nearest at all (to walk to), aiming at the chest. */
function findTargets(room: Room, bot: Player, eye: Vec3) {
  let seen: Aim | null = null;
  let near: Aim | null = null;
  for (const t of room.players.values()) {
    if (!t.alive || t.id === bot.id || sameTeam(room, t, bot)) continue;
    const dx = t.x - eye[0];
    const dy = t.y + CHEST - eye[1];
    const dz = t.z - eye[2];
    const dist = Math.hypot(dx, dy, dz);
    if (dist === 0) continue;
    const aim = { p: t, yaw: Math.atan2(-dx, -dz), pitch: Math.asin(dy / dist), dist };
    if (!near || dist < near.dist) near = aim;
    if (dist > SIGHT_RANGE || (seen && dist >= seen.dist)) continue;
    const dir: Vec3 = [dx / dist, dy / dist, dz / dist];
    if (!castShot(eye, dir, room.colliders, [], bot.id, dist).hit) seen = aim; // no wall in between
  }
  return { seen, near };
}

function think(room: Room, bot: Player, now: number): void {
  const brain = brains.get(bot) ?? { seq: 0, strafe: 1, strafeUntil: 0, targetId: null, seenSince: 0 };
  brains.set(bot, brain);

  if (!bot.alive) {
    const ready = !bot.deathTime || now - bot.deathTime >= PLAYER.respawnDelay;
    if (!room.matchOver && ready) {
      const ch = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)]!;
      spawnPlayer(room, bot, ch, 'base');
      brain.seq = 0;
      bot.lastSeq = -1;
    }
    return;
  }

  if (now > brain.strafeUntil) {
    brain.strafe = -brain.strafe;
    brain.strafeUntil = now + STRAFE_MS * (0.5 + Math.random());
  }
  const eye: Vec3 = [bot.x, bot.y + PLAYER.eye, bot.z];
  const { seen: target, near } = findTargets(room, bot, eye);
  if (target?.p.id !== brain.targetId) {
    brain.targetId = target?.p.id ?? null;
    brain.seenSince = now;
  }
  // Nobody in sight, or knife only (gun game's last level, infected): head for the nearest rival
  const chase = !target || !!weaponOf(bot)?.melee;
  const aim = target ?? near;
  // Walking into something: jump (a crate, a step), and the strafe slides it along walls
  const stuck = chase && aim && Math.hypot(bot.move.vx, bot.move.vz) < STUCK_SPEED;
  const input: MoveInput = {
    seq: ++brain.seq,
    f: chase && aim ? 1 : 0,
    s: brain.strafe,
    yaw: aim?.yaw ?? bot.ry,
    pitch: target?.pitch ?? 0,
    b: stuck ? BTN_JUMP : 0,
    slot: bot.slot,
  };
  queueInputs(bot, [input]);

  if (!target || room.matchOver || now - brain.seenSince < REACTION_MS) return;
  const a = bot.ammo[bot.slot];
  if (a && a.mag <= 0 && !a.reloadEnd) return handleReload(bot);
  const err = () => (Math.random() * 2 - 1) * AIM_ERROR;
  handleShoot(room, bot, { o: eye, d: [forward(target.yaw + err(), target.pitch + err())], lag: 0 });
}

/** One fixed step for every bot of the room (before the movement simulation). */
export function tickBots(room: Room, now: number): void {
  for (const p of room.players.values()) if (isBot(p)) think(room, p, now);
}
