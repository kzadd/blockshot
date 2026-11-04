// Things to jump on, added to the open ground of every arena map (not the race course): with the Urban Terror
// moves (wall jumps, ledge pulls) a map needs places to climb, not just floor to run across. Each cluster goes where
// nothing else stands, clear of spawns, ladders, ziplines, pickups and objects.
import { round2 } from '../core/math';
import type { BoxKind, MapBox, MapZipline } from './types';

/** Room a cluster needs round it (m) and how far from the points to keep clear. */
const CLUSTER_R = 3.4;
const KEEP = 5;
/** Grid step of the candidate spots. */
const STEP = 5;

/** Alley between two blocks: gap, block thickness and height (m). */
const ALLEY_GAP = 2.2;
const ALLEY_T = 2.2;
const ALLEY_H = 6.5;

type Cluster = 'steps' | 'pillar' | 'alley';

/**
 * Adds jumpable clusters in open spots: steps (1.2 / 2.4 / 3.6 m, a jump each), a pillar with a ledge (pull
 * yourself up), and an alley of two blocks to climb by wall jumping between them. `natural` maps get rock instead of
 * concrete and crates.
 */
export function addParkour(
  boxes: MapBox[],
  H: number,
  keepClear: readonly [number, number][],
  ziplines: readonly MapZipline[],
  rand: () => number,
  natural: boolean,
): void {
  // Every cluster goes in twice, mirrored on x (the maps are mirror-symmetric: both sides stay fair)
  const B = (x: number, y: number, z: number, w: number, h: number, d: number, c: BoxKind) => {
    boxes.push({ x: round2(x), y: round2(y), z: round2(z), w, h, d, c });
    boxes.push({ x: round2(-x), y: round2(y), z: round2(z), w, h, d, c });
  };
  const solid: BoxKind = natural ? 'rock' : 'concrete';
  const step: BoxKind = natural ? 'rock' : 'crate';
  const nearLine = (x: number, z: number) =>
    ziplines.some(([a, b]) => {
      const dx = b[0] - a[0];
      const dz = b[2] - a[2];
      const len2 = dx * dx + dz * dz || 1;
      const t = Math.min(1, Math.max(0, ((x - a[0]) * dx + (z - a[2]) * dz) / len2));
      return Math.hypot(a[0] + dx * t - x, a[2] + dz * t - z) < KEEP;
    });
  const open = (x: number, z: number) =>
    !boxes.some(
      (b) =>
        b.c !== 'floor' &&
        b.y < 6 &&
        Math.abs(x - b.x) < b.w / 2 + CLUSTER_R &&
        Math.abs(z - b.z) < b.d / 2 + CLUSTER_R,
    ) &&
    !keepClear.some(([px, pz]) => Math.hypot(px - x, pz - z) < KEEP) &&
    !nearLine(x, z);

  const spots: [number, number][] = [];
  for (let x = -H + 6; x <= -CLUSTER_R - 2; x += STEP) for (let z = -H + 6; z <= H - 6; z += STEP) spots.push([x, z]);
  // Shuffled once (seeded), then taken while there is room
  for (let i = spots.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [spots[i], spots[j]] = [spots[j]!, spots[i]!];
  }
  const want = Math.round(H / 12); // pairs
  const kinds: Cluster[] = ['steps', 'pillar', 'alley'];
  let placed = 0;
  for (const [x, z] of spots) {
    if (placed >= want) break;
    if (!open(x, z) || !open(-x, z)) continue;
    const kind = kinds[placed % kinds.length]!;
    const along = rand() < 0.5; // which way it runs
    const at = (u: number, v: number): [number, number] => (along ? [x + u, z + v] : [x + v, z + u]);
    if (kind === 'steps') {
      for (const [i, h] of [1.2, 2.4, 3.6].entries()) {
        const [bx, bz] = at(-1.6 + i * 1.6, 0);
        B(bx, 0, bz, 1.6, h, 1.6, step);
      }
    } else if (kind === 'pillar') {
      const [ax, az] = at(-0.9, 0);
      const [bx, bz] = at(1.1, 0);
      B(ax, 0, az, 1.8, 2.2, 1.8, step);
      B(bx, 0, bz, 2.2, 4.2, 2.2, solid);
    } else {
      // An alley: two blocks 2.2 m apart, open on top. Too tall for a jump and a ledge pull: you get on the roofs by
      // wall jumping from one side to the other
      for (const s of [-1, 1]) {
        const [wx, wz] = at(0, s * (ALLEY_GAP / 2 + ALLEY_T / 2));
        B(wx, 0, wz, along ? 3 : ALLEY_T, ALLEY_H, along ? ALLEY_T : 3, solid);
      }
    }
    placed++;
  }
}
