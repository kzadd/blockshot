import { BARREL, TREE, pad, sandbags } from '../props';
import type { BoxKind, MapBuildContext } from '../types';

// Polvo: desert town with three routes (tunnel, mid and long hall) and two bomb sites in the north.
// Coordinates are designed for the medium size (80 m) and scaled for the others.
export function buildPolvo({ B, S, P, H }: MapBuildContext): void {
  const k = H / 40;
  // Rectangle [x1,x2] × [z1,z2] of height h, resting on y
  const R = (x1: number, x2: number, z1: number, z2: number, h: number, c: BoxKind = 'wall2', y = 0) =>
    B(((x1 + x2) / 2) * k, y, ((z1 + z2) / 2) * k, (x2 - x1) * k, h, (z2 - z1) * k, c);
  // Houses: the corridors are left between them
  R(-22, -6, -12, -2, 7);
  R(-22, -6, 2, 12, 7);
  R(6, 22, -12, -8, 7);
  R(6, 22, -4, 12, 7);
  R(-22, -6, 18, 28, 7);
  R(6, 22, 18, 28, 7);
  R(30, 40, -10, 26, 8, 'wall');
  R(-40, -30, -10, 26, 8, 'wall');
  R(-8, 8, -30, -24, 4);
  // Mid and long hall doors, with lintel
  R(-14, -2, -17, -15, 5);
  R(2, 14, -17, -15, 5);
  R(-2, 2, -17, -15, 1, 'wall2', 4);
  R(22, 26, 13, 15, 7);
  R(26, 30, 13, 15, 2.4, 'wall2', 4.6);
  // B tunnel and covered connector from mid to B
  R(-30, -22, 2, 22, 1, 'roof', 3.4);
  R(-22, -6, -2, 2, 1, 'roof', 3.6);
  // Site A: platform with steps
  R(24, 36, -34, -24, 1, 'platform');
  R(22, 24, -32, -26, 0.5, 'step');
  R(27, 33, -24, -22, 0.5, 'step');
  R(28, 30.4, -31, -28.6, 2.4, 'crate2', 1);
  R(32, 34.4, -28, -25.6, 1.2, 'crate', 1);
  // Site B
  R(-36, -24, -34, -26, 0.5, 'platform');
  R(-31, -28.6, -31, -28.6, 2.4, 'crate2', 0.5);
  R(-27, -24.6, -34, -31.6, 1.2, 'crate', 0.5);
  R(-35, -33.4, -26, -24.4, 1.6, 'crate');
  // Cover along the routes
  R(-1, 1, -7, -5, 2, 'crate');
  R(-2.6, -1.4, 5.4, 6.6, 1.2, 'crate');
  R(25, 26.6, -1, 0.6, 1.2, 'crate');
  R(-11, -9, 32, 34, 1.2, 'crate');
  R(9, 11, 32, 34, 1.2, 'crate2');
  R(-19, -17, -18, -16, 1.2, 'crate');
  R(-13, -11, -35, -33, 1.2, 'crate');
  R(11, 13, -35, -33, 1.2, 'crate2');
  // Decoration
  for (const s of [1, -1]) {
    P(s * 3 * k, 30 * k, TREE);
    P(s * 30 * k, -36 * k, sandbags(3, 1));
    P(s * 26 * k, 28 * k, BARREL);
    P(s * 26.9 * k, 28.6 * k, BARREL);
    P(s * 4 * k, -20 * k, BARREL);
    P(s * 18 * k, 16 * k, BARREL);
  }
  P(-26 * k, -12 * k, BARREL);
  // Jump pads in mid: to peek over the houses
  pad(B, 0, 20 * k);
  pad(B, 0, -20 * k);
  P(27 * k, -15 * k, sandbags(1, 3));

  const spawns = [
    [0, 35],
    [-8, 36],
    [8, 36],
    [-16, 35],
    [16, 35],
    [0, -36],
    [-10, -37],
    [10, -37],
    [-35, 32],
    [35, 32],
    [-35, -14],
    [35, -14],
    [26, 20],
    [-26, 20],
  ] as const;
  for (const [x, z] of spawns) S(x * k, z * k);
}
