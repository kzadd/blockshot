import { TREE, car } from '../props';
import { doorAt, flight, house, railing, slab, wall, windowAt, type Opening } from '../structures';
import type { MapBuildContext, MapLadder, PropPart } from '../types';

/** Ground-floor walls stop under the first floor slab; its top is the first floor (m). */
const F1 = 3;
const F1_T = 0.2;
const G_H = F1 - F1_T;
/** First floor walls (the upper floor is a roofless ruin) and the low wall round the courtyard gallery. */
const F1_H = 2.6;
const PARAPET = 1;
/** Courtyard (open to the sky) half side, the cloister walk round it, and the two corridor rings. */
const YARD = 9;
const CLOISTER = 12;
const RING_IN = 21;
const RING_OUT = 24;
/** Corridor baffles: how far they stick out across the 3 m corridor (they break the long sightlines). */
const BAFFLE = 1.6;
/** Stairwell flight in the corner room of each wing (along the corridor wall, climbing +x). */
const STAIR_X = 12.5;
const STAIR_STEPS = 6;

/** The same context turned k quarter turns round the centre ((x, z) → (-z, x) each turn). */
export function turned(c: MapBuildContext, k: number): MapBuildContext {
  const rot = (x: number, z: number): [number, number] => {
    let p: [number, number] = [x, z];
    for (let i = 0; i < k; i++) p = [-p[1], p[0]];
    return [p[0] || 0, p[1] || 0];
  };
  const swap = k % 2 === 1;
  const box =
    (fn: MapBuildContext['B']): MapBuildContext['B'] =>
    (x, y, z, w, h, d, kind) => {
      const [rx, rz] = rot(x, z);
      fn(rx, y, rz, swap ? d : w, h, swap ? w : d, kind);
    };
  const parts = (ps: PropPart[]): PropPart[] =>
    ps.map(([dx, dy, dz, w, h, d, kind]) => {
      const [rx, rz] = rot(dx, dz);
      return [rx, dy, rz, swap ? d : w, h, swap ? w : d, kind];
    });
  return {
    ...c,
    B: box(c.B),
    D: box(c.D),
    S: (x, z) => c.S(...rot(x, z)),
    P: (x, z, ps) => c.P(...rot(x, z), parts(ps)),
    BR: (x, z) => c.BR(...rot(x, z)),
    BK: (x, z, s, y) => c.BK(...rot(x, z), s, y),
    PK: (kind, x, z, y) => c.PK(kind, ...rot(x, z), y),
    LD: (x, z, y1, dir) => c.LD(...rot(x, z), y1, ((dir + k) % 4) as MapLadder['dir']),
    PW: (x, z, y) => c.PW(...rot(x, z), y),
  };
}

// Sanatorio: an abandoned sanatorium at night, built for Infectados. A walled courtyard in the middle, the cloister
// walk round it and four wings laid out as a pinwheel (the same wing turned four times, so every corridor runs into
// the next one): two corridor rings, rooms between and around them, a stairwell in each wing and a ladder up from
// the courtyard. The first floor is a roofless ruin over the whole building. The north wing holds the «zona segura»
// (the operating theatre: two doors, sandbags and supplies); the south-west corner, the water tower (two floors
// and a roof, the last hideout).
export function buildSanatorio(ctx: MapBuildContext): void {
  courtyard(ctx);
  for (let k = 0; k < 4; k++) wing(turned(ctx, k), k);
}

/** The courtyard: dry fountain, dead trees, a wrecked ambulance and rubble (nothing in the open runs far). */
function courtyard(ctx: MapBuildContext): void {
  const { B, P, PK, PW } = ctx;
  B(0, 0, 0, 3, 0.8, 3, 'wall2');
  B(0, 0.8, 0, 1.4, 5.2, 1.4, 'wall2');
  for (const [x, z] of [
    [-5.5, -5.5],
    [5.5, 5.5],
    [5.8, -5],
  ] as const)
    P(x, z, TREE);
  P(-5.5, 4.5, car(false));
  B(3.5, 0, -1.5, 1.2, 1.1, 1.2, 'crate');
  B(-3, 0, 2.5, 2.4, 0.9, 1, 'rock');
  PK('hp', 0, 6.5);
  PW(0, -6.5);
}

/** One wing (laid out as the north one: x from -12 to 40, z from -40 to -12). */
function wing(m: MapBuildContext, k: number): void {
  const { B, S, BK, BR, PK, LD } = m;
  const gw = (run: 'x' | 'z', at: number, from: number, to: number, holes: Opening[] = []) =>
    wall(m, run, at, from, to, 0, G_H, 'plaster', holes);
  const up = (run: 'x' | 'z', at: number, from: number, to: number, holes: Opening[] = []) =>
    wall(m, run, at, from, to, F1, F1_H, 'brick', holes, { frame: null });

  // ---- Ground floor
  // Courtyard wall: two arches into the cloister walk, a window, the ladder between the east arch and the corner
  gw('x', -YARD, -YARD - 0.15, YARD - 0.15, [doorAt(-5, 2), windowAt(-1, 1.6), doorAt(3.5, 2)]);
  LD(7, -YARD + 0.15, F1, 0);
  // Cloister wall, then the inner band of rooms (ward, day room, stairwell) and the inner corridor wall
  gw('x', -CLOISTER, -CLOISTER, RING_IN, [doorAt(-6), doorAt(6.5), doorAt(16)]);
  gw('x', -RING_IN, -CLOISTER, RING_IN, [doorAt(4)]);
  gw('z', -1, -RING_IN, -CLOISTER, [doorAt(-14.5)]);
  gw('z', 10, -RING_IN, -CLOISTER, [windowAt(-16.5, 1.6)]);
  gw('z', RING_IN, -RING_IN, -CLOISTER, [doorAt(-15)]);
  // Outer corridor wall and the rooms against the map wall: dormitory, two small rooms, the theatre, the corner hall
  gw('x', -RING_OUT, -CLOISTER, RING_OUT, [doorAt(-6), doorAt(6), doorAt(18)]);
  gw('z', RING_OUT, -RING_OUT, -CLOISTER, [doorAt(-18)]);
  gw('z', 0, -40, -RING_OUT, [doorAt(-36)]);
  gw('x', -32, 0, 12, [doorAt(3)]);
  gw('z', 12, -40, -RING_OUT);
  gw('z', RING_OUT, -40, -RING_OUT, [doorAt(-30)]);
  gw('x', -26, RING_OUT, 40, [doorAt(36)]);
  gw('x', -CLOISTER, RING_OUT, 40, [doorAt(30)]);
  // Baffles in the outer corridor, from alternate sides
  for (const [x, side] of [
    [-13, -1],
    [-1, 1],
    [12, -1],
  ] as const)
    B(x, 0, side < 0 ? -RING_OUT + BAFFLE / 2 : -RING_IN - BAFFLE / 2, 0.3, G_H, BAFFLE, 'plaster');
  // Stairwell: one flight along the corridor wall up to the first floor
  const c0 = -RING_IN + 0.15;
  const end = flight(B, 'x', STAIR_X, 1, c0, c0 + 1.3, 0, STAIR_STEPS);
  const well = { x0: STAIR_X - 0.4, x1: end, z0: c0, z1: c0 + 1.7 };
  // Furniture: beds in the ward and the dormitory, a table in the day room, crates in the corner hall
  for (const bx of [-10, -7, -4]) B(bx, 0, -19.4, 1, 0.6, 2, 'wood');
  for (const [bx, bz] of [
    [-10, -38.4],
    [-7, -38.4],
    [-4, -38.4],
    [-10, -25.6],
    [-3, -25.6],
  ] as const)
    B(bx, 0, bz, 1, 0.6, 2, 'wood');
  B(5, 0, -16.5, 3, 0.9, 1.4, 'wood');
  B(28, 0, -38.4, 2.4, 1.2, 1.2, 'crate2');
  B(38.4, 0, -20, 1.2, 1.2, 2.4, 'crate2');
  BK(38, -16);
  BR(2, -38.5);
  if (k === 0) {
    // «Zona segura»: the operating theatre, two doors, sandbags inside each, tables and supplies
    B(17.5, 0, -26.3, 3, 0.95, 0.6, 'sandbag');
    B(21.4, 0, -31.5, 0.6, 0.95, 3, 'sandbag');
    B(16, 0, -34, 2.2, 1, 1, 'metal');
    B(14.6, 0, -38.6, 2.4, 1.1, 1, 'metal');
    PK('armor', 18, -37);
    PK('hp', 14, -30);
  } else {
    for (const bz of [-36, -29]) B(18, 0, bz, 3, 0.9, 1.2, 'metal');
    PK('hp', 22, -34);
  }

  // ---- First floor (a roofless ruin)
  slab(B, { x0: -YARD, x1: CLOISTER, z0: -CLOISTER, z1: -YARD }, F1, F1_T, 'tile');
  slab(B, { x0: -CLOISTER, x1: 40, z0: -40, z1: -CLOISTER }, F1, F1_T, 'tile', [well]);
  railing(B, well.x0 - 0.06, well.z0, well.x0 - 0.06, well.z1, F1);
  railing(B, well.x0 - 0.12, well.z1 + 0.06, well.x1, well.z1 + 0.06, F1);
  // Low wall round the gallery over the courtyard (open where the ladder comes up)
  wall(m, 'x', -YARD, -YARD - 0.15, YARD - 0.15, F1, PARAPET, 'plaster', [{ c: 7, w: 1.4, y0: 0, y1: PARAPET }], {
    frame: null,
  });
  up('x', -CLOISTER, -CLOISTER, RING_IN, [doorAt(-8), doorAt(2), doorAt(18.5)]);
  up('x', -RING_IN, -CLOISTER, RING_IN, [doorAt(-6), doorAt(7)]);
  up('z', 4, -RING_IN, -CLOISTER, [doorAt(-17.5)]);
  up('z', 11, -RING_IN, -CLOISTER, [doorAt(-13.5)]);
  up('z', RING_IN, -RING_IN, -CLOISTER, [doorAt(-18)]);
  up('x', -RING_OUT, -CLOISTER, RING_OUT, [doorAt(-2), doorAt(15)]);
  up('z', RING_OUT, -RING_OUT, -CLOISTER, [doorAt(-16)]);
  up('z', 6, -40, -RING_OUT, [doorAt(-36.5)]);
  up('z', RING_OUT, -40, -RING_OUT, [doorAt(-27)]);
  up('x', -30, RING_OUT, 40, [doorAt(34.5)]);
  up('x', -CLOISTER, RING_OUT, 40, [doorAt(29)]);
  for (const [x, side] of [
    [-8, 1],
    [6, -1],
    [18, 1],
  ] as const)
    B(x, F1, side < 0 ? -RING_OUT + BAFFLE / 2 : -RING_IN - BAFFLE / 2, 0.3, F1_H, BAFFLE, 'brick');
  // Rubble on the first floor
  B(-6, F1, -36, 2.2, 1.1, 1.2, 'rock');
  B(30, F1, -18, 1.2, 1.2, 1.2, 'crate');
  BK(-9, -16, 1.2, F1);

  if (k === 2) {
    // The water tower in the corner: two floors over the first floor and a roof with a low wall (the last hideout)
    house(m, {
      x: 34,
      z: -35,
      y: F1,
      w: 6,
      d: 6,
      stories: 2,
      wall: 'brick',
      ground: 'tile',
      roof: 'roof',
      doors: [{ side: 'w', at: 1.5 }],
      windows: [{ side: 'n' }, { side: 'e', story: 1 }, { side: 's', story: 1 }],
      stairs: [
        { side: 'e', at: -2.3, dir: 1 },
        { side: 'w', at: 2.3, dir: -1, story: 1 },
      ],
    });
    PK('armor', 34, -35, F1 + 6);
  }

  // Spawns on the first floor
  for (const [x, z] of [
    [-6, -16.5],
    [8, -17],
    [-6, -31],
    [17, -28],
    [32, -20],
    [27.5, -37],
  ] as const)
    S(x, z);
}
