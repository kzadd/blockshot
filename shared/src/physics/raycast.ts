// Dependency-free raycasting: the server uses it as the authority, the client for effects.
import type { Vec3 } from '../core/math';

export interface Collider {
  c: string;
  min: Vec3;
  max: Vec3;
}

/** Anything with feet position and posture that can be hit by a shot. */
export interface HitTarget {
  id: string;
  x: number;
  y: number;
  z: number;
  /** sliding */
  sl: number;
  /** crouching */
  cr: number;
  alive: boolean;
}

export type ShotHit = { type: 'wall' } | { type: 'player'; id: string; head: boolean };

/** Hitbox sizes (metres). Sliding or crouching lowers both boxes. */
export const HITBOX = {
  halfWidth: 0.38,
  bodyHeight: 1.45,
  headHeight: 1.64,
  headRadius: 0.27,
  lowered: 0.5,
} as const;

const EPSILON = 1e-9;

export function rayAABB(o: Vec3, d: Vec3, min: Vec3, max: Vec3): number {
  let tmin = 0;
  let tmax = Infinity;
  for (let i = 0; i < 3; i++) {
    const oi = o[i]!;
    const di = d[i]!;
    if (Math.abs(di) < EPSILON) {
      if (oi < min[i]! || oi > max[i]!) return Infinity;
    } else {
      let t1 = (min[i]! - oi) / di;
      let t2 = (max[i]! - oi) / di;
      if (t1 > t2) [t1, t2] = [t2, t1];
      if (t1 > tmin) tmin = t1;
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return Infinity;
    }
  }
  return tmin;
}

export function raySphere(o: Vec3, d: Vec3, c: Vec3, r: number): number {
  const ox = o[0] - c[0];
  const oy = o[1] - c[1];
  const oz = o[2] - c[2];
  const b = ox * d[0] + oy * d[1] + oz * d[2];
  const cc = ox * ox + oy * oy + oz * oz - r * r;
  const disc = b * b - cc;
  if (disc < 0) return Infinity;
  const s = Math.sqrt(disc);
  let t = -b - s;
  if (t < 0) t = -b + s;
  return t < 0 ? Infinity : t;
}

export interface Hitboxes {
  bmin: Vec3;
  bmax: Vec3;
  head: Vec3;
  hr: number;
}

/** Player hitboxes (p.x, p.y, p.z = feet). */
export function hitboxes(p: Pick<HitTarget, 'x' | 'y' | 'z' | 'sl' | 'cr'>): Hitboxes {
  const s = p.sl || p.cr ? HITBOX.lowered : 0;
  const w = HITBOX.halfWidth;
  return {
    bmin: [p.x - w, p.y, p.z - w],
    bmax: [p.x + w, p.y + HITBOX.bodyHeight - s, p.z + w],
    head: [p.x, p.y + HITBOX.headHeight - s, p.z],
    hr: HITBOX.headRadius,
  };
}

export interface ShotResult {
  t: number;
  hit: ShotHit | null;
}

export function castShot(
  o: Vec3,
  d: Vec3,
  colliders: readonly Pick<Collider, 'min' | 'max'>[],
  players: readonly HitTarget[],
  ignoreId: string,
  range: number,
): ShotResult {
  let t = range;
  let hit: ShotHit | null = null;
  for (const b of colliders) {
    const bt = rayAABB(o, d, b.min, b.max);
    if (bt < t) {
      t = bt;
      hit = { type: 'wall' };
    }
  }
  for (const p of players) {
    if (p.id === ignoreId || !p.alive) continue;
    const hb = hitboxes(p);
    const th = raySphere(o, d, hb.head, hb.hr);
    if (th < t) {
      t = th;
      hit = { type: 'player', id: p.id, head: true };
    }
    const tb = rayAABB(o, d, hb.bmin, hb.bmax);
    if (tb < t) {
      t = tb;
      hit = { type: 'player', id: p.id, head: false };
    }
  }
  return { t, hit };
}
