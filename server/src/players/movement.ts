// Authoritative movement: clients send input commands, the server simulates them with the shared
// movement code at a fixed rate and tells each client where it really is (ack).
import {
  BTN_AIM,
  BTN_SHOVE,
  FALL_OUT_Y,
  PLAYER,
  SHOVE,
  round2,
  BODY,
  accessorySpeed,
  climbables,
  FIXED_DT,
  movesOrJumps,
  MAX_QUEUED_INPUTS,
  MAX_SIM_BUDGET_S,
  WEAPONS,
  clamp,
  staminaMult,
  stepMovement,
  type MoveInput,
  type Vec3,
} from '@blockshot/shared';
import { dieAlone } from '../combat/damage';
import type { Room } from '../rooms/room';
import { recordPosition } from './history';
import type { Player } from './player';

const PITCH_LIMIT = 1.6;

/** Queues new commands (older or repeated sequence numbers are ignored). */
export function queueInputs(p: Player, cmds: readonly MoveInput[]): void {
  let last = p.inputs[p.inputs.length - 1]?.seq ?? p.lastSeq;
  for (const c of cmds) {
    if (c.seq <= last) continue;
    if (p.inputs.length >= MAX_QUEUED_INPUTS) break; // sending faster than real time: the rest is dropped
    p.inputs.push(c);
    last = c.seq;
  }
}

/**
 * Knocks a player away along (dx, dz) with a little lift, no damage (SHOVE). Its own client gets the new velocity in
 * the next ack, replaying its pending commands from there.
 */
export function pushPlayer(p: Player, dx: number, dz: number): void {
  const len = Math.hypot(dx, dz) || 1;
  p.move.vx += (dx / len) * SHOVE.push;
  p.move.vz += (dz / len) * SHOVE.push;
  p.move.vy = Math.max(p.move.vy, SHOVE.lift);
  p.move.grounded = false;
}

/** The shove key (V): the nearest player (any team) within reach in front is pushed away; once every cooldownMs. */
export function shove(room: Room, p: Player, now: number): void {
  if (now < p.shoveAt) return;
  p.shoveAt = now + SHOVE.cooldownMs;
  const fx = -Math.sin(p.ry);
  const fz = -Math.cos(p.ry);
  let best: Player | null = null;
  let bestD = SHOVE.range;
  for (const q of room.players.values()) {
    const dx = q.x - p.x;
    const dz = q.z - p.z;
    const d = Math.hypot(dx, dz);
    if (q === p || !q.alive || d > bestD || Math.abs(q.y - p.y) > PLAYER.height) continue;
    if (d > 0 && (dx * fx + dz * fz) / d < SHOVE.cone) continue;
    best = q;
    bestD = d;
  }
  if (!best || best.zombie === 'tank') return; // Infectados' Tanque does not budge
  pushPlayer(best, fx, fz);
  const at: Vec3 = [round2(best.x), round2(best.y + PLAYER.eye), round2(best.z)];
  room.channel.to(p.id, 'hitmarker', [{ head: false, kill: false, dmg: 0, at, id: best.id }]);
}

function stepPlayer(room: Room, p: Player, input: MoveInput, now: number): void {
  if (!p.cls) return;
  if (movesOrJumps(input)) p.idle = false;
  // The weapon actually held decides the speed: the slot inside the input is only the client's prediction
  const weaponId = p.loadout[p.slot];
  const w = weaponId ? WEAPONS[weaponId] : null;
  const walk = BODY.speed * (w?.weight ?? 1) * accessorySpeed(p.cls.accessory) * (room.mode.speedFactor?.(p) ?? 1);
  stepMovement(p.move, input, FIXED_DT, {
    colliders: room.colliders,
    walk,
    adsMove: w?.adsMove ?? 1,
    dash: p.cls.ability === 'dash',
    leap: p.zombie === 'leaper',
    staminaMult: staminaMult(w?.weight ?? 1),
    ...climbables(room.map),
  });
  const m = p.move;
  p.x = m.x;
  p.y = m.y;
  p.z = m.z;
  p.ry = input.yaw;
  p.rx = clamp(input.pitch, -PITCH_LIMIT, PITCH_LIMIT);
  p.sl = m.sliding ? 1 : 0;
  p.cr = m.crouching && !m.sliding ? 1 : 0;
  p.lastSeq = input.seq;
  p.aiming = (input.b & BTN_AIM) !== 0;
  if (input.b & BTN_SHOVE) shove(room, p, now);
}

/**
 * Simulates the queued commands of every living player for one tick of `dt` seconds. Each player can only
 * spend the simulation time that really passed (plus a small bank for jitter), so sending more commands
 * does not make anyone faster.
 */
export function simulateRoom(room: Room, dt: number, now: number): void {
  for (const p of room.players.values()) {
    if (!p.alive) {
      p.inputs.length = 0;
      continue;
    }
    p.simBudget = Math.min(MAX_SIM_BUDGET_S, p.simBudget + dt);
    while (p.inputs.length && p.simBudget >= FIXED_DT) {
      stepPlayer(room, p, p.inputs.shift()!, now);
      p.simBudget -= FIXED_DT;
    }
    recordPosition(p, now);
    // Fell into the void: a death (the race sends you back to your checkpoint well before, over the lava)
    if (p.y <= FALL_OUT_Y && room.modeId !== 'race') dieAlone(room, p, 'Vacío');
  }
}

/**
 * Tells each living player its authoritative movement state. Reliable on purpose: it goes out right after
 * the (volatile) snapshot, and a volatile message is dropped while the transport is still busy.
 */
export function sendAcks(room: Room): void {
  for (const p of room.players.values()) {
    if (p.alive) room.channel.to(p.id, 'player:ack', [{ seq: p.lastSeq, s: p.move, life: p.life }]);
  }
}
