import { BARREL, PALLET, car, sandbags } from '../props';
import { RAIL_T, STEP_RUN, STORY, flight, house, railing, slab, wall, type Rect } from '../structures';
import type { BoxFn, MapBuildContext, MapLadder } from '../types';

/** Concrete skeleton in the middle: half side, floors (3, 6) and its open roof (9). */
const T = 10;
const ROOF = 3 * STORY;
const DECK_T = 0.3;
const COLUMN = 0.8;
/** Column lines of the skeleton (both axes): the edges and a bay either side of the atrium. */
const COLS = [-9.6, -3.4, 3.4, 9.6];
/** Stair cores (east; the west one is its mirror): two bands along z split by a wall, a switchback per story. */
const CORE_A: [number, number] = [6.7, 8.0];
const CORE_B: [number, number] = [5.2, 6.5];
const CORE_Z = 1.8;
const CORE_WALLS = [5.1, 6.6, 8.1];
const WELL = 0.4;
/** The roof is only poured north of here: south of it only the beams on the column lines are in. */
const ROOF_EDGE = 6;
/** Scaffold on the east face of the skeleton (and its mirror): x range, z range of each deck. */
const SCAF_X0 = T;
const SCAF_X1 = 12.4;
const DECK1_Z: [number, number] = [-8, 8];
const DECK2_Z: [number, number] = [-8, -2.6];
const PLANK_T = 0.15;
/** Tower crane on the axis, north: mast, the landing on it, the walkable boom (jib) out over the skeleton. */
const MAST_Z = -30;
const MAST = 1.6;
const MAST_H = 22;
const LANDING = 12;
const JIB_W = 1.2;
const JIB_END = -5.5;
/** Neighbour block (half built) on the axis, south: two stories, roof at 6. */
const NB = { x0: -12, x1: 12, z0: 22, z1: 32 };
const NB_ROOF = 2 * STORY;
/** Stacked containers (site huts / stores): one is 2.6 high; two make a wall-jump alley 2.2 m from a building. */
const CONT_H = 2.6;
const ALLEY = 2.2;
const LOW = 1.2;

// Obra: a building site. In the middle a three-story concrete skeleton (open floors, an atrium, two stair cores,
// a roof poured only halfway) with a scaffold on each team's face; north the tower crane, its boom a walkway out over
// the skeleton roof and cables from its landing to the site offices; south a half-built neighbour block joined to
// the skeleton's second floor by a plank bridge. Lanes: north (crane yard), middle (through the skeleton's ground
// floor) and south (between the skeleton and the block, and behind it). Everything east (+x) is mirrored west.
export function buildObra(ctx: MapBuildContext): void {
  const { B, D, S, P, BR, BK, PK, LD, ZL, PW } = ctx;
  /** Box on both sides (once on the axis). */
  const M: BoxFn = (x, y, z, w, h, d, c) => {
    B(x, y, z, w, h, d, c);
    if (x !== 0) B(-x, y, z, w, h, d, c);
  };
  const MD: BoxFn = (x, y, z, w, h, d, c) => {
    D(x, y, z, w, h, d, c);
    if (x !== 0) D(-x, y, z, w, h, d, c);
  };
  const mirrored = { B: M, D: MD };
  const MS = (x: number, z: number) => (S(x, z), S(-x, z));
  const MP = (x: number, z: number, parts: Parameters<typeof P>[2]) => (P(x, z, parts), P(-x, z, parts));
  const ML = (x: number, z: number, y1: number, dir: MapLadder['dir']) => {
    LD(x, z, y1, dir);
    LD(-x, z, y1, dir === 1 ? 3 : dir === 3 ? 1 : dir);
  };
  /** Bars of rebar sticking out of the top of a wall or column (decoration). */
  const rebar = (x: number, y: number, z: number, len: number, alongX: boolean, h = 0.9) => {
    const n = Math.max(1, Math.round(len / 0.8));
    for (let i = 0; i < n; i++) {
      const a = -len / 2 + (i + 0.5) * (len / n);
      MD(alongX ? x + a : x, y, alongX ? z : z + a, 0.06, h, 0.06, 'metal');
    }
  };

  // ---------------------------------------------------------------- The skeleton
  skeleton(B, M, MD);
  // Scaffolds on the east and west faces: stairs from the ground at the south end up to deck 1 (3 m, level with the
  // first floor), a flight on it up to deck 2 (6 m, the second floor) and a ladder up a column to the roof
  scaffold(M);
  ML(T + 0.15, -3.4, ROOF, 3);
  // Rebar sticking up from the columns where the roof is still to be poured
  for (const x of COLS) if (x > 0) rebar(x, ROOF, COLS[3]!, 0.6, true, 1.2);

  // ---------------------------------------------------------------- The crane (north, on the axis)
  B(0, 0, MAST_Z, 4, 1, 3.6, 'concrete'); // footing
  B(0, 1, MAST_Z, MAST, MAST_H - 1, MAST, 'rail');
  // Landing round the mast at 12 m, a ladder up its north edge, and the boom from it south over the skeleton
  B(0, LANDING - 0.3, MAST_Z, 4, 0.3, 3.6, 'metal');
  LD(0, MAST_Z - 1.95, LANDING, 2);
  D(0, 0, MAST_Z - 2.1, 0.2, LANDING, 0.2, 'metal'); // the ladder's rail post
  const jibZ0 = MAST_Z + 1.8;
  B(0, LANDING - 0.3, (jibZ0 + JIB_END) / 2, JIB_W, 0.3, JIB_END - jibZ0, 'rail');
  D(0, LANDING + 0.9, (jibZ0 + JIB_END) / 2, 0.08, 0.08, JIB_END - jibZ0, 'railing'); // safety line overhead
  D(0, MAST_H, MAST_Z, 2.4, 2, 2.4, 'metal'); // cab
  D(0, MAST_H + 2, MAST_Z, 0.5, 5, 0.5, 'rail'); // peak
  D(0, MAST_H + 1, MAST_Z + 9, 1, 1, 18, 'rail'); // upper jib
  D(0, MAST_H + 1, MAST_Z - 5, 1, 1, 8, 'rail'); // counter-jib
  D(0, MAST_H - 0.6, MAST_Z - 8, 1.8, 2, 2.4, 'concrete'); // counterweight
  D(0, MAST_H - 7, MAST_Z + 17, 0.08, 8, 0.08, 'railing'); // cable
  D(0, MAST_H - 8.2, MAST_Z + 17, 2, 1.2, 2, 'crate'); // load
  // Cables from the landing down to the roof of each team's site office
  for (const s of [1, -1]) ZL([s * 1.6, LANDING + 2.3, MAST_Z], [s * 26.5, NB_ROOF + 2.3, -27]);
  PK('armor', 1.2, MAST_Z + 1.2, LANDING);
  // Crane yard: blocks of the counterweight waiting to go up, rebar bundles
  M(4.5, 0, MAST_Z - 1, 2.2, 1.6, 2.2, 'concrete');
  M(4.5, 1.6, MAST_Z - 1, 1.6, 0.9, 1.6, 'concrete');
  M(9, 0, -35, 5, 0.6, 1.6, 'metal');
  M(9, 0.6, -35, 4, 0.5, 1.2, 'metal');

  // ---------------------------------------------------------------- Neighbour block (south, on the axis)
  house(ctx, {
    x: 0,
    z: (NB.z0 + NB.z1) / 2,
    w: NB.x1 - NB.x0,
    d: NB.z1 - NB.z0,
    stories: 2,
    wall: 'brick',
    floor: 'slab',
    roof: 'slab',
    trim: null,
    parapet: false,
    doors: [
      { side: 'n', at: 7 },
      { side: 'n', at: -7 },
      { side: 's', at: 9.6 },
      { side: 's', at: -9.6 },
      { side: 'e', at: 0 },
      { side: 'w', at: 0 },
    ],
    windows: [
      { side: 'n', at: 2.5, w: 2 },
      { side: 'n', at: -2.5, w: 2 },
      { side: 's', at: 2.5, w: 2 },
      { side: 's', at: -2.5, w: 2 },
      { side: 'e', at: -3 },
      { side: 'w', at: -3 },
      { side: 'e', at: 3 },
      { side: 'w', at: 3 },
      { side: 'n', at: 0, story: 1, w: 2.4 },
      { side: 'n', at: 9.5, story: 1, w: 2 },
      { side: 'n', at: -9.5, story: 1, w: 2 },
      { side: 's', at: 2.5, story: 1, w: 2.4 },
      { side: 's', at: -2.5, story: 1, w: 2.4 },
      { side: 's', at: 8.5, story: 1, w: 2.4 },
      { side: 's', at: -8.5, story: 1, w: 2.4 },
      { side: 'e', at: 0, story: 1, w: 2.4 },
      { side: 'w', at: 0, story: 1, w: 2.4 },
    ],
    stairs: [
      { side: 's', at: 4, dir: 1 },
      { side: 's', at: -4, dir: -1 },
      { side: 'n', at: 4, dir: 1, story: 1 },
      { side: 'n', at: -4, dir: -1, story: 1 },
    ],
    partitions: [
      { run: 'z', at: 0, door: 0 },
      { run: 'z', at: 0, door: 0, story: 1 },
    ],
  });
  // Its roof: a parapet still going up (none over the alley side, a gap for the bridge), rebar on top of it
  const pz = (NB.z0 + NB.z1) / 2;
  wall(mirrored, 'x', NB.z0 + 0.15, 1.2, NB.x1, NB_ROOF, 1, 'brick', [], { frame: null });
  wall(mirrored, 'x', NB.z1 - 0.15, 0, NB.x1, NB_ROOF, 1, 'brick', [], { frame: null });
  wall(mirrored, 'z', NB.x1 - 0.15, pz + 1, NB.z1 - 0.3, NB_ROOF, 1, 'brick', [], { frame: null });
  rebar(6, NB_ROOF + 1, NB.z1 - 0.15, 10, true, 0.7);
  // Plank bridge from the skeleton's second floor to the block roof, propped in the middle
  B(0, 2 * STORY - DECK_T, (T + NB.z0) / 2, 2.4, DECK_T, NB.z0 - T, 'platform');
  for (const s of [1, -1]) railing(B, s * (1.2 - RAIL_T / 2), T, s * (1.2 - RAIL_T / 2), NB.z0, 2 * STORY);
  M(1.1, 0, (T + NB.z0) / 2, 0.3, 2 * STORY - DECK_T, 0.3, 'metal');
  // Containers stacked two high by its east (west) wall: the alley between them is climbed by wall jumping
  const cx = NB.x1 + ALLEY + CONT_H / 2;
  M(cx, 0, 25, CONT_H, CONT_H, 6, 'cont1');
  M(cx, CONT_H, 25, CONT_H, CONT_H, 6, 'cont2');

  // ---------------------------------------------------------------- Site offices (north-east / north-west)
  // Two stacked portacabins you walk into: a door on each side, stairs inside, a balcony towards the base, outside
  // stairs up to the roof (where the crane cable lands). Containers stacked by its west side make a second alley
  const ox = 29;
  const oz = -27;
  const ow = 9;
  house(mirrored, {
    x: ox,
    z: oz,
    w: ow,
    d: 5,
    stories: 2,
    wall: 'metal',
    floor: 'slab',
    roof: 'roof',
    ground: 'tile',
    trim: null,
    parapet: false,
    doors: [
      { side: 'w', at: 0 },
      { side: 'e', at: 0.6 },
    ],
    windows: [
      { side: 'n', at: 2 },
      { side: 's', at: -2.5 },
      { side: 's', at: 2, story: 1 },
      { side: 'n', at: -2, story: 1 },
      { side: 'w', at: 0, story: 1 },
    ],
    stairs: [{ side: 'n', at: -3.4, dir: 1 }],
    balconies: [{ side: 'e', at: 0, w: 3 }],
    outside: { side: 's', at: ow / 2 - 0.1, dir: -1 },
  });
  const sx = ox - ow / 2 - ALLEY - CONT_H / 2;
  M(sx, 0, oz, CONT_H, CONT_H, 6, 'cont2');
  M(sx, CONT_H, oz, CONT_H, CONT_H, 6, 'cont1');
  PK('hp', ox + 1.5, oz + 1);
  PK('hp', -(ox + 1.5), oz + 1);

  // Tool shed by the south-east (south-west) corner: one room, a ladder up to its roof
  house(mirrored, {
    x: 30,
    z: 22,
    w: 7,
    d: 4.5,
    wall: 'metal',
    roof: 'roof',
    ground: 'tile',
    trim: null,
    parapet: false,
    doors: [
      { side: 'w', at: 0 },
      { side: 'n', at: 1.5 },
    ],
    windows: [
      { side: 'e', at: 0 },
      { side: 's', at: -1.5 },
    ],
  });
  ML(32, 24.4, STORY, 0);

  // ---------------------------------------------------------------- Cover in the open ground
  // Middle lane: a rebar wall and pallets of bricks between the base and the skeleton
  M(18, 0, 0, 0.4, LOW, 7, 'concrete');
  rebar(18, LOW, 0, 7, false);
  for (const z of [-8, 8]) {
    M(22, 0, z, 1.4, 1.1, 1.4, 'crate');
    M(22, 0, z + (z > 0 ? 1.5 : -1.5), 1.4, 1.1, 1.4, 'crate');
    M(22, 1.1, z, 1.2, 1, 1.2, 'crate2');
  }
  M(15, 0, -6, 0.4, LOW, 3, 'brick');
  M(15, 0, 6, 0.4, LOW, 3, 'brick');
  // North lane: the power weapon between concrete blocks, crate stacks and a pipe stack
  for (const s of [1, -1]) B(s * 3, 0, -17.5, 1.8, 1.1, 0.8, 'concrete');
  M(17, 0, -17, 2.4, 1.2, 2.4, 'crate');
  M(17, 1.2, -17, 1.6, 1.2, 1.6, 'crate2');
  M(25, 0, -15, 6, 0.5, 1.6, 'metal');
  M(25, 0.5, -15, 5, 0.5, 1.2, 'metal');
  M(34, 0, -15.5, 0.4, LOW, 4, 'brick');
  M(13.8, 0, -12.5, 2.4, 1.4, 1.2, 'wood'); // formwork panels
  M(13.8, 1.4, -12.5, 2.2, 0.3, 1, 'wood');
  // South lane: under the bridge, brick walls going up, material stacks, the concrete mixer
  for (const s of [1, -1]) B(s * 3.5, 0, 16, 2.4, LOW, 0.4, 'brick');
  M(9, 0, 17, 0.4, LOW, 3.5, 'brick');
  M(19, 0, 16, 2.4, 1.2, 2.4, 'crate');
  M(19, 1.2, 16, 1.6, 1.2, 1.6, 'crate2');
  MP(26, 13, car(true));
  M(34, 0, 15.5, 0.4, LOW, 4, 'brick');
  // Behind the block: pipes, sand bays, portable toilets
  B(0, 0, 36, 7, 0.5, 1.6, 'metal');
  B(0, 0.5, 36, 6, 0.5, 1.2, 'metal');
  for (const x of [19, 20.4, 21.8]) M(x, 0, 37.6, 1.2, 2.4, 1.2, 'cont2');
  M(34, 0, 32, 5, 1.4, 0.4, 'concrete');
  M(31.7, 0, 34.5, 0.4, 1.4, 5, 'concrete');
  M(14, 0, -36, 2.4, 1.2, 2.4, 'crate');
  M(22, 0, -36, 0.4, LOW, 4, 'brick');
  MP(36.5, -36.5, PALLET);
  MP(37, 28.5, PALLET);
  MP(16.5, 12, BARREL);
  MP(25, -21, sandbags(2.4, 0.9));
  MP(25, 30, sandbags(0.9, 2.4));
  BR(20.5, -20);
  BR(-20.5, -20);
  BR(13.5, 30);
  BR(-13.5, 30);
  BK(22, 4.5, 1.2);
  BK(-22, 4.5, 1.2);
  BK(6, -14, 1.1);
  BK(-6, -14, 1.1);

  // ---------------------------------------------------------------- Power weapons, spawns
  PW(0, -19.5);
  PW(0, 18);
  for (const [x, z] of [
    [37, 0],
    [36, -9],
    [36, 9],
    [36, -21],
    [37, 17],
    [34, -36],
    [27, 35],
    [29, -6],
    [29, 6],
  ] as const)
    MS(x, z);
  S(0, -37);
}

// Concrete skeleton: columns, two stair cores, floors with an atrium, missing bays, a roof poured halfway
function skeleton(B: BoxFn, M: BoxFn, MD: BoxFn): void {
  for (const x of COLS) {
    for (const z of COLS) {
      if (x > 0) M(x, 0, z, COLUMN, ROOF, COLUMN, 'concrete');
    }
  }

  // Stair cores: band A climbs north (-z) on stories 0 and 2, band B climbs back south on story 1
  for (const x of CORE_WALLS) M(x, 0, 0, 0.2, ROOF + 1.6, 2 * CORE_Z, 'concrete');
  flight(M, 'z', CORE_Z, -1, CORE_A[0], CORE_A[1], 0, 6);
  flight(M, 'z', -CORE_Z, 1, CORE_B[0], CORE_B[1], STORY, 6);
  flight(M, 'z', CORE_Z, -1, CORE_A[0], CORE_A[1], 2 * STORY, 6);
  const both = (r: Rect): Rect[] => [r, { x0: -r.x1, x1: -r.x0, z0: r.z0, z1: r.z1 }];
  const wellA = both({ x0: CORE_A[0], x1: CORE_A[1], z0: -CORE_Z, z1: CORE_Z + WELL });
  const wellB = both({ x0: CORE_B[0], x1: CORE_B[1], z0: -CORE_Z - WELL, z1: CORE_Z });
  const atrium: Rect = { x0: -3, x1: 3, z0: -3, z1: 3 };
  const bays = both({ x0: 3.8, x1: T, z0: 3.8, z1: T });

  const deck: Rect = { x0: -T, x1: T, z0: -T, z1: T };
  slab(B, deck, STORY, DECK_T, 'slab', [...wellA, atrium]);
  slab(B, deck, 2 * STORY, DECK_T, 'slab', [...wellB, atrium, ...bays]);
  slab(B, { x0: -T, x1: T, z0: -T, z1: ROOF_EDGE }, ROOF, DECK_T, 'slab', wellA);
  // Beams on the column lines where the roof is not poured yet: a balancing walk over the second floor
  B(0, ROOF - 0.4, COLS[3]!, 2 * T, 0.4, COLUMN, 'concrete');
  for (const x of COLS) if (x > 0) M(x, ROOF - 0.4, (ROOF_EDGE + T) / 2, COLUMN, 0.4, T - ROOF_EDGE, 'concrete');

  // Railings: round the atrium on the first floor (north and south sides; drop in from east or west), and along
  // the north edge of the first two floors
  for (const y of [STORY, 2 * STORY]) {
    railing(B, -3, -3 - RAIL_T / 2, 3, -3 - RAIL_T / 2, y);
    railing(B, -3, 3 + RAIL_T / 2, 3, 3 + RAIL_T / 2, y);
    railing(M, 4.2, -T + RAIL_T / 2, 8.8, -T + RAIL_T / 2, y);
  }
  railing(M, 4.2, T - RAIL_T / 2, 8.8, T - RAIL_T / 2, STORY);
  // Guard rails round the poured roof: gaps to drop into the crane yard, at the scaffold ladder and onto the beams
  const e = T - RAIL_T / 2;
  railing(B, -4, -e, 4, -e, ROOF);
  railing(M, 6, -e, T, -e, ROOF);
  railing(M, e, -T, e, -4.4, ROOF);
  railing(M, e, -2.4, e, ROOF_EDGE, ROOF);
  railing(B, -2.9, ROOF_EDGE - RAIL_T / 2, 2.9, ROOF_EDGE - RAIL_T / 2, ROOF);
  railing(M, 3.9, ROOF_EDGE - RAIL_T / 2, T, ROOF_EDGE - RAIL_T / 2, ROOF);
  // Ground floor: brick going in between the columns of the north and south edges (doors and windows left open)
  const ctx = { B: M, D: MD };
  wall(ctx, 'x', -T + 0.15, 3.8, 9.2, 0, STORY - DECK_T, 'brick', [{ c: 6.5, w: 1.8, y0: 0, y1: 2.4 }]);
  wall(ctx, 'x', T - 0.15, 3.8, 9.2, 0, STORY - DECK_T, 'brick', [{ c: 6.5, w: 2, y0: 1.1, y1: 2.1 }]);
  B(0, 0, -T + 0.15, 6, LOW, 0.3, 'brick');
  // Cover on every floor: stacked formwork and blocks of concrete
  M(1.8, 0, 6.5, 1.6, 1.1, 0.8, 'concrete');
  M(6, 0, -6, 1.2, 1.2, 1.2, 'crate');
  M(5.5, STORY, -6.5, 1.8, 1.1, 0.6, 'concrete');
  M(1.5, STORY, 6.5, 0.6, 1.1, 1.8, 'concrete');
  M(5.5, 2 * STORY, -6.5, 0.6, 1.1, 1.8, 'concrete');
  M(1.8, 2 * STORY, 7, 1.6, 1.1, 0.6, 'concrete');
  M(3.5, ROOF, -6.5, 1.6, 1, 1.6, 'wood');
  M(5, ROOF, 2.5, 1.8, 1.1, 0.6, 'concrete');
  M(9, ROOF, -8.5, 0.6, 1.1, 1.8, 'concrete');
  // Edge of the poured roof: a formwork board along it (decoration)
  MD(5, ROOF - 0.5, ROOF_EDGE + 0.05, 10, 0.5, 0.1, 'wood');
}

// Scaffold on the east face of the skeleton (and the west one): plank decks at 3 and 6 m against its floors
function scaffold(M: BoxFn): void {
  const mid = (a: [number, number]) => (a[0] + a[1]) / 2;
  const len = (a: [number, number]) => a[1] - a[0];
  const w = SCAF_X1 - SCAF_X0;
  const cx = (SCAF_X0 + SCAF_X1) / 2;
  M(cx, STORY - PLANK_T, mid(DECK1_Z), w, PLANK_T, len(DECK1_Z), 'platform');
  M(cx, 2 * STORY - PLANK_T, mid(DECK2_Z), w, PLANK_T, len(DECK2_Z), 'platform');
  const ox = SCAF_X1 - RAIL_T / 2;
  // Posts on the outer side (the inner side is tied to the skeleton)
  for (const z of [-7.9, -4, 0, 4, 7.9]) {
    const h = z <= DECK2_Z[1] ? 2 * STORY + 1 : STORY + 1;
    M(SCAF_X1 - 0.08, 0, z, 0.15, h, 0.15, 'metal');
  }
  railing(M, ox, DECK1_Z[0], ox, DECK1_Z[1], STORY);
  railing(M, SCAF_X0, DECK1_Z[0] + RAIL_T / 2, SCAF_X1, DECK1_Z[0] + RAIL_T / 2, STORY);
  railing(M, ox, DECK2_Z[0], ox, DECK2_Z[1], 2 * STORY);
  railing(M, SCAF_X0, DECK2_Z[0] + RAIL_T / 2, SCAF_X1, DECK2_Z[0] + RAIL_T / 2, 2 * STORY);
  // Ground to deck 1 from the south end; deck 1 to deck 2 along its outer edge
  flight(M, 'z', DECK1_Z[1] + 6 * STEP_RUN, -1, 10.6, 11.9, 0, 6);
  flight(M, 'z', DECK2_Z[1] + 6 * STEP_RUN, -1, 10.95, 12.25, STORY, 6);
}
