import { BARREL, CACTUS, pad, sandbags, stairs } from '../props';
import { house, mirrorHouse, type HouseSpec } from '../structures';
import type { MapBuildContext } from '../types';

const MESA_H = 4;
/** Gallery under each mesa's edge: depth into the mesa and its height (m). */
const GALLERY = 3;
const GALLERY_H = 2.7;
/** Outposts along each mesa, as fractions of H (mirrored on the other mesa). */
const OUTPOSTS = [-0.45, 0.1, 0.6];
/** Narrow firing slits. */
const SLIT = { w: 1.6, sill: 1.25, top: 1.75 };
const TOWER: HouseSpec = {
  x: 0,
  z: 0,
  w: 6,
  d: 6,
  stories: 2,
  wall: 'plaster',
  ground: 'wood',
  doors: [{ side: 'n' }, { side: 's' }],
  windows: [
    { side: 'w', ...SLIT },
    { side: 'e', at: 1, ...SLIT },
    { side: 'n', story: 1 },
    { side: 's', story: 1 },
    { side: 'e', at: -1.2, story: 1 },
    { side: 'w', at: 1.2, story: 1 },
  ],
  stairs: [
    { side: 'e', at: -2.3, dir: 1 },
    { side: 'w', at: 2.3, dir: -1, story: 1 },
  ],
};

// Desfiladero: a canyon between two high mesas joined by bridges
export function buildDesfiladero(ctx: MapBuildContext): void {
  const { B, S, P: Prop, H, BR, BK, PK, ZL, rand } = ctx;
  const P = Math.max(10, Math.round(0.32 * H)); // the canyon spans -P..P
  const outpost: HouseSpec = {
    x: 0,
    z: 0,
    y: MESA_H,
    w: H < 30 ? 6 : 7,
    d: 6,
    wall: 'concrete',
    ground: 'concrete',
    doors: [
      { side: 'w', at: 1.2 },
      { side: 'e', at: -1.2 },
    ],
    windows: [
      { side: 'w', at: -1.4, ...SLIT },
      { side: 'n', at: 0, ...SLIT },
      { side: 'e', at: 1.4, ...SLIT },
    ],
    outside: { side: 's', at: -(H < 30 ? 6 : 7) / 2 + 0.2, dir: 1 },
  };
  const bridges = [0, 0.5 * H, -0.5 * H];
  for (const s of [1, -1]) {
    // The mesa, with a gallery cut under its edge (a covered way along the canyon, roofed and on pillars)
    const g0 = s > 0 ? -0.45 * H : 0.05 * H;
    const g1 = s > 0 ? -0.05 * H : 0.45 * H;
    const inner = s * (P + GALLERY / 2);
    B(s * (P + GALLERY + (H - P - GALLERY) / 2), 0, 0, H - P - GALLERY, MESA_H, 2 * H, 'platform');
    B(inner, 0, (-H + g0) / 2, GALLERY, MESA_H, g0 + H, 'platform');
    B(inner, 0, (g1 + H) / 2, GALLERY, MESA_H, H - g1, 'platform');
    B(inner, GALLERY_H, (g0 + g1) / 2, GALLERY, MESA_H - GALLERY_H, g1 - g0, 'platform');
    for (let z = g0 + 5; z < g1 - 2; z += 7) B(s * (P + 0.4), 0, z, 0.7, GALLERY_H, 0.7, 'wall2');
    PK('hp', s * (P + GALLERY - 0.9), (g0 + g1) / 2);
    const ups = [s * 0.25 * H, -s * 0.7 * H];
    for (const z of ups) stairs(B, s * P, z, 'x', s, 8, 3);

    // Low walls at the mesa edge, without blocking stairs or bridges
    const keep = [...ups, ...bridges];
    for (let z = -H + 5; z < H - 4; z += 10) {
      if (keep.some((q) => Math.abs(q - z) < 6)) continue;
      B(s * (P + 1), 4, z, 0.8, 1.2, 5, 'wall2');
    }
    // Concrete outposts on the mesas: slit windows, a door front and back, stairs up to a roof nest
    for (const z of OUTPOSTS) {
      const x = s * (P + 0.55 * (H - P));
      house(ctx, mirrorHouse({ ...outpost, x, z: s * z * H }, s, s));
      B(x - s * (outpost.w / 2 + 1.2), MESA_H, s * z * H - s * 1.8, 1.6, 1.2, 1.6, 'crate');
    }
  }
  for (const z of bridges) B(0, 3.4, z, 2 * P, 0.6, 4, 'bridge');
  // Two watchtowers on the canyon floor, between the bridges: stairs inside, a hatch to the roof
  for (const s of [1, -1]) house(ctx, mirrorHouse({ ...TOWER, z: s * 0.25 * H }, s, s));
  // Jump pads at the foot of each mesa (opposite side to the stairs)
  for (const s of [1, -1]) pad(B, s * (P - 2), -s * 0.25 * H);

  // Sandbags at the bridge entrances, cacti and barrels
  for (const s of [1, -1]) {
    for (const z of bridges) Prop(s * (P + 2.6), z + 3.2, sandbags(1, 2));
    for (const z of OUTPOSTS) {
      const cx = s * (P + 0.55 * (H - P));
      Prop(cx + s * (outpost.w / 2 + 0.8), s * z * H + s * 1.4, BARREL);
      Prop(cx + s * (outpost.w / 2 + 0.8), s * z * H + s * 2.4, BARREL);
    }
    for (let i = 0; i < Math.round(H / 6); i++) {
      Prop(s * (P + 2 + rand() * (H - P - 4)), (rand() * 2 - 1) * (H - 3), CACTUS);
    }
  }
  for (let i = 0; i < Math.round(H / 10); i++) Prop((rand() * 2 - 1) * (P - 2), (rand() * 2 - 1) * (H - 4), CACTUS);

  // Rocks on the canyon floor (away from the foot of the stairs and the spawns)
  const avoid = [0.25, 0.7, 0.45, 0.85].flatMap((f) => [f * H, -f * H]);
  for (let z = -H + 7; z < H - 6; z += 8) {
    if (avoid.some((q) => Math.abs(q - z) < 4)) continue;
    const sx = rand() < 0.5 ? 1 : -1;
    const w = 1.8 + rand() * 1.4;
    B(sx * (0.25 + rand() * 0.25) * P, 0, z, w, 1.2 + rand() * 0.9, w, 'rock');
  }

  // The canyon floor: an overturned truck and sandbag lines to cross it in hops, barrels and a crate that breaks,
  // the armour right under the middle bridge; a zipline from each mesa down into the canyon
  PK('armor', 0, 0);
  for (const s of [1, -1]) {
    B(-s * 0.3 * P, 0, s * 0.38 * H, 2.4, 2.2, 5.5, 'metal');
    B(-s * 0.3 * P, 0, s * (0.38 * H + 3.6), 2.4, 1.6, 1.8, 'metal');
    Prop(s * 0.2 * P, s * 0.66 * H, sandbags(4, 1));
    Prop(-s * 0.45 * P, -s * 0.12 * H, sandbags(1, 3));
    BR(s * 0.6 * P, s * 0.12 * H);
    BK(s * 0.4 * P, -s * 0.18 * H, 1.4);
    ZL([s * (P + 0.3), MESA_H + 2.3 + 0.4, s * 0.6 * H], [s * 0.15 * P, 2.3, s * 0.8 * H]);
  }

  for (const s of [1, -1]) {
    S(0, s * (H - 3));
    S(s * (H - 3), 0);
    S(s * (H - 3), 0.6 * H);
    S(s * (H - 3), -0.6 * H);
    S(-s * 0.5 * P, s * 0.45 * H);
    S(s * 0.5 * P, -s * 0.85 * H);
  }
}
