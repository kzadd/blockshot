// Pieces shared by the obstacle courses of the Carrera mode (Verbena, Tarta): slabs on decor columns over the
// floor, solid blocks, checkpoint slabs and the arches over the track.
import type { BoxKind, MapBuildContext } from '../types';

const SLAB = 0.6;
/** Dropping tiles: side, and side plus the gap between two. */
export const TILE_S = 1.8;
export const TILE_PITCH = TILE_S + 0.25;

export function course({ B, D, CP }: MapBuildContext) {
  /** Columns under a slab, so nothing floats (decor, never collide). */
  const pillars = (x0: number, x1: number, z0: number, z1: number, top: number) => {
    const alongX = x1 - x0 >= z1 - z0;
    const n = Math.max(1, Math.round((alongX ? x1 - x0 : z1 - z0) / 8));
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      D(
        alongX ? x0 + t * (x1 - x0) : (x0 + x1) / 2,
        0,
        alongX ? (z0 + z1) / 2 : z0 + t * (z1 - z0),
        0.9,
        top,
        0.9,
        'wall',
      );
    }
  };
  /** A slab from x0 to x1 and z0 to z1, its top at y. */
  const plat = (x0: number, x1: number, z0: number, z1: number, y: number, c: BoxKind = 'platform') => {
    B((x0 + x1) / 2, y - SLAB, (z0 + z1) / 2, x1 - x0, SLAB, z1 - z0, c);
    pillars(x0, x1, z0, z1, y - SLAB);
  };
  /** A solid block standing on the floor, its top at y. */
  const block = (x0: number, x1: number, z0: number, z1: number, y: number, c: BoxKind = 'wall') =>
    B((x0 + x1) / 2, 0, (z0 + z1) / 2, x1 - x0, y, z1 - z0, c);
  /** A checkpoint slab (or solid block): all of it counts (in order; the last one is the finish). */
  const checkpoint = (x0: number, x1: number, z0: number, z1: number, y: number, solid = false) => {
    (solid ? block : plat)(x0, x1, z0, z1, y, 'step');
    CP((x0 + x1) / 2, y, (z0 + z1) / 2, x1 - x0, z1 - z0);
  };
  /** An arch over the track at (x, z) (decor): two posts `span` apart and a banner; `alongX` = the track runs along x. */
  const arch = (x: number, z: number, y: number, span: number, alongX: boolean) => {
    for (const s of [-1, 1])
      D(alongX ? x : x + (s * span) / 2, y, alongX ? z + (s * span) / 2 : z, 0.5, 4, 0.5, 'metal');
    D(x, y + 4, z, alongX ? 0.5 : span + 0.5, 0.8, alongX ? span + 0.5 : 0.5, 'awning');
  };
  /** The frame a hammer hangs from, over a track along x (decor). */
  const gallows = (x: number, z: number, y: number) => {
    for (const s of [-1, 1]) B(x, 0, z + s * 6, 0.4, y + 6.6, 0.4, 'metal');
    D(x, y + 6.6, z, 0.4, 0.4, 12.4, 'metal');
  };
  /** The housing a pusher slides out of, on side `side` of a track along x at z. */
  const housing = (x: number, z: number, y: number, side: number) =>
    B(x, y - SLAB, z + side * 4.2, 2.2, 2.4 + SLAB, 1.4, 'metal');
  return { plat, block, checkpoint, arch, gallows, housing };
}
