// Air strike (the 7-kill streak reward): a line of blasts where the player is looking, announced on the ground first
// so whoever is there has a moment to run.
import { AIRSTRIKE, GRENADE_WEAPON, PLAYER, castShot, round2, type Vec3, type Weapon } from '@blockshot/shared';
import type { Player } from '../players/player';
import type { Room } from '../rooms/room';
import { blastAt } from './grenades';

export interface Strike {
  owner: string;
  at: Vec3[];
  when: number;
}

const STRIKE_WEAPON: Weapon = { ...GRENADE_WEAPON, name: 'Bombardeo aéreo', damage: AIRSTRIKE.maxDamage };

/** Marks the strike: the point looked at (as far as AIRSTRIKE.range) and blasts in a line along the look. */
export function callStrike(room: Room, p: Player, now: number): void {
  const d: Vec3 = [-Math.sin(p.ry) * Math.cos(p.rx), Math.sin(p.rx), -Math.cos(p.ry) * Math.cos(p.rx)];
  const eye: Vec3 = [p.x, p.y + PLAYER.eye, p.z];
  const { t } = castShot(eye, d, room.colliders, [], p.id, AIRSTRIKE.range);
  const hit: Vec3 = [eye[0] + d[0] * t, eye[1] + d[1] * t, eye[2] + d[2] * t];
  const flat = Math.hypot(d[0], d[2]) || 1;
  const mid = (AIRSTRIKE.blasts - 1) / 2;
  const at = Array.from({ length: AIRSTRIKE.blasts }, (_, i): Vec3 => {
    const k = (i - mid) * AIRSTRIKE.spacing;
    return [round2(hit[0] + (d[0] / flat) * k), round2(Math.max(0, hit[1]) + 0.3), round2(hit[2] + (d[2] / flat) * k)];
  });
  room.strikes.push({ owner: p.id, at, when: now + AIRSTRIKE.delayMs });
  room.channel.broadcast('strike', [{ at, ms: AIRSTRIKE.delayMs }]);
}

/** Strikes whose warning is over come down. */
export function tickStrikes(room: Room, now: number): void {
  if (!room.strikes.length) return;
  const due = room.strikes.filter((s) => now >= s.when);
  if (!due.length) return;
  room.strikes = room.strikes.filter((s) => now < s.when);
  for (const s of due)
    for (const pos of s.at) blastAt(room, room.players.get(s.owner), pos, AIRSTRIKE, STRIKE_WEAPON, now);
}
