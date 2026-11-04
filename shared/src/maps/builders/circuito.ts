import { pad } from '../props';
import type { BoxKind, MapBuildContext } from '../types';

/** Course height over the lava (the arena floor): falling below RACE_FALL_Y sends you back to your checkpoint. */
const Y = 4;
const SLAB = 0.6;
/** The three legs of the course run along x at these z: north (west → east), middle (back west), south (east). */
const NORTH = -28;
const MID = 0;
const SOUTH = 28;
/** Track width (along z) on the wide sections, the hammer bridge and the pusher bridge. */
const WIDE = 10;
const BRIDGE = 3;
const PUSH_W = 4;
/** Dropping tiles: side and gap. */
const TILE_S = 1.8;
const TILE_GAP = 0.25;
/** The two ledges of the first leg: within a jump + ledge pull (2.4 m above the feet) once you jump the gap. */
const LEDGE1 = Y + 2.2;
const TOWER = LEDGE1 + 2.6;
/** A zipline cable hangs this far over the floor at either end (grabbed with a jump). */
const ZIP_UP = 2.5;
/** The wall-jump chimney: 2.2 m between two walls 6 m high, climbed by bouncing from side to side. */
const CHIMNEY = 2.2;
const HIGH = Y + 6;
/** The finish: on a tower a ledge pull above the last island. */
const FINISH = HIGH + 2.6;
/** Low ceiling of the slide tunnel: you only fit crouched (1.25 m) or sliding. */
const TUNNEL_H = 1.4;

// Circuito: an obstacle course over lava for the Carrera mode (Fall Guys with guns), with an Urban Terror twist:
// every section is a movement trick. Three legs joined by two turns, easy to hard:
//  north leg (→ east): stepping stones, sweepers, two ledges to pull up onto a tower, and a zipline down to…
//  middle leg (← west): dropping tiles, the hammer bridge, a slide tunnel and the pusher bridge; then jump pads to…
//  south leg (→ east): long jumps (the last one sprinting), a 2.2 m wall-jump chimney up to the high islands
//  with sweepers, and the last ledge pull onto the finish tower.
// Checkpoints (CP, in order; the last one is the finish) after each turn and every couple of sections.
export function buildCircuito(ctx: MapBuildContext): void {
  const { B, D, S, CP, HZ, TL, PW, PK, BK, BR, ZL } = ctx;
  /** Lava columns under a slab, so nothing floats (decor). */
  const pillars = (x0: number, x1: number, z: number, top: number) => {
    const n = Math.max(1, Math.round((x1 - x0) / 8));
    for (let i = 0; i < n; i++) D(x0 + ((i + 0.5) * (x1 - x0)) / n, 0, z, 0.9, top, 0.9, 'wall');
  };
  /** A slab from x0 to x1 (along the course) and z0 to z1, its top at y. */
  const plat = (x0: number, x1: number, z0: number, z1: number, y = Y, c: BoxKind = 'platform') => {
    B((x0 + x1) / 2, y - SLAB, (z0 + z1) / 2, x1 - x0, SLAB, z1 - z0, c);
    pillars(x0, x1, (z0 + z1) / 2, y - SLAB);
  };
  /** A solid block of rock out of the lava, its top at y. */
  const block = (x0: number, x1: number, z0: number, z1: number, y: number, c: BoxKind = 'wall') =>
    B((x0 + x1) / 2, 0, (z0 + z1) / 2, x1 - x0, y, z1 - z0, c);
  /** A checkpoint slab: all of it counts. */
  const checkpoint = (x0: number, x1: number, z0: number, z1: number, y = Y) => {
    plat(x0, x1, z0, z1, y, 'step');
    CP((x0 + x1) / 2, y, (z0 + z1) / 2, x1 - x0, z1 - z0);
  };
  /** An arch over the course at x (decor): two posts and a banner. */
  const arch = (x: number, z: number, y: number, span: number) => {
    for (const s of [-1, 1]) D(x, y, z + (s * span) / 2, 0.5, 4, 0.5, 'metal');
    D(x, y + 4, z, 0.5, 0.8, span + 0.5, 'awning');
  };

  D(0, 0, 0, 80, 0.05, 80, 'lava');

  // ================================================================ North leg, west → east (easy)
  const n0 = NORTH - WIDE / 2;
  const n1 = NORTH + WIDE / 2;
  // Start: a wide slab with room for twelve
  plat(-38, -30, n0, n1, Y, 'step');
  for (const x of [-36.5, -34.5, -32.5]) for (const dz of [-3.6, -1.2, 1.2, 3.6]) S(x, NORTH + dz);
  arch(-30, NORTH, Y, WIDE);

  // 1 · Stepping stones: short jumps (1.5, 2, 2 and 1.5 m) from side to side; each stone is longer than a walking
  // jump (about 6.4 m with the Urban Terror jump) minus the gap, so jumping at its end never overshoots the next one
  for (const [x0, x1, dz] of [
    [-28.5, -23, -1.2],
    [-21, -16, 1.2],
    [-14, -9, -1.2],
  ] as const)
    plat(x0, x1, NORTH + dz - 1.5, NORTH + dz + 1.5);

  // 2 · Sweepers: two spinning bars across a wide slab (jump them)
  plat(-7.5, 9, n0, n1);
  HZ({ k: 'sweeper', x: -3.4, y: Y, z: NORTH, len: 4, period: 3200, phase: 0 });
  HZ({ k: 'sweeper', x: 4.6, y: Y, z: NORTH, len: 4, period: 2600, phase: 0.5 });
  checkpoint(9, 14, n0, n1); // CP1

  // 3 · Ledges: jump a lava gap at a wall and pull yourself up (hold jump), twice, onto the tower
  block(15.5, 22, NORTH - 4, NORTH + 4, LEDGE1, 'rock');
  block(23.5, 38, n0, n1, TOWER, 'wall');
  PK('hp', 27, NORTH - 3, TOWER);
  // 4 · Zipline from the tower's south edge down to the middle leg
  ZL([34, TOWER + ZIP_UP, n1 - 1], [34, Y + ZIP_UP, MID - 2.5]);

  // ================================================================ Middle leg, east → west
  const m0 = MID - WIDE / 2;
  const m1 = MID + WIDE / 2;
  checkpoint(30, 38, m0, m1); // CP2: under the zipline
  PW(36, MID + 3);

  // 5 · Dropping tiles: a field of them over the lava (they shake, then drop under you)
  const pitch = TILE_S + TILE_GAP;
  const cols = 6;
  for (let i = 0; i < cols; i++)
    for (let z = -4.1; z <= 4.11; z += pitch) TL(30 - TILE_GAP - TILE_S / 2 - i * pitch, Y, MID + z, TILE_S);
  const tilesEnd = 30 - cols * pitch;
  checkpoint(tilesEnd - 4.5, tilesEnd, m0, m1); // CP3
  PK('armor', tilesEnd - 2.25, MID - 3.5);

  // 6 · Hammers: a narrow bridge, three hammers swinging across it out of step
  const h1 = tilesEnd - 4.5;
  plat(0, h1, MID - BRIDGE / 2, MID + BRIDGE / 2);
  for (const [x, period, phase] of [
    [h1 - 3, 2400, 0],
    [h1 - 6.5, 2000, 0.33],
    [h1 - 10, 2800, 0.66],
  ] as const) {
    HZ({ k: 'hammer', x, y: Y, z: MID, len: 5.5, period, phase });
    // the gallows they hang from
    for (const s of [-1, 1]) B(x, 0, MID + s * 6, 0.4, Y + 6.6, 0.4, 'metal');
    D(x, Y + 6.6, MID, 0.4, 0.4, 12.4, 'metal');
  }

  // 7 · Slide tunnel: a low roof behind a tall face; slide under it (crouch while running) or crawl
  plat(-10, 0, MID - PUSH_W / 2, MID + PUSH_W / 2);
  B(-4.75, Y + TUNNEL_H, MID, 6.5, 0.8, PUSH_W + 0.4, 'metal');
  B(-1.25, Y + TUNNEL_H, MID, 0.5, 4.1, PUSH_W + 0.4, 'metal');
  D(-1, Y + TUNNEL_H - 0.3, MID, 0.05, 0.3, PUSH_W + 0.4, 'awning');

  // 8 · Pushers: a bridge with blocks punching out from both sides, out of step
  plat(-24, -10, MID - PUSH_W / 2, MID + PUSH_W / 2);
  for (const [x, side, phase] of [
    [-12.5, 1, 0],
    [-16, -1, 0.3],
    [-19.5, 1, 0.6],
    [-22.5, -1, 0.15],
  ] as const) {
    HZ({ k: 'pusher', x, y: Y, z: MID, len: 3, period: 2200, phase, side });
    // the housing it slides out of
    B(x, Y - SLAB, MID + side * 4.2, 2.2, 2.4 + SLAB, 1.4, 'metal');
  }

  // 9 · The west turn: a plaza (CP4) with a jump pad up to an island, and another pad over to the south leg
  checkpoint(-38, -24, m0, m1); // CP4
  pad(B, -35, MID + 3.6, Y);
  PK('hp', -27, MID - 3.5);
  BK(-29, MID + 3.5);
  BR(-37, MID - 4);
  block(-37.5, -32.5, MID + 8, MID + 14, Y + 3, 'rock');
  pad(B, -35, MID + 12.6, Y + 3);

  // ================================================================ South leg, west → east (hardest)
  const s0 = SOUTH - WIDE / 2;
  const s1 = SOUTH + WIDE / 2;
  checkpoint(-38, -28, s0 - 2, s1 + 1); // CP5: where the pads land
  PW(-36, SOUTH + 4);

  // 10 · Long jumps: 5, 5.5, 6 and 8.8 m of lava. Walking jumps (and a ledge pull when you fall a bit short) make the
  // first three; the last one needs a sprint, so save your stamina for it (jumps and sprinting both spend it)
  for (const [x0, x1, dz] of [
    [-23, -20, -1],
    [-14.5, -11, 1],
    [-5, -1.8, -1],
  ] as const)
    plat(x0, x1, SOUTH + dz - 2, SOUTH + dz + 2);
  checkpoint(7, 10.5, s0, s1); // CP6
  BK(7.5, s0 + 1.2);

  // 11 · The chimney: a 2.2 m slot between two 6 m walls, closed at the far end; bounce from wall to wall
  const c0 = SOUTH - CHIMNEY / 2;
  const c1 = SOUTH + CHIMNEY / 2;
  plat(10.5, 15, c0, c1);
  block(10.5, 15, s0, c0, HIGH, 'wall');
  block(10.5, 15, c1, s1, HIGH, 'wall');
  block(15, 18, s0, s1, HIGH, 'wall');

  // 12 · High islands with a sweeper each, 3 m gaps, then the last ledge onto the finish tower
  plat(21, 26, SOUTH - 2.5, SOUTH + 2.5, HIGH);
  HZ({ k: 'sweeper', x: 23.5, y: HIGH, z: SOUTH, len: 2.2, period: 2200, phase: 0.25 });
  plat(29, 33, SOUTH - 2, SOUTH + 2, HIGH);
  HZ({ k: 'sweeper', x: 31, y: HIGH, z: SOUTH, len: 1.7, period: 1700, phase: 0.75 });
  // The finish: on top of the tower
  block(34.5, 38.5, SOUTH - 3, SOUTH + 3, FINISH, 'step');
  CP(36.5, FINISH, SOUTH, 4, 6);
  arch(36.5, SOUTH, FINISH, 6);
}
