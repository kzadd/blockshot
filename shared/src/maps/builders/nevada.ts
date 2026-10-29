import { LOGS, PINE, sandbags } from '../props';
import { house, railing } from '../structures';
import type { MapBuildContext } from '../types';

/** Watchtowers: platform height, half its side and the legs' thickness (m). */
const TOWER_H = 6;
const TOWER_HALF = 2.75;
const LEG = 0.5;
const DECK_T = 0.3;
/** Frozen lake in the middle: half its size on x and z. */
const LAKE_X = 14;
const LAKE_Z = 12;
/** A zipline's low end sits this far above the snow where riders land. */
const ZIP_LAND = 2.3;

// Nevada: a mountain post in the snow, laid out the same seen from either side (turned half round): a frozen
// lake in the middle (the quick, open way), pine woods to the west and east (the slow, covered ways), a
// watchtower in two corners with a zipline down to the lake, log cabins to the south-west and a sawmill to the
// north-east.
export function buildNevada(ctx: MapBuildContext): void {
  const { B, D, S, P, H, BR, BK, PK, LD, ZL, rand } = ctx;
  const k = H / 40;

  // The lake: ice you can cross in the open, rocks round its shore
  D(0, 0, 0, 2 * LAKE_X * k, 0.03, 2 * LAKE_Z * k, 'ice');
  PK('armor', 0, 0);
  const rocks: [number, number, number, number][] = [
    [-15, -6, 2.4, 1.6],
    [14, 5, 2.6, 1.8],
    [3, 13, 2.2, 1.4],
    [-4, -13, 2.2, 1.4],
    [-9, 9, 1.6, 1.1],
    [9, -9, 1.6, 1.1],
  ];
  for (const [x, z, w, h] of rocks) B(x * k, 0, z * k, w, h, w * 0.85, 'rock');

  for (const s of [1, -1]) {
    // Watchtower in the corner (north-west, and south-east for the other side): ladder, railing and a zipline to
    // the lake shore; sandbags round its foot
    const tx = -s * 30 * k;
    const tz = -s * 30 * k;
    for (const lx of [1, -1])
      for (const lz of [1, -1])
        B(tx + lx * (TOWER_HALF - LEG), 0, tz + lz * (TOWER_HALF - LEG), LEG, TOWER_H, LEG, 'wood');
    B(tx, TOWER_H, tz, 2 * TOWER_HALF, DECK_T, 2 * TOWER_HALF, 'wood');
    const top = TOWER_H + DECK_T;
    const e = TOWER_HALF - 0.06;
    // The ladder side (towards the lake on z) keeps a gap in the railing
    // Railings on the two back sides only: the lake sides stay open for the zipline and the ladder
    railing(B, tx - e, tz - s * e, tx + e, tz - s * e, top);
    railing(B, tx - s * e, tz - e, tx - s * e, tz + e, top);
    LD(tx + s * TOWER_HALF, tz + s * 1.6, top, s > 0 ? 3 : 1);
    D(tx, top + 2.4, tz, 2 * TOWER_HALF + 0.6, 0.25, 2 * TOWER_HALF + 0.6, 'roof');
    ZL(
      [tx + s * (TOWER_HALF - 0.2), top + ZIP_LAND, tz + s * (TOWER_HALF - 0.2)],
      [-s * (LAKE_X - 2) * k, ZIP_LAND, -s * (LAKE_Z - 3) * k],
    );
    P(tx + s * 4.5, tz, sandbags(1, 3));
    P(tx, tz + s * 4.5, sandbags(3, 1));

    // Pine woods to the west (and east): many trunks, a fallen-log line and a hunter's tent
    for (let i = 0; i < 22; i++) {
      const x = -s * (22 + rand() * 16) * k;
      const z = s * (-10 + rand() * 24) * k;
      P(x, z, PINE);
    }
    B(-s * 26 * k, 0, s * 2 * k, 1, 0.9, 5, 'wood');

    // The open snow between the spawns and the lake: a sandbag trench, rocks, a log pile and a few pines
    P(-s * 4 * k, -s * 19 * k, sandbags(6, 1));
    P(s * 8 * k, -s * 17 * k, sandbags(1, 4));
    B(-s * 14 * k, 0, -s * 22 * k, 3, 2, 2.5, 'rock');
    B(s * 18 * k, 0, -s * 9 * k, 2.4, 1.6, 2, 'rock');
    P(s * 12 * k, -s * 28 * k, LOGS);
    for (const [x, z] of [
      [-8, -28],
      [2, -31],
      [-20, -14],
    ] as const)
      P(s * x * k, s * z * k, PINE);
  }

  // Log cabins to the south-west: health in the big one, barrels and a crate outside
  house(ctx, {
    x: -28 * k,
    z: 22 * k,
    w: 8,
    d: 6,
    wall: 'wood',
    roof: 'roof',
    ground: 'wood',
    doors: [{ side: 'e' }, { side: 'n' }],
    windows: [{ side: 's' }, { side: 'w' }],
  });
  PK('hp', -28 * k, 22 * k);
  house(ctx, {
    x: -16 * k,
    z: 31 * k,
    w: 5,
    d: 5,
    wall: 'wood',
    roof: 'roof',
    ground: 'wood',
    doors: [{ side: 'n' }, { side: 'e' }],
    windows: [{ side: 'w' }],
  });
  BR(-21 * k, 17 * k);
  BK(-34 * k, 27 * k, 1.2);
  BK(-10 * k, 24 * k, 1.2);

  // Sawmill to the north-east: an open shed on posts over the log stacks, health inside, fuel barrels around
  const mx = 28 * k;
  const mz = -22 * k;
  for (const px of [-5, 5]) for (const pz of [-3, 3]) B(mx + px, 0, mz + pz, 0.4, 3.2, 0.4, 'wood');
  B(mx, 3.2, mz, 10.8, 0.3, 6.8, 'roof');
  P(mx - 2.5, mz - 1.5, LOGS);
  P(mx + 2.5, mz + 1.5, LOGS);
  PK('hp', mx + 1.5, mz - 1.5);
  BR(mx + 6.5, mz - 4.5);
  BR(mx - 6, mz + 4);
  BK(mx + 6, mz + 4.5, 1.2);
  BK(mx - 6.5, mz - 4.5, 1.2);
  P(mx - 10, mz + 7, LOGS);

  // Spawns at the back of each side (none under the watchtowers)
  for (let x = -30; x <= 30; x += 10) {
    if (Math.abs(x + 30) > 4) S(x * k, -(H - 2.5));
    if (Math.abs(x - 30) > 4) S(x * k, H - 2.5);
  }
}
