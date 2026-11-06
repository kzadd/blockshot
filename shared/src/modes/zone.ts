// Shrinking zone (Supervivencia, Último en pie, Por equipos): the map stays open for a while, then a circle closes
// on a centre picked at random on open ground near the middle of the map; outside it you lose health, faster and
// faster. Por equipos runs it in cycles (it opens again on a new centre) and respawns inside it while it is closed.
import type { Vec3 } from '../core/math';
import type { GameMap } from '../maps/types';
import { openGround } from './domination';
import type { ModeId } from './modes';

export interface ZonePlan {
  /** ms with the whole map open */
  openMs: number;
  /** ms the circle takes to close down to `minR` */
  shrinkMs: number;
  /** smallest radius (m) */
  minR: number;
  /** cycles (respawn modes): ms it stays closed before opening again on a new centre */
  closedMs?: number;
}

export const ZONE_PLANS: Partial<Record<ModeId, ZonePlan>> = {
  // A round lasts ROUNDS.roundMs (2 min): 45 s open, 1 min closing, the last 15 s at 10 m
  rounds: { openMs: 45000, shrinkMs: 60000, minR: 10 },
  lms: { openMs: 45000, shrinkMs: 60000, minR: 10 },
  teams: { openMs: 60000, shrinkMs: 40000, minR: 15, closedMs: 30000 },
};

/** Health lost per second outside: first half of the closing, second half, closed. */
export const ZONE_DPS = [5, 10, 20] as const;
/** The «closing in 10 s» warning, this long before it starts. */
export const ZONE_WARN_MS = 10000;

/** Zone state `elapsed` ms after it was set up: radius, damage outside (0 while open) and whether it is open. */
export function zoneAt(plan: ZonePlan, elapsed: number, fullR: number): { r: number; dps: number; open: boolean } {
  const t = elapsed - plan.openMs;
  if (t < 0) return { r: fullR, dps: 0, open: true };
  const k = Math.min(1, t / plan.shrinkMs);
  return { r: fullR + (plan.minR - fullR) * k, dps: ZONE_DPS[k < 0.5 ? 0 : k < 1 ? 1 : 2], open: false };
}

/** A whole cycle (respawn modes): open, closing, closed. */
export const zoneCycleMs = (plan: ZonePlan): number => plan.openMs + plan.shrinkMs + (plan.closedMs ?? 0);

/** Radius that covers the whole map from (x, z): the far corner. */
export const fullZoneRadius = (map: GameMap, x: number, z: number): number =>
  Math.hypot(map.half + Math.abs(x), map.half + Math.abs(z));

const groundCache = new WeakMap<GameMap, Vec3[]>();

/**
 * Open ground near the middle of the map (the zone centres to pick from, and where to respawn inside a closed
 * zone): standing room with nothing overhead, never on a roof or inside a wall.
 */
export function zoneGround(map: GameMap): Vec3[] {
  const known = groundCache.get(map);
  if (known) return known;
  const { ground, clear, around } = openGround(map);
  const spots: Vec3[] = [];
  for (const [x, z] of around(0, 0)) if (clear(x, z)) spots.push([x, ground(x, z), z]);
  if (!spots.length) spots.push([0, ground(0, 0), 0]);
  groundCache.set(map, spots);
  return spots;
}
