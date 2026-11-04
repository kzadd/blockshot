import { BARREL, TREE, pad } from '../props';
import { doorAt, flight, house, railing, slab, wall, windowAt } from '../structures';
import type { MapBuildContext, MapLadder } from '../types';

/** The perimeter wall: thickness, height of its walkway (adarve) and the merlons on its inner edge (m). */
const RAMPART_T = 3;
const RAMPART_H = 4.5;
const MERLON_H = 1.1;
const MERLON_GAP = 3.2;
/** Church: footprint, height of its walls and roof (the roof top is the tower's second floor). */
const CHURCH = { x: 14, z0: -37.6, z1: -26 };
const CHURCH_ROOF = 6;
/** Cloister: outer square, depth of the arcaded galleries and the floor of the upper gallery. */
const CL = { x: 13, z0: -20, z1: 6 };
const GALLERY = 3.5;
const UPPER = 3;
const CL_Z = (CL.z0 + CL.z1) / 2;
const GARDEN = CL.x - GALLERY;
/** Low walls round the orchard and the cloister parapets. */
const LOW = 0.9;
const ARCH = { w: 2, sill: 1, top: 2.6 };

/** The same context with x mirrored: everything built through it lands on the west half. */
function mirrored(c: MapBuildContext): MapBuildContext {
  const flip = (d: MapLadder['dir']): MapLadder['dir'] => (d === 1 ? 3 : d === 3 ? 1 : d);
  return {
    ...c,
    B: (x, y, z, w, h, d, k) => c.B(-x, y, z, w, h, d, k),
    D: (x, y, z, w, h, d, k) => c.D(-x, y, z, w, h, d, k),
    S: (x, z) => c.S(-x, z),
    P: (x, z, parts) =>
      c.P(
        -x,
        z,
        parts.map(([dx, ...r]) => [-dx, ...r]),
      ),
    BR: (x, z) => c.BR(-x, z),
    BK: (x, z, s, y) => c.BK(-x, z, s, y),
    PK: (k, x, z, y) => c.PK(k, -x, z, y),
    LD: (x, z, y1, dir) => c.LD(-x, z, y1, flip(dir)),
    ZL: (a, b) => c.ZL([-a[0], a[1], a[2]], [-b[0], b[1], b[2]]),
    PW: (x, z, y) => c.PW(-x, z, y),
  };
}

// Monasterio: a walled hilltop monastery. North: the church nave with its bell tower; middle: the cloister (garden,
// arcaded walk and an upper gallery); south: the orchard. Each half (mirrored on x) has a refectory, stables, a barn
// and a granary in the yards, and the perimeter wall carries a walkway with merlons, a bartizan and a gatehouse.
// Three lanes cross the middle: church (nave, roof and the passage behind it), cloister, and orchard / south walkway.
export function buildMonasterio(ctx: MapBuildContext): void {
  church(ctx);
  cloister(ctx);
  orchard(ctx);
  for (const m of [ctx, mirrored(ctx)]) half(m);
}

/** The nave (walk-in, doors at both ends and to the south), its roof as a walkway and the bell tower. */
function church(ctx: MapBuildContext): void {
  const { B, D, PK } = ctx;
  const { x, z0, z1 } = CHURCH;
  const top = CHURCH_ROOF - 0.3;
  const zc = (z0 + z1) / 2;
  wall(ctx, 'x', z0 + 0.15, -x, x, 0, top, 'wall2', [windowAt(-10), windowAt(10)]);
  wall(ctx, 'x', z1 - 0.15, -x, x, 0, top, 'wall2', [
    doorAt(0),
    doorAt(-8),
    doorAt(8),
    windowAt(-11.5),
    windowAt(11.5),
    windowAt(-4.8),
    windowAt(4.8),
  ]);
  for (const s of [1, -1]) {
    wall(ctx, 'z', s * (x - 0.15), z0 + 0.3, z1 - 0.3, 0, top, 'wall2', [
      doorAt(zc, 2),
      windowAt(z0 + 2.4),
      windowAt(z1 - 2.6),
    ]);
    // Parapet round the roof (open behind the tower, whose door gives onto it)
    wall(ctx, 'z', s * (x - 0.15), z0 + 0.3, z1 - 0.3, CHURCH_ROOF, 1, 'wall2', [], { frame: null });
    wall(ctx, 'x', z1 - 0.15, s > 0 ? 3 : -x, s > 0 ? x : -3, CHURCH_ROOF, 1, 'wall2', [], { frame: null });
  }
  wall(ctx, 'x', z0 + 0.15, -x, x, CHURCH_ROOF, 1, 'wall2', [], { frame: null });
  slab(B, { x0: -x, x1: x, z0, z1 }, CHURCH_ROOF, 0.3, 'roof');
  D(0, CHURCH_ROOF - 0.25, z0 - 0.06, 2 * x + 0.24, 0.25, 0.12, 'trim');
  // Inside: floor, two rows of columns, pews and the altar
  B(0, 0, zc, 2 * x - 0.6, 0.04, z1 - z0 - 0.6, 'tile');
  for (const cx of [-9, -3.5, 3.5, 9]) for (const cz of [z0 + 3, z1 - 2.6]) B(cx, 0, cz, 0.8, top, 0.8, 'wall2');
  for (const px of [-6.25, 6.25]) for (const pz of [zc - 1.2, zc + 1.2]) B(px, 0, pz, 3, 0.5, 0.6, 'wood');
  B(0, 0, z0 + 1.2, 3.2, 1.1, 1.2, 'wall2');
  PK('armor', 0, zc);
  // Bell tower: up through three floors to a lookout. Ground: church and cloister; first floor: the upper gallery
  // of the cloister; second floor (the belfry): the church roof
  house(ctx, {
    x: 0,
    z: z1 + 3,
    w: 6,
    d: 6,
    stories: 3,
    wall: 'wall2',
    ground: 'tile',
    roof: 'roof',
    doors: [{ side: 'n' }, { side: 's' }, { side: 's', story: 1 }, { side: 'n', story: 2 }],
    windows: [
      { side: 'e', at: 1, story: 1 },
      { side: 'w', at: -1, story: 1 },
      { side: 'e', ...ARCH },
      { side: 'w', ...ARCH, story: 2 },
      { side: 'e', ...ARCH, story: 2 },
      { side: 's', ...ARCH, story: 2 },
    ],
    stairs: [
      { side: 'e', at: -2.3, dir: 1 },
      { side: 'w', at: 2.3, dir: -1, story: 1 },
      { side: 'e', at: -2.3, dir: 1, story: 2 },
    ],
  });
}

/** Square cloister: garden with a well, arcaded walk on columns, upper gallery on top reached by stairs. */
function cloister(ctx: MapBuildContext): void {
  const { B, D, P, PW } = ctx;
  const { x, z0, z1 } = CL;
  const h = UPPER + 1;
  // Outer walls: doors and windows below, a parapet round the upper gallery (open where the tower stands)
  wall(ctx, 'x', z0 + 0.15, -x, x, 0, UPPER, 'wall2', [
    doorAt(0),
    doorAt(-8),
    doorAt(8),
    windowAt(-4.5),
    windowAt(4.5),
  ]);
  wall(ctx, 'x', z1 - 0.15, -x, x, 0, h, 'wall2', [
    doorAt(0),
    doorAt(-8.5),
    doorAt(8.5),
    windowAt(-4.5),
    windowAt(4.5),
  ]);
  for (const s of [1, -1]) {
    wall(ctx, 'x', z0 + 0.15, s > 0 ? 3 : -x, s > 0 ? x : -3, UPPER, 1, 'wall2', [], { frame: null });
    wall(ctx, 'z', s * (x - 0.15), z0 + 0.3, z1 - 0.3, 0, h, 'wall2', [
      doorAt(CL_Z),
      doorAt(z0 + 6.5),
      windowAt(z0 + 9.7),
    ]);
  }
  // Upper gallery floor over the walk, with a stairwell in the east and west galleries
  const sx = x - 0.3; // inner face of the outer wall
  const stair = { from: z1 - 4, len: 3.6 };
  const hole = (s: number) => ({
    x0: s > 0 ? sx - 1.7 : -sx,
    x1: s > 0 ? sx : -sx + 1.7,
    z0: stair.from - stair.len,
    z1: stair.from + 0.4,
  });
  slab(B, { x0: -x, x1: x, z0, z1: z0 + GALLERY }, UPPER, 0.3, 'roof');
  slab(B, { x0: -x, x1: x, z0: z1 - GALLERY, z1 }, UPPER, 0.3, 'roof');
  for (const s of [1, -1]) {
    const r = { x0: s > 0 ? GARDEN : -x, x1: s > 0 ? x : -GARDEN, z0: z0 + GALLERY, z1: z1 - GALLERY };
    slab(B, r, UPPER, 0.3, 'roof', [hole(s)]);
    flight(B, 'z', stair.from, -1, s * sx, s * (sx - 1.3), 0, 6);
    const edge = s * (sx - 1.7 - 0.06);
    railing(B, edge, stair.from - stair.len, edge, stair.from + 0.4, UPPER);
    railing(B, s * (sx - 1.7), stair.from + 0.46, s * sx, stair.from + 0.46, UPPER);
  }
  // Columns of the arcade along the garden, and the low parapet over them (gaps in the middle of each side)
  const offs = [-9.2, -6.13, -3.07, 0, 3.07, 6.13, 9.2];
  for (const o of offs) {
    for (const s of [1, -1]) {
      B(o, 0, s > 0 ? z1 - GALLERY + 0.3 : z0 + GALLERY - 0.3, 0.6, UPPER - 0.3, 0.6, 'wall2');
      if (Math.abs(o) < 9) B(s * (GARDEN + 0.3), 0, CL_Z + o, 0.6, UPPER - 0.3, 0.6, 'wall2');
    }
  }
  for (const s of [1, -1]) {
    for (const t of [1, -1]) {
      const mid = t * (1.5 + (GARDEN - 1.5) / 2);
      const len = GARDEN - 1.5;
      B(mid, UPPER, s > 0 ? z1 - GALLERY + 0.15 : z0 + GALLERY - 0.15, len, LOW, 0.3, 'wall2');
      B(s * (GARDEN + 0.15), UPPER, CL_Z + mid, 0.3, LOW, len, 'wall2');
    }
  }
  // Garden: lawn, the well in the middle, hedges and trees
  B(0, 0, CL_Z, 2 * GARDEN, 0.04, 2 * GARDEN, 'platform');
  B(0, 0, CL_Z, 2.6, 0.9, 2.6, 'wall2');
  D(0, 0.9, CL_Z, 2.1, 0.02, 2.1, 'water');
  for (const s of [1, -1]) B(s * 1.1, 0.9, CL_Z, 0.25, 1.6, 0.25, 'wood');
  D(0, 2.5, CL_Z, 2.6, 0.2, 0.2, 'wood');
  for (const s of [1, -1]) {
    B(s * 3.6, 0, CL_Z, 0.8, 1.0, 3.2, 'crate2');
    for (const tz of [-5.5, 5.5]) P(s * 5.5, CL_Z + tz, TREE);
    PW(s * 6.5, CL_Z);
  }
}

/** Orchard and vegetable garden between the cloister and the south wall, with the gatehouse on the walkway. */
function orchard(ctx: MapBuildContext): void {
  const { B, D, PK } = ctx;
  // Wayside cross in the street between cloister and orchard (it breaks the long east-west line)
  B(0, 0, 9, 1.8, 1.2, 1.8, 'wall2');
  B(0, 1.2, 9, 0.4, 2.2, 0.4, 'wall2');
  D(0, 2.6, 9, 1.4, 0.3, 0.3, 'wall2');
  PK('armor', 0, 22.5);
  // Gatehouse on the south walkway: the walk goes through it
  house(ctx, {
    x: 0,
    z: 40 - RAMPART_T / 2,
    y: RAMPART_H,
    w: 7,
    d: RAMPART_T,
    wall: 'wall',
    roof: 'roof',
    parapet: false,
    doors: [{ side: 'e' }, { side: 'w' }],
    windows: [
      { side: 'n', at: -1.8 },
      { side: 'n', at: 1.8 },
    ],
  });
}

/** Everything on the east half (built a second time, mirrored, for the west). */
function half(m: MapBuildContext): void {
  const { B, S, P, BR, BK, PK, LD } = m;
  const inner = 40 - RAMPART_T; // inner face of the perimeter wall
  // Perimeter wall with its walkway (east side and half of the south side)
  B(40 - RAMPART_T / 2, 0, -RAMPART_T / 2, RAMPART_T, RAMPART_H, 80 - RAMPART_T, 'wall');
  B(20, 0, 40 - RAMPART_T / 2, 40, RAMPART_H, RAMPART_T, 'wall');
  const skipE: [number, number][] = [
    [-34, -26],
    [-12.8, -6.2],
    [-4.6, 14.6],
    [22.6, 25.4],
  ];
  const skipS: [number, number][] = [
    [0, 4.4],
    [5, 12.4],
    [24.6, 27.4],
  ];
  for (let z = -38.5; z < inner - 1; z += MERLON_GAP)
    if (!skipE.some(([a, b]) => z > a && z < b)) B(inner + 0.25, RAMPART_H, z, 0.5, MERLON_H, 1, 'wall');
  for (let x = 5; x < inner - 1; x += MERLON_GAP)
    if (!skipS.some(([a, b]) => x > a && x < b)) B(x, RAMPART_H, inner + 0.25, 1, MERLON_H, 0.5, 'wall');
  // Up to the walkway: stairs in the north-east yard and by the orchard, ladders by the barn
  flight(B, 'z', -27, -1, inner, inner - 1.3, 0, 9);
  flight(B, 'x', 6, 1, inner, inner - 1.3, 0, 9);
  LD(inner, 24, RAMPART_H, 1);
  LD(26, inner, RAMPART_H, 2);
  // Bartizan on the east walkway: the walk goes through it, a window over the stables yard
  house(m, {
    x: 40 - RAMPART_T / 2,
    z: -9.5,
    y: RAMPART_H,
    w: RAMPART_T,
    d: 5,
    wall: 'wall',
    roof: 'roof',
    parapet: false,
    doors: [{ side: 'n' }, { side: 's' }],
    windows: [{ side: 'w' }],
  });

  // Refectory (north-east), two floors, roof terrace by an inner stair; a 2.2 m alley between it and the church
  const rx0 = CHURCH.x + 2.2;
  const rx1 = 30;
  house(m, {
    x: (rx0 + rx1) / 2,
    z: -33,
    w: rx1 - rx0,
    d: 14,
    stories: 2,
    wall: 'plaster',
    ground: 'tile',
    roof: 'roof',
    shutter: 'shutter',
    doors: [
      { side: 'w', at: 4 },
      { side: 's', at: -3 },
      { side: 's', at: 4 },
      { side: 'e', at: 3 },
    ],
    windows: [
      { side: 's', at: 0.5 },
      { side: 'w', at: -1 },
      { side: 'e', at: -2 },
      { side: 's', story: 1, at: -4 },
      { side: 's', story: 1, at: 4 },
      { side: 'w', story: 1, at: 3 },
      { side: 'e', story: 1, at: 3 },
    ],
    stairs: [
      { side: 'n', at: -3, dir: 1 },
      { side: 'e', at: 2, dir: -1, story: 1 },
    ],
  });
  for (const tz of [-30.5, -34]) B(23.4, 0, tz, 6, 0.8, 1, 'wood');

  // Stables against the east wall: one floor, stalls open to the yard; the roof is a step below the walkway
  house(m, {
    x: 33.5,
    z: 5,
    w: 7,
    d: 18,
    wall: 'plaster',
    roof: 'roof',
    parapet: false,
    doors: [{ side: 'w', at: -5 }, { side: 'w', at: 0 }, { side: 'w', at: 5 }, { side: 'n', at: 2 }, { side: 's' }],
    outside: { side: 'n', at: -3.4, dir: 1 },
  });
  for (const tz of [1, 5, 9]) B(35, 0, tz, 3.4, 1.4, 0.3, 'wood');
  // Hay stacked against the stables: a jump onto the roof
  B(28.6, 0, 12, 1.2, 2.2, 1.2, 'crate2');
  B(27.4, 0, 12, 1.2, 1.1, 1.2, 'crate2');

  // Barn and granary (south-east), a 2.2 m alley between them to wall jump up to the roofs
  const gx1 = 17.8;
  const bx0 = gx1 + 2.2;
  house(m, {
    x: bx0 + 6,
    z: 26,
    w: 12,
    d: 10,
    stories: 2,
    wall: 'brick',
    ground: 'tile',
    roof: 'roof',
    doors: [{ side: 'n', at: -3 }, { side: 'n', at: 3 }, { side: 'e' }, { side: 's', at: -3 }],
    windows: [
      { side: 'w', at: -2.5 },
      { side: 'w', at: 2.5 },
      { side: 's', at: 1 },
      { side: 'w', story: 1 },
      { side: 'n', story: 1, at: -3 },
      { side: 'n', story: 1, at: 3 },
      { side: 'e', story: 1 },
      { side: 's', story: 1 },
    ],
    stairs: [
      { side: 's', at: 4.5, dir: -1 },
      { side: 'n', at: -4.5, dir: 1, story: 1 },
    ],
  });
  house(m, {
    x: gx1 - 2.9,
    z: 27,
    w: 5.8,
    d: 12,
    stories: 2,
    wall: 'wall2',
    ground: 'tile',
    roof: 'roof',
    doors: [{ side: 'n' }, { side: 's' }],
    windows: [
      { side: 'w', at: 2 },
      { side: 'e', at: 3 },
      { side: 'w', story: 1, at: -2 },
      { side: 'w', story: 1, at: 2.5 },
      { side: 'e', story: 1, at: -3 },
    ],
    stairs: [
      { side: 'w', at: -4, dir: 1 },
      { side: 'e', at: 4, dir: -1, story: 1 },
    ],
  });

  // Orchard (this half): low stone walls, fruit trees and vegetable beds
  B(6, 0, 12.2, 8, LOW, 0.4, 'rock');
  B(9.8, 0, 16, 0.4, LOW, 7.6, 'rock');
  B(9.8, 0, 29.5, 0.4, LOW, 11, 'rock');
  for (const tx of [3, 7]) for (const tz of [16, 22.5, 29]) P(tx, tz, TREE);
  for (const bz of [19.25, 25.75, 32]) B(5, 0, bz, 5, 0.6, 1, 'platform');

  // Yards: carts, hay, a trough, trees and barrels for cover
  B(16.5, 0, -13, 1.2, 1.1, 2.4, 'crate2');
  B(16.5, 1.1, -13.6, 1.2, 1.1, 1.2, 'crate2');
  B(22.5, 0, -8, 1.4, 1.1, 2.8, 'crate');
  B(28, 0, -9, 0.9, 0.8, 3, 'wall2');
  B(22.5, 0, 8, 2.4, 1.1, 1.2, 'crate2');
  B(28.5, 0, -21, 2.8, 1.1, 1.4, 'crate');
  B(16.5, 0, 13.5, 3, 1, 0.5, 'rock');
  P(22, 2, TREE);
  P(17, -1, TREE);
  P(31.5, 18, TREE);
  P(33.5, -24, BARREL);
  pad(B, 15.6, -16);
  BR(18, 10);
  BR(33, -31);
  BK(17, -3);
  BK(11, 9.5);
  BK(3, 35.5);
  PK('hp', 15.1, -23);

  // Spawns: the yards, the lanes by the barn and the street south of the cloister
  for (const [x, z] of [
    [33.5, -36],
    [33.5, -20],
    [20, -21],
    [26, -14],
    [19, -8],
    [25, -2],
    [19, 4],
    [25, 10],
    [34.5, 17.5],
    [27, 34],
    [14.9, 16.5],
    [6, 9],
  ] as const)
    S(x, z);
}
