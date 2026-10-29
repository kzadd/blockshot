import { LAMP, TREE, car, stairs } from '../props';
import { house, railing } from '../structures';
import type { BoxFn, MapBuildContext } from '../types';

/** The streets stand this high over the station floor (m). */
const STREET = 4;
/** Half width of the sunken station (m): the streets start at ±PIT. */
const PIT = 14;
/** Tracks (centre lines) and the island platform between them. */
const TRACK_Z = 8;
const PLATFORM_H = 1;
const PLATFORM_HALF = 5;
/** Canopy over the island platform, held by columns. */
const CANOPY_Y = 6;
/** Carriages: length, width and the gap between two of them (to cross the track). */
const CAR_L = 13;
const CAR_W = 3;
const CAR_GAP = 2.4;
/** Rails and sleepers on each track (decoration). */
const GAUGE = 1.5;
const SLEEPER_STEP = 1.2;

// Estación: two streets with kiosks up top and, sunk between them, a station with two tracks, an island platform
// under a canopy and a train standing at it that you can walk through. Four stairways and a footbridge join the
// levels; the tunnel lines are long, the train and the columns break them up.
export function buildEstacion(ctx: MapBuildContext): void {
  const { B, D, S, P, H, BR, BK, PK, LD, ZL } = ctx;
  const k = H / 40;
  const U: BoxFn = (x, y, z, w, h, d, c) => B(x, y + STREET, z, w, h, d, c);

  // The two streets
  for (const s of [1, -1]) B(0, 0, (s * (PIT + H)) / 2, 2 * H, STREET, H - PIT, 'quay');

  // Tracks: ballast, rails and sleepers (decoration), dark tunnel mouths at both ends
  for (const s of [1, -1]) {
    const z = s * TRACK_Z;
    D(0, 0, z, 2 * H, 0.06, 3.4, 'ballast');
    for (const r of [1, -1]) D(0, 0.06, z + (r * GAUGE) / 2, 2 * H, 0.14, 0.1, 'track');
    for (let x = -H + 0.6; x < H; x += SLEEPER_STEP) D(x, 0.03, z, 0.25, 0.06, 2.4, 'sleeper');
    for (const e of [1, -1]) D(e * (H - 0.15), 0, z, 0.3, 4.6, 5.2, 'tunnel');
  }

  // Island platform with steps at both ends, columns and the canopy (a ladder up one column)
  const platL = H - 9;
  B(0, 0, 0, 2 * platL, PLATFORM_H, 2 * PLATFORM_HALF, 'platform');
  for (const e of [1, -1]) stairs(B, e * platL, 0, 'x', -e, 2, 3, 'step');
  for (const x of [-24, -8, 8, 24]) B(x * k, PLATFORM_H, 0, 0.7, CANOPY_Y - PLATFORM_H, 0.7, 'concrete');
  B(0, CANOPY_Y, 0, 2 * platL - 6, 0.35, 2 * PLATFORM_HALF + 1, 'roof');
  LD(-8 * k, 0.35, CANOPY_Y + 0.35, 0);
  // Benches and a crate stack on the platform
  for (const x of [-16, 0, 16]) B(x * k, PLATFORM_H, -1.8, 2.2, 0.5, 0.6, 'wood');
  BK(-30 * k, 1.5, 1.2, PLATFORM_H);
  BK(30 * k, -1.5, 1.2, PLATFORM_H);

  // The train on the south track: three carriages with doors on both sides, roofs you can stand on
  const cars = [-1, 0, 1].map((i) => i * (CAR_L + CAR_GAP) - 4 * k);
  for (const [i, x] of cars.entries()) {
    house(ctx, {
      x,
      z: TRACK_Z,
      w: CAR_L,
      d: CAR_W,
      y: 0.2,
      wall: 'train',
      roof: 'roof',
      ground: 'tile',
      frame: null,
      trim: null,
      parapet: false,
      doors: [
        { side: 'n', at: -3.5 },
        { side: 'n', at: 3.5 },
        { side: 's', at: 0 },
      ],
      windows: [
        { side: 'n', at: 0, w: 3 },
        { side: 's', at: -4, w: 2.4 },
        { side: 's', at: 4, w: 2.4 },
      ],
    });
    if (i === 1) PK('armor', x, TRACK_Z);
  }

  // Stairways from each street down to the station floor (one at each corner)
  for (const s of [1, -1]) {
    for (const e of [1, -1]) stairs(B, e * 33 * k, s * (PIT - 1.4), 'x', e, Math.round(STREET / 0.5), 2.6, 'stair');
  }
  // Footbridge across the station from street to street, with railings
  const bridgeX = 14 * k;
  B(bridgeX, STREET - 0.3, 0, 3, 0.3, 2 * PIT, 'bridge');
  for (const r of [1, -1]) railing(B, bridgeX + r * 1.45, -PIT, bridgeX + r * 1.45, PIT, STREET);
  for (const z of [-4.5, 4.5]) B(bridgeX, PLATFORM_H, z, 0.6, STREET - 0.3 - PLATFORM_H, 0.6, 'concrete');
  // A railing along both street edges, open at the stairways and the bridge
  for (const s of [1, -1]) {
    const z = s * (PIT + 0.06);
    railing(B, -H, z, -36 * k, z, STREET);
    railing(B, -30 * k, z, bridgeX - 1.6, z, STREET);
    railing(B, bridgeX + 1.6, z, 30 * k, z, STREET);
    railing(B, 36 * k, z, H, z, STREET);
  }

  // Up on the streets: a ticket hall on each side (health inside), kiosks, parked cars and lamps
  for (const s of [1, -1]) {
    const hx = -s * 22 * k;
    const hz = s * (PIT + 7);
    house(ctx, {
      x: hx,
      z: hz,
      w: 10,
      d: 7,
      y: STREET,
      wall: 'brick',
      roof: 'roof',
      ground: 'tile',
      doors: [
        { side: s > 0 ? 'n' : 's', at: -2.5 },
        { side: s > 0 ? 'n' : 's', at: 2.5 },
        { side: 'e' },
        { side: 'w' },
      ],
      windows: [{ side: s > 0 ? 's' : 'n', at: 0, w: 2 }],
      outside: { side: s > 0 ? 's' : 'n', at: -4.5, dir: 1 },
    });
    PK('hp', hx, hz);
    house(ctx, {
      x: s * 4 * k,
      z: s * (PIT + 5),
      w: 3.5,
      d: 3,
      y: STREET,
      wall: 'plaster',
      roof: 'roof',
      awning: 'awning',
      doors: [{ side: s > 0 ? 's' : 'n' }],
      windows: [{ side: 'e' }, { side: 'w' }],
    });
    P(s * 30 * k, s * (PIT + 10), car(true));
    P(-s * 6 * k, s * (PIT + 13), car(true));
    U(s * 22 * k, 0, s * (PIT + 4), 3, 1, 1.2, 'concrete');
    BR(s * 12 * k, s * (PIT + 3.5));
    for (const x of [-36, -12, 12, 36]) P(x * k, s * (PIT + 2), LAMP);
    // Street trees and low walls: cover across the open street
    for (const x of [-34, -6, 18]) P(s * x * k, s * (PIT + 11), TREE);
    U(-s * 8 * k, 0, s * (PIT + 8.5), 3.2, 1, 1, 'concrete');
    U(s * 34 * k, 0, s * (PIT + 7), 1, 1, 3.2, 'concrete');
    U(s * 2 * k, 0, s * (PIT + 15), 3.2, 1, 1, 'concrete');
  }
  // Barrels by the tunnel mouths, where the track works are
  for (const e of [1, -1]) BR(e * (H - 3), -TRACK_Z - 2.6);
  BK(-(H - 4), TRACK_Z + 2.8, 1.3);
  BK(H - 4, -TRACK_Z + 2.8, 1.3);

  // Zipline from the roof of the north ticket hall down onto the canopy
  const hallTop = STREET + 3 + 0.3;
  // (from its front edge, high enough to clear the parapet: jump to grab it)
  ZL([22 * k, hallTop + 1 + 2.3, -(PIT + 3.6)], [8 * k, CANOPY_Y + 0.35 + 2.3, -1]);

  // Spawns along the back of each street
  // (none on the ticket halls: on the small size the street is short and they reach the back wall)
  const onHall = (x: number, z: number) => Math.abs(x + Math.sign(z) * 22 * k) < 6.5 && Math.abs(z) > PIT + 2;
  for (let x = -30; x <= 30; x += 10) {
    for (const z of [-(H - 2.5), H - 2.5]) if (!onHall(x * k, z)) S(x * k, z);
  }
}
