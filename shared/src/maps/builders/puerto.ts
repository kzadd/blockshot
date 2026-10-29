import { LAMP, pad, stairs } from '../props';
import { house, railing } from '../structures';
import type { BoxFn, MapBuildContext, StructureKind } from '../types';

/** The quays stand this high over the canal floor (m); the water reaches a little under them. */
const G = 1.2;
const WATER_TOP = 0.85;
/** Half width of the canal (m). */
const CANAL = 5;
/** Container footprint (the pack model's) and height per container. */
const CONT_W = 2.6;
const CONT_L = 6;
const CONT_H = 2.6;
/** Gantry crane over the canal: walkway height above the quay. */
const GANTRY_H = 7;
const WALK_T = 0.3;
/** Ship in its dock: hull top above the quay. */
const HULL_H = 3.5;
/** A zipline's low end sits this far above where riders land (they hang ZIPLINE.hang under it). */
const ZIP_LAND = 2.3;

// Puerto: a container yard to the north, a canal across the middle with two causeways and a gantry crane over
// it, and a freighter in its dock to the south. Three ways across (two low and one high); the crane's walkway
// and the ship's deck are the high ground, with ziplines down from the crane.
export function buildPuerto(ctx: MapBuildContext): void {
  const { B, D, S, P, H, BR, BK, PK, LD, ZL, rand } = ctx;
  const k = H / 40;
  // The crane, the ship and its dock grow with the map size
  const GANTRY_HALF = Math.round(5 + 8 * k);
  const HULL_HALF = Math.round(24 * k);
  const HULL_Z0 = Math.round(5 + 9 * k);
  const HULL_Z1 = HULL_Z0 + Math.round(8 + 4 * k);
  /** Boxes standing on the quay (y measured from its top). */
  const Q: BoxFn = (x, y, z, w, h, d, c) => B(x, y + G, z, w, h, d, c);

  // Quays and canal: the water is decoration over the canal floor (you can wade through it, slowly exposed)
  B(0, 0, -(CANAL + H) / 2, 2 * H, G, H - CANAL, 'quay');
  B(0, 0, (CANAL + H) / 2, 2 * H, G, H - CANAL, 'quay');
  D(0, 0, 0, 2 * H, WATER_TOP, 2 * CANAL, 'water');
  // Two causeways
  for (const s of [1, -1]) B(s * 20 * k, 0, 0, 6, G, 2 * CANAL, 'bridge');
  // Bollards along both quay edges
  for (let x = -H + 4; x < H - 3; x += 7) {
    if (Math.abs(Math.abs(x) - 20 * k) < 4) continue;
    for (const s of [1, -1]) Q(x, 0, s * (CANAL + 0.6), 0.5, 0.7, 0.5, 'metal');
  }

  // Gantry crane: four legs and a walkway over the canal, ladders up the legs at each end
  for (const sx of [1, -1]) for (const sz of [1, -1]) Q(sx * 1.1, 0, sz * GANTRY_HALF, 0.8, GANTRY_H, 0.8, 'metal');
  Q(0, GANTRY_H, 0, 3.2, WALK_T, 2 * GANTRY_HALF + 1, 'metal');
  railing(B, -1.5, -GANTRY_HALF, -1.5, GANTRY_HALF, G + GANTRY_H + WALK_T);
  railing(B, 1.5, -GANTRY_HALF, 1.5, GANTRY_HALF, G + GANTRY_H + WALK_T);
  const walkTop = G + GANTRY_H + WALK_T;
  LD(1.1, -GANTRY_HALF - 0.4, walkTop, 2);
  LD(-1.1, GANTRY_HALF + 0.4, walkTop, 0);
  // Its cab hangs over the middle (cover up there)
  Q(0, GANTRY_H + WALK_T, 0, 2.4, 1.6, 3, 'metal');

  // North: the container yard, stacks of one to three with ladders on the tall ones
  const colors: StructureKind[] = ['cont1', 'cont2', 'cont3'];
  const stack = (x: number, z: number, n: number) => {
    for (let i = 0; i < n; i++) Q(x, i * CONT_H, z, CONT_W, CONT_H, CONT_L, colors[Math.floor(rand() * 3)]!);
    if (n >= 2) LD(x, z + CONT_L / 2, G + n * CONT_H, 0);
  };
  const rowA: [number, number][] = [
    [-30, 1],
    [-21, 2],
    [-12, 1],
    [12, 1],
    [21, 3],
    [30, 1],
  ];
  const rowB: [number, number][] = [
    [-26, 2],
    [-16, 1],
    [-6, 3],
    [6, 2],
    [16, 1],
    [26, 2],
  ];
  for (const [x, n] of rowA) stack(x * k, -15 * k, n);
  for (const [x, n] of rowB) stack(x * k, -26 * k, n);
  // Crates that break and barrels between the rows
  for (const x of [-30, -8, 8, 30]) BK(x * k, -20.5 * k, 1.3);
  for (const x of [-17, 17]) BR(x * k, -20.5 * k);
  BK(-3 * k, -9, 1.2);
  BK(3.5 * k, -10.5, 1.2);

  // North hut by the canal: health inside
  const hutN = { x: -34 * k, z: -10 * k };
  house(ctx, {
    x: hutN.x,
    z: hutN.z,
    w: 7,
    d: 6,
    y: G,
    wall: 'metal',
    roof: 'roof',
    ground: 'tile',
    doors: [{ side: 'e' }, { side: 's' }],
    windows: [{ side: 'n' }],
  });
  PK('hp', hutN.x, hutN.z);

  // South: the freighter in its dock, a gangway at the stern, the bridge tower aft and containers on deck
  const hullZ = (HULL_Z0 + HULL_Z1) / 2;
  Q(0, 0, hullZ, 2 * HULL_HALF, HULL_H, HULL_Z1 - HULL_Z0, 'hull');
  const Lift: BoxFn = (x, y, z, w, h, d, c) => B(x, y + G, z, w, h, d, c);
  stairs(Lift, -HULL_HALF, hullZ, 'x', 1, Math.round(HULL_H / 0.5), 2.6, 'deck');
  const deck = G + HULL_H;
  // Bow to the east: the hull narrows to a point (stepped blocks, walkable on top)
  const beam = HULL_Z1 - HULL_Z0;
  for (let i = 1; i <= 3; i++)
    Q(HULL_HALF + 0.75 + (i - 1) * 1.5, 0, hullZ, 1.5, HULL_H, beam * (1 - i * 0.24), 'hull');
  railing(B, -HULL_HALF, HULL_Z0 + 0.1, HULL_HALF, HULL_Z0 + 0.1, deck);
  railing(B, -HULL_HALF, HULL_Z1 - 0.1, HULL_HALF, HULL_Z1 - 0.1, deck);
  const towerX = Math.round(16 * k);
  house(ctx, {
    x: towerX,
    z: hullZ,
    w: 7,
    d: 7,
    y: deck,
    wall: 'hull',
    roof: 'platform',
    ground: 'deck',
    doors: [{ side: 'w' }, { side: 'n' }],
    windows: [{ side: 'w', at: 2.2 }, { side: 'e' }],
  });
  LD(towerX, hullZ + 3.5, deck + 3.3, 0);
  // Funnel behind the tower (it only blocks what a funnel would)
  B(towerX + 5, deck, hullZ, 2.2, 6, 2.6, 'hull');
  B(-12 * k, deck, hullZ - 2, CONT_L, CONT_H, CONT_W, 'cont2');
  B(-12 * k, deck + CONT_H, hullZ - 2, CONT_L, CONT_H, CONT_W, 'cont1');
  B(-2 * k, deck, hullZ + 2.5, CONT_L, CONT_H, CONT_W, 'cont3');
  BK(-6 * k, hullZ + 3, 1.2, deck);
  // Health on the bridge tower, armour at the crane's cab (the hottest spot)
  PK('armor', 0, 1.9, walkTop);
  // Jump pads from the quay up to the deck
  for (const x of [-8, 8]) pad(B, x, HULL_Z0 - 1.6, G);

  // South quay: cover in front of the hull, barrels by the gangways
  const quayZ = (CANAL + HULL_Z0) / 2;
  for (const s of [1, -1]) BR(s * (HULL_HALF - 3), quayZ);
  BK(-12 * k, quayZ, 1.3);
  BK(12 * k, quayZ - 0.5, 1.3);
  Q(0, 0, quayZ + 0.5, 4, 1.1, 1.2, 'concrete');

  // South hut (mirror of the north one), health inside
  const hutS = { x: 34 * k, z: 10 * k };
  house(ctx, {
    x: hutS.x,
    z: hutS.z,
    w: 7,
    d: 6,
    y: G,
    wall: 'metal',
    roof: 'roof',
    ground: 'tile',
    doors: [{ side: 'w' }, { side: 'n' }],
    windows: [{ side: 's' }],
  });
  PK('hp', hutS.x, hutS.z);

  // Ziplines from the crane's walkway: north down onto the tallest stack, south down onto the deck
  const top = walkTop + ZIP_LAND;
  ZL([0, top, -GANTRY_HALF - 0.6], [6 * k, G + 2 * CONT_H + ZIP_LAND, -26 * k + 1]);
  ZL([0, top, GANTRY_HALF + 0.6], [0, deck + ZIP_LAND, hullZ + 1]);

  // Lamps on the quays
  for (const s of [1, -1]) for (const x of [-34, -10, 10, 34]) P(x * k, s * 7.5, LAMP);

  // Spawns: the back of each side
  for (let x = -30; x <= 30; x += 10) {
    S(x * k, -(H - 2.5));
    S(x * k, H - 2.5);
  }
}
