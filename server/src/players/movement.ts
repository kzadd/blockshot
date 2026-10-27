// Authoritative movement: clients send input commands, the server simulates them with the shared
// movement code at a fixed rate and tells each client where it really is (ack).
import {
  BTN_AIM,
  CHAR_BY_ID,
  FIXED_DT,
  MAX_QUEUED_INPUTS,
  MAX_SIM_BUDGET_S,
  WEAPONS,
  clamp,
  stepMovement,
  type MoveInput,
} from '@blockshot/shared';
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

function stepPlayer(room: Room, p: Player, input: MoveInput): void {
  if (!p.characterId) return;
  // The weapon actually held decides the speed: the slot inside the input is only the client's prediction
  const weaponId = p.loadout[p.slot];
  const w = weaponId ? WEAPONS[weaponId] : null;
  const walk = CHAR_BY_ID[p.characterId].speed * (w?.weight ?? 1) * (room.mode.speedFactor?.(p) ?? 1);
  const spawn = room.map.spawns[0];
  stepMovement(p.move, input, FIXED_DT, {
    colliders: room.colliders,
    walk,
    adsMove: w?.adsMove ?? 1,
    fallback: spawn ? [spawn[0], spawn[1], spawn[2]] : [0, 0, 0],
    dash: CHAR_BY_ID[p.characterId].ability === 'dash',
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
      stepPlayer(room, p, p.inputs.shift()!);
      p.simBudget -= FIXED_DT;
    }
    recordPosition(p, now);
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
