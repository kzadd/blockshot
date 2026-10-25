// Practice bots for the server's own PC: they play the mode's objective (flags, zones, tags) or hunt the nearest
// rival, walking the map (stairs and jump pads too), and shoot with the same rules as a player (fire rate, ammo,
// damage), only less accurately.
import {
  BOT_LEVELS,
  BTN_JUMP,
  CHARACTERS,
  DOM,
  PLAYER,
  WEAPONS,
  castShot,
  dominationZones,
  type BotLevel,
  type MoveInput,
  type Vec3,
} from '@blockshot/shared';
import { handleReload, handleShoot, handleSwitch } from '../combat/shooting';
import type { RoomRegistry } from '../rooms/registry';
import type { Room } from '../rooms/room';
import { weaponOf } from './loadout';
import { queueInputs } from './movement';
import { findPath, navGrid } from './nav';
import type { Player } from './player';
import { spawnPlayer } from './spawn';
import { sameTeam } from './teams';
import { asSide } from '../modes/scoring';

export const BOT_PREFIX = 'bot:';
/** A room never gets more bots than this (they are for testing, not to fill matches). */
export const MAX_BOTS = 4;
/** The bot changes strafing direction every STRAFE_MS ± half. */
const STRAFE_MS = 1200;
/** Chest height of the target, from its feet (m). */
const CHEST = 1.1;
const SIGHT_RANGE = 80;
/** Below this horizontal speed (m/s) a chasing bot counts as blocked. */
const STUCK_SPEED = 1;
/** The path to the rival is worked out again this often (ms), or sooner if the rival moved this far (m). */
const REPATH_MS = 1000;
const REPATH_MOVED = 3;
/** A waypoint closer than this (m) counts as reached. */
const WAYPOINT_REACHED = 0.6;
/** Out of shotgun range, and too close for a sniper scope, the bot takes out its secondary (m). */
const SHOTGUN_RANGE = 15;
const SNIPER_MIN_RANGE = 10;
/** With an objective to play, rivals further than this are shot on the way instead of stopping for them. */
const ENGAGE_RANGE = 25;
/** The objective is looked up again this often (ms). */
const OBJECTIVE_MS = 250;
/** Kill confirmed: tags closer than this are worth a detour (m). */
const TAG_DETOUR = 30;
/** Close enough to an objective point to stop walking (m). */
const AT_GOAL = 1.2;

interface Brain {
  level: BotLevel;
  seq: number;
  strafe: number;
  strafeUntil: number;
  targetId: string | null;
  seenSince: number;
  path: Vec3[];
  pathAt: number;
  goal: Vec3 | null;
  /** where the mode wants the bot (null: hunt rivals) and when it was looked up */
  objective: Vec3 | null;
  objectiveAt: number;
  /** how close to the objective counts as there (a zone is big, a flag is not) */
  objectiveRadius: number;
}

const brains = new WeakMap<Player, Brain>();
let botCount = 0;

export const isBot = (p: Player): boolean => p.id.startsWith(BOT_PREFIX);

const newBrain = (level: BotLevel): Brain => ({
  level,
  seq: 0,
  strafe: 1,
  strafeUntil: 0,
  targetId: null,
  seenSince: 0,
  path: [],
  pathAt: 0,
  goal: null,
  objective: null,
  objectiveAt: 0,
  objectiveRadius: AT_GOAL,
});

/** Adds a bot to the room; returns an error message when it cannot. */
export function addBot(registry: RoomRegistry, room: Room, level: BotLevel = 'normal'): string | null {
  const bots = [...room.players.values()].filter(isBot).length;
  if (bots >= MAX_BOTS) return `Ya hay ${MAX_BOTS} bots en la sala.`;
  if (room.players.size >= room.max) return 'La sala está llena.';
  const id = `${BOT_PREFIX}${++botCount}`;
  registry.addPlayer(room, id, `Bot ${bots + 1} · ${BOT_LEVELS[level].name}`);
  brains.set(room.players.get(id)!, newBrain(level));
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

/** Yaw towards the next waypoint of the path to `target` (worked out again when stale). */
function followPath(room: Room, bot: Player, brain: Brain, target: Vec3, now: number): number | null {
  const moved = brain.goal ? Math.hypot(target[0] - brain.goal[0], target[2] - brain.goal[2]) : Infinity;
  // Never in the air: mid-jump (a pad) the ground below is the nearest node and the new path would turn it back
  if (bot.move.grounded && (now - brain.pathAt > REPATH_MS || moved > REPATH_MOVED)) {
    brain.goal = [target[0], target[1], target[2]];
    brain.path = findPath(navGrid(room.map, room.colliders), [bot.x, bot.y, bot.z], brain.goal) ?? [];
    brain.pathAt = now;
  }
  while (brain.path.length && Math.hypot(brain.path[0]![0] - bot.x, brain.path[0]![2] - bot.z) < WAYPOINT_REACHED)
    brain.path.shift();
  const next = brain.path[0];
  return next ? Math.atan2(-(next[0] - bot.x), -(next[2] - bot.z)) : null;
}

const at = (p: { x: number; y: number; z: number }): Vec3 => [p.x, p.y, p.z];

/**
 * Where the mode wants this bot: steal / bring home / return a flag, take a zone that is not ours, pick up a
 * nearby tag. Null when the mode has nothing to do (then it hunts the nearest rival).
 */
function objectiveOf(room: Room, bot: Player): { goal: Vec3; radius: number } | null {
  const team = asSide(bot.team);
  if (!team) return null;
  const enemy = team === 1 ? 2 : 1;
  const snap = room.mode.snapshot?.(room, Date.now());
  if (snap?.fl) {
    const mine = snap.fl[team];
    const theirs = snap.fl[enemy];
    const home = room.map.bases[team];
    if (theirs.c === bot.id) return { goal: [home[0], home[1], home[2]], radius: AT_GOAL }; // bring it home
    if (!mine.h && !mine.c) return { goal: at(mine), radius: AT_GOAL }; // return ours
    const thief = mine.c ? room.players.get(mine.c) : null;
    if (thief?.alive) return { goal: at(thief), radius: AT_GOAL }; // chase whoever has ours
    if (!theirs.c) return { goal: at(theirs), radius: AT_GOAL }; // go and steal theirs
    return null;
  }
  if (snap?.dz) {
    // The nearest zone we do not hold (or that is being fought over)
    const zones = dominationZones(room.map);
    let best: Vec3 | null = null;
    zones.forEach((z, i) => {
      const [owner, , contested] = snap.dz![i]!;
      if (owner === team && !contested) return;
      if (!best || Math.hypot(z[0] - bot.x, z[2] - bot.z) < Math.hypot(best[0] - bot.x, best[2] - bot.z)) best = z;
    });
    return best ? { goal: best, radius: DOM.radius - 1.5 } : null;
  }
  if (snap?.tg) {
    let best: Vec3 | null = null;
    for (const [, x, y, z] of snap.tg) {
      const d = Math.hypot(x - bot.x, z - bot.z);
      if (d < TAG_DETOUR && (!best || d < Math.hypot(best[0] - bot.x, best[2] - bot.z))) best = [x, y, z];
    }
    return best ? { goal: best, radius: 0.5 } : null;
  }
  return null;
}

/** Shotgun out of range or sniper too close: the secondary is better. */
function pickWeapon(bot: Player, dist: number): void {
  const primary = bot.loadout[0];
  if (!primary || bot.loadout.length < 2 || WEAPONS[primary].melee) return;
  const w = WEAPONS[primary];
  const secondary = (w.pellets > 1 && dist > SHOTGUN_RANGE) || (!!w.scope && dist < SNIPER_MIN_RANGE);
  const slot = secondary ? 1 : 0;
  if (bot.slot !== slot) handleSwitch(bot, slot);
}

function think(room: Room, bot: Player, now: number): void {
  const brain = brains.get(bot) ?? newBrain('normal');
  brains.set(bot, brain);
  const level = BOT_LEVELS[brain.level];

  if (!bot.alive) {
    const ready = !bot.deathTime || now - bot.deathTime >= PLAYER.respawnDelay;
    if (!room.matchOver && ready && room.mode.canSpawn?.(room, bot) !== false) {
      const ch = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)]!;
      spawnPlayer(room, bot, ch, 'base');
      brain.seq = 0;
      brain.path = [];
      brain.goal = null;
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
  if (target) pickWeapon(bot, target.dist);
  if (now - brain.objectiveAt > OBJECTIVE_MS) {
    const o = objectiveOf(room, bot);
    brain.objective = o?.goal ?? null;
    brain.objectiveRadius = o?.radius ?? AT_GOAL;
    brain.objectiveAt = now;
  }
  const melee = !!weaponOf(bot)?.melee;
  const objective = brain.objective;
  // A rival in sight: stop and fight, unless there is an objective and the rival is far (shoot on the way)
  const fight = !!target && !melee && (!objective || target.dist < ENGAGE_RANGE);
  // Otherwise walk: to the objective, or (knife only, or nobody in sight) to the nearest rival
  let goal: Vec3 | null = null;
  if (!fight) goal = objective ?? (near ? at(near.p) : null);
  const there = goal && objective && Math.hypot(goal[0] - bot.x, goal[2] - bot.z) < brain.objectiveRadius;
  const walkYaw =
    goal && !there
      ? (followPath(room, bot, brain, goal, now) ?? Math.atan2(-(goal[0] - bot.x), -(goal[2] - bot.z)))
      : null;
  // Facing: the rival when there is one in sight, otherwise where it walks
  const faceYaw = target && !melee ? target.yaw : (walkYaw ?? bot.ry);
  // Walk direction relative to the facing (moving one way while aiming another)
  const rel = walkYaw === null ? 0 : walkYaw - faceYaw;
  // Walking into something: jump (a crate, a step)
  const stuck = walkYaw !== null && Math.hypot(bot.move.vx, bot.move.vz) < STUCK_SPEED;
  const input: MoveInput = {
    seq: ++brain.seq,
    f: walkYaw !== null ? Math.cos(rel) : 0,
    // Strafing while following a path would push it off stairs and ledges; standing in a zone it holds still
    s: walkYaw !== null ? -Math.sin(rel) : fight ? brain.strafe : 0,
    yaw: faceYaw,
    pitch: target?.pitch ?? 0,
    b: stuck ? BTN_JUMP : 0,
    slot: bot.slot,
  };
  queueInputs(bot, [input]);

  if (!target || room.matchOver || now - brain.seenSince < level.reactionMs) return;
  const a = bot.ammo[bot.slot];
  if (a && a.mag <= 0 && !a.reloadEnd) return handleReload(bot);
  const err = () => (Math.random() * 2 - 1) * level.aimError;
  handleShoot(room, bot, { o: eye, d: [forward(target.yaw + err(), target.pitch + err())], lag: 0 });
}

/** One fixed step for every bot of the room (before the movement simulation). */
export function tickBots(room: Room, now: number): void {
  for (const p of room.players.values()) if (isBot(p)) think(room, p, now);
}
