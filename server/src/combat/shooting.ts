// Authoritative shots: the client sends origin and directions; the server checks fire rate, ammo and
// reload, rewinds the other players to what the shooter saw, traces the rays and applies the damage.
import {
  DIRECTION_LENGTH_TOLERANCE,
  FIRE_RATE_TOLERANCE,
  LAG_COMP_MAX_MS,
  MAX_INPUT_DELAY_S,
  PLAYER,
  RELOAD_GRACE_MS,
  SHOT_ORIGIN_TOLERANCE,
  castShot,
  clamp,
  damageAt,
  round2,
  type HitTarget,
  type ShootInput,
  type Vec3,
} from '@blockshot/shared';
import { poseAt } from '../players/history';
import { weaponIdOf, weaponOf } from '../players/loadout';
import type { Player } from '../players/player';
import { sameTeam } from '../players/teams';
import type { Room } from '../rooms/room';
import { shieldBlocks } from './abilities';
import { launchRound } from './grenades';
import { applyDamage } from './damage';
import { behaviorOf } from './weaponBehavior';

/** Vertical speed counted for the origin tolerance at most (m/s, about a jump's take-off). */
const MAX_VERTICAL_SLACK_SPEED = 10;

interface PendingDamage {
  dmg: number;
  head: boolean;
  at: Vec3;
}

function normalized(dirs: readonly Vec3[]): Vec3[] | null {
  const out: Vec3[] = [];
  for (const d of dirs) {
    const len = Math.hypot(d[0], d[1], d[2]);
    if (Math.abs(len - 1) > DIRECTION_LENGTH_TOLERANCE) return null;
    out.push([d[0] / len, d[1] / len, d[2] / len]);
  }
  return out;
}

/**
 * Whether a shot or throw may start at `o`. The client predicts its own movement, so it can be slightly ahead
 * of the server: allow for its speed (vertical speed capped, or falling fast would give metres of slack), and
 * the origin must be reachable from the real eye without crossing a wall.
 */
export function validOrigin(room: Room, p: Player, o: Vec3): boolean {
  const eye: Vec3 = [p.x, p.y + PLAYER.eye, p.z];
  const speed = Math.hypot(p.move.vx, Math.min(Math.abs(p.move.vy), MAX_VERTICAL_SLACK_SPEED), p.move.vz);
  const tolerance = SHOT_ORIGIN_TOLERANCE + speed * MAX_INPUT_DELAY_S;
  const gap: Vec3 = [o[0] - eye[0], o[1] - eye[1], o[2] - eye[2]];
  const gapLen = Math.hypot(...gap);
  if (gapLen > tolerance) return false;
  return !(
    gapLen > 0 &&
    castShot(eye, [gap[0] / gapLen, gap[1] / gapLen, gap[2] / gapLen], room.colliders, [], p.id, gapLen).hit
  );
}

export function handleShoot(room: Room, p: Player, msg: ShootInput): void {
  const w = weaponOf(p);
  const a = p.ammo[p.slot];
  const now = Date.now();
  if (!w || !a) return;

  if (a.reloadEnd) {
    if (now < a.reloadEnd - RELOAD_GRACE_MS) return;
    a.mag = w.mag;
    a.reloadEnd = 0;
  }
  if (a.mag <= 0 || now - (p.lastShot[p.slot] ?? 0) < w.fireRate * FIRE_RATE_TOLERANCE) return;

  const eye: Vec3 = [p.x, p.y + PLAYER.eye, p.z];
  if (!validOrigin(room, p, msg.o)) return;
  // Melee reach is measured from the server's eye, so a shifted origin cannot lengthen the knife
  const o = w.melee ? eye : msg.o;
  if (msg.d.length > w.pellets) return;
  const dirs = normalized(msg.d);
  if (!dirs) return;

  const behavior = behaviorOf(w);
  if (behavior.usesAmmo) a.mag--;
  p.lastShot[p.slot] = now;
  p.protUntil = 0; // shooting removes spawn protection

  // Grenade launcher: the round flies (grenades.ts) and does the damage when it blows up
  if (w.projectile) {
    p.shots++;
    launchRound(room, p, o, dirs[0]!, now);
    room.channel.broadcast('shot', [{ id: p.id, w: weaponIdOf(p), e: [] }], p.id);
    return;
  }

  // Lag compensation: rivals are placed where the shooter saw them when firing
  const past = now - clamp(msg.lag ?? 0, 0, LAG_COMP_MAX_MS);
  const targets: HitTarget[] = [...room.players.values()]
    .filter((t) => t.alive && t.id !== p.id && !sameTeam(room, t, p))
    .map((t) => ({ ...poseAt(t, past), id: t.id, alive: true }));
  const ends: Vec3[] = [];
  const damage = new Map<string, PendingDamage>();
  for (const d of dirs) {
    const { t, hit } = behavior.trace(w, { origin: o, dir: d, colliders: room.colliders, targets, shooterId: p.id });
    ends.push([round2(o[0] + d[0] * t), round2(o[1] + d[1] * t), round2(o[2] + d[2] * t)]);
    if (hit?.type !== 'player') continue;
    const e = damage.get(hit.id) ?? { dmg: 0, head: false, at: [o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t] };
    e.dmg += damageAt(w, t) * (hit.head ? w.headMult : 1);
    e.head ||= hit.head;
    damage.set(hit.id, e);
  }
  p.shots++;
  if (damage.size) p.hits++;
  for (const { head } of damage.values()) if (head) p.heads++;
  room.channel.broadcast('shot', [{ id: p.id, w: weaponIdOf(p), e: ends }], p.id);
  for (const [id, { dmg, head, at }] of damage) {
    const victim = room.players.get(id);
    // Tanque's shield stops what comes from the front
    if (victim && shieldBlocks(victim, o, now)) {
      room.channel.broadcast('shield:hit', [{ id: victim.id, at: [round2(at[0]), round2(at[1]), round2(at[2])] }]);
      continue;
    }
    if (victim) applyDamage(room, p, victim, behavior.damage(w, p, victim, dmg), head, w, at);
  }
}

export function handleReload(p: Player): void {
  const w = weaponOf(p);
  const a = p.ammo[p.slot];
  if (w && a && behaviorOf(w).usesAmmo && !a.reloadEnd && a.mag < w.mag) a.reloadEnd = Date.now() + w.reload;
}

export function handleSwitch(p: Player, slot: number): void {
  if (slot < 0 || slot >= p.loadout.length) return;
  const a = p.ammo[p.slot];
  if (a) a.reloadEnd = 0; // switching weapons cancels the reload
  p.slot = slot;
}
