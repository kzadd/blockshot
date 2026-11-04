import { BARREL, LAMP, TREE, car, pad } from '../props';
import { STORY, facade, house, mirrorHouse, railing, wall, windowAt, type HouseSpec } from '../structures';
import type { BoxKind, MapBuildContext, PropPart } from '../types';

/** Every roof of the old town is a flat terrace at this height (two stories). */
const ROOF = 2 * STORY;
/** Planks between the roofs: thickness and width. */
const PLANK_T = 0.2;
const PLANK_W = 1.4;
/** The clock tower: footprint and three stories up to the lookout. */
const TOWER = 6;
const TOWER_Y = 3 * STORY;
const BELFRY = 2.6;
/** Half width of the canal running south from the square. */
const CANAL = 1.75;
const SHOP = { w: 2.4, sill: 0.7, top: 2.2 };

/** A café table under its parasol, with two stools. */
const CAFE: PropPart[] = [
  [0, 0, 0, 0.9, 0.75, 0.9, 'wood'],
  [0, 0.75, 0, 0.1, 1.5, 0.1, 'trunk'],
  [0, 2.25, 0, 2.2, 0.1, 2.2, 'awning'],
  [0.85, 0, 0, 0.4, 0.45, 0.4, 'wood'],
  [-0.85, 0, 0, 0.4, 0.45, 0.4, 'wood'],
];
const CART: PropPart[] = [
  [0, 0.3, 0, 1.4, 0.8, 2.4, 'wood'],
  [0, 0, -0.8, 1.6, 0.6, 0.3, 'trunk'],
  [0, 0, 0.8, 1.6, 0.6, 0.3, 'trunk'],
  [0, 1.1, 0.4, 1, 0.8, 1, 'crate'],
];

// Casco Viejo: an old town centre, mirror-symmetric on x. A square with a clock tower (climb inside to the lookout)
// in the middle; a covered gateway north of it to the north street; a canal running south to the south street.
// Three lanes between the halves (north street, square and middle street, south street) and a fourth layer up
// high: every row of houses has a flat roof terrace at 6 m and planks join them all over the streets and alleys.
// The alleys between the rows are 2.2 m wide: bounce from wall to wall up to the roofs.
export function buildCiudad(ctx: MapBuildContext): void {
  const { B, D, S, P, BR, BK, PK, LD, PW } = ctx;
  /** Both halves: (x, …) and its mirror (-x, …). */
  const M = (x: number, y: number, z: number, w: number, h: number, d: number, c: BoxKind) => {
    B(x, y, z, w, h, d, c);
    B(-x, y, z, w, h, d, c);
  };
  const MD = (x: number, y: number, z: number, w: number, h: number, d: number, c: BoxKind = 'trim') => {
    D(x, y, z, w, h, d, c);
    D(-x, y, z, w, h, d, c);
  };
  const MP = (x: number, z: number, parts: PropPart[]) => {
    P(x, z, parts);
    P(
      -x,
      z,
      parts.map(([dx, ...rest]): PropPart => [-dx, ...rest]),
    );
  };
  const MS = (x: number, z: number) => {
    S(x, z);
    S(-x, z);
  };
  const MH = (spec: HouseSpec) => {
    house(ctx, spec);
    house(ctx, mirrorHouse({ ...spec, x: -spec.x }, -1, 1));
  };
  /** A solid row house from x0..x1 × z0..z1 (east half, mirrored), shuttered windows, a chimney on the roof. */
  const row = (x0: number, x1: number, z0: number, z1: number, h: number, c: BoxKind, chimney = true) => {
    const x = (x0 + x1) / 2;
    const z = (z0 + z1) / 2;
    const center = x0 + x1 === 0;
    (center ? B : M)(x, 0, z, x1 - x0, h, z1 - z0, c);
    facade(center ? D : MD, x, z, x1 - x0, z1 - z0, h, 'shutter');
    if (chimney && h <= ROOF) (center ? B : M)(x + (x1 - x0) / 4, h, z, 0.9, 1.3, 0.9, 'brick');
  };
  /** A plank between two roofs, from (x0, z0) to (x1, z1) (axis aligned). */
  const plank = (x0: number, z0: number, x1: number, z1: number, mirror = true) => {
    const w = Math.max(PLANK_W, Math.abs(x1 - x0));
    const d = Math.max(PLANK_W, Math.abs(z1 - z0));
    (mirror ? M : B)((x0 + x1) / 2, ROOF - PLANK_T, (z0 + z1) / 2, w, PLANK_T, d, 'bridge');
  };

  // ------------------------------------------------------------------ The square and its clock tower
  house(ctx, {
    x: 0,
    z: 0,
    w: TOWER,
    d: TOWER,
    stories: 3,
    wall: 'brick',
    frame: 'trim',
    ground: 'tile',
    awning: 'awning',
    doors: [
      { side: 'e', at: 1.2 },
      { side: 'w', at: 1.2 },
    ],
    windows: [
      { side: 'n', at: 0 },
      { side: 's', at: -1 },
      { side: 'e', at: -1.4, story: 1 },
      { side: 'w', at: -1.4, story: 1 },
      { side: 's', at: 0, story: 1 },
      { side: 'n', at: 0, story: 2 },
      { side: 's', at: 0, story: 2 },
      { side: 'e', at: 0, story: 2 },
      { side: 'w', at: 0, story: 2 },
    ],
    stairs: [
      { side: 'n', at: -2.3, dir: 1 },
      { side: 's', at: 2.3, dir: -1, story: 1 },
      { side: 'n', at: -2.3, dir: 1, story: 2 },
    ],
  });
  // Belfry over the lookout: four posts and a roof, then a spire and a clock on every face (decoration)
  for (const sx of [1, -1])
    for (const sz of [1, -1]) B(sx * (TOWER / 2 - 0.25), TOWER_Y, sz * (TOWER / 2 - 0.25), 0.5, BELFRY, 0.5, 'brick');
  B(0, TOWER_Y + BELFRY, 0, TOWER + 0.6, 0.3, TOWER + 0.6, 'roof');
  for (const [i, s] of [4.6, 3.2, 1.8, 0.6].entries()) D(0, TOWER_Y + BELFRY + 0.3 + i * 0.7, 0, s, 0.7, s, 'roof');
  for (const s of [1, -1]) {
    D(0, 7, s * (TOWER / 2 + 0.05), 1.8, 1.8, 0.1, 'trim');
    D(s * (TOWER / 2 + 0.05), 7, 0, 0.1, 1.8, 1.8, 'trim');
    D(0, 7.85, s * (TOWER / 2 + 0.12), 0.12, 0.8, 0.05, 'frame');
    D(s * (TOWER / 2 + 0.12), 7.85, 0, 0.05, 0.12, 0.6, 'frame');
  }
  PK('armor', 0, 1.8, TOWER_Y);

  // Fountain at the head of the canal
  B(0, 0, 9.15, 6, 0.7, 0.3, 'quay');
  M(2.85, 0, 11, 0.3, 0.7, 4, 'quay');
  B(0, 0, 11, 0.8, 2, 0.8, 'quay');
  D(0, 2, 11, 1.8, 0.2, 1.8, 'quay');
  D(0, 0, 11, 5.4, 0.45, 3.7, 'water');
  // Market stalls and café terraces round the square: cover on the way across
  const stall = (x: number, z: number) => {
    M(x, 0, z, 3, 1.1, 0.8, 'wood');
    for (const px of [-1.6, 1.6]) for (const pz of [-1.1, 1.1]) M(x + px, 0, z + pz, 0.15, 2.6, 0.15, 'wood');
    MD(x, 2.6, z, 3.6, 0.15, 2.6, 'awning');
  };
  stall(6.5, -7.5);
  for (const [x, z] of [
    [9, -10.5],
    [8.5, 5.5],
    [8.5, 10.5],
    [5.5, 8],
  ] as const)
    MP(x, z, CAFE);
  for (const [x, z] of [
    [10.3, -2],
    [4, 11.8],
  ] as const)
    MP(x, z, TREE);
  MP(10.6, 4.4, LAMP);
  MP(3.6, -4, LAMP);
  BK(4.2, -10.5, 1.2);
  BK(-4.2, -10.5, 1.2);
  PW(7.5, 0);
  PW(-7.5, 0);

  // ------------------------------------------------------------------ North: covered gateway and the north rows
  // Gatehouse: two walk-in halves with a vaulted passage between them and a room over it
  MH({
    x: 4.5,
    z: -20,
    w: 5,
    d: 12,
    stories: 2,
    wall: 'bld3',
    ground: 'tile',
    awning: 'awning',
    shutter: 'shutter',
    parapet: false,
    doors: [
      { side: 'w', at: 3 },
      { side: 'n', at: 0 },
      { side: 's', at: -0.6 },
      { side: 'w', at: -3, story: 1 },
    ],
    windows: [
      { side: 'w', at: -3 },
      { side: 'e', at: 3 },
      { side: 'e', at: -3, story: 1 },
      { side: 'e', at: 3, story: 1 },
      { side: 'n', at: 0, story: 1 },
    ],
    stairs: [
      { side: 'e', at: -5, dir: 1 },
      { side: 'w', at: 4, dir: -1, story: 1 },
    ],
    balconies: [{ side: 's', at: 0.4, w: 3 }],
  });
  B(0, STORY - 0.4, -20, 4, 0.4, 12, 'brick');
  for (const s of [1, -1]) {
    wall(ctx, 'x', -20 + s * 5.85, -2, 2, STORY, STORY - 0.3, 'bld3', [windowAt(0)], { shutter: 'shutter' });
    // The arch over each mouth of the passage
    D(0, STORY - 0.7, -20 + s * 6.05, 4.4, 0.3, 0.2, 'trim');
    M(1.85, 0, -20 + s * 6.05, 0.3, STORY - 0.4, 0.2, 'trim');
  }
  B(0, ROOF - 0.3, -20, 4, 0.3, 12, 'slab');
  PK('hp', 5.2, -17.5);
  PK('hp', -5.2, -17.5);
  // A well in the middle of the north street
  B(0, 0, -29, 2, 1.1, 2, 'quay');
  for (const sx of [1, -1]) B(sx * 0.8, 1.1, -29, 0.15, 1.3, 0.15, 'wood');
  D(0, 2.4, -29, 2.2, 0.15, 1.2, 'roof');
  // North rows against the outer wall, 2.2 m alleys between them
  row(-7, 7, -40, -32, ROOF, 'bld2');
  row(9.2, 13.6, -40, -32, ROOF, 'bld1', false);
  row(13.6, 18, -40, -32, ROOF, 'bld4');
  row(20.2, 24.6, -40, -32, ROOF, 'bld3', false);
  row(24.6, 29, -40, -32, ROOF, 'plaster');
  row(29, 40, -40, -34, 3 * STORY, 'brick');
  // Walk-in house between the north street and the square
  MH({
    x: 17.75,
    z: -20.5,
    w: 12.5,
    d: 11,
    stories: 2,
    wall: 'brick',
    frame: 'trim',
    ground: 'tile',
    awning: 'awning',
    parapet: false,
    doors: [
      { side: 'n', at: -3 },
      { side: 'w', at: 0 },
      { side: 'e', at: 2 },
      { side: 's', at: 3 },
    ],
    windows: [
      { side: 'n', at: 3, ...SHOP },
      { side: 's', at: -3 },
      { side: 'n', at: -3.5, story: 1 },
      { side: 'n', at: 3.5, story: 1 },
      { side: 's', at: 0, story: 1 },
      { side: 'w', at: -2, story: 1 },
      { side: 'e', at: 2, story: 1 },
    ],
    stairs: [
      { side: 'e', at: -4, dir: 1 },
      { side: 'w', at: 4, dir: -1, story: 1 },
    ],
    partitions: [{ run: 'z', at: -1, door: 2.5 }],
    balconies: [{ side: 'n', at: 0, w: 3 }],
  });
  M(20.5, 0, -18, 1.4, 1.1, 1.4, 'crate');
  // Solid block on the square, across the alley
  row(11.5, 17.75, -12.8, -3.5, ROOF, 'bld1', false);
  row(17.75, 24, -12.8, -3.5, ROOF, 'bld2');
  // The base house (east / west end), walk-in, against the outer wall
  MH({
    x: 34.5,
    z: -19.5,
    w: 11,
    d: 17,
    stories: 2,
    wall: 'bld4',
    ground: 'tile',
    awning: 'awning',
    shutter: 'shutter',
    parapet: false,
    doors: [
      { side: 'w', at: -5 },
      { side: 's', at: -2.5 },
      { side: 'n', at: 0 },
    ],
    windows: [
      { side: 'w', at: 1 },
      { side: 's', at: 2.5 },
      { side: 'w', at: -4, story: 1 },
      { side: 'w', at: 4, story: 1 },
      { side: 'n', at: 0, story: 1 },
    ],
    stairs: [
      { side: 'e', at: -6, dir: 1 },
      { side: 'e', at: 6, dir: -1, story: 1 },
    ],
    balconies: [{ side: 's', at: 2, w: 3 }],
  });
  M(31, 0, -15, 1.4, 1.1, 1.4, 'crate');

  // ------------------------------------------------------------------ South: canal, café house and the south rows
  D(0, 0, 26.5, 2 * CANAL, 0.05, 27, 'water');
  // Railings along the canal, open at the footbridge and the street bridge
  for (const [z0, z1] of [
    [13, 19.5],
    [22.5, 26],
  ] as const)
    for (const s of [1, -1]) railing(B, s * (CANAL + 0.06), z0, s * (CANAL + 0.06), z1, 0);
  B(0, 0, 21, 2 * CANAL + 0.6, 0.35, 3, 'bridge');
  B(0, 0, 29, 2 * CANAL + 0.6, 0.35, 6, 'bridge');
  // Café house on the middle street: shop windows, a balcony, stairs to the roof
  MH({
    x: 17.75,
    z: 8,
    w: 12.5,
    d: 9,
    stories: 2,
    wall: 'plaster',
    ground: 'tile',
    awning: 'awning',
    shutter: 'shutter',
    parapet: false,
    doors: [
      { side: 'n', at: -3 },
      { side: 'w', at: 0 },
      { side: 's', at: 3 },
      { side: 'e', at: 0 },
    ],
    windows: [
      { side: 'n', at: 3, ...SHOP },
      { side: 'w', at: -2.5, ...SHOP },
      { side: 'n', at: -4, story: 1 },
      { side: 'w', at: 0, story: 1 },
      { side: 'e', at: 0, story: 1 },
      { side: 's', at: -3, story: 1 },
    ],
    stairs: [
      { side: 's', at: -5, dir: 1 },
      { side: 'n', at: 5, dir: -1, story: 1 },
    ],
    balconies: [{ side: 'n', at: 0.5, w: 4 }],
  });
  M(15, 0, 6, 2.6, 1.1, 0.8, 'wood'); // the bar
  row(11.5, 24, 14.7, 26, ROOF, 'bld1');
  row(4.5, 9.3, 16, 26, ROOF, 'bld3');
  row(29, 40, 11, 28, ROOF, 'bld2');
  LD(29, 16, ROOF, 1);
  LD(-29, 16, ROOF, 3);
  row(1.75, 12, 32, 40, ROOF, 'brick');
  row(14.2, 21.6, 32, 40, ROOF, 'bld4', false);
  row(21.6, 29, 32, 40, ROOF, 'bld2');
  row(29, 40, 34, 40, 3 * STORY, 'plaster');

  // ------------------------------------------------------------------ Up high: planks join every roof
  plank(7, -24, 11.5, -24); // gatehouse ↔ north house, over the lane
  plank(5, -32, 5, -26); // gatehouse ↔ north row, over the north street
  plank(7, -39, 9.2, -39); // north row, over its alleys
  plank(18, -39, 20.2, -39);
  plank(22.5, -32, 22.5, -26); // north row ↔ north house
  plank(23, -15, 23, -12.8); // north house ↔ the block on the square
  plank(13, -3.5, 13, 3.5); // over the middle street, by the square
  plank(23, 12.5, 23, 14.7); // café house ↔ south block
  plank(9.3, 25, 11.5, 25);
  plank(-4.5, 24, 4.5, 24, false); // over the canal
  plank(24, -25, 29, -25); // over the cross street, to the base roofs
  plank(24, 20, 29, 20);
  plank(22, 26, 22, 32); // over the south street
  plank(12, 39, 14.2, 39);
  plank(-1.75, 37, 1.75, 37, false);
  // Chimneys and skylights for cover on the base roofs
  M(37, ROOF, -20, 1, 1.3, 2.4, 'brick');
  M(34, ROOF, 20, 2.4, 1.3, 1, 'brick');

  // ------------------------------------------------------------------ The base yards and street cover
  pad(B, 37.6, -8.4);
  pad(B, -37.6, -8.4);
  M(33, 0, 7.5, 2.4, 1.2, 2.4, 'crate');
  M(35.4, 0, 8.1, 2.4, 2.4, 1.2, 'crate2');
  MP(31.5, -8, CART);
  BR(30, 2.8);
  BR(-30, 2.8);
  BK(39, -2, 1.3);
  BK(-39, -2, 1.3);
  // Middle street: a cart, crates and barrels
  MP(16, -2, CART);
  BK(22.5, 2.3, 1.2);
  BK(-22.5, 2.3, 1.2);
  MP(19, 2.6, BARREL);
  // Cross street and the long streets
  MP(26.5, -10, CART);
  BR(25, 9);
  BR(-25, 9);
  MP(27.8, 24, BARREL);
  MP(28, -30.5, car(true));
  MP(16, 30.6, car(true));
  MP(9, -27, CART);
  M(10.5, 0, 27.5, 2.4, 1.2, 1.2, 'crate');
  for (const [x, z] of [
    [12, -26.5],
    [24.3, -2],
    [24.3, 31.5],
    [7.4, 13.5],
    [35, -27.5],
    [35, 28.5],
  ] as const)
    MP(x, z, LAMP);

  // ------------------------------------------------------------------ Spawns: streets and base yards
  for (const [x, z] of [
    [37, 0],
    [34, -5],
    [34, 5],
    [26.5, -19],
    [26.5, 18],
    [20, 0],
    [15, -29],
    [19.5, 29],
    [35, -31],
    [35, 31],
    [7, 14.5],
  ] as const)
    MS(x, z);
}
