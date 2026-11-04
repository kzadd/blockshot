import { LAMP, PALLET, TREE, car, sandbags, stairs } from '../props';
import { flight, house, mirrorHouse, railing, type HouseSpec } from '../structures';
import type { BoxKind, MapBuildContext, MapLadder } from '../types';

/** The streets stand this high over the station floor (m). */
export const STREET = 4;
/** The sunken station spans |z| < PIT; the streets are beyond. */
export const PIT = 15;
/** Platforms: their height, the island between the tracks (|z| < ISLAND) and the side platforms (|z| > SIDE). */
const PLAT = 1;
const ISLAND = 5;
const SIDE = 9;
/** Track centre lines (north track at -TRACK_Z, the train stands on the south one). */
const TRACK_Z = 7;
/** Ends of the platforms along x: the island and the side platforms. */
const ISLAND_END = 31;
const SIDE_END = 30;
/** Canopies over the platforms: underside and thickness; their top is CANOPY. */
const CANOPY_Y = 6;
const CANOPY_T = 0.35;
export const CANOPY = CANOPY_Y + CANOPY_T;
/** Footbridges at street level across the station, at x = ±BRIDGE_X (deck 3 m wide). */
export const BRIDGE_X = 14;
const BRIDGE_HW = 1.5;
/** Carriages: length, width, floor height (level with the platforms within a step) and the gap between two. */
const CAR_L = 13;
const CAR_W = 3;
const CAR_Y = 0.5;
const CAR_GAP = 2.4;
/** Two-story street buildings: their roof (m). */
export const ROOF = STREET + 6;
/** The ticket hall (one story): its roof, and its front on the grand stair down to the north platform. */
export const HALL_ROOF = STREET + 3;
const HALL_FRONT = -18.6;
/** Rails and sleepers (decoration). */
const GAUGE = 1.5;
const SLEEPER_STEP = 1.2;

const TOWN = {
  ground: 'tile',
  roof: 'roof',
  shutter: 'shutter',
  parapet: false,
} as const satisfies Partial<HouseSpec>;

// Estación: a city station sunk 4 m under two streets. The tracks run east-west through the middle: an island
// platform between them, a side platform under each street, a stopped train on the south track (walk through it
// car to car, climb onto its roofs) and freight wagons on the north one. The ticket hall stands on the north street
// with a grand stair down to the platforms; two footbridges (one per team) cross the station at street level with
// stairs down to the island; canopies over the platforms are a high layer you reach from the bridges, the street
// edge or the signal boxes at the ends of the island. Up on the streets, two-story blocks with 2.2 m alleys (wall
// jumps to the roofs), a bridge from the blocks to the hall roof and an arch over the south plaza. Three lanes: the
// north street, the station, the south street. Bases at the tunnel mouths. Everything east (+x) is mirrored west.
export function buildEstacion(ctx: MapBuildContext): void {
  const { B, D, S, P, H, BR, BK, PK, LD, ZL, PW } = ctx;
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
  const flightX = (start: number, dir: 1 | -1, z0: number, z1: number, y0: number, steps: number, landing = 0.6) => {
    flight(B, 'x', start, dir, z0, z1, y0, steps, 'stair', landing);
    flight(B, 'x', -start, -dir as 1 | -1, z0, z1, y0, steps, 'stair', landing);
  };
  const flightZ = (start: number, dir: 1 | -1, x0: number, x1: number, y0: number, steps: number, landing = 0.6) => {
    flight(B, 'z', start, dir, x0, x1, y0, steps, 'stair', landing);
    flight(B, 'z', start, dir, -x1, -x0, y0, steps, 'stair', landing);
  };
  /** A house written for the east side, and its mirror in the west (once when it sits on the axis). */
  const twin = (h: HouseSpec) => {
    house(ctx, h);
    if (h.x !== 0) house(ctx, mirrorHouse({ ...h, x: -h.x }, -1, 1));
  };
  /** Railing along z = at from x0 to x1 (east side, mirrored; across the axis when x0 = 0), skipping the gaps. */
  const railX = (at: number, x0: number, x1: number, y: number, gaps: [number, number][]) => {
    let cur = x0;
    for (const [a, b] of [...gaps, [x1, x1] as [number, number]]) {
      if (cur === 0) railing(B, -a, at, a, at, y);
      else if (a - cur > 0.3) {
        railing(B, cur, at, a, at, y);
        railing(B, -cur, at, -a, at, y);
      }
      cur = b;
    }
  };

  // ---------------------------------------------------------------- The two streets (4 m) and the pit
  B(0, 0, (-H + HALL_FRONT) / 2, 2 * H, STREET, H + HALL_FRONT, 'quay'); // north street, behind the grand stair
  M((2.5 + H) / 2, 0, (HALL_FRONT - PIT) / 2, H - 2.5, STREET, PIT + HALL_FRONT, 'quay'); // beside the stair
  B(0, 0, (PIT + H) / 2, 2 * H, STREET, H - PIT, 'quay'); // south street
  // Grand stair from the ticket hall down to the north platform
  B(0, 0, (HALL_FRONT - PIT) / 2, 5, PLAT, -HALL_FRONT - PIT, 'platform');
  flight(B, 'z', -PIT, -1, -2.5, 2.5, PLAT, 6);
  // Edge railings along both streets, open at the stairs and the bridges
  for (const s of [1, -1]) {
    const gaps: [number, number][] = [
      [BRIDGE_X - BRIDGE_HW, BRIDGE_X + BRIDGE_HW],
      [22.7, 24.1],
      [37, 38.6],
    ];
    railX(s * (PIT + 0.06), s < 0 ? 2.5 : 0, H, STREET, gaps);
  }

  // ---------------------------------------------------------------- Tracks, platforms, canopies
  for (const s of [1, -1]) {
    const z = s * TRACK_Z;
    D(0, 0, z, 2 * H, 0.06, 3.4, 'ballast');
    for (const r of [1, -1]) D(0, 0.06, z + (r * GAUGE) / 2, 2 * H, 0.14, 0.1, 'track');
    for (let x = -H + 0.6; x < H; x += SLEEPER_STEP) D(x, 0.03, z, 0.25, 0.06, 2.4, 'sleeper');
    for (const e of [1, -1]) D(e * (H - 0.15), 0, z, 0.3, 4.6, 5.2, 'tunnel');
  }
  // Island platform, side platforms, steps down to the tracks at their ends
  B(0, 0, 0, 2 * ISLAND_END, PLAT, 2 * ISLAND, 'platform');
  for (const s of [1, -1]) B(0, 0, (s * (SIDE + PIT)) / 2, 2 * SIDE_END, PLAT, PIT - SIDE, 'platform');
  for (const e of [1, -1]) {
    stairs(B, e * ISLAND_END, 0, 'x', -e, 2, 2 * ISLAND, 'step');
    for (const s of [1, -1]) stairs(B, e * SIDE_END, (s * (SIDE + PIT)) / 2, 'x', -e, 2, PIT - SIDE, 'step');
  }
  // Canopies: over the island (split at the bridges, the east end against the signal box) and over the side
  // platforms; columns at the platform edges
  const canopy = (x0: number, x1: number, z0: number, z1: number, cols: number[]) => {
    M((x0 + x1) / 2, CANOPY_Y, (z0 + z1) / 2, x1 - x0, CANOPY_T, z1 - z0, 'roof');
    // columns on the platform edges (the side canopies hang from the street wall on their outer edge)
    for (const x of cols)
      for (const z of [z0 + 1.5, z1 - 1.5])
        if (Math.abs(z) < PIT - 2) M(x, PLAT, z, 0.5, CANOPY_Y - PLAT, 0.5, 'metal');
  };
  // (they stop 0.6 m short of the bridges: hop onto the bridge railing, then up onto the canopy)
  const bx0 = BRIDGE_X - BRIDGE_HW - 0.6;
  const bx1 = BRIDGE_X + BRIDGE_HW + 0.6;
  canopy(-bx0, bx0, -6, 6, [3, 9]);
  canopy(bx1, 24.9, -6, 6, [18.5, 23]);
  for (const s of [1, -1]) {
    const [z0, z1] = s > 0 ? [8.5, PIT] : [-PIT, -8.5];
    canopy(-bx0, bx0, z0, z1, [3, 9]);
    canopy(bx1, 27, z0, z1, [18.5, 25]);
  }
  // Porch over the grand stair: the hall roof runs out onto the north canopy
  B(0, HALL_ROOF - CANOPY_T, (HALL_FRONT - PIT) / 2, 6, CANOPY_T, -HALL_FRONT - PIT, 'roof');
  // Benches, luggage carts (to climb onto the train roofs), crates
  M(6, PLAT, -2.5, 2.2, 0.5, 0.6, 'wood');
  M(20, PLAT, -2.5, 2.2, 0.5, 0.6, 'wood');
  M(5, PLAT, 12, 2.2, 0.5, 0.6, 'wood');
  M(4.5, PLAT, 3.9, 2, 1.2, 1.2, 'crate');
  M(20.5, PLAT, 3.9, 2, 1.2, 1.2, 'crate');
  M(20.5, PLAT, 10, 1.2, 1.2, 1.2, 'crate2');
  // Crates against the street walls: a way back up from the side platforms
  for (const s of [1, -1]) {
    M(28, PLAT, s * 14.2, 1.4, 1.2, 1.4, 'crate');
    M(26.6, PLAT, s * 14.3, 1.2, 0.6, 1.2, 'crate2');
  }

  // ---------------------------------------------------------------- Stairs between the levels
  // Footbridges street to street, with railings, posts on the platforms and stairs down to the island
  M(BRIDGE_X, STREET - 0.3, 0, 2 * BRIDGE_HW, 0.3, 2 * PIT, 'bridge');
  // (the outer railing opens where the island stair arrives)
  for (const [x, z0, z1] of [
    [BRIDGE_X - BRIDGE_HW + 0.06, -PIT, PIT],
    [BRIDGE_X + BRIDGE_HW - 0.06, -PIT, 0.1],
    [BRIDGE_X + BRIDGE_HW - 0.06, 1.5, PIT],
  ] as const) {
    railing(B, x, z0, x, z1, STREET);
    railing(B, -x, z0, -x, z1, STREET);
  }
  for (const z of [-ISLAND + 0.6, ISLAND - 0.6, -SIDE - 0.6, SIDE + 0.6])
    M(BRIDGE_X, PLAT, z, 0.6, STREET - 0.3 - PLAT, 0.6, 'concrete');
  // the island stair hugs the east side of the east bridge (west side of the west one), climbing north
  flightZ(4.4, -1, BRIDGE_X + BRIDGE_HW, BRIDGE_X + BRIDGE_HW + 1.3, PLAT, 6, 1.2);
  // Side platform up to the street, near the east end (both sides)
  for (const s of [1, -1]) flightX(19.8, 1, s * PIT, s * (PIT - 1.3), PLAT, 6, 1.2);
  // Track floor at the tunnel ends up to the street
  for (const s of [1, -1]) flightX(33, 1, s * PIT, s * (PIT - 1.4), 0, 8, 1.2);

  // ---------------------------------------------------------------- The train (south track) and freight (north)
  // Four carriages, doors on both long sides and at the ends (walk the train from car to car)
  for (const x of [CAR_GAP / 2 + CAR_L / 2, CAR_GAP * 1.5 + CAR_L * 1.5]) {
    M(x, 0, TRACK_Z, CAR_L - 1, CAR_Y, CAR_W - 0.4, 'metal'); // undercarriage
    twin({
      x,
      z: TRACK_Z,
      w: CAR_L,
      d: CAR_W,
      y: CAR_Y,
      wall: 'train',
      roof: 'roof',
      ground: 'tile',
      frame: null,
      trim: null,
      parapet: false,
      doors: [
        { side: 'n', at: -3.5 },
        { side: 'n', at: 3.5 },
        { side: 's', at: -3.5 },
        { side: 's', at: 3.5 },
        { side: 'e', at: 0, w: 1.2 },
        { side: 'w', at: 0, w: 1.2 },
      ],
      windows: [
        { side: 'n', at: 0, w: 3.6 },
        { side: 's', at: 0, w: 3.6 },
      ],
    });
  }
  // Gangways between the cars: a step
  M(CAR_L + CAR_GAP, 0, TRACK_Z, CAR_GAP, CAR_Y, 1.4, 'metal');
  B(0, 0, TRACK_Z, CAR_GAP, CAR_Y, 1.4, 'metal');
  // Freight on the north track: a flatcar with a container on each side, a crate stack in the middle
  M(22, 0, -TRACK_Z, 10, 1.2, 2.6, 'metal');
  M(23, 1.2, -TRACK_Z, 6, 2.6, 2.4, 'cont1');
  M(18.6, 1.2, -TRACK_Z, 1.2, 1.2, 1.2, 'crate');
  M(5, 0, -TRACK_Z - 0.5, 1.2, 1.2, 1.2, 'crate');
  M(5.8, 0, -TRACK_Z + 0.7, 1, 1, 1, 'crate2');

  // ---------------------------------------------------------------- Signal boxes at the ends of the island
  twin({
    x: 28,
    z: 0,
    w: 6,
    d: 6,
    y: PLAT,
    stories: 2,
    wall: 'brick',
    ground: 'wood',
    roof: 'roof',
    doors: [
      { side: 'w', at: 0.6 },
      { side: 'e', at: 0.6 },
    ],
    windows: [
      { side: 'n', at: 1, w: 1.6 },
      { side: 's', at: -1, w: 1.6 },
      { side: 'n', at: 0, w: 3.6, story: 1 },
      { side: 's', at: 0, w: 3.6, story: 1 },
      { side: 'e', at: 0, w: 3, story: 1 },
      { side: 'w', at: 0.8, w: 2, story: 1 },
    ],
    stairs: [
      { side: 'n', at: -2.4, dir: 1 },
      { side: 's', at: 2.4, dir: -1, story: 1 },
    ],
  });
  PK('hp', 28.6, 1.6, PLAT);
  PK('hp', -28.6, 1.6, PLAT);

  // ---------------------------------------------------------------- North street: the ticket hall and two blocks
  house(ctx, {
    ...TOWN,
    x: 0,
    z: (HALL_FRONT - 31) / 2,
    w: 18,
    d: 31 + HALL_FRONT,
    y: STREET,
    wall: 'brick',
    doors: [
      { side: 's', at: 0, w: 5 },
      { side: 'e', at: 1 },
      { side: 'w', at: 1 },
      { side: 'n', at: -3 },
      { side: 'n', at: 3 },
    ],
    windows: [
      { side: 's', at: -6, w: 2.4 },
      { side: 's', at: 6, w: 2.4 },
      { side: 'e', at: -3 },
      { side: 'w', at: -3 },
    ],
  });
  // Ticket counters, columns; ladders up the back wall to the hall roof
  M(5.5, STREET, -28, 4, 1.1, 0.8, 'wood');
  M(4, STREET, -22, 0.7, 2.7, 0.7, 'concrete');
  ML(6.5, -31, HALL_ROOF, 2);
  D(0, HALL_ROOF, HALL_FRONT + 0.15, 4, 1.2, 0.3, 'trim'); // the station sign over the stair
  PK('armor', 0, -26, STREET);
  // Blocks A (by the hall) and B, a 2.2 m alley between them; a bridge from A's first floor to the hall roof
  twin({
    ...TOWN,
    x: 17,
    z: -30.5,
    w: 8,
    d: 11,
    y: STREET,
    stories: 2,
    wall: 'plaster',
    awning: 'awning',
    doors: [
      { side: 's', at: -1.5 },
      { side: 'w', at: -3 },
      { side: 'w', at: 2.5, story: 1 },
    ],
    windows: [
      { side: 's', at: 2 },
      { side: 'w', at: 1.5 },
      { side: 's', at: -1, story: 1 },
      { side: 'n', at: 0, story: 1 },
    ],
    stairs: [
      { side: 'n', at: -3.4, dir: 1 },
      { side: 's', at: 3.4, dir: -1, story: 1 },
    ],
  });
  M(11, HALL_ROOF - 0.4, -28, 4, 0.4, 2.2, 'bridge');
  twin({
    ...TOWN,
    x: 27.1,
    z: -30.5,
    w: 7.8,
    d: 11,
    y: STREET,
    stories: 2,
    wall: 'brick',
    doors: [
      { side: 's', at: 1.5 },
      { side: 'n', at: -2.5 },
    ],
    windows: [
      { side: 's', at: -2 },
      { side: 's', at: 0, story: 1 },
      { side: 'n', at: 2, story: 1 },
    ],
    stairs: [{ side: 'n', at: 3.4, dir: -1 }],
    outside: { side: 'e', at: -4.8, dir: 1 },
  });
  // Cover on the north street
  MP(25, -19.5, car(true));
  MP(6, -35, car(true));
  M(35.5, STREET, -24, 1, 1, 3.2, 'concrete');
  M(10.5, STREET, -20.5, 3.2, 1, 1, 'concrete');
  M(7.5, STREET, -16.9, 2, 2.4, 2, 'metal'); // newsstands on the station edge
  MD(7.5, STREET + 2.4, -16.9, 2.6, 0.12, 2.6, 'awning');
  for (const x of [11, 20, 31]) MP(x, -16, LAMP);
  BR(33.5, -18.5);
  BR(-33.5, -18.5);
  BK(11, -37.5);
  BK(-11, -37.5);

  // ---------------------------------------------------------------- South street: blocks C and D, the plaza
  twin({
    ...TOWN,
    x: 9,
    z: 29,
    w: 8,
    d: 10,
    y: STREET,
    stories: 2,
    wall: 'plaster',
    awning: 'awning',
    doors: [
      { side: 'n', at: 1.5 },
      { side: 'w', at: -2 },
      { side: 's', at: 2.5 },
    ],
    windows: [
      { side: 'n', at: -2 },
      { side: 'w', at: 2 },
      { side: 'w', at: 0, story: 1 },
      { side: 'n', at: 0, story: 1 },
    ],
    stairs: [
      { side: 's', at: -3.4, dir: 1 },
      { side: 'n', at: 3.4, dir: -1, story: 1 },
    ],
  });
  twin({
    ...TOWN,
    x: 19.6,
    z: 29,
    w: 8.8,
    d: 10,
    y: STREET,
    stories: 2,
    wall: 'brick',
    doors: [
      { side: 'n', at: -1.5 },
      { side: 's', at: -2.5 },
    ],
    windows: [
      { side: 'n', at: 2 },
      { side: 'n', at: 0, story: 1 },
      { side: 's', at: -2, story: 1 },
    ],
    stairs: [{ side: 's', at: 3.4, dir: -1 }],
    outside: { side: 'e', at: -4.5, dir: 1 },
  });
  // Arch over the plaza joining the two C roofs
  B(0, ROOF - 0.4, 29, 10, 0.4, 2.4, 'bridge');
  // Plaza: a bus shelter, planters, low walls; a zipline from the arch down to the island canopy
  B(0, STREET, 20.5, 5, 0.5, 0.6, 'wood');
  B(0, STREET, 21.2, 6, 2.6, 0.2, 'metal');
  D(0, STREET + 2.6, 20.6, 6.4, 0.15, 1.8, 'awning');
  MP(3, 36, TREE);
  MP(3, 25, TREE);
  ZL([0, ROOF + 2.3, 28.6], [0, CANOPY + 2.3, 3]);
  // Cover on the south street
  MP(29, 19.5, car(true));
  MP(35, 29, car(false));
  MP(30, 37, car(true));
  M(25.5, STREET, 22, 3.2, 1, 1, 'concrete');
  P(8, 19.5, sandbags(3, 1));
  P(-8, 19.5, sandbags(3, 1));
  B(0, STREET, 17.2, 2, 2.4, 2, 'metal');
  D(0, STREET + 2.4, 17.2, 2.6, 0.12, 2.6, 'awning');
  for (const x of [6, 20, 31]) MP(x, 16, LAMP);
  MP(27.5, 34.5, PALLET);
  BR(26, 38);
  BR(-26, 38);
  BK(14.1, 36.5);
  BK(-14.1, 36.5);
  // Pit ends: track works by the tunnel mouths
  BR(37.5, -11);
  BR(-37.5, -11);
  BK(35.5, 11.5, 1.3);
  BK(-35.5, 11.5, 1.3);
  M(34.5, 0, -4.5, 1.2, 1.2, 1.2, 'crate');

  // ---------------------------------------------------------------- Pickups, power weapons, spawns
  PW(0, 0, PLAT);
  PW(0, 32.5, STREET);
  PK('armor', 0, 12, PLAT);
  for (const [x, z] of [
    [37, 0],
    [36, -20],
    [36, -31],
    [26.5, -22.2],
    [19, -21],
    [36, 21],
    [35.5, 34],
    [28.5, 26],
    [21, 19.5],
  ] as const)
    MS(x, z);
}
