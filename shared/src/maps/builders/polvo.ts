import { BARREL, TREE, pad, sandbags } from '../props';
import { facade, house, mirrorHouse, type HouseSpec } from '../structures';
import type { BoxKind, MapBuildContext } from '../types';

/** Common look of the adobe houses. */
const ADOBE = {
  stories: 2,
  wall: 'plaster',
  ground: 'tile',
  awning: 'awning',
  parapet: true,
} as const satisfies Partial<HouseSpec>;

// Polvo: desert town with three routes (tunnel, mid and long hall) and two bomb sites in the north.
// Coordinates are designed for the medium size (80 m) and scaled for the others.
export function buildPolvo(ctx: MapBuildContext): void {
  const { B, D, S, P, H, BR, BK, PK, LD } = ctx;
  const k = H / 40;
  // Rectangle [x1,x2] × [z1,z2] of height h, resting on y
  const R = (x1: number, x2: number, z1: number, z2: number, h: number, c: BoxKind = 'wall2', y = 0) =>
    B(((x1 + x2) / 2) * k, y, ((z1 + z2) / 2) * k, (x2 - x1) * k, h, (z2 - z1) * k, c);
  // Adobe house over the rectangle [x1,x2] × [z1,z2]; `spec` places the openings knowing the real size
  const RH = (x1: number, x2: number, z1: number, z2: number, spec: (w: number, d: number) => Partial<HouseSpec>) => {
    const w = (x2 - x1) * k;
    const d = (z2 - z1) * k;
    const box = { x: ((x1 + x2) / 2) * k, z: ((z1 + z2) / 2) * k, w, d };
    return { ...ADOBE, ...box, ...spec(w, d) };
  };
  // Houses: the corridors are left between them. Most can be entered: they open side routes and
  // first-floor windows over the streets, but keep their old silhouette (roof + parapet = 7 m)
  house(
    ctx,
    RH(-22, -6, -12, -2, (w, d) => ({
      doors: [
        { side: 'e', at: 0.2 * d },
        { side: 'w', at: -0.2 * d },
        { side: 's', at: -0.25 * w },
      ],
      windows: [
        { side: 'e', at: -0.25 * d },
        { side: 'n', at: 0.25 * w, story: 1 },
        { side: 'n', at: -0.25 * w, story: 1 },
        { side: 'e', at: 0.25 * d, story: 1 },
        { side: 'w', at: 0.2 * d, story: 1 },
        { side: 's', at: 0.25 * w, story: 1 },
      ],
      stairs: [{ side: 'n', at: 0.15 * w, dir: -1 }],
    })),
  );
  // Solid blocks: closed shutters and a cornice
  const RF = (x1: number, x2: number, z1: number, z2: number, h: number, c: BoxKind = 'wall2') => {
    R(x1, x2, z1, z2, h, c);
    facade(ctx.D, ((x1 + x2) / 2) * k, ((z1 + z2) / 2) * k, (x2 - x1) * k, (z2 - z1) * k, h, 'shutter');
  };
  RF(-22, -6, 2, 12, 7);
  RF(6, 22, -12, -8, 7);
  const houseD = RH(6, 22, -4, 12, (w, d) => ({
    doors: [
      { side: 'w', at: -0.25 * d },
      { side: 'e', at: 0.25 * d },
      { side: 's', at: 0 },
    ],
    windows: [
      { side: 'e', at: -0.25 * d },
      { side: 'w', at: 0.25 * d },
      { side: 'w', at: -0.25 * d, story: 1 },
      { side: 'w', at: 0.25 * d, story: 1 },
      { side: 'n', at: -0.25 * w, story: 1 },
      { side: 'e', at: 0.25 * d, story: 1 },
      { side: 's', at: 0.25 * w, story: 1 },
      { side: 's', at: -0.25 * w, story: 1 },
    ],
    partitions: [{ run: 'x', at: 0, door: -0.25 * w }],
    stairs: [{ side: 'n', at: 0.3 * w, dir: -1 }],
  }));
  house(ctx, houseD);
  B(houseD.x - 0.2 * houseD.w, 0, houseD.z + 0.25 * houseD.d, 1.4, 1.2, 1.4, 'crate');
  // The two houses by the south spawn have a hatch up to a roof terrace
  const houseE = RH(-22, -6, 18, 28, (w, d) => ({
    doors: [
      { side: 's', at: -0.2 * w },
      { side: 'n', at: 0.2 * w },
    ],
    windows: [
      { side: 's', at: 0.2 * w },
      { side: 'n', at: -0.2 * w },
      { side: 'n', at: 0.25 * w, story: 1 },
      { side: 'n', at: -0.25 * w, story: 1 },
      { side: 's', at: 0.25 * w, story: 1 },
      { side: 's', at: -0.25 * w, story: 1 },
      { side: 'w', at: 0, story: 1 },
    ],
    stairs: [
      { side: 'w', at: 0.35 * d, dir: -1 },
      { side: 'e', at: -0.35 * d, dir: 1, story: 1 },
    ],
  }));
  house(ctx, houseE);
  house(ctx, mirrorHouse({ ...houseE, x: -houseE.x }, -1, 1));
  RF(30, 40, -10, 26, 8, 'wall');
  RF(-40, -30, -10, 26, 8, 'wall');
  // Low house between the sites, with outside stairs to its roof
  house(
    ctx,
    RH(-8, 8, -30, -24, (w) => ({
      stories: 1,
      doors: [
        { side: 'n', at: 0.25 * w },
        { side: 's', at: -0.3 * w },
        { side: 's', at: 0.3 * w },
      ],
      windows: [{ side: 'e' }, { side: 'w' }],
      outside: { side: 'n', at: -0.45 * w, dir: 1 },
    })),
  );
  // Mid and long hall doors, with lintel
  R(-14, -2, -17, -15, 5);
  R(2, 14, -17, -15, 5);
  R(-2, 2, -17, -15, 1, 'wall2', 4);
  R(22, 26, 13, 15, 7);
  R(26, 30, 13, 15, 2.4, 'wall2', 4.6);
  // B tunnel and covered connector from mid to B
  R(-30, -22, 2, 22, 1, 'roof', 3.4);
  R(-22, -6, -2, 2, 1, 'roof', 3.6);
  // Site A: platform with steps
  R(24, 36, -34, -24, 1, 'platform');
  R(22, 24, -32, -26, 0.5, 'step');
  R(27, 33, -24, -22, 0.5, 'step');
  R(28, 30.4, -31, -28.6, 2.4, 'crate2', 1);
  R(32, 34.4, -28, -25.6, 1.2, 'crate', 1);
  // Site B
  R(-36, -24, -34, -26, 0.5, 'platform');
  R(-31, -28.6, -31, -28.6, 2.4, 'crate2', 0.5);
  R(-27, -24.6, -34, -31.6, 1.2, 'crate', 0.5);
  R(-35, -33.4, -26, -24.4, 1.6, 'crate');
  // Cover along the routes
  R(-1, 1, -7, -5, 2, 'crate');
  R(-2.6, -1.4, 5.4, 6.6, 1.2, 'crate');
  R(25, 26.6, -1, 0.6, 1.2, 'crate');
  R(-11, -9, 32, 34, 1.2, 'crate');
  R(9, 11, 32, 34, 1.2, 'crate2');
  R(-19, -17, -18, -16, 1.2, 'crate');
  R(-13, -11, -35, -33, 1.2, 'crate');
  R(11, 13, -35, -33, 1.2, 'crate2');
  // Decoration
  for (const s of [1, -1]) {
    P(s * 3 * k, 30 * k, TREE);
    P(s * 30 * k, -36 * k, sandbags(3, 1));
    P(s * 26 * k, 28 * k, BARREL);
    P(s * 26.9 * k, 28.6 * k, BARREL);
    P(s * 4 * k, -20 * k, BARREL);
    P(s * 18 * k, 16 * k, BARREL);
  }
  P(-26 * k, -12 * k, BARREL);
  // Jump pads in mid: to peek over the houses
  pad(B, 0, 20 * k);
  pad(B, 0, -20 * k);

  // Market street between the two yards: stalls with striped awnings (cover with a roof), armour in the middle
  for (const x of [-18, -8, 8, 18]) {
    B(x * k, 0, -21 * k, 3, 1.1, 0.8, 'wood');
    for (const px of [-1.6, 1.6]) for (const pz of [-1.1, 1.1]) B(x * k + px, 0, -21 * k + pz, 0.15, 2.6, 0.15, 'wood');
    D(x * k, 2.6, -21 * k, 3.6, 0.15, 2.6, 'awning');
  }
  PK('armor', 0, -22.5 * k);
  // A well and two carts in the middle cut the long line north
  B(0, 0, 26 * k, 2.4, 1, 2.4, 'concrete');
  for (const s of [1, -1]) B(s * 12 * k, 0, 22 * k, 2.6, 1.3, 1.6, 'wood');
  // Planks from roof to roof over the middle (resting on the parapets) and ladders up the two north houses
  B(0, 7.1, -3 * k, 12 * k + 0.6, 0.2, 1.6, 'bridge');
  for (const s of [1, -1]) LD(s * 12 * k, 18 * k, 7.3, 2);
  // Health in the tunnel, explosive barrels at both sites, crates that break in the middle
  PK('hp', -26 * k, 12 * k);
  BR(34 * k, -21 * k);
  BR(-30 * k, -23 * k);
  BK(4 * k, 3 * k, 1.3);
  BK(-5 * k, -2 * k, 1.3);
  P(27 * k, -15 * k, sandbags(1, 3));

  const spawns = [
    [0, 35],
    [-8, 36],
    [8, 36],
    [-16, 35],
    [16, 35],
    [0, -36],
    [-10, -37],
    [10, -37],
    [-35, 32],
    [35, 32],
    [-35, -14],
    [35, -14],
    [26, 20],
    [-26, 20],
  ] as const;
  for (const [x, z] of spawns) S(x * k, z * k);
}
