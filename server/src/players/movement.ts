import { clamp, type PlayerStateInput } from '@blockshot/shared';
import type { Room } from '../rooms/room';
import { recordPosition } from './history';
import type { Player } from './player';

const MS_PER_S = 1000;
/** Max distance accepted per message: a fixed slack plus a speed (m/s) times the elapsed time. */
const TELEPORT_SLACK = 4;
const TELEPORT_SPEED = 40;
const MAX_ELAPSED_S = 1;
const MIN_Y = -5;
const MAX_Y = 50;
const PITCH_LIMIT = 1.6;

/**
 * Position reported by the client. Very basic anti-teleport (it is a classroom game, not a tournament);
 * generous for chained slides, bunny hop and jump pads. Returns false when the move was rejected.
 */
export function applyReportedState(room: Room, p: Player, d: PlayerStateInput): boolean {
  const now = Date.now();
  const elapsed = Math.min(MAX_ELAPSED_S, (now - p.lastState) / MS_PER_S);
  const dist = Math.hypot(d.x - p.x, d.y - p.y, d.z - p.z);
  if (dist > TELEPORT_SLACK + TELEPORT_SPEED * elapsed) {
    room.channel.to(p.id, 'player:correct', [{ x: p.x, y: p.y, z: p.z }]);
    return false;
  }
  const b = room.map.bounds;
  p.x = clamp(d.x, -b, b);
  p.y = clamp(d.y, MIN_Y, MAX_Y);
  p.z = clamp(d.z, -b, b);
  p.ry = d.ry;
  p.rx = clamp(d.rx, -PITCH_LIMIT, PITCH_LIMIT);
  p.sl = d.sl ? 1 : 0;
  p.cr = d.cr ? 1 : 0;
  p.lastState = now;
  recordPosition(p, now);
  return true;
}
