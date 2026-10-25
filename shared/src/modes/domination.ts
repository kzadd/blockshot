// Domination: three zones (A near Red, B in the middle, C near Blue). Standing in a zone with no rival in it
// takes it; every few seconds each team scores a point per zone it holds.
import type { Vec3 } from '../core/math';
import { getColliders } from '../maps/maps';
import type { GameMap } from '../maps/types';

export const DOM = {
  /** zone radius (m) and how far above or below it still counts */
  radius: 4,
  height: 2.5,
  /** ms one player needs to turn a zone (from the other team: neutral first, then yours) */
  captureMs: 6000,
  /** each extra teammate in the zone speeds it up by this much, up to `maxBoost` */
  boostPerMate: 0.5,
  maxBoost: 2,
  /** a point per zone held, this often (ms) */
  scoreEveryMs: 2000,
};
export const ZONE_NAMES = ['A', 'B', 'C'] as const;

/** Free space a zone needs around its centre (half side, m) and the height that must be clear. */
const CLEAR_HALF = 2;
const CLEAR_HEIGHT = 2;
const WALL_MARGIN = 4;
/** Where A (and mirrored, C) is looked for: this fraction of the half side west of the centre. */
const SIDE_ZONE_X = 0.5;
const SEARCH_STEP = 1;
const SEARCH_RADIUS = 0.4;

const cache = new WeakMap<GameMap, Vec3[]>();

/**
 * Zone centres for a map, on open ground. A and C mirror each other on x (the maps are mirror-symmetric,
 * so both teams are just as far from "their" zone); B sits on the centre line. Deterministic: server and
 * client compute the same.
 */
export function dominationZones(map: GameMap): Vec3[] {
  const known = cache.get(map);
  if (known) return known;
  const colliders = getColliders(map);
  const h = map.half;
  const clear = (x: number, z: number) =>
    Math.abs(x) < h - WALL_MARGIN &&
    Math.abs(z) < h - WALL_MARGIN &&
    !colliders.some(
      (c) =>
        c.max[1] > 0.05 &&
        c.min[1] < CLEAR_HEIGHT &&
        c.max[0] > x - CLEAR_HALF &&
        c.min[0] < x + CLEAR_HALF &&
        c.max[2] > z - CLEAR_HALF &&
        c.min[2] < z + CLEAR_HALF,
    );
  // Rings of growing radius around a point, nearest first
  const around = function* (cx: number, cz: number) {
    yield [cx, cz] as const;
    for (let r = SEARCH_STEP; r <= h * SEARCH_RADIUS; r += SEARCH_STEP) {
      const n = Math.ceil((2 * Math.PI * r) / SEARCH_STEP);
      for (let i = 0; i < n; i++)
        yield [cx + r * Math.cos((i / n) * 2 * Math.PI), cz + r * Math.sin((i / n) * 2 * Math.PI)] as const;
    }
  };
  let a: Vec3 = [-SIDE_ZONE_X * h, 0, 0];
  for (const [x, z] of around(-SIDE_ZONE_X * h, 0)) {
    if (x < -CLEAR_HALF && clear(x, z) && clear(-x, z)) {
      a = [x, 0, z];
      break;
    }
  }
  let b: Vec3 = [0, 0, 0];
  for (let k = 0; k <= h * SEARCH_RADIUS * 2; k += SEARCH_STEP) {
    const z = [k, -k].find((zz) => clear(0, zz));
    if (z !== undefined) {
      b = [0, 0, z];
      break;
    }
  }
  const zones: Vec3[] = [a, b, [-a[0], 0, a[2]]];
  cache.set(map, zones);
  return zones;
}
