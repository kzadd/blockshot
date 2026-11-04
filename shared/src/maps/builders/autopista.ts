import { BARREL, LAMP, car } from '../props';
import { STORY, house, mirrorHouse, railing, type HouseSpec } from '../structures';
import type { BoxFn, MapBuildContext } from '../types';

/** The motorway deck: top height, half width (it spans x -DECK_HALF..DECK_HALF) and slab thickness (m). */
const DECK_Y = 6;
const DECK_HALF = 5;
const DECK_T = 0.8;
/** Jersey barriers along the deck edges. */
const JERSEY_T = 0.4;
const JERSEY_H = 0.9;
/** On-ramps beside the deck: x range, where they leave the ground (|z|) and the run of each 0.5 m step. */
const RAMP_X0 = DECK_HALF;
const RAMP_X1 = 9;
const RAMP_Z0 = 8;
const RAMP_RUN = 1;
const RAMP_STEPS = DECK_Y / 0.5;
/** Ramp steps up to this height are solid down to the ground; higher ones are slabs you can walk under. */
const RAMP_SOLID = 2.5;
const RAMP_SLAB = 0.5;
/** Landing at the top of each ramp, joining the deck. */
const LANDING_D = 4;
/** Apartment column on each side (x range) and the alleys between its blocks. */
const BLD_X0 = 17;
const BLD_X1 = 27;
const ALLEY = 2.2;
/** Low apartments (2 stories) next to the middle, tall ones (3 stories) at the ends. */
const LOW_Z0 = 14;
const LOW_Z1 = 24;
const TALL_Z1 = 38;
/** Gas station canopy (x range, half depth, height of its top). */
const CANOPY_X0 = 15;
const CANOPY_X1 = 27;
const CANOPY_HALF = 6;
const CANOPY_Y = 4.5;
const CANOPY_T = 0.4;
/** Footbridge from the low apartment roof to the deck (z range, north side). */
const FOOT_Z0 = -34;
const FOOT_Z1 = -32;
/** A zipline's ends hang this far above the floor riders land on. */
const ZIP_LAND = 2.3;
/** Pillars under the deck (z) and their x offset from the middle. */
const PILLARS_Z = [-36, -27, -9, 0, 9, 27, 36];
const PILLAR_X = 3.6;

// Autopista: a run-down neighbourhood split by an elevated motorway along x = 0. On-ramps climb onto the deck
// from both sides (abandoned cars and a jack-knifed lorry up there); under it, a dark car park between the pillars
// with three ways across. Each half (mirror images) has a row of apartment blocks with wall-jump alleys, a gas
// station with a canopy, a kiosk, a car park and a fenced basketball court. A footbridge and two ziplines link the
// roofs to the deck.
export function buildAutopista(ctx: MapBuildContext): void {
  const { B, D, S, BR, BK, PK, LD, ZL, PW } = ctx;
  /** A box and its mirror image on x (once if it sits on the middle line). */
  const M: BoxFn = (x, y, z, w, h, d, c) => {
    B(x, y, z, w, h, d, c);
    if (Math.abs(x) > 0.01) B(-x, y, z, w, h, d, c);
  };
  const MD: BoxFn = (x, y, z, w, h, d, c) => {
    D(x, y, z, w, h, d, c);
    if (Math.abs(x) > 0.01) D(-x, y, z, w, h, d, c);
  };
  /** A house written for the east side, and its mirror image to the west. */
  const both = (h: HouseSpec) => {
    house(ctx, h);
    house(ctx, { ...mirrorHouse(h, -1, 1), x: -h.x });
  };
  /** A wrecked car (solid boxes, so it also sits under the deck and on it). */
  const wreck = (x: number, y: number, z: number, alongX: boolean) => {
    for (const [dx, dy, dz, w, h, d, c] of car(alongX)) M(x + dx, y + dy, z + dz, w, h, d, c);
  };
  const Sm = (x: number, z: number) => {
    S(x, z);
    S(-x, z);
  };

  // ---------------------------------------------------------------- The motorway
  B(0, DECK_Y - DECK_T, 0, 2 * DECK_HALF, DECK_T, 80, 'bridge');
  // Jersey barriers on both edges, open where the ramps, the footbridge and the zipline arrive
  const rampTop = RAMP_Z0 + RAMP_STEPS * RAMP_RUN; // 20
  const open: [number, number][] = [
    [FOOT_Z0, FOOT_Z1],
    [-rampTop - LANDING_D, -rampTop + 1],
    [rampTop - 1, rampTop + LANDING_D],
    [31, 33],
  ];
  let z = -40;
  for (const [a, b] of [...open, [40, 40] as [number, number]]) {
    if (a > z) M(DECK_HALF - JERSEY_T / 2, DECK_Y, (z + a) / 2, JERSEY_T, JERSEY_H, a - z, 'wall2');
    z = b;
  }
  // Pillars and, under the middle of each half of the deck, a wall that closes it (three ways across remain)
  for (const pz of PILLARS_Z) M(PILLAR_X, 0, pz, 1, DECK_Y - DECK_T, 1, 'concrete');
  for (const s of [1, -1]) B(0, 0, s * 17, 0.6, DECK_Y - DECK_T, 10, 'wall2');
  // Parking lines under the deck
  for (const pz of [-38, -34, -30, -26, 26, 30, 34, 38]) MD(2.6, 0, pz, 3.2, 0.02, 0.12, 'trim');

  // On-ramps: 0.5 m steps beside the deck, north and south of the middle on both sides
  for (const s of [1, -1]) {
    const rx = (RAMP_X0 + RAMP_X1) / 2;
    const rw = RAMP_X1 - RAMP_X0;
    for (let i = 1; i <= RAMP_STEPS; i++) {
      const top = i * 0.5;
      const zc = s * (RAMP_Z0 + (i - 0.5) * RAMP_RUN);
      if (top <= RAMP_SOLID) M(rx, 0, zc, rw, top, RAMP_RUN, 'bridge');
      else M(rx, top - RAMP_SLAB, zc, rw, RAMP_SLAB, RAMP_RUN, 'bridge');
    }
    const lz = s * (rampTop + LANDING_D / 2);
    M(rx, DECK_Y - DECK_T, lz, rw, DECK_T, LANDING_D, 'bridge');
    // Its supports, and barriers round the landing
    M(RAMP_X1 - 0.5, 0, s * (RAMP_Z0 + 8.5), 0.6, 4, 0.6, 'concrete');
    M(RAMP_X1 - 0.5, 0, lz, 0.6, DECK_Y - DECK_T, 0.6, 'concrete');
    M(RAMP_X1 - JERSEY_T / 2, DECK_Y, lz, JERSEY_T, JERSEY_H, LANDING_D, 'wall2');
    M(rx, DECK_Y, s * (rampTop + LANDING_D - JERSEY_T / 2), rw, JERSEY_H, JERSEY_T, 'wall2');
  }

  // On the deck: a lorry jack-knifed across it (trailer, cab and its spilt crates) and abandoned cars
  B(0, DECK_Y, 2, 6, 2.6, 2.5, 'cont1');
  B(0, DECK_Y, -0.55, 2.4, 3, 2.6, 'metal');
  M(2.2, DECK_Y, 4, 1.2, 1.2, 1.2, 'crate');
  wreck(2.5, DECK_Y, -13, false);
  wreck(2.4, DECK_Y, 13, false);
  wreck(2.6, DECK_Y, -29, false);
  wreck(2.5, DECK_Y, 36, false);
  BK(3.5, -5, 1.2, DECK_Y);
  BK(-3.5, -5, 1.2, DECK_Y);
  // Under it: cars in the car park, one across the middle
  wreck(1.8, 0, -31, false);
  wreck(1.8, 0, 32, false);
  wreck(0, 0, 5, true);

  // ---------------------------------------------------------------- Apartment blocks (east side, mirrored)
  const bx = (BLD_X0 + BLD_X1) / 2;
  const bw = BLD_X1 - BLD_X0;
  for (const s of [1, -1]) {
    const south = s > 0;
    // Low block (2 stories) by the middle: a corner shop downstairs. Its roof (no parapet) is reached by the
    // inside stairs or by wall jumping up the alley between it and the tall block
    const low: HouseSpec = {
      x: bx,
      z: (LOW_Z0 + LOW_Z1) / 2,
      w: bw,
      d: LOW_Z1 - LOW_Z0,
      stories: 2,
      wall: south ? 'brick' : 'plaster',
      ground: 'tile',
      awning: 'awning',
      parapet: false,
      doors: [
        { side: 'w', at: 2.5 },
        { side: 'n', at: -2 },
        { side: 'e', at: -1 },
      ],
      windows: [
        { side: 'w', at: -2, w: 2.4, sill: 0.7, top: 2.2 },
        { side: 'n', at: 2.5, w: 2.4, sill: 0.7, top: 2.2 },
        { side: 'e', at: 2.5 },
        { side: 'w', at: -2.5, story: 1 },
        { side: 'w', at: 2.5, story: 1 },
        { side: 'n', at: 0, story: 1 },
        { side: 'e', at: 0, story: 1 },
      ],
      stairs: [
        { side: 's', at: -3.6, dir: 1 },
        { side: 'e', at: 4, dir: -1, story: 1 },
      ],
    };
    // Tall block (3 stories) at the end: inside stairs from floor to floor up to the highest roof
    const tallD = TALL_Z1 - LOW_Z1 - ALLEY;
    const footAt = -(FOOT_Z0 + FOOT_Z1) / 2 - (TALL_Z1 - tallD / 2);
    const tall: HouseSpec = {
      x: bx,
      z: TALL_Z1 - tallD / 2,
      w: bw,
      d: tallD,
      stories: 3,
      wall: south ? 'plaster' : 'brick',
      ground: 'tile',
      parapet: !south, // the south one has the zipline leaving its roof
      doors: [
        { side: 'w', at: -3 },
        { side: 'w', at: 3 },
        // Top floor: the north one opens onto the footbridge to the deck, the south one onto a balcony
        ...(south ? [] : [{ side: 'w' as const, at: footAt, story: 2 }]),
      ],
      balconies: south ? [{ side: 'w', at: footAt, w: 2.4, story: 2 }] : [],
      windows: [
        { side: 'w', at: 0 },
        { side: 'e', at: 0 },
        { side: 'w', at: -3, story: 1 },
        { side: 'w', at: 3, story: 1 },
        { side: 'w', at: -3.5, story: 2 },
        { side: 'e', at: 2, story: 2 },
        { side: 's', at: 0, story: 1 },
      ],
      // Zigzag up all three floors and through a hatch to the roof
      stairs: [
        { side: 's', at: 2, dir: -1 },
        { side: 'n', at: -2, dir: 1, story: 1 },
        { side: 's', at: 2, dir: -1, story: 2 },
      ],
    };
    both(south ? low : { ...mirrorHouse(low, 1, -1), z: -low.z });
    both(south ? tall : { ...mirrorHouse(tall, 1, -1), z: -tall.z });
    // Roof clutter: a water tank on the low block, air conditioners on the tall one
    M(20.5, STORY * 2, s * 21.5, 2.2, 2, 2.2, 'metal');
    M(20, STORY * 3, s * 29, 1.2, 0.9, 1, 'metal');
    M(24, STORY * 3, s * 35, 1.2, 0.9, 1, 'metal');
  }
  // Footbridge from the deck into the top floor of the north tall blocks, with railings
  const fz = (FOOT_Z0 + FOOT_Z1) / 2;
  M((DECK_HALF + BLD_X0) / 2, DECK_Y - 0.4, fz, BLD_X0 - DECK_HALF, 0.4, FOOT_Z1 - FOOT_Z0, 'bridge');
  for (const rz of [FOOT_Z0 + 0.06, FOOT_Z1 - 0.06]) railing(M, DECK_HALF, rz, BLD_X0, rz, DECK_Y);
  // Zipline from the south tall roofs down onto the deck
  for (const s of [1, -1]) ZL([s * (BLD_X0 + 0.8), STORY * 3 + ZIP_LAND, 32], [s * 2.5, DECK_Y + ZIP_LAND, 32]);

  // ---------------------------------------------------------------- Gas station and kiosk
  const cx = (CANOPY_X0 + CANOPY_X1) / 2;
  M(cx, CANOPY_Y - CANOPY_T, 0, CANOPY_X1 - CANOPY_X0, CANOPY_T, 2 * CANOPY_HALF, 'platform');
  for (const pz of [-4.5, 4.5]) {
    M(CANOPY_X0 + 0.6, 0, pz, 0.6, CANOPY_Y - CANOPY_T, 0.6, 'metal');
    M(CANOPY_X1 - 0.6, 0, pz, 0.6, CANOPY_Y - CANOPY_T, 0.6, 'metal');
  }
  // The middle pillar on the street side carries a ladder up to the canopy
  M(CANOPY_X1 - 0.3, 0, 0, 0.6, CANOPY_Y - CANOPY_T, 0.6, 'metal');
  LD(CANOPY_X1, 0, CANOPY_Y, 3);
  LD(-CANOPY_X1, 0, CANOPY_Y, 1);
  // Pump islands
  for (const pz of [-2.5, 2.5]) {
    M(cx, 0, pz, 7, 0.2, 1.2, 'step');
    M(cx - 2.5, 0.2, pz, 0.7, 1.5, 0.5, 'metal');
    M(cx + 2.5, 0.2, pz, 0.7, 1.5, 0.5, 'metal');
  }
  // A dumpster and a crate on it: a way up the canopy from the motorway side
  M(CANOPY_X0 - 0.8, 0, 3, 1.2, 1.4, 2, 'cont2');
  M(CANOPY_X0 - 0.8, 1.4, 3.4, 1.1, 1.1, 1.1, 'crate');
  // Kiosk behind it: one story, shop windows, outside stairs to its roof
  both({
    x: 34,
    z: 0,
    w: 8,
    d: 10,
    wall: 'concrete',
    ground: 'tile',
    awning: 'awning',
    doors: [
      { side: 'w', at: -2 },
      { side: 'n', at: 0 },
    ],
    windows: [
      { side: 'w', at: 2, w: 2.4, sill: 0.7, top: 2.2 },
      { side: 'e', at: 0 },
    ],
    outside: { side: 's', at: -3.7, dir: 1 },
  });
  M(32, 0, -1, 0.8, 1.1, 3, 'crate'); // counter

  // ---------------------------------------------------------------- Back yards
  // North: a car park with a low wall
  wreck(31.5, 0, -36, false);
  wreck(37, 0, -27, false);
  M(33, 0, -15.5, 6, 1.1, 0.4, 'wall2');
  // South: a fenced basketball court with a gap on the street and on the north side
  const fence = (x0: number, z0: number, x1: number, z1: number) => railing(M, x0, z0, x1, z1, 0, 1.2);
  fence(30, 15, 33, 15);
  fence(36.5, 15, 39.5, 15);
  fence(30, 15, 30, 22.5);
  fence(30, 29.5, 30, 37);
  fence(30, 37, 39.5, 37);
  for (const hz of [15.8, 36.2]) {
    const out = hz < 26 ? -1 : 1;
    M(34.5, 0, hz + out * 0.4, 0.25, 3.4, 0.25, 'metal');
    M(34.5, 2.9, hz, 1.8, 1, 0.1, 'metal');
  }
  MD(34.5, 0, 26, 7, 0.02, 0.12, 'trim');

  // Street furniture along the service road
  for (const lz of [-17, 12, 28]) {
    ctx.P(RAMP_X1 + 0.6, lz, LAMP);
    ctx.P(-RAMP_X1 - 0.6, lz, LAMP);
  }
  wreck(13.5, 0, -20, false);
  wreck(13.5, 0, 21, false);
  for (const [x, z] of [
    [27.8, -12],
    [10.5, 38],
  ] as const) {
    ctx.P(x, z, BARREL);
    ctx.P(-x, z, BARREL);
  }

  // ---------------------------------------------------------------- Spawns, pickups, power weapons, objects
  for (const [x, z] of [
    [12.5, -37],
    [12.5, -27],
    [12.5, -4],
    [12.5, 36],
    [22, -10],
    [22, 10],
    [34, -22],
    [35, -10],
    [35, 10],
    [34.5, 22],
    [34.5, 32],
  ] as const)
    Sm(x, z);
  PW(0, -3);
  PW(0, 14, DECK_Y);
  PK('hp', cx, 0);
  PK('hp', -cx, 0);
  PK('armor', 0, -30, DECK_Y);
  PK('armor', 0, 35);
  for (const s of [1, -1]) {
    BR(s * 24, -7.5);
    BR(s * 13, 26);
    BK(s * 31.5, -20);
    BK(s * 28.5, 33);
  }
}
