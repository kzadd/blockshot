// Moving obstacles of the race course, as a pure function of the (server) time, so the server and every client
// agree where they are. They are not colliders: whoever they touch is knocked back (the server does it, the
// client gets it back in its movement ack).
import type { MapHazard } from './types';

/** Sweeper bar height above its floor and thickness; hammer swing (rad) and head half size; pusher block; knock. */
export const HAZARD = {
  sweepH: 0.55,
  sweepR: 0.35,
  swing: 1.15,
  head: 0.9,
  pushW: 1.6,
  pushH: 1.8,
  pushD: 3,
  /** horizontal speed and lift given to a player hit (m/s), and the time before the same one hits again (ms) */
  knock: 15,
  lift: 6,
  againMs: 600,
} as const;

const TAU = Math.PI * 2;
const cycle = (h: MapHazard, t: number) => (((t / h.period + h.phase) % 1) + 1) % 1;

/** Angle of a sweeper's bar (rad) at time t (ms). */
export const sweeperAngle = (h: MapHazard, t: number) => cycle(h, t) * TAU;
/** Swing of a hammer from straight down (rad), along z. */
export const hammerAngle = (h: MapHazard, t: number) => Math.sin(cycle(h, t) * TAU) * HAZARD.swing;
/** How far a pusher is out over the track (0 in its slot at the side … 1 fully out). */
export const pusherOut = (h: MapHazard, t: number) => 0.5 - 0.5 * Math.cos(cycle(h, t) * TAU);

/** Where a hammer's head is at time t: [x, y, z] (the pivot is `len` over y). */
export function hammerHead(h: MapHazard, t: number): [number, number, number] {
  const a = hammerAngle(h, t);
  return [h.x, h.y + h.len - Math.cos(a) * h.len, h.z + Math.sin(a) * h.len];
}
/** Centre of a pusher block at time t: [x, y, z] (it slides along z from the side of the track). */
export function pusherAt(h: MapHazard, t: number): [number, number, number] {
  const side = h.side ?? 1;
  return [h.x, h.y + HAZARD.pushH / 2, h.z + side * (h.len + HAZARD.pushD / 2 - pusherOut(h, t) * h.len)];
}

/**
 * Does the hazard touch a body standing at (x, y, z) at time t (radius r, height hgt)? If so, the way it knocks the
 * body (unit x, z).
 */
export function hazardHit(
  h: MapHazard,
  t: number,
  x: number,
  y: number,
  z: number,
  r: number,
  hgt: number,
): [number, number] | null {
  if (h.k === 'sweeper') {
    const barY = h.y + HAZARD.sweepH;
    if (y > barY + HAZARD.sweepR || y + hgt < barY - HAZARD.sweepR) return null;
    const a = sweeperAngle(h, t);
    const ux = Math.cos(a);
    const uz = Math.sin(a);
    const dx = x - h.x;
    const dz = z - h.z;
    const along = dx * ux + dz * uz;
    if (Math.abs(along) > h.len) return null;
    if (Math.abs(-dx * uz + dz * ux) > r + HAZARD.sweepR) return null;
    // The bar turns towards +angle: it pushes the body round, along its tangent
    const s = Math.sign(along) || 1;
    return [-uz * s, ux * s];
  }
  if (h.k === 'hammer') {
    const [hx, hy, hz] = hammerHead(h, t);
    if (Math.abs(x - hx) > r + HAZARD.head || Math.abs(z - hz) > r + HAZARD.head) return null;
    if (y > hy + HAZARD.head || y + hgt < hy - HAZARD.head) return null;
    // Knocked the way the head is swinging
    return [0, Math.cos(cycle(h, t) * TAU) >= 0 ? 1 : -1];
  }
  const [px, py, pz] = pusherAt(h, t);
  if (Math.abs(x - px) > r + HAZARD.pushW / 2 || Math.abs(z - pz) > r + HAZARD.pushD / 2) return null;
  if (y > py + HAZARD.pushH / 2 || y + hgt < py - HAZARD.pushH / 2) return null;
  return [0, -(h.side ?? 1)];
}
