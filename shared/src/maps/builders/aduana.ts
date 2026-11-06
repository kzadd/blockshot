import { facade, doorAt, house, slab, wall } from '../structures';
import { stairs } from '../props';
import type { MapBuildContext } from '../types';

/** Yard walls: too tall for a jump and a ledge pull (m). */
const WALL_H = 4.5;
/** Warehouse B: walls, roof slab on top. */
const NAVE = { x0: 12, x1: 26, z0: 12, z1: 28 };
/** The defenders' wall (x 26..28) closes the sites from Blue's yard; these are its openings (z ranges). */
const BACK_GAPS: [number, number][] = [
  [-24, -20],
  [-1.25, 1.25],
  [18, 22],
  [32, 36],
];
const DOCK_H = 1;

// Aduana: a border customs post, built for Bomba. Red (attackers) come in from the west road, Blue (defenders) hold
// the customs yard to the east. Three lanes: north (along the lorry park to the gate of site A, the loading yard),
// middle (the road through the toll booth, with a short passage to A and a short corridor to B) and south (to the
// gate of the back yard and site B, inside the warehouse). Each site has two ways in for the attackers, each with a
// chokepoint, and a door from Blue's yard behind.
export function buildAduana(ctx: MapBuildContext): void {
  const { B, D, S, P, BR, BK, PK, PW } = ctx;

  // ---- West half: four blocks of offices and sheds split the three lanes (alleys between them for rotations)
  const block = (x0: number, x1: number, z0: number, z1: number, h: number, c: 'bld1' | 'bld2' | 'bld3' | 'bld4') => {
    B((x0 + x1) / 2, 0, (z0 + z1) / 2, x1 - x0, h, z1 - z0, c);
    facade(D, (x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, h, 'shutter');
  };
  block(-28, -12, -26, -10, 7, 'bld2');
  block(-8, 10, -24, -8, 6, 'bld1');
  block(-28, -4, 10, 26, 7, 'bld3');
  block(0, 10, 8, 24, 6, 'bld4');

  // ---- The walls of the sites: A gate (north lane), B gate (south lane), the defenders' wall
  const solid = (x0: number, x1: number, z0: number, z1: number, h = WALL_H, c: 'wall' | 'concrete' = 'wall') =>
    B((x0 + x1) / 2, 0, (z0 + z1) / 2, x1 - x0, h, z1 - z0, c);
  solid(10, 12, -40, -33);
  solid(10, 12, -30, -8);
  solid(10, 12, 8, 30);
  solid(10, 12, 33, 40);
  let z = -40;
  for (const [a, b] of BACK_GAPS) {
    solid(26, 28, z, a);
    z = b;
  }
  solid(26, 28, z, 40);
  // Lintels over the defenders' doors (the wall reads as one)
  for (const [a, b] of BACK_GAPS) B(27, 3, (a + b) / 2, 2, WALL_H - 3, b - a, 'wall');

  // ---- Middle: the A passage (between two blocks) and the B corridor (to the warehouse door)
  solid(12, 13, -12, -8, WALL_H, 'concrete');
  solid(15.5, 26, -12, -8, WALL_H, 'concrete');
  solid(12, 19.5, 8, 12, WALL_H, 'concrete');
  solid(23, 26, 8, 12, WALL_H, 'concrete');
  // The toll booth on the road and its canopy; lorries parked to break the long view down the road
  house(ctx, {
    x: 0,
    z: 0,
    w: 6,
    d: 5,
    wall: 'plaster',
    roof: 'slab',
    doors: [{ side: 'e' }, { side: 'w' }],
    windows: [{ side: 'n' }, { side: 's' }],
  });
  D(0, 4.2, 0, 14, 0.3, 15, 'awning');
  for (const [cx, cz] of [
    [-5.5, -6.5],
    [5.5, -6.5],
    [-5.5, 6.5],
    [5.5, 6.5],
  ] as const)
    B(cx, 0, cz, 0.4, 4.2, 0.4, 'metal');
  B(-14, 0, -5, 2.6, 2.6, 6, 'cont2');
  B(16, 0, 5, 2.6, 2.6, 6, 'cont3');
  B(-22, 0, 4, 4.2, 1.6, 2, 'cont1');
  B(9, 0, -4.5, 1.2, 1.2, 1.2, 'crate');

  // ---- North lane: lorries and containers up to the A gate
  B(-18, 0, -33, 6, 2.6, 2.6, 'cont2');
  B(-6, 0, -36.5, 2.6, 2.6, 6, 'cont1');
  B(-4, 0, -29.5, 6, 2.6, 2.6, 'cont3');
  B(5, 0, -33.5, 0.6, 1.1, 4, 'concrete');
  BR(-11, -38.5);

  // ---- Site A: the loading yard (a dock along the north wall, a container by the gate, crates round the site)
  B(19, 0, -37.5, 14, DOCK_H, 5, 'platform');
  stairs(B, 19, -35, 'z', -1, 2, 3);
  B(15.3, 0, -25, 2.6, 2.6, 6, 'cont2');
  B(17, 0, -16.5, 1.2, 1.2, 1.2, 'crate');
  B(23.2, 0, -15.8, 1.2, 1.2, 2.4, 'crate');
  B(23.2, 1.2, -16.4, 1.2, 1.2, 1.2, 'crate2');
  B(23.5, 0, -27.5, 2.4, 1.1, 1.2, 'crate2');
  B(17.6, 0, -30.5, 1.2, 1.1, 2.4, 'crate');
  BK(14, -36.5, 1.2, DOCK_H);

  // ---- Site B: inside the warehouse (door from the B corridor, two from the back yard, one from Blue's yard)
  wall(ctx, 'x', NAVE.z0 + 0.15, NAVE.x0, NAVE.x1, 0, WALL_H, 'brick', [doorAt(21.25, 2.2)]);
  wall(ctx, 'x', NAVE.z1 - 0.15, NAVE.x0, NAVE.x1, 0, WALL_H, 'brick', [doorAt(15), doorAt(22.5)]);
  slab(B, NAVE, WALL_H + 0.3, 0.3, 'roof');
  B(15, 0, 16, 2.4, 1.2, 2.4, 'crate');
  B(15, 1.2, 16, 1.2, 1.2, 1.2, 'crate2');
  B(24.5, 0, 15.5, 2, 1.6, 4, 'cont3');
  B(16, 0, 24.8, 1.2, 1.1, 2.4, 'crate2');
  B(23.8, 0, 24.5, 2.4, 1.1, 1.2, 'crate');
  // Back yard: a lorry and crates
  B(19, 0, 34, 6, 2.6, 2.6, 'cont1');
  B(14, 0, 37.5, 1.2, 1.2, 1.2, 'crate');
  B(23.5, 0, 30.5, 1.2, 1.1, 1.2, 'crate2');

  // ---- South lane: a lorry, pallets and a low wall up to the B gate
  B(-17, 0, 31, 2.6, 2.6, 6, 'cont3');
  B(-7, 0, 36.5, 6, 2.6, 2.6, 'cont2');
  B(3, 0, 29.5, 4, 1.1, 0.6, 'concrete');
  BK(-2, 33);
  PK('hp', -12, 37.5);
  PK('hp', -12, -37.5);

  // ---- The two spawn yards
  B(-35, 0, -20, 2.6, 2.6, 6, 'cont1');
  B(-35, 0, 20, 2.6, 2.6, 6, 'cont2');
  B(-31, 0, 0, 1.2, 1.1, 2.4, 'crate');
  B(34, 0, -24, 2.4, 1.2, 2.4, 'crate');
  B(34, 0, 26, 2.4, 1.2, 2.4, 'crate2');
  B(31.5, 0, 9, 1.2, 1.1, 2.4, 'crate');
  PK('armor', -38, 0);
  PK('armor', 38.5, 0);
  P(-38.5, -30, [[0, 0, 0, 0.85, 1.1, 0.85, 'barrel']]);
  PW(-12, -33);

  for (const [x, z] of [
    [-37, -14],
    [-33, -12],
    [-37, -7],
    [-33, -5],
    [-37, 2],
    [-33, 4],
    [-37, 9],
    [-33, 11],
    [-31, -26],
    [-31, 26],
    [-36, -33],
    [-36, 33],
  ] as const)
    S(x, z);
  for (const [x, z] of [
    [31, -14],
    [35, -12],
    [38, -6],
    [32, -4],
    [36, 3],
    [32, 5],
    [38, 10],
    [35, 13],
    [32, -32],
    [36, -37],
    [32, 30],
    [37, 37],
  ] as const)
    S(x, z);
}
