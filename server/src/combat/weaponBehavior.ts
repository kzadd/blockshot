// Strategy per kind of weapon: how a shot finds its target and how damage is adjusted.
import {
  BACKSTAB_DOT,
  MELEE_ASSIST_DOT,
  castShot,
  rayAABB,
  type Collider,
  type HitTarget,
  type ShotResult,
  type Vec3,
  type Weapon,
} from '@blockshot/shared';
import type { Player } from '../players/player';

/** Melee assist aims at the target's chest (m above its feet). */
const MELEE_AIM_HEIGHT = 1;

export interface TraceInput {
  origin: Vec3;
  dir: Vec3;
  colliders: readonly Collider[];
  targets: readonly HitTarget[];
  shooterId: string;
}

export interface WeaponBehavior {
  /** does each shot spend a round */
  readonly usesAmmo: boolean;
  trace(w: Weapon, input: TraceInput): ShotResult;
  /** final damage for one victim, after all pellets were added up */
  damage(w: Weapon, shooter: Player, victim: Player, dmg: number): number;
}

const hitscan: WeaponBehavior = {
  usesAmmo: true,
  trace: (w, { origin, dir, colliders, targets, shooterId }) =>
    castShot(origin, dir, colliders, targets, shooterId, w.range),
  damage: (_w, _s, _v, dmg) => dmg,
};

// Knife: besides the ray, it hits whoever is very close and in front (no pixel aim needed)
function meleeAssist(w: Weapon, { origin: o, dir: d, colliders, targets }: TraceInput): ShotResult | null {
  let best: ShotResult | null = null;
  for (const t of targets) {
    const c: Vec3 = [t.x, t.y + MELEE_AIM_HEIGHT, t.z];
    const v: Vec3 = [c[0] - o[0], c[1] - o[1], c[2] - o[2]];
    const dist = Math.hypot(...v);
    if (dist > w.range || (best && dist > best.t)) continue;
    if ((v[0] * d[0] + v[1] * d[1] + v[2] * d[2]) / dist < MELEE_ASSIST_DOT) continue;
    const toTarget: Vec3 = [v[0] / dist, v[1] / dist, v[2] / dist];
    if (colliders.some((b) => rayAABB(o, toTarget, b.min, b.max) < dist)) continue;
    best = { t: dist, hit: { type: 'player', id: t.id, head: false } };
  }
  return best;
}

const melee: WeaponBehavior = {
  usesAmmo: false,
  trace(w, input) {
    const shot = hitscan.trace(w, input);
    if (shot.hit?.type === 'player') return shot;
    return meleeAssist(w, input) ?? shot;
  },
  // From behind (attacker behind where the victim looks) it deals the backstab damage
  damage(w, shooter, victim, dmg) {
    if (!w.backstab) return dmg;
    const rx = shooter.x - victim.x;
    const rz = shooter.z - victim.z;
    const len = Math.hypot(rx, rz) || 1;
    const facing = (-Math.sin(victim.ry) * rx - Math.cos(victim.ry) * rz) / len;
    return facing < BACKSTAB_DOT ? w.backstab : dmg;
  },
};

export const behaviorOf = (w: Weapon): WeaponBehavior => (w.melee ? melee : hitscan);
