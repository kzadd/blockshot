import { LOGS, PINE, sandbags } from '../props';
import { flight, house, mirrorHouse, railing, type HouseSpec } from '../structures';
import type { BoxKind, MapBuildContext, MapLadder } from '../types';

/** The rocky ridge along the north: its top, the ledge in front of it and the boulders at its foot (m). */
export const RIDGE = 6;
const LEDGE = 4;
const BOULDER = 2;
/** The narrow cleft through the ridge on each side: from x = CLEFT_X to CLEFT_X + CLEFT_W (wall jumps). */
export const CLEFT_X = 7;
export const CLEFT_W = 2.2;
/** The radio hut on the ridge top (a solid block with a ladder) and the top of it. */
const RADIO_Z = -37;
export const RADIO_TOP = RIDGE + 3;
/** Watchtowers: where the east one stands, its deck height, half its side and the legs' thickness. */
const TX = 27;
const TZ = -4;
const TOWER_H = 6;
const TOWER_HALF = 2.75;
const LEG = 0.5;
const DECK_T = 0.3;
const TOWER_TOP = TOWER_H + DECK_T;
/** A zipline's ends hang this far above what riders stand on. */
const ZIP_LAND = 2.3;
/** Frozen lake in the middle: half its size on x and z. */
const LAKE_X = 15;
const LAKE_Z = 12;
/** Lodge (two stories, on the axis) and the two-story cabin east of it: the 2.2 m gap between them. */
export const LODGE_Z = 27;
export const LODGE_HALF_W = 9;
export const ALLEY_W = 2.2;
export const ROOF = 6;

/** Common look of the log buildings. */
const LOG = {
  wall: 'wood',
  ground: 'wood',
  floor: 'wood',
  roof: 'roof',
  parapet: false,
} as const satisfies Partial<HouseSpec>;

// Nevada: a mountain outpost in the snow, mirrored on x (west = east). A rocky ridge closes the north: a 6 m top
// with ledges and boulders to climb, a narrow cleft on each side to wall jump and the radio hut in the middle,
// with ziplines down to the two watchtowers. The frozen lake is the exposed centre (an ice-fishing hut and snow
// walls for cover). The log lodge closes the south: two stories, five doors, a balcony over the lake and stairs to
// the roof; a two-story cabin stands 2.2 m from each side of it (wall jumps between them). Pine woods north-east /
// north-west, small cabins south-east / south-west, the bases at the far east and west. Three lanes: the ridge foot
// (and its top), the lake, the lane behind the lodge (and through it).
export function buildNevada(ctx: MapBuildContext): void {
  const { B, D, S, P, BR, BK, PK, LD, ZL, PW, rand } = ctx;
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
  const MZ = (a: [number, number, number], b: [number, number, number]) => {
    ZL(a, b);
    ZL([-a[0], a[1], a[2]], [-b[0], b[1], b[2]]);
  };
  const MR = (x0: number, z0: number, x1: number, z1: number, y: number) => {
    railing(B, x0, z0, x1, z1, y);
    railing(B, -x0, z0, -x1, z1, y);
  };
  /** A house written for the east side, and its mirror in the west. */
  const twin = (h: HouseSpec) => {
    house(ctx, h);
    house(ctx, mirrorHouse({ ...h, x: -h.x }, -1, 1));
  };

  // ---------------------------------------------------------------- The ridge (north, z -40..-25)
  // Middle mass with the radio hut, climbed by its front ledge and a boulder (2 m each)
  B(0, 0, -35, 2 * CLEFT_X, RIDGE, 10, 'rock');
  B(0, 0, -28.75, 8, LEDGE, 2.5, 'rock');
  B(0, 0, -26.5, 3, BOULDER, 2, 'rock');
  // The side masses: a cleft 2.2 m wide from the middle one (z -40..-30), a ledge and a boulder further out, and
  // rock steps up from the base
  const sideX0 = CLEFT_X + CLEFT_W;
  M((sideX0 + 40) / 2, 0, -36.5, 40 - sideX0, RIDGE, 7, 'rock');
  M((sideX0 + 16) / 2, 0, -31.5, 16 - sideX0, RIDGE, 3, 'rock');
  M(21, 0, -31.25, 10, LEDGE, 3.5, 'rock');
  M(19.5, 0, -28.5, 3, BOULDER, 2, 'rock');
  const stepsStart = -33 + 12 * 0.6;
  flight(B, 'z', stepsStart, -1, 34, 36.5, 0, 12, 'rock');
  flight(B, 'z', stepsStart, -1, -36.5, -34, 0, 12, 'rock');
  // A log bridge over the back of each cleft joins the ridge top from side to side
  M(CLEFT_X + CLEFT_W / 2, RIDGE - 0.3, -39.2, CLEFT_W + 0.6, 0.3, 1.6, 'wood');
  // Cover on the ridge top: rocks and snow walls along its edge
  M(15, RIDGE, -36, 1.6, 1.2, 1.4, 'rock');
  M(29, RIDGE, -35, 2.2, 1.2, 1.4, 'rock');
  M(4.5, RIDGE, -31, 2.4, 1.1, 0.6, 'wall2');
  M(24, RIDGE, -34, 3, 1.1, 0.6, 'wall2');
  // The radio hut: a solid block with a ladder to its top and a mast; ziplines down to both watchtowers
  B(0, RIDGE, RADIO_Z, 3, 3, 3, 'metal');
  D(0, RADIO_TOP, RADIO_Z - 0.9, 0.25, 9, 0.25, 'metal');
  D(0, RADIO_TOP + 6, RADIO_Z - 0.9, 2.4, 0.12, 0.12, 'metal');
  LD(0, RADIO_Z + 1.5, RADIO_TOP, 0);
  PK('armor', 0, RADIO_Z - 0.6, RADIO_TOP);
  MZ([1.1, RADIO_TOP + ZIP_LAND, RADIO_Z + 0.9], [TX - 2.3, TOWER_TOP + ZIP_LAND, TZ - 2.3]);

  // ---------------------------------------------------------------- Watchtowers (east / west of the lake)
  for (const lx of [1, -1])
    for (const lz of [1, -1])
      M(TX + lx * (TOWER_HALF - LEG), 0, TZ + lz * (TOWER_HALF - LEG), LEG, TOWER_H, LEG, 'wood');
  M(TX, TOWER_H, TZ, 2 * TOWER_HALF, DECK_T, 2 * TOWER_HALF, 'wood');
  const e = TOWER_HALF - 0.06;
  // Railings on the base sides; the lake and ridge sides stay open for the cables, a gap for the ladder
  MR(TX - e, TZ + e, TX + e, TZ + e, TOWER_TOP);
  MR(TX + e, TZ - e, TX + e, TZ + 0.4, TOWER_TOP);
  ML(TX + TOWER_HALF + 0.35, TZ + 1.6, TOWER_TOP, 3);
  MD(TX, TOWER_TOP + 2.4, TZ, 2 * TOWER_HALF + 0.6, 0.25, 2 * TOWER_HALF + 0.6, 'roof');
  MZ([TX - 2.4, TOWER_TOP + ZIP_LAND, TZ + 1], [8, ZIP_LAND, -1]);
  MP(TX + 4.5, TZ - 3, sandbags(1, 3));
  MP(TX - 1, TZ + 5, sandbags(3, 1));
  BR(TX + 1, TZ - 4.5);
  BR(-TX - 1, TZ - 4.5);

  // ---------------------------------------------------------------- The frozen lake (the exposed centre)
  D(0, 0, 0, 2 * LAKE_X, 0.03, 2 * LAKE_Z, 'ice');
  // Ice-fishing hut in the middle: doors east and west, a window south, a ladder up its north wall
  house(ctx, {
    ...LOG,
    x: 0,
    z: 0,
    w: 4.4,
    d: 3.6,
    doors: [{ side: 'e' }, { side: 'w' }],
    windows: [{ side: 's' }],
  });
  LD(0, -1.8, 3, 2);
  PK('armor', 0, 0.6, 3);
  PW(0, -8);
  PW(0, 8);
  // Snow walls on the ice and rocks round the shore
  M(6.5, 0, -6.5, 3, 1.2, 0.7, 'wall2');
  M(6.5, 0, 6.5, 3, 1.2, 0.7, 'wall2');
  M(12, 0, 4, 0.7, 1.2, 3, 'wall2');
  M(15, 0, -10, 2.4, 1.6, 2, 'rock');
  M(14.5, 0, 10, 2.2, 1.4, 1.8, 'rock');
  BK(4.5, 2.5, 1.1);
  BK(-4.5, 2.5, 1.1);

  // ---------------------------------------------------------------- North lane and the pine woods
  M(11, 0, -21, 2.2, 1.5, 1.8, 'rock');
  M(5, 0, -16, 3, 1.2, 0.7, 'wall2');
  MP(27, -27, LOGS);
  // Pine woods north-east (and north-west): seeded, the same on both sides
  let pines = 0;
  for (let i = 0; i < 80 && pines < 12; i++) {
    const x = 14 + rand() * 17;
    const z = -24 + rand() * 14;
    if (Math.hypot(x - 11, z + 21) < 3 || Math.hypot(x - TX, z - TZ) < 5.5) continue;
    MP(x, z, PINE);
    pines++;
  }
  // The sawmill in the woods: a shed open on three sides round a log stack, a ladder up its back wall
  twin({
    ...LOG,
    x: 22,
    z: -16,
    w: 9,
    d: 6,
    doors: [
      { side: 's', at: 0, w: 3 },
      { side: 'e', at: 0, w: 2.4 },
      { side: 'w', at: 0, w: 2.4 },
    ],
    windows: [
      { side: 'n', at: -2.8 },
      { side: 'n', at: 2.8, w: 1.6 },
      { side: 's', at: 3.2 },
      { side: 's', at: -3.2 },
    ],
  });
  M(21.5, 0, -16.5, 3, 1.4, 1.6, 'logs');
  ML(22, -19.35, 3, 2);
  BK(19, -11, 1.2);
  BK(-19, -11, 1.2);

  // ---------------------------------------------------------------- The lodge (south, on the axis)
  // Two stories: doors to the lake, to the back and to both sides, a balcony over the lake, stairs to the roof
  house(ctx, {
    ...LOG,
    x: 0,
    z: LODGE_Z,
    w: 2 * LODGE_HALF_W,
    d: 10,
    stories: 2,
    doors: [
      { side: 'n', at: -3 },
      { side: 'n', at: 3 },
      { side: 's', at: 0 },
      { side: 'e', at: -3.5 },
      { side: 'w', at: -3.5 },
    ],
    windows: [
      { side: 'n', at: -6.5 },
      { side: 'n', at: 6.5 },
      { side: 's', at: -2.8 },
      { side: 's', at: 2.8 },
      { side: 'e', at: -3.5, story: 1 },
      { side: 'w', at: -3.5, story: 1 },
      { side: 's', at: -6, story: 1 },
      { side: 's', at: 6, story: 1 },
    ],
    stairs: [
      { side: 's', at: -7.4, dir: 1 },
      { side: 's', at: 7.4, dir: -1 },
      { side: 'n', at: -7.4, dir: 1, story: 1 },
      { side: 'n', at: 7.4, dir: -1, story: 1 },
    ],
    balconies: [{ side: 'n', at: 0, w: 4 }],
  });
  // Tables inside (cover across the hall)
  M(3.5, 0, LODGE_Z + 0.5, 1, 0.9, 2.2, 'wood');
  // Two-story cabin 2.2 m east (and west) of the lodge: wall jumps between them, stairs inside to its roof
  const cabX0 = LODGE_HALF_W + ALLEY_W;
  twin({
    ...LOG,
    x: cabX0 + 3.4,
    z: 26,
    w: 6.8,
    d: 8,
    stories: 2,
    doors: [
      { side: 'n', at: -1.2 },
      { side: 'e', at: -1 },
    ],
    windows: [
      { side: 'n', at: 2 },
      { side: 'e', at: 2, story: 1 },
      { side: 'n', at: -2.2, story: 1 },
      { side: 's', at: 0, story: 1 },
    ],
    stairs: [
      { side: 's', at: -2.6, dir: 1 },
      { side: 'n', at: 2.6, dir: -1, story: 1 },
    ],
  });

  // ---------------------------------------------------------------- Small cabin south-east (and south-west)
  twin({
    ...LOG,
    x: 25,
    z: 16,
    w: 7,
    d: 5.6,
    doors: [
      { side: 'w', at: 0 },
      { side: 'n', at: 1.5 },
    ],
    windows: [
      { side: 'e', at: 0 },
      { side: 'n', at: -1.8 },
    ],
    outside: { side: 's', at: -2.9, dir: 1 },
  });
  PK('hp', 26, 16);
  PK('hp', -26, 16);

  // ---------------------------------------------------------------- The open ground south of the lake and the back lane
  M(5, 0, 16.5, 3, 1.2, 0.7, 'wall2');
  M(16.5, 0, 15, 2, 1.3, 1.8, 'rock');
  B(0, 0, 36, 4, 1.2, 0.7, 'wall2');
  M(14, 0, 35, 0.7, 1.2, 3, 'wall2');
  MP(24, 35, LOGS);
  MP(31, 23, PINE);
  MP(19, 33, PINE);
  MP(28, 30, PINE);
  BK(31, 36, 1.2);
  BK(-31, 36, 1.2);

  // ---------------------------------------------------------------- The bases (far east / west)
  MP(33, 1, sandbags(1, 3));
  MP(34, -18, sandbags(3, 1));
  M(37, 0, 16, 1.2, 1.2, 1.2, 'crate');
  M(37, 1.2, 16, 0.9, 0.9, 0.9, 'crate2');
  BR(32, 11);
  BR(-32, 11);

  // ---------------------------------------------------------------- Spawns
  for (const [x, z] of [
    [36, -22],
    [30, -21],
    [33, -13],
    [36, -8],
    [37, 0],
    [32, 6],
    [36, 10],
    [33, 20],
    [36, 27],
    [31, 34],
    [22, 37],
  ] as const)
    MS(x, z);
}
