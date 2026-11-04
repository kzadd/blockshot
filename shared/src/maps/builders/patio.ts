import { BARREL, LAMP, PALLET, TREE, pad, sandbags } from '../props';
import { PARAPET_H, STORY, flight, house, mirrorHouse, railing, type HouseSpec } from '../structures';
import type { BoxKind, MapBuildContext, MapLadder, PropPart } from '../types';

/** Roofs of the corner houses, the pavilions and the gatehouses, and the walkways along the walls (two stories). */
const ROOF = 2 * STORY;
/** Walkways and bridges: plank thickness. */
const WALK_T = 0.4;
/** Corner houses: they span |x|, |z| in C0..C1, a 2.2 m back alley away from the outer walls. */
const C0 = 25.8;
const C1 = 37.8;
const CC = (C0 + C1) / 2;
/** Walkways run along the outer walls at this band (|x| or |z| in W0..C1), over the lanes. */
const W0 = 35;
/** The central tower: footprint half side, three stories up to the lookout; the side terraces at its first floor. */
const TOWER = 4;
const TERRACE_X = 5.5;
const TERRACE_W = 3;
const TERRACE_D = 10;
/** Pavilions in the north and south wings: two of them with a 2.2 m alley between (|x| in PAV0..PAV1). The
 * northern ones stand in the wing (z -PAV_Z ± PAV_D / 2), the southern ones against the outer wall from PAV_S. */
const PAV0 = 1.1;
const PAV1 = 8.9;
const PAV_Z = 30;
const PAV_D = 6;
const PAV_S = 31.5;
/** Gatehouses in front of the flags: x GATE ± 3, z ± 5. */
const GATE = 27;
/** Where the flag stands (the outermost spawn of each half). */
const BASE_X = 33;
/** The bridge from each gatehouse roof to the walkway crosses beside the flag (not over it). */
const BRIDGE_Z = 3.6;

/** A market stall: counter, four posts and a striped awning on top (decoration). */
const STALL: PropPart[] = [
  [0, 0, 0, 3, 1.1, 0.8, 'wood'],
  [-1.6, 0, -1.1, 0.15, 2.6, 0.15, 'trunk'],
  [1.6, 0, -1.1, 0.15, 2.6, 0.15, 'trunk'],
  [-1.6, 0, 1.1, 0.15, 2.6, 0.15, 'trunk'],
  [1.6, 0, 1.1, 0.15, 2.6, 0.15, 'trunk'],
];

// Patio: a walled courtyard, mirror-symmetric on x (Red west, Blue east). In the middle a brick tower with three
// stories and a lookout on the roof; its first floor opens east and west onto terraces reached by stairs (north)
// and jump pads (south). Four two-story houses fill the corners; their roofs are joined by plank walkways running
// along the outer walls, so the whole rim is an upper ring at 6 m. Behind every corner house a 2.2 m back alley
// along the outer wall is climbed by wall jumping. The north and south wings hold two pavilions each, with a
// wall-jump alley between them; the northern ones bridge to the walkway, the southern ones carry it. Each flag stands behind a gatehouse
// whose roof bridges to the walkway beside it. Three lanes between the halves: the north wing, the courtyard round
// the tower, the south wing; and the ring of roofs and walkways above them.
export function buildPatio(ctx: MapBuildContext): void {
  const { B, D, S, P, BR, BK, PK, LD, ZL, PW } = ctx;
  /** Box on both sides (once when it sits on the axis). */
  const M = (x: number, y: number, z: number, w: number, h: number, d: number, c: BoxKind) => {
    B(x, y, z, w, h, d, c);
    if (x !== 0) B(-x, y, z, w, h, d, c);
  };
  /** Box in the four quadrants (x and z mirrored). */
  const Q = (x: number, y: number, z: number, w: number, h: number, d: number, c: BoxKind) => {
    M(x, y, z, w, h, d, c);
    if (z !== 0) M(x, y, -z, w, h, d, c);
  };
  const MS = (x: number, z: number) => (S(x, z), S(-x, z));
  const MP = (x: number, z: number, parts: PropPart[]) => (
    P(x, z, parts),
    P(
      -x,
      z,
      parts.map(([dx, ...rest]): PropPart => [-dx, ...rest]),
    )
  );
  const ML = (x: number, z: number, y1: number, dir: MapLadder['dir']) => {
    LD(x, z, y1, dir);
    LD(-x, z, y1, dir === 1 ? 3 : dir === 3 ? 1 : dir);
  };
  /** A house written for the (+x, +z) quadrant, put in the quadrants (sx, sz) listed. */
  const put = (h: HouseSpec, quads: [number, number][]) => {
    for (const [sx, sz] of quads) house(ctx, mirrorHouse({ ...h, x: sx * h.x, z: sz * h.z }, sx, sz));
  };
  const ALL: [number, number][] = [
    [1, 1],
    [-1, 1],
    [1, -1],
    [-1, -1],
  ];

  // ---------------------------------------------------------------- The tower and its terraces
  house(ctx, {
    x: 0,
    z: 0,
    w: 2 * TOWER,
    d: 2 * TOWER,
    stories: 3,
    wall: 'brick',
    ground: 'tile',
    frame: 'trim',
    shutter: 'shutter',
    doors: [
      { side: 'n', at: 0 },
      { side: 's', at: 0 },
      { side: 'e', at: -2.6, story: 1 },
      { side: 'w', at: -2.6, story: 1 },
    ],
    windows: [
      { side: 'e', at: -2.6 },
      { side: 'w', at: -2.6 },
      { side: 'n', at: -2, story: 1 },
      { side: 'n', at: 2, story: 1 },
      { side: 's', at: 0, story: 1 },
      { side: 'n', at: 0, story: 2, w: 1.6 },
      { side: 's', at: 0, story: 2, w: 1.6 },
      { side: 'e', at: -1.5, story: 2 },
      { side: 'e', at: 1.8, story: 2 },
      { side: 'w', at: -1.5, story: 2 },
      { side: 'w', at: 1.8, story: 2 },
    ],
    stairs: [
      // Ground floor: one flight up each side wall, climbing north to the terrace doors
      { side: 'e', at: 1.8, dir: -1 },
      { side: 'w', at: 1.8, dir: -1 },
      // First floor: along the south wall; second floor: along the north wall through the hatch to the lookout
      { side: 's', at: -1.8, dir: 1, story: 1 },
      { side: 'n', at: 1.8, dir: -1, story: 2 },
    ],
  });
  // Terraces east and west at the first floor: stairs at the north end, a jump pad at the south end, a low wall
  // on the outer edge
  M(TERRACE_X, 0, 0, TERRACE_W, STORY, TERRACE_D, 'platform');
  M(TERRACE_X + TERRACE_W / 2 - 0.15, STORY, 0, 0.3, PARAPET_H, TERRACE_D - 2, 'wall2');
  const tx0 = TERRACE_X - TERRACE_W / 2;
  const tx1 = TERRACE_X + TERRACE_W / 2;
  const stepsUp = STORY / 0.5;
  flight(B, 'z', -TERRACE_D / 2 - stepsUp * 0.6, 1, tx0, tx1, 0, stepsUp);
  flight(B, 'z', -TERRACE_D / 2 - stepsUp * 0.6, 1, -tx1, -tx0, 0, stepsUp);
  for (const s of [1, -1]) pad(B, s * TERRACE_X, TERRACE_D / 2 + 1.6);

  // ---------------------------------------------------------------- Corner houses
  // Written for the south-east one: the west and north faces look into the courtyard, the east and south ones
  // onto the back alleys. Two rooms downstairs (a partition with a door), stairs to the first floor and the roof.
  put(
    {
      x: CC,
      z: CC,
      w: C1 - C0,
      d: C1 - C0,
      stories: 2,
      wall: 'plaster',
      ground: 'tile',
      shutter: 'shutter',
      awning: 'awning',
      parapet: false,
      doors: [
        { side: 'w', at: -2.5 },
        { side: 'n', at: -2.5 },
        { side: 'e', at: 3 },
        { side: 's', at: 3 },
      ],
      windows: [
        { side: 'w', at: 2.5 },
        { side: 'n', at: 2.5 },
        { side: 'w', at: -3, story: 1 },
        { side: 'w', at: 3, story: 1 },
        { side: 'n', at: -3, story: 1 },
        { side: 's', at: -3, story: 1 },
        { side: 'e', at: 3, story: 1 },
      ],
      stairs: [
        { side: 's', at: -4, dir: 1 },
        { side: 'e', at: 1.4, dir: 1, story: 1 },
      ],
      partitions: [{ run: 'x', at: 0, door: -3 }],
      balconies: [{ side: 'n', at: 0, w: 3 }],
    },
    ALL,
  );
  // Parapets on the courtyard sides of the roofs, open at the inner corner (zipline) and where the walkways join
  for (const [lo, hi] of [[C0 + 2.2, W0]] as const) {
    Q((lo + hi) / 2, ROOF, C0 + 0.15, hi - lo, PARAPET_H, 0.3, 'plaster');
    Q(C0 + 0.15, ROOF, (lo + hi) / 2, 0.3, PARAPET_H, hi - lo, 'plaster');
  }
  // Furniture: a crate in each room, a stack upstairs
  Q(CC + 2.5, 0, CC - 3, 1.4, 1.1, 1.4, 'crate');
  Q(CC - 3, 0, CC + 3.5, 1.2, 1.2, 1.2, 'crate2');
  Q(CC - 2.5, STORY, CC - 2.5, 1.4, 1.2, 1.4, 'crate2');

  // ---------------------------------------------------------------- Walkways along the outer walls
  const wm = (W0 + C1) / 2;
  const ww = C1 - W0;
  // North and south: from corner roof to corner roof, on pillars (the south one runs over the pavilion roofs and
  // the end of their alley); ladders on two pillars of each
  B(0, ROOF - WALK_T, -wm, 2 * C0, WALK_T, ww, 'bridge');
  M((C0 + PAV1) / 2, ROOF - WALK_T, wm, C0 - PAV1, WALK_T, ww, 'bridge');
  B(0, ROOF - WALK_T, wm, 2 * PAV0, WALK_T, ww, 'bridge');
  for (const s of [1, -1]) B(s * wm, ROOF - WALK_T, 0, ww, WALK_T, 2 * C0, 'bridge');
  for (const x of [14, 21]) Q(x, 0, W0 + 0.5, 0.8, ROOF - WALK_T, 1, 'wall2');
  M(6, 0, -W0 - 0.5, 0.8, ROOF - WALK_T, 1, 'wall2');
  for (const z of [8, 17]) Q(W0 + 0.5, 0, z, 1, ROOF - WALK_T, 0.8, 'wall2');
  for (const s of [1, -1]) {
    ML(14, s * W0, ROOF, s > 0 ? 2 : 0);
    ML(W0, s * 17, ROOF, 1);
  }
  // Railings on the inner edges, open at the ladders and the bridges
  const edge = W0 + 0.06;
  const segs = (cuts: number[], from = -C0, to = C0) => {
    const out: [number, number][] = [];
    let a = from;
    for (const c of [...cuts].sort((p, q) => p - q)) {
      out.push([a, c - 0.8]);
      a = c + 0.8;
    }
    out.push([a, to]);
    return out;
  };
  for (const [a, b] of segs([-14, -5, 5, 14])) railing(B, a, -edge, b, -edge, ROOF);
  for (const [a, b] of segs([14], PAV1)) {
    railing(B, a, edge, b, edge, ROOF);
    railing(B, -a, edge, -b, edge, ROOF);
  }
  for (const s of [1, -1]) {
    for (const [a, b] of segs([-17, BRIDGE_Z, 17])) railing(B, s * edge, a, s * edge, b, ROOF);
  }

  // ---------------------------------------------------------------- Pavilions in the north and south wings
  // North: written for the south-east quadrant and mirrored north. Doors to the courtyard and to the lane; the
  // alley wall is blind, for wall jumps; stairs to the first floor; the roof is bridged to the walkway.
  put(
    {
      x: (PAV0 + PAV1) / 2,
      z: PAV_Z,
      w: PAV1 - PAV0,
      d: PAV_D,
      stories: 2,
      wall: 'brick',
      ground: 'tile',
      frame: 'trim',
      parapet: false,
      awning: 'awning',
      doors: [
        { side: 'n', at: 0 },
        { side: 'e', at: 0 },
      ],
      windows: [
        { side: 'n', at: 2.6 },
        { side: 'e', at: 0, story: 1 },
        { side: 's', at: -1.5, story: 1 },
        { side: 'n', at: -1.2, story: 1 },
      ],
      stairs: [{ side: 's', at: -1.6, dir: 1 }],
    },
    [
      [1, -1],
      [-1, -1],
    ],
  );
  M((PAV0 + PAV1) / 2, ROOF - WALK_T, -(PAV_Z + PAV_D / 2 + W0) / 2, 2, WALK_T, W0 - PAV_Z - PAV_D / 2, 'bridge');
  // South: against the outer wall, their roofs part of the walkway; the alley between them is a dead end with the
  // armour at the back. Stairs up to the first floor and on through a hatch to the roof.
  put(
    {
      x: (PAV0 + PAV1) / 2,
      z: (PAV_S + C1) / 2,
      w: PAV1 - PAV0,
      d: C1 - PAV_S,
      stories: 2,
      wall: 'brick',
      ground: 'tile',
      frame: 'trim',
      parapet: false,
      awning: 'awning',
      doors: [
        { side: 'n', at: 1.5 },
        { side: 'e', at: -1 },
      ],
      windows: [
        { side: 'n', at: -2 },
        { side: 'n', at: 0, story: 1 },
        { side: 'n', at: 2.6, story: 1 },
        { side: 'e', at: 0, story: 1 },
      ],
      stairs: [
        { side: 's', at: -2, dir: 1 },
        { side: 'n', at: 2, dir: -1, story: 1 },
      ],
    },
    [
      [1, 1],
      [-1, 1],
    ],
  );

  // ---------------------------------------------------------------- Gatehouses and flags
  // Written for the east one: a passage west to east, doors north and south, stairs to the roof, a bridge from
  // the roof past the flag to the walkway on the outer wall
  put(
    {
      x: GATE,
      z: 0,
      w: 6,
      d: 10,
      stories: 2,
      wall: 'brick',
      ground: 'tile',
      frame: 'trim',
      shutter: 'shutter',
      awning: 'awning',
      parapet: false,
      doors: [
        { side: 'w', at: 2.5 },
        { side: 'e', at: 2.5 },
        { side: 'n', at: 0 },
        { side: 's', at: 0 },
      ],
      windows: [
        { side: 'w', at: -2.5 },
        { side: 'w', at: -2.5, story: 1 },
        { side: 'w', at: 2.5, story: 1 },
        { side: 'n', at: 0, story: 1 },
        { side: 's', at: 0, story: 1 },
        { side: 'e', at: 2.5, story: 1 },
      ],
      stairs: [
        { side: 'e', at: -4.2, dir: 1 },
        { side: 'w', at: 4.2, dir: -1, story: 1 },
      ],
    },
    [
      [1, 1],
      [-1, 1],
    ],
  );
  M((GATE + 3 + W0) / 2, ROOF - WALK_T, BRIDGE_Z, W0 - GATE - 3, WALK_T, 2.2, 'bridge');
  // Sandbags either side of the flag, crates in the wing
  MP(BASE_X, -5.5, sandbags(2.4, 1));
  MP(BASE_X, 5.5, sandbags(2.4, 1));
  Q(28.5, 0, 15, 2.4, 2.4, 2.4, 'crate2');
  Q(26.6, 0, 15.6, 1.4, 1.2, 1.4, 'crate');

  // ---------------------------------------------------------------- The courtyard
  // Fountains north and south of the tower
  for (const s of [1, -1]) {
    B(0, 0, s * 17, 4, 0.8, 4, 'concrete');
    B(0, 0.8, s * 17, 0.8, 1.6, 0.8, 'concrete');
    D(0, 0.8, s * 17, 3.4, 0.02, 3.4, 'water');
  }
  // Low planter walls on the middle lane and crate stacks (a step and a block: a ledge to climb)
  Q(15, 0, 6.5, 1, 1.1, 5, 'wall2');
  Q(18, 0, 14, 2.4, 2.4, 2.4, 'crate2');
  Q(16.2, 0, 14.6, 1.2, 1.2, 1.2, 'crate');
  // Market stalls by the wings
  MP(9, 20, STALL);
  MP(9, -20, STALL);
  for (const s of [1, -1]) for (const z of [20, -20]) D(s * 9, 2.6, z, 3.8, 0.15, 2.8, 'awning');
  // Trees in planters, lamps round the tower
  MP(20.5, 6, TREE);
  MP(20.5, -6, TREE);
  MP(14, 23, TREE);
  MP(14, -23, TREE);
  for (const z of [9, -9]) MP(9, z, LAMP);
  // Breakable crates on top of the crate stacks, explosive barrels in the far corners of the back alleys (kept off
  // the walking routes: the test bots' pathfinding does not know these objects)
  for (const sx of [1, -1])
    for (const sz of [1, -1]) {
      BK(sx * 18, sz * 14, 1.2, 2.4);
      BR(sx * 39.3, sz * 39.3);
    }

  // ---------------------------------------------------------------- The wings
  // North (health) and south (armour): crates and barrels under the walkways
  M(19, 0, -30.5, 2.4, 1.2, 2.4, 'crate');
  M(22.5, 0, 31.5, 2.4, 1.2, 2.4, 'crate');
  MP(22.5, 38.5, BARREL);
  MP(22.5, -38.5, BARREL);
  MP(11, 38.4, PALLET);
  MP(11, -38.4, PALLET);
  MP(3, -24, sandbags(2.6, 1));

  // ---------------------------------------------------------------- Ziplines: corner roofs down to the terraces
  const zipTop = ROOF + 2.3;
  for (const sx of [1, -1])
    for (const sz of [1, -1])
      ZL([sx * (C0 + 1.2), zipTop, sz * (C0 + 1.2)], [sx * (TERRACE_X + 0.3), STORY + 2.3, sz * 3.4]);

  // ---------------------------------------------------------------- Pickups, power weapons, spawns
  PK('armor', 0, 1.5, 3 * STORY);
  PK('armor', 0, 36.5);
  PK('hp', 11.5, -33.5);
  PK('hp', -11.5, -33.5);
  PW(0, 11);
  PW(0, -11);
  S(BASE_X, 0);
  S(-BASE_X, 0);
  for (const [x, z] of [
    [32, 11],
    [32, -11],
    [30, 21],
    [30, -21],
    [17, 31],
    [17, -31],
    [21, 19],
    [21, -19],
    [14, 27],
    [14, -27],
  ] as const)
    MS(x, z);
}
