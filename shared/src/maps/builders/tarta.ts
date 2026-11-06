import { TILE_PITCH, TILE_S, course } from './course';
import type { MapBuildContext } from '../types';

/** The four tiers of the cake: each one a ledge pull (2.2 m) above the last, from south to north. */
const Y1 = 4;
const Y2 = Y1 + 2.2;
const Y3 = Y2 + 2.2;
const Y4 = Y3 + 2.2;
/** Middle line (z) of each tier: they run along x, east, west, east and west again. */
const Z1 = 30;
const Z2 = 10;
const Z3 = -10;
const Z4 = -28;
/** The last climb: three ledges from the fourth tier to the cherry on top. */
const STEP1 = Y4 + 2.2;
const STEP2 = STEP1 + 2.2;
const FINISH = STEP2 + 2.2;

// Tarta: a four-tier cake over a sea of cream, run in a zigzag that climbs a tier at every turn (a jump over a 1.5 m
// gap and a ledge pull). Easy to hard (checkpoints CP, in order; the last one is the finish):
//  tier 1 (→ east): a wide slab of four hammers, stepping stones (CP1), the pusher bridge, the climb (CP2);
//  tier 2 (← west): a field of dropping tiles (CP3), a plaza with two big sweepers, three beams (CP4), the climb;
//  tier 3 (→ east): the hammer bridge, long jumps of 3.5, 4 and 4.5 m (CP5), a sweeper island, the climb (CP6);
//  tier 4 (← west): a bridge of dropping tiles two wide, hammers and a sweeper (CP7), three ledges to the finish.
export function buildTarta(ctx: MapBuildContext): void {
  const { D, S, HZ, TL, PK } = ctx;
  const { plat, block, checkpoint, arch, gallows, housing } = course(ctx);
  const hammer = (x: number, z: number, y: number, period: number, phase: number) => {
    HZ({ k: 'hammer', x, y, z, len: 5.5, period, phase });
    gallows(x, z, y);
  };

  D(0, 0, 0, 80, 0.05, 80, 'water');

  // ================================================================ Tier 1, west → east
  plat(-37, -29, Z1 - 5, Z1 + 5, Y1, 'step');
  for (const x of [-35.5, -33, -30.5]) for (const dz of [-3.6, -1.2, 1.2, 3.6]) S(x, Z1 + dz);
  arch(-29, Z1, Y1, 10, true);

  // 1 · A wide slab under four hammers swinging out of step
  plat(-29, -11, Z1 - 4, Z1 + 4, Y1, 'cont1');
  for (const [x, period, phase] of [
    [-25.5, 2600, 0],
    [-21.5, 2200, 0.25],
    [-17.5, 3000, 0.5],
    [-13.5, 2400, 0.75],
  ] as const)
    hammer(x, Z1, Y1, period, phase);

  // 2 · Stepping stones, 2 m apart, from side to side
  for (const [x0, dz, c] of [
    [-9, -1.5, 'cont2'],
    [-2, 1.5, 'cont3'],
    [5, -1.5, 'tile'],
  ] as const)
    plat(x0, x0 + 5, Z1 + dz - 1.75, Z1 + dz + 1.75, Y1, c);
  checkpoint(12, 18, Z1 - 5, Z1 + 5, Y1); // CP1

  // 3 · Pushers: a bridge with blocks punching out from both sides
  plat(18, 32, Z1 - 2, Z1 + 2, Y1, 'platform');
  for (const [x, side, phase] of [
    [20.5, 1, 0],
    [24, -1, 0.3],
    [27.5, 1, 0.6],
    [30.5, -1, 0.15],
  ] as const) {
    HZ({ k: 'pusher', x, y: Y1, z: Z1, len: 3, period: 2200, phase, side });
    housing(x, Z1, Y1, side);
  }
  plat(32, 38, Z1 - 5, Z1 + 5, Y1, 'slab');
  // Up to tier 2: jump the gap north and pull yourself up
  checkpoint(31, 38, 17, 23.5, Y2, true); // CP2

  // ================================================================ Tier 2, east → west
  // 4 · Dropping tiles: seven rows of five, jumped onto from the north edge of CP2
  const rows = 7;
  for (let i = 0; i < rows; i++)
    for (let dz = -4.1; dz <= 4.11; dz += TILE_PITCH)
      TL(38 - TILE_PITCH + TILE_S / 2 - i * TILE_PITCH, Y2, Z2 + dz, TILE_S);
  const tilesEnd = 38 - rows * TILE_PITCH;
  checkpoint(tilesEnd - 5, tilesEnd, Z2 - 5, Z2 + 5, Y2); // CP3
  PK('hp', tilesEnd - 2.5, Z2 + 3.5, Y2);

  // 5 · A plaza with two big sweepers
  plat(-1, tilesEnd - 5, Z2 - 5, Z2 + 5, Y2, 'cont3');
  HZ({ k: 'sweeper', x: 13.5, y: Y2, z: Z2, len: 4.2, period: 3000, phase: 0 });
  HZ({ k: 'sweeper', x: 4, y: Y2, z: Z2, len: 4.2, period: 2500, phase: 0.5 });

  // 6 · Three beams a metre wide, 1.5 m apart
  for (const [x1, dz] of [
    [-2.5, 0],
    [-10, 0.4],
    [-17.5, -0.4],
  ] as const)
    plat(x1 - 6, x1, Z2 + dz - 0.5, Z2 + dz + 0.5, Y2, 'cont2');
  checkpoint(-37, -25, Z2 - 5, Z2 + 5, Y2); // CP4
  // Up to tier 3
  block(-37, -30, -3, 3.5, Y3, 'tile');

  // ================================================================ Tier 3, west → east
  // 7 · Hammers: a narrow bridge, three hammers swinging across it
  plat(-37, -26, Z3 - 5, Z3 + 5, Y3, 'slab');
  plat(-26, -10, Z3 - 1.5, Z3 + 1.5, Y3, 'platform');
  for (const [x, period, phase] of [
    [-22.5, 2400, 0],
    [-18.5, 2000, 0.33],
    [-14.5, 2800, 0.66],
  ] as const)
    hammer(x, Z3, Y3, period, phase);

  // 8 · Long jumps: 3.5, 4 and 4.5 m of cream, then 4 m to the checkpoint
  for (const [x0, dz, c] of [
    [-6.5, 1, 'cont1'],
    [1.5, -1, 'cont2'],
    [10, 1, 'cont3'],
  ] as const)
    plat(x0, x0 + 4, Z3 + dz - 2, Z3 + dz + 2, Y3, c);
  checkpoint(18, 24, Z3 - 5, Z3 + 5, Y3); // CP5
  PK('armor', 21, Z3 - 3.5, Y3);

  // 9 · An island 3 m away with a sweeper, and up to tier 4
  plat(27, 37, Z3 - 5, Z3 + 5, Y3, 'tile');
  HZ({ k: 'sweeper', x: 32, y: Y3, z: Z3, len: 3.5, period: 2600, phase: 0.2 });
  checkpoint(29, 37, -34, -16.5, Y4, true); // CP6

  // ================================================================ Tier 4, east → west
  // 10 · A bridge of dropping tiles, two wide and eight long
  const rows4 = 8;
  for (let i = 0; i < rows4; i++)
    for (const dz of [-TILE_PITCH / 2, TILE_PITCH / 2])
      TL(29 - TILE_PITCH + TILE_S / 2 - i * TILE_PITCH, Y4, Z4 + dz, TILE_S);
  const bridgeEnd = 29 - rows4 * TILE_PITCH;

  // 11 · Two hammers and a sweeper between them
  plat(-4, bridgeEnd, Z4 - 5, Z4 + 5, Y4, 'cont1');
  hammer(8.5, Z4, Y4, 2400, 0);
  HZ({ k: 'sweeper', x: 3, y: Y4, z: Z4, len: 3.5, period: 2200, phase: 0.6 });
  hammer(-1.5, Z4, Y4, 2000, 0.4);
  checkpoint(-12, -4, Z4 - 5, Z4 + 5, Y4); // CP7

  // 12 · Three ledges up to the cherry on top
  block(-19.5, -13.5, Z4 - 5, Z4 + 5, STEP1, 'cont2');
  block(-27, -21, Z4 - 5, Z4 + 5, STEP2, 'cont3');
  checkpoint(-37, -28.5, Z4 - 5, Z4 + 5, FINISH, true); // the finish
  arch(-32.75, Z4, FINISH, 10, true);
}
