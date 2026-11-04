import { BARREL, LAMP, PALLET, TREE } from '../props';
import { flight, house, mirrorHouse, type HouseSpec } from '../structures';
import type { BoxKind, MapBuildContext, MapLadder } from '../types';

/** Ground levels: the quay and the market (0), the middle terraces and the high town with the church. */
const L1 = 1.5;
const L2 = 4.5;
/** Azoteas: two-story houses on the middle terraces and one-story houses up high all have their roof here. */
const ROOF = 7.5;
/** Arches over the lanes: solid plaster bridges between roofs, this thick under the roof level. */
const ARCH_T = 0.6;
/** The sea wall runs along this z; the water and the boats are beyond it. */
const SEA_Z = 33.7;

/** Common look of the whitewashed houses. */
const WHITE = {
  wall: 'plaster',
  ground: 'tile',
  roof: 'slab',
  shutter: 'shutter',
  awning: 'awning',
  parapet: false,
} as const satisfies Partial<HouseSpec>;

// Pueblo: a whitewashed village climbing from a quay on the sea (south, +z) to a church square (north, -z).
// The quay (0 m) and the market square in the middle (0 m) are the low ground; the middle terraces (1.5 m) hold
// two-story houses on a street across the map, and the high town (4.5 m) has one-story houses and the church. Every
// house roof (azotea) is at 7.5 m, joined by arches over the lanes, and the church's first floor joins both sides
// by two arches: the high route. Three lanes: the quay, the street through the market, the lane behind the church.
// Everything east (+x) is mirrored west.
export function buildPueblo(ctx: MapBuildContext): void {
  const { B, D, S, P, BR, BK, PK, LD, ZL, PW } = ctx;
  /** Box on both sides (once when it sits on the axis). */
  const M = (x: number, y: number, z: number, w: number, h: number, d: number, c: BoxKind) => {
    B(x, y, z, w, h, d, c);
    if (x !== 0) B(-x, y, z, w, h, d, c);
  };
  const MD = (x: number, y: number, z: number, w: number, h: number, d: number, c: BoxKind) => {
    D(x, y, z, w, h, d, c);
    if (x !== 0) D(-x, y, z, w, h, d, c);
  };
  const MS = (x: number, z: number) => (S(x, z), S(-x, z));
  const MP = (x: number, z: number, parts: Parameters<typeof P>[2]) => (P(x, z, parts), P(-x, z, parts));
  const ML = (x: number, z: number, y1: number, dir: MapLadder['dir']) => {
    LD(x, z, y1, dir);
    LD(-x, z, y1, dir === 1 ? 3 : dir === 3 ? 1 : dir);
  };
  /** A flight along x on both sides (climbing away from / towards the axis as on the east). */
  const flightX = (start: number, dir: 1 | -1, z0: number, z1: number, y0: number, steps: number) => {
    flight(B, 'x', start, dir, z0, z1, y0, steps);
    flight(B, 'x', -start, -dir as 1 | -1, z0, z1, y0, steps);
  };
  const flightZ = (start: number, dir: 1 | -1, x0: number, x1: number, y0: number, steps: number) => {
    flight(B, 'z', start, dir, x0, x1, y0, steps);
    flight(B, 'z', start, dir, -x1, -x0, y0, steps);
  };
  /** A house written for the east side, and its mirror in the west. */
  const twin = (h: HouseSpec) => {
    house(ctx, h);
    house(ctx, mirrorHouse({ ...h, x: -h.x }, -1, 1));
  };

  // ---------------------------------------------------------------- Ground: terraces, stairs, sea
  M(26, 0, 4.5, 28, L1, 29, 'platform'); // middle terraces: x 12..40, z -10..19
  B(0, 0, -25, 80, L2, 30, 'platform'); // high town: z -40..-10
  // The great stair from the market up to the church square
  flight(B, 'z', -10 + 9 * 0.6, -1, -4, 4, 0, 9);
  MD(4.25, 0, -7.3, 0.5, 4.6, 5.6, 'trim'); // its white side walls (low, decoration)
  // Market up to the terrace street, and a second flight further south
  flightX(12 - 3 * 0.6, 1, 1.5, 6, 0, 3);
  flightX(12 - 3 * 0.6, 1, 14, 17.5, 0, 3);
  // Terrace street up to the high town (east end) and the patio down to the quay
  flightZ(-10 + 6 * 0.6, -1, 35.6, 38.8, L1, 6);
  flightZ(19 + 3 * 0.6, -1, 23.8, 27.2, 0, 3);
  flightZ(19 + 3 * 0.6, -1, 36.8, 39.6, 0, 3);
  // Sea wall (a gap for each jetty), the water, jetties and boats
  for (const [a, b] of [
    [0, 20.5],
    [23.5, 40],
  ] as const)
    M((a + b) / 2, 0, SEA_Z, b - a, 1, 0.6, 'quay');
  D(0, 0, 37, 80, 0.3, 6.6, 'water');
  M(22, 0, 37, 3, 0.45, 6, 'deck');
  for (const [x, z, w, d] of [
    [10, 37.2, 5.5, 2.2],
    [31, 36.6, 6.5, 2.4],
  ] as const) {
    M(x, 0, z, w, 1.1, d, 'hull');
    M(x + 0.6, 1.1, z, w * 0.35, 0.9, d * 0.7, 'deck'); // cabin
  }

  // ---------------------------------------------------------------- Middle terraces (1.5 m)
  // A and B: two-story houses north of the street, a 2.2 m alley between them (wall jumps to the roofs)
  twin({
    ...WHITE,
    x: 18.5,
    z: -4.5,
    w: 9,
    d: 9,
    y: L1,
    stories: 2,
    doors: [
      { side: 's', at: 1.5 },
      { side: 'w', at: 1.5 },
    ],
    windows: [
      { side: 's', at: -2.5 },
      { side: 'w', at: -2.5 },
      { side: 'w', at: 1.5, story: 1 },
      { side: 's', at: 0, story: 1 },
      { side: 'n', at: 0, story: 1 },
    ],
    stairs: [
      { side: 'n', at: -3.7, dir: 1 },
      { side: 'e', at: -3.4, dir: 1, story: 1 },
    ],
  });
  twin({
    ...WHITE,
    x: 29.6,
    z: -4.5,
    w: 8.8,
    d: 9,
    y: L1,
    stories: 2,
    doors: [
      { side: 's', at: -1 },
      { side: 'e', at: 1.5 },
    ],
    windows: [
      { side: 's', at: 2.5 },
      { side: 'e', at: -2, story: 1 },
      { side: 's', at: -1, story: 1 },
    ],
    stairs: [
      { side: 'n', at: 3.7, dir: -1 },
      { side: 'w', at: -3.4, dir: 1, story: 1 },
    ],
  });
  // C: two stories south of the street, outside stairs on its south face up to the azotea
  twin({
    ...WHITE,
    x: 18.5,
    z: 11,
    w: 9,
    d: 8,
    y: L1,
    stories: 2,
    doors: [
      { side: 'n', at: 1.5 },
      { side: 'e', at: 0 },
    ],
    windows: [
      { side: 'w', at: 0 },
      { side: 'n', at: -2.5 },
      { side: 'w', at: 0, story: 1 },
      { side: 'n', at: 0, story: 1 },
      { side: 's', at: 2, story: 1 },
    ],
    outside: { side: 's', at: -4.4, dir: 1 },
  });
  // D: one story by the quay, a ladder up to its low azotea (a perch over the boats)
  twin({
    ...WHITE,
    x: 31.75,
    z: 12,
    w: 8.5,
    d: 8,
    y: L1,
    doors: [
      { side: 'w', at: 0 },
      { side: 'n', at: 2 },
    ],
    windows: [
      { side: 's', at: -1.5 },
      { side: 's', at: 2 },
      { side: 'e', at: 0 },
    ],
  });
  ML(30, 8, L1 + 3, 2);
  // Arch over the street from C's azotea to A's
  M(16, ROOF - 3.2, 3.5, 2.4, 3.2, 7, 'plaster');
  // Patio between C and D: planters
  MP(25.5, 9.5, TREE);

  // ---------------------------------------------------------------- High town (4.5 m)
  // G and F: one-story houses at the back with an alley between them; H in front, joined to G and to A by arches
  twin({
    ...WHITE,
    x: 17.5,
    z: -29.5,
    w: 9,
    d: 9,
    y: L2,
    doors: [
      { side: 's', at: -2 },
      { side: 'w', at: -2.5 },
      { side: 'n', at: 2 },
    ],
    windows: [
      { side: 'w', at: 1.5 },
      { side: 's', at: 2 },
      { side: 'e', at: 0 },
    ],
    stairs: [{ side: 'n', at: -3.4, dir: 1 }],
  });
  twin({
    ...WHITE,
    x: 28.6,
    z: -29.5,
    w: 8.8,
    d: 9,
    y: L2,
    doors: [
      { side: 's', at: 1 },
      { side: 'e', at: -2 },
    ],
    windows: [
      { side: 's', at: -2.5 },
      { side: 'n', at: 0 },
      { side: 'e', at: 2 },
    ],
  });
  twin({
    ...WHITE,
    x: 23,
    z: -17,
    w: 10,
    d: 8,
    y: L2,
    doors: [
      { side: 'w', at: 0 },
      { side: 'n', at: -2 },
    ],
    windows: [
      { side: 's', at: -2 },
      { side: 's', at: 2.5 },
      { side: 'n', at: 2.5 },
    ],
    outside: { side: 'e', at: -3.6, dir: 1 },
  });
  M(20, ROOF - ARCH_T, -23, 2.2, ARCH_T, 4, 'plaster'); // G - H
  M(20, ROOF - ARCH_T, -11, 2.2, ARCH_T, 4, 'plaster'); // H - A
  M(10.5, ROOF - ARCH_T, -29.5, 5, ARCH_T, 2.2, 'plaster'); // church - G

  // The church on top: two doors at the front, side doors, a first floor open to both arches, a bell tower on the
  // roof with a ladder to its top and a cable down to the market
  house(ctx, {
    ...WHITE,
    x: 0,
    z: -31,
    w: 16,
    d: 14,
    y: L2,
    stories: 2,
    awning: undefined,
    parapet: true,
    doors: [
      { side: 's', at: -3, w: 2 },
      { side: 's', at: 3, w: 2 },
      { side: 'e', at: -4 },
      { side: 'w', at: -4 },
      { side: 'e', at: 1.5, story: 1 },
      { side: 'w', at: 1.5, story: 1 },
    ],
    windows: [
      { side: 'e', at: 3 },
      { side: 'w', at: 3 },
      { side: 's', at: -5, story: 1 },
      { side: 's', at: 5, story: 1 },
      { side: 's', at: 0, story: 1, w: 1.6 },
    ],
    stairs: [
      { side: 'n', at: -6.5, dir: 1 },
      { side: 'n', at: 6.5, dir: -1 },
      { side: 's', at: -6.6, dir: 1, story: 1 },
      { side: 's', at: 6.6, dir: -1, story: 1 },
    ],
  });
  const churchRoof = L2 + 2 * 3;
  const towerTop = churchRoof + 3.5;
  B(0, churchRoof, -31, 3, 3.5, 3, 'plaster');
  D(0, towerTop, -31, 3.4, 0.25, 3.4, 'trim');
  D(0, towerTop - 2.4, -29.45, 1.2, 1.6, 0.1, 'frame'); // belfry opening (painted)
  LD(0, -29.5, towerTop, 0);
  ZL([0, towerTop + 2.3, -29.7], [0, 2.3, 5]);
  // Church square: a fountain and planters
  B(0, L2, -17, 3, 0.7, 3, 'wall2');
  D(0, L2 + 0.7, -17, 2.6, 0.02, 2.6, 'water');
  MP(7, -13.5, TREE);
  MP(10.5, -21, TREE);

  // ---------------------------------------------------------------- Market square (0 m)
  // Stalls with awnings (cover across the middle lane), crates and barrels
  for (const z of [3.5, 10]) {
    M(6, 0, z, 1, 1.1, 2.6, 'wood');
    for (const dz of [-1.3, 1.3]) M(6.6, 0, z + dz, 0.15, 2.5, 0.15, 'wood');
    MD(6.1, 2.5, z, 1.8, 0.12, 3.2, 'awning');
  }
  M(9.5, 0, -6.5, 1.2, 1.2, 1.2, 'crate');
  M(3, 0, 7, 1.6, 0.9, 1.6, 'wall2'); // stone well curbs
  MP(9, -1, TREE);
  BK(9.5, -4.8, 1.1);
  BK(-9.5, -4.8, 1.1);
  BK(3.5, 16.5);
  BK(-3.5, 16.5);
  MP(10, 17.5, BARREL);

  // ---------------------------------------------------------------- Quay (0 m)
  // The fish market (lonja): a hall to walk through along the quay, a ladder to its roof
  twin({
    ...WHITE,
    x: 18,
    z: 26.5,
    w: 8,
    d: 7,
    doors: [
      { side: 'e', at: 0 },
      { side: 'w', at: 0 },
    ],
    windows: [
      { side: 'n', at: -2 },
      { side: 'n', at: 2 },
      { side: 's', at: 0, w: 2 },
    ],
  });
  ML(16, 23, 3, 2);
  // Beached boats and fish crates for cover
  M(7, 0, 28.5, 2, 1.2, 5, 'hull');
  M(7, 1.2, 29.2, 1.4, 0.3, 2, 'deck');
  M(31, 0, 24.5, 2.4, 1.2, 1.2, 'crate');
  M(31, 0, 25.7, 1.2, 2.4, 1.2, 'crate2');
  M(27, 0, 31, 1.2, 1.2, 2.4, 'crate');
  M(4.5, 0, 21, 1.2, 1.2, 1.2, 'crate'); // nets and crates along the foot of the terraces
  M(4.5, 1.2, 21, 0.9, 0.6, 0.9, 'crate2');
  MP(12, 22, PALLET);
  MP(36, 32, PALLET);
  for (const x of [4, 13, 28, 38]) M(x, 0, SEA_Z - 0.6, 0.45, 0.6, 0.45, 'metal'); // bollards
  for (const x of [11, 25, 35]) MP(x, 32.5, LAMP);
  BR(29, 21);
  BR(-29, 21);

  // ---------------------------------------------------------------- Pickups, power weapons, spawns
  PW(0, 11);
  PW(0, -20);
  PK('armor', 0, 28);
  PK('armor', 0, -35, churchRoof);
  PK('hp', 25.5, 17.5);
  PK('hp', -25.5, 17.5);
  for (const [x, z] of [
    [36, 22],
    [33, 29],
    [25.5, 25],
    [37, 3.5],
    [29, 3.5],
    [25.5, 13],
    [37, -16],
    [32, -21],
    [36, -37],
    [10, -14],
  ] as const)
    MS(x, z);
}
