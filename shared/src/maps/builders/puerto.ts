import { LAMP, PALLET } from '../props';
import { flight, house, mirrorHouse, railing, slab, wall, windowAt, doorAt, type HouseSpec } from '../structures';
import type { BoxKind, MapBuildContext, MapLadder, StructureKind } from '../types';

/** The quays stand this high over the canal floor (m); the water reaches a little under them. */
const G = 1;
const WATER_TOP = 0.7;
/** The canal runs north-south through the middle: its half width (the quay edges are at x = ±CANAL). */
const CANAL = 8;
/** Containers: width, length and height of one (the pack model's); a stack of two has its top here. */
const CONT_W = 2.6;
const CONT_L = 6;
const CONT_H = 2.6;
const STACK_TOP = G + 2 * CONT_H;
/** Gap between two container rows: a wall-jump alley. */
const ALLEY = 2.2;
/** The freighter: half beam, hull wall thickness, deck height (from the canal floor, 3 m over the quays). */
const HULL_HALF = 5;
const HULL_T = 0.5;
const DECK = 4;
const DECK_T = 0.3;
/** The hold under the deck (z range); the bow is north of it and the stern with the bridge tower south. */
const HOLD_Z0 = -16;
const HOLD_Z1 = 4;
const BOW_Z = -22;
const STERN_Z = 16;
/** Gangways from the quays to the deck, at this z. */
const GANGWAY_Z = -2;
/** Gantry crane over the lock gate: centre z, half depth of its walkway, walkway top, leg x. */
const GANTRY_Z = 24;
const GANTRY_HALF_D = 1.5;
const GANTRY_TOP = G + 9;
const GANTRY_LEG_X = 10.6;
const GANTRY_END = 11;
/** Footbridge over the canal between the offices' first floors. */
const FOOT_Z = -33;
const FOOT_TOP = G + 3;
/** A zipline's ends sit this far above where riders stand to grab them. */
const ZIP_LAND = 2.3;

// Puerto: a canal runs north-south through the middle of a container port; a freighter lies in its dock in the
// canal, a gantry crane straddles the lock gate to the south and a footbridge joins two office blocks to the north.
// Three lanes cross the canal: the footbridge (and the water under it) in the north, the ship in the middle (its deck
// by the gangways, its hold through the doors in the hull) and the lock gate under the crane in the south (the crane's
// walkway over it, ziplines down to the warehouse roofs and to the ship's bridge). Each quay has two rows of stacked
// containers with a wall-jump alley between them, a warehouse with a first floor and a roof joined to the containers by
// a catwalk, an office block and a shed. Everything east (+x) is mirrored west.
export function buildPuerto(ctx: MapBuildContext): void {
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
  const MR = (x0: number, z0: number, x1: number, z1: number, y: number) => {
    railing(B, x0, z0, x1, z1, y);
    railing(B, -x0, z0, -x1, z1, y);
  };
  /** A house written for the east side, and its mirror in the west. */
  const twin = (h: HouseSpec) => {
    house(ctx, h);
    house(ctx, mirrorHouse({ ...h, x: -h.x }, -1, 1));
  };
  const colors: StructureKind[] = ['cont1', 'cont2', 'cont3'];
  const pick = () => colors[Math.floor(rand() * colors.length)]!;
  /** A row of containers end to end, `n` long and `high` stacked, along x or z from (x0, z0), on both sides. */
  const row = (run: 'x' | 'z', x0: number, z0: number, n: number, high: number) => {
    for (let i = 0; i < n; i++)
      for (let j = 0; j < high; j++) {
        const [x, z] = run === 'x' ? [x0 + (i + 0.5) * CONT_L, z0] : [x0, z0 + (i + 0.5) * CONT_L];
        const [w, d] = run === 'x' ? [CONT_L, CONT_W] : [CONT_W, CONT_L];
        M(x, G + j * CONT_H, z, w, CONT_H, d, pick());
      }
  };

  // ---------------------------------------------------------------- Quays and canal
  M((40 + CANAL) / 2, 0, 0, 40 - CANAL, G, 80, 'quay'); // x 8..40
  D(0, 0, 0, 2 * CANAL, WATER_TOP, 80, 'water');
  // Bollards along the quay edges (clear of the gangways and the crane)
  for (const z of [-37, -28, -20, -13, 6, 12, 32, 38]) M(CANAL + 0.5, G, z, 0.5, 0.7, 0.5, 'metal');
  // Steps down into the water at both basins
  for (const z of [-26, 31]) M(CANAL - 0.4, 0, z, 0.8, 0.5, 2, 'quay');

  // ---------------------------------------------------------------- The freighter
  // Hull walls round the hold (doors at the waterline, portholes), solid bow and stern under the deck
  for (const s of [1, -1]) {
    const at = s * (HULL_HALF - HULL_T / 2);
    wall(ctx, 'z', at, HOLD_Z0, HOLD_Z1, 0, DECK, 'hull', [doorAt(-6), windowAt(-12, 0.8), windowAt(0, 0.8)], {
      t: HULL_T,
    });
  }
  B(0, 0, (BOW_Z + HOLD_Z0) / 2, 2 * HULL_HALF, DECK - DECK_T, HOLD_Z0 - BOW_Z, 'hull');
  B(0, DECK - DECK_T, (BOW_Z + HOLD_Z0) / 2, 2 * HULL_HALF, DECK_T, HOLD_Z0 - BOW_Z, 'deck');
  B(0, 0, (HOLD_Z1 + STERN_Z) / 2, 2 * HULL_HALF, DECK - DECK_T, STERN_Z - HOLD_Z1, 'hull');
  B(0, DECK - DECK_T, (HOLD_Z1 + STERN_Z) / 2, 2 * HULL_HALF, DECK_T, STERN_Z - HOLD_Z1, 'deck');
  // The bow narrows to the north in two steps
  for (const [z, w] of [
    [BOW_Z - 1, 7],
    [BOW_Z - 3, 3.6],
  ] as const) {
    B(0, 0, z, w, DECK - DECK_T, 2, 'hull');
    B(0, DECK - DECK_T, z, w, DECK_T, 2, 'deck');
  }
  // Deck over the hold with a hatch over each of the two stairs down
  const hatch = (s: number) => {
    const [a, b] = [s * (HULL_HALF - HULL_T), s * 2.6];
    return { x0: Math.min(a, b), x1: Math.max(a, b), z0: HOLD_Z0, z1: HOLD_Z0 + 1 + 8 * 0.6 };
  };
  slab(B, { x0: -HULL_HALF + HULL_T, x1: HULL_HALF - HULL_T, z0: HOLD_Z0, z1: HOLD_Z1 }, DECK, DECK_T, 'deck', [
    hatch(1),
    hatch(-1),
  ]);
  D(0, 0.02, (HOLD_Z0 + HOLD_Z1) / 2, 2 * (HULL_HALF - HULL_T), 0.02, HOLD_Z1 - HOLD_Z0, 'ballast');
  // Stairs from the hold up through the hatches (against the hull, climbing north to south)
  for (const s of [1, -1]) {
    const c0 = s * (HULL_HALF - HULL_T);
    flight(B, 'z', HOLD_Z0 + 1, 1, c0, c0 - s * 1.4, 0, 8, 'stair');
    railing(B, s * 2.55, HOLD_Z0, s * 2.55, hatch(1).z1, DECK);
  }
  // Railings round the deck, open at the gangways
  for (const s of [1, -1]) {
    const x = s * (HULL_HALF - 0.06);
    railing(B, x, BOW_Z, x, GANGWAY_Z - 1.2, DECK);
    railing(B, x, GANGWAY_Z + 1.2, x, STERN_Z, DECK);
  }
  railing(B, -HULL_HALF, STERN_Z - 0.06, HULL_HALF, STERN_Z - 0.06, DECK);
  // Gangways: steps up the quay and a plank over the water to the deck
  flight(B, 'x', CANAL + 6 * 0.6, -1, GANGWAY_Z - 1.2, GANGWAY_Z + 1.2, G, 6, 'deck');
  flight(B, 'x', -CANAL - 6 * 0.6, 1, GANGWAY_Z - 1.2, GANGWAY_Z + 1.2, G, 6, 'deck');
  M((CANAL + HULL_HALF) / 2, DECK - 0.3, GANGWAY_Z, CANAL - HULL_HALF, 0.3, 2.4, 'bridge');
  for (const dz of [-1.2, 1.2]) MR(HULL_HALF, GANGWAY_Z + dz, CANAL, GANGWAY_Z + dz, DECK);
  // Cargo on deck: a container in the middle, a pair on the bow; crates in the hold
  B(0, DECK, -6, CONT_W, CONT_H, CONT_L, 'cont2');
  B(0, DECK, -19, CONT_L, CONT_H, CONT_W, 'cont1');
  for (const [x, z] of [
    [2.4, -3],
    [-2.4, -3],
  ] as const)
    B(x, 0, z, 1.2, 1.2, 1.2, 'crate');
  BK(1.8, 1.5, 1.2);
  BK(-1.8, 1.5, 1.2);
  BK(0, -9.5, 1.2, DECK);
  // The bridge tower on the stern: doors to the deck, windows to both quays, a ladder to its roof and the funnel
  const towerZ = 9.5;
  house(ctx, {
    x: 0,
    z: towerZ,
    w: 8,
    d: 7,
    y: DECK,
    wall: 'hull',
    roof: 'platform',
    ground: 'deck',
    parapet: false,
    doors: [
      { side: 'n', at: -2 },
      { side: 'n', at: 2 },
    ],
    windows: [
      { side: 'e', at: -1.5, w: 2 },
      { side: 'w', at: -1.5, w: 2 },
      { side: 'e', at: 1.8 },
      { side: 'w', at: 1.8 },
      { side: 's', at: -2.2 },
      { side: 's', at: 2.2 },
    ],
  });
  const towerTop = DECK + 3;
  LD(0, towerZ + 3.5, towerTop, 0);
  B(0, towerTop, towerZ - 2, 2.2, 2.6, 2.2, 'hull'); // the funnel
  D(0, towerTop + 2.6, towerZ - 2, 2.3, 0.4, 2.3, 'trim');

  // ---------------------------------------------------------------- Lock gate and gantry crane (south)
  B(0, 0, GANTRY_Z, 2 * CANAL, G, 2 * GANTRY_HALF_D, 'bridge');
  for (const dz of [-GANTRY_HALF_D + 0.06, GANTRY_HALF_D - 0.06])
    railing(B, -CANAL, GANTRY_Z + dz, CANAL, GANTRY_Z + dz, G);
  for (const dz of [-GANTRY_HALF_D + 0.4, GANTRY_HALF_D - 0.4])
    M(GANTRY_LEG_X, G, GANTRY_Z + dz, 0.8, GANTRY_TOP - G - 0.3, 0.8, 'metal');
  B(0, GANTRY_TOP - 0.3, GANTRY_Z, 2 * GANTRY_END, 0.3, 2 * GANTRY_HALF_D, 'metal');
  // (a gap in the north one under the cable down to the ship)
  railing(
    B,
    -GANTRY_END + 0.6,
    GANTRY_Z + GANTRY_HALF_D - 0.06,
    GANTRY_END - 0.6,
    GANTRY_Z + GANTRY_HALF_D - 0.06,
    GANTRY_TOP,
  );
  MR(1, GANTRY_Z - GANTRY_HALF_D + 0.06, GANTRY_END - 0.6, GANTRY_Z - GANTRY_HALF_D + 0.06, GANTRY_TOP);
  // The boom reaching out over the south basin and cover boxes on the walkway
  D(0, GANTRY_TOP + 2.2, GANTRY_Z + 7, 1, 0.6, 14, 'metal');
  MD(0.9, GANTRY_TOP + 1, GANTRY_Z, 0.3, 1.8, 0.3, 'metal');
  M(4, GANTRY_TOP, GANTRY_Z, 1.4, 1.2, 1.6, 'metal');
  // Up a leg on each quay
  ML(GANTRY_END + 0.15, GANTRY_Z - GANTRY_HALF_D + 0.4, GANTRY_TOP, 3);

  // ---------------------------------------------------------------- Footbridge (north)
  B(0, FOOT_TOP - 0.3, FOOT_Z, 24, 0.3, 2.4, 'bridge');
  for (const dz of [-1.14, 1.14]) railing(B, -12, FOOT_Z + dz, 12, FOOT_Z + dz, FOOT_TOP);
  for (const x of [-4, 4]) D(x, 0, FOOT_Z, 0.5, FOOT_TOP - 0.3, 0.5, 'metal');

  // ---------------------------------------------------------------- Office blocks (north), joined by the footbridge
  twin({
    x: 17,
    z: -32.5,
    w: 10,
    d: 11,
    y: G,
    stories: 2,
    wall: 'concrete',
    ground: 'tile',
    roof: 'slab',
    shutter: 'shutter',
    doors: [
      { side: 's', at: -2 },
      { side: 'e', at: 2.5 },
      { side: 'w', at: 3 },
      { side: 'w', at: -0.5, story: 1 },
    ],
    windows: [
      { side: 's', at: 2.5 },
      { side: 'w', at: -2.5 },
      { side: 'n', at: 2 },
      { side: 's', at: -2, story: 1 },
      { side: 's', at: 2.5, story: 1 },
      { side: 'e', at: 2, story: 1 },
      { side: 'w', at: 3, story: 1 },
    ],
    stairs: [
      { side: 'n', at: -4.4, dir: 1 },
      { side: 'e', at: -5.2, dir: 1, story: 1 },
    ],
  });

  // ---------------------------------------------------------------- Container rows
  // North rows along x, an alley between them; a ladder at the east end, a catwalk to the warehouse roof
  const rowA = -19.3;
  const rowB = rowA + CONT_W + ALLEY;
  row('x', 11, rowA, 3, 2);
  row('x', 11, rowB, 3, 2);
  ML(11 + 3 * CONT_L, rowB, STACK_TOP, 3);
  const catX = 20;
  const catZ0 = rowB + CONT_W / 2;
  M(catX, STACK_TOP - 0.3, (catZ0 - 8) / 2, 1.6, 0.3, -8 - catZ0, 'bridge');
  // two steps up to the roof's level (0.8 m over the containers)
  M(catX, STACK_TOP, -9.25, 1.6, 0.4, 0.5, 'step');
  M(catX, STACK_TOP, -8.5, 1.6, 0.8, 1, 'step');
  MR(catX + 0.86, catZ0, catX + 0.86, -9, STACK_TOP);
  MR(catX - 0.86, catZ0, catX - 0.86, -9, STACK_TOP);
  // South rows along z, an alley between them, a ladder at the south end
  const rowC = 22;
  const rowD = rowC + CONT_W + ALLEY;
  row('z', rowC, 14, 3, 2);
  row('z', rowD, 14, 3, 2);
  ML(rowD, 14 + 3 * CONT_L, STACK_TOP, 0);
  // Loose single containers for cover on the open quay
  M(33, G, -26, CONT_L, CONT_H, CONT_W, 'cont3');
  M(14, G, 11.5, CONT_L, CONT_H, CONT_W, 'cont1');
  M(16, G, 35, CONT_L, CONT_H, CONT_W, 'cont2');
  // Crate stacks breaking the long view down the north lane and along the east strip
  M(12.8, G, -25, 1.2, 2.4, 1.2, 'crate2');
  M(12.8, G, -23.8, 1.2, 1.2, 1.2, 'crate');
  M(37.5, G, 5, 1.2, 2.4, 1.2, 'crate2');
  M(36.3, G, 5, 1.2, 1.2, 1.2, 'crate');
  // A perch against the north wall: a crate up to a container's roof
  M(34, G, -38.7, CONT_L, CONT_H, CONT_W, 'cont1');
  M(32, G, -36.8, 1.2, 1.2, 1.2, 'crate');

  // ---------------------------------------------------------------- Warehouses (middle): a hall with a first floor
  twin({
    x: 24,
    z: 0,
    w: 16,
    d: 16,
    y: G,
    stories: 2,
    wall: 'brick',
    ground: 'tile',
    roof: 'slab',
    floor: 'wood',
    parapet: false,
    doors: [
      { side: 'w', at: 0, w: 2.4 },
      { side: 'e', at: 0 },
      { side: 'n', at: -2 },
      { side: 's', at: 3 },
    ],
    windows: [
      { side: 'w', at: -5 },
      { side: 'w', at: 5 },
      { side: 'n', at: 4 },
      { side: 's', at: -3 },
      { side: 'w', at: -4.5, story: 1 },
      { side: 'w', at: 0, story: 1, w: 2 },
      { side: 'w', at: 4.5, story: 1 },
      { side: 'n', at: -5, story: 1 },
      { side: 'n', at: 3, story: 1 },
      { side: 's', at: 0, story: 1 },
      { side: 'e', at: 0, story: 1 },
    ],
    stairs: [
      { side: 'e', at: -7.3, dir: 1 },
      { side: 'e', at: 3.5, dir: 1, story: 1 },
    ],
  });
  // Crates and pallets inside the hall
  M(20, G, -3, 1.2, 1.2, 1.2, 'crate');
  M(20, G + 1.2, -3, 1, 1, 1, 'crate2');
  M(27, G, 4.5, 2.4, 1.2, 1.2, 'crate');
  BK(19, 4, 1.2);
  BK(-19, 4, 1.2);

  // ---------------------------------------------------------------- Sheds (south-east and south-west)
  twin({
    x: 33,
    z: 18,
    w: 9,
    d: 8,
    y: G,
    wall: 'wall',
    roof: 'roof',
    ground: 'tile',
    doors: [
      { side: 'n', at: 0 },
      { side: 's', at: -2 },
    ],
    windows: [
      { side: 's', at: 2 },
      { side: 'n', at: 3 },
    ],
    outside: { side: 'e', at: -3.6, dir: 1 },
  });
  PK('hp', 33, 18.5);
  PK('hp', -33, 18.5);

  // ---------------------------------------------------------------- Ziplines from the crane
  const zipTop = GANTRY_TOP + ZIP_LAND;
  ZL([0, zipTop, GANTRY_Z - 0.8], [0, towerTop + ZIP_LAND, towerZ + 1.5]);
  for (const s of [1, -1]) ZL([s * (GANTRY_END - 1.2), zipTop, GANTRY_Z + 0.6], [s * 26, G + 6 + ZIP_LAND, 5]);

  // ---------------------------------------------------------------- Cover, objects, pickups
  // Quay edge: concrete blocks and crates by the water
  M(10, G, -8, 2.4, 1.1, 1, 'concrete');
  M(10, G, 18, 1, 1.1, 2.4, 'concrete');
  M(11, G, -38, 1.2, 1.2, 1.2, 'crate');
  BK(10, 6.5, 1.2);
  BK(-10, 6.5, 1.2);
  BK(36, -18, 1.3);
  BK(-36, -18, 1.3);
  BR(10.5, 28.5);
  BR(-10.5, 28.5);
  BR(30, -9.5);
  BR(-30, -9.5);
  MP(37, 30, PALLET);
  MP(28, -36, PALLET);
  for (const z of [-24, -9, 9, 30]) MP(9.4, z, LAMP);

  PK('armor', 0, GANTRY_Z, GANTRY_TOP);
  PW(0, -12, 0);
  PW(0, -24, DECK);

  for (const [x, z] of [
    [36, -2],
    [36, -12],
    [35, -21],
    [36, -35],
    [27, -32],
    [35, 10],
    [36, 27],
    [33, 36],
    [24, 36],
    [15, 18],
    [16.5, -23.6],
  ] as const)
    MS(x, z);
}
