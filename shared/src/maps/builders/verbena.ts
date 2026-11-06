import { TILE_PITCH, TILE_S, course } from './course';
import type { MapBuildContext } from '../types';

/** Course height over the pool; the second half runs higher, after the stairs. */
const Y = 4;
const HIGH = Y + 4.4;
/** The legs of the spiral: west (going north), north (going east), east (going south), south (going west). */
const AX = -30;
const BZ = -31.6;
const CX = 31.5;
const DZ = 26;
/** The last climb: three ledges (a jump over a 1.5 m gap and a pull up) to the tower in the middle. */
const PLAZA = HIGH + 2.4;
const LEDGE = PLAZA + 2.2;
const LEDGE2 = LEDGE + 2.2;
const FINISH = LEDGE2 + 2.2;

// Verbena: a funfair obstacle course over a pool, a spiral inwards from the south-west corner to a tower in the
// middle. Four legs, easy to hard (checkpoints CP, in order; the last one is the finish):
//  west leg (→ north): stepping stones, a plaza with two sweepers (CP1), a field of dropping tiles (CP2);
//  north leg (→ east): the hammer bridge, a staircase up over the water, the pusher bridge (CP3), a sweeper island;
//  east leg (→ south): three narrow beams (CP4), a corridor of three short sweepers to jump (CP5);
//  south leg (→ west): three pillars climbing a little each, the plaza (CP6), then three ledges up to the tower (finish).
export function buildVerbena(ctx: MapBuildContext): void {
  const { D, S, HZ, TL, PK } = ctx;
  const { plat, block, checkpoint, arch, gallows, housing } = course(ctx);

  D(0, 0, 0, 80, 0.05, 80, 'water');

  // ================================================================ West leg, south → north
  plat(AX - 6, AX + 6, 27, 36, Y, 'step');
  for (const x of [-34.5, -31.5, -28.5, -25.5]) for (const z of [29, 31.5, 34]) S(x, z);
  arch(AX, 27, Y, 12, false);

  // 1 · Stepping stones, 2 m apart, from side to side
  for (const [z0, dx, c] of [
    [20, -1.2, 'cont1'],
    [13, 1.2, 'cont2'],
    [6, -1.2, 'cont3'],
  ] as const)
    plat(AX + dx - 1.75, AX + dx + 1.75, z0, z0 + 5, Y, c);

  // 2 · A plaza with two spinning bars (jump them)
  plat(AX - 5, AX + 5, -12, 4, Y, 'tile');
  HZ({ k: 'sweeper', x: AX, y: Y, z: 0, len: 3.8, period: 3000, phase: 0 });
  HZ({ k: 'sweeper', x: AX, y: Y, z: -8.3, len: 3.8, period: 2400, phase: 0.5 });
  checkpoint(AX - 5, AX + 5, -17, -12, Y); // CP1

  // 3 · Dropping tiles: five rows of them (they shake, then drop under you)
  const rows = 5;
  for (let i = 0; i < rows; i++)
    for (let dx = -4.1; dx <= 4.11; dx += TILE_PITCH)
      TL(AX + dx, Y, -17 - TILE_PITCH + TILE_S / 2 - i * TILE_PITCH, TILE_S);
  const tilesEnd = -17 - rows * TILE_PITCH;
  checkpoint(AX - 6, AX + 6, -36, tilesEnd, Y); // CP2: the north-west corner

  // ================================================================ North leg, west → east
  // 4 · Hammers: a narrow bridge, three hammers swinging across it out of step
  plat(-24, -9, BZ - 1.5, BZ + 1.5, Y, 'slab');
  for (const [x, period, phase] of [
    [-20.5, 2400, 0],
    [-16.5, 2000, 0.33],
    [-12.5, 2800, 0.66],
  ] as const) {
    HZ({ k: 'hammer', x, y: Y, z: BZ, len: 5.5, period, phase });
    gallows(x, BZ, Y);
  }

  // 5 · Staircase over the water: four blocks 1.1 m higher each, 0.8 m apart (a jump each)
  const kinds = ['cont1', 'cont2', 'cont3', 'tile'] as const;
  for (let i = 0; i < 4; i++) {
    const x0 = -8.2 + i * 3.3;
    block(x0, x0 + 2.5, BZ - 2, BZ + 2, Y + 1.1 * (i + 1), kinds[i]);
  }

  // 6 · Pushers: up there, a bridge with blocks punching out from both sides
  plat(5, 19, BZ - 2, BZ + 2, HIGH, 'platform');
  for (const [x, side, phase] of [
    [7.5, 1, 0],
    [11, -1, 0.3],
    [14.5, 1, 0.6],
    [17.5, -1, 0.15],
  ] as const) {
    HZ({ k: 'pusher', x, y: HIGH, z: BZ, len: 3, period: 2200, phase, side });
    housing(x, BZ, HIGH, side);
  }
  checkpoint(19, 24, BZ - 4, BZ + 4, HIGH); // CP3
  PK('hp', 21.5, BZ - 3, HIGH);

  // 7 · The north-east corner: an island 3 m away with a big sweeper
  plat(27, 36, BZ - 4.5, BZ + 4.5, HIGH, 'cont2');
  HZ({ k: 'sweeper', x: CX, y: HIGH, z: BZ, len: 3.6, period: 2600, phase: 0.2 });

  // ================================================================ East leg, north → south
  // 8 · Three beams a metre wide, 1.5 m apart
  for (const [z0, dx] of [
    [-25.6, 0],
    [-18.1, 0.4],
    [-10.6, -0.4],
  ] as const)
    plat(CX + dx - 0.5, CX + dx + 0.5, z0, z0 + 6, HIGH, 'cont3');
  checkpoint(27, 36, -3.1, 3, HIGH); // CP4

  // 9 · A corridor with three short bars spinning across all of it: jump each one as it comes
  plat(CX - 2.5, CX + 2.5, 3, 21, HIGH, 'tile');
  for (const [z, period, phase] of [
    [7, 1800, 0],
    [12.5, 2200, 0.4],
    [18, 2000, 0.75],
  ] as const)
    HZ({ k: 'sweeper', x: CX, y: HIGH, z, len: 2.4, period, phase });
  checkpoint(26, 36, 21, 31, HIGH); // CP5: the south-east corner
  PK('armor', 33, 29, HIGH);

  // ================================================================ South leg, east → west, and up
  // 10 · Pillars 1.8 m apart, each 0.8 m higher (long enough to land on after a walking jump)
  for (let i = 0; i < 3; i++) {
    const x1 = 24.2 - i * 6.3;
    const z = DZ + (i % 2 ? 1 : -1);
    block(x1 - 4.5, x1, z - 1.5, z + 1.5, HIGH + 0.8 * (i + 1), kinds[i]);
  }
  checkpoint(-6, 5.3, DZ - 5, DZ + 5, PLAZA); // CP6

  // 11 · The tower: three ledges to pull yourself up onto (a sweeper on the first), the finish on top
  block(-5, 5, 13.5, 19.5, LEDGE, 'cont1');
  HZ({ k: 'sweeper', x: 0, y: LEDGE, z: 16.5, len: 2.6, period: 2400, phase: 0.5 });
  block(-5, 5, 6, 12, LEDGE2, 'cont2');
  checkpoint(-6, 6, -6, 4.5, FINISH, true); // the finish

  arch(0, -0.75, FINISH, 10, false);
}
