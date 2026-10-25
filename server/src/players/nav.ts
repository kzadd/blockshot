// Navigation for the practice bots: a grid of every surface a player can stand on (floor, roofs, stair
// steps, scaffold decks) and A* over it. Walking up is allowed one step at a time (like the movement code),
// dropping down from any reasonable height, and jump pads launch you onto any ledge in reach. Built once per
// map and size, on first use.
import { PAD, PLAYER, type Collider, type GameMap, type Vec3 } from '@blockshot/shared';

/** Grid cell (m): small enough that consecutive stair steps land on neighbouring cells. */
const CELL = 0.5;
/** Room a standing player needs around the cell centre (m). */
// The player's own radius plus a hair: a cell is only walkable if the real body fits there
const BODY_R = PLAYER.radius + 0.02;
/** Highest step walked up (a bit under the movement's stepUp) and highest drop taken on purpose. */
const STEP = PLAYER.stepUp - 0.05;
const DROP = 4.5;
/** Collider buckets for the build (m). */
const BUCKET = 4;
const MAX_EXPANSIONS = 40000;
/** Jump pads: the pad throws you up (about v²/2g) while you keep walking forward; a ledge counts as reachable
 * if it is this far away horizontally and between a step and almost the top of the jump above the pad. */
const PAD_APEX = (PAD.power * PAD.power) / (2 * PLAYER.gravity);
const PAD_MIN_RISE = 0.8;
const PAD_REACH: [number, number] = [1.2, 4.5];
/** Extra cost of a pad jump (m): a little worse than walking the same distance, so stairs win when close. */
const PAD_COST = 3;
const NEIGHBOURS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
] as const;

export interface NavGrid {
  n: number;
  half: number;
  /** standing heights per cell (cell index = iz * n + ix) */
  heights: number[][];
  /** pad node → the ledge nodes it can throw you onto */
  padJumps: Map<number, number[]>;
}

const grids = new WeakMap<GameMap, NavGrid>();

export function navGrid(map: GameMap, colliders: readonly Collider[]): NavGrid {
  const known = grids.get(map);
  if (known) return known;
  const half = map.half;
  const n = Math.ceil((2 * half) / CELL);
  // Colliders bucketed by area so each cell only checks the few around it
  const nb = Math.ceil((2 * half) / BUCKET) + 1;
  const buckets: Collider[][] = Array.from({ length: nb * nb }, () => []);
  const bi = (v: number) => Math.max(0, Math.min(nb - 1, Math.floor((v + half) / BUCKET)));
  for (const c of colliders) {
    for (let bz = bi(c.min[2] - BODY_R); bz <= bi(c.max[2] + BODY_R); bz++)
      for (let bx = bi(c.min[0] - BODY_R); bx <= bi(c.max[0] + BODY_R); bx++) buckets[bz * nb + bx]!.push(c);
  }
  const heights: number[][] = [];
  for (let iz = 0; iz < n; iz++) {
    for (let ix = 0; ix < n; ix++) {
      const x = -half + (ix + 0.5) * CELL;
      const z = -half + (iz + 0.5) * CELL;
      const near = buckets[bi(z) * nb + bi(x)]!;
      const under = near.filter((c) => x >= c.min[0] && x <= c.max[0] && z >= c.min[2] && z <= c.max[2]);
      const free = (h: number) =>
        !near.some(
          (c) =>
            // anything you can step onto is not in the way (the next stair step)
            c.max[1] > h + STEP &&
            c.min[1] < h + PLAYER.height &&
            c.max[0] > x - BODY_R &&
            c.min[0] < x + BODY_R &&
            c.max[2] > z - BODY_R &&
            c.min[2] < z + BODY_R,
        );
      const tops = [0, ...under.map((c) => c.max[1])].filter((h, i, a) => a.indexOf(h) === i && free(h));
      heights.push(tops);
    }
  }
  const padJumps = new Map<number, number[]>();
  for (const pad of colliders) {
    if (pad.c !== 'pad') continue;
    const cx = (pad.min[0] + pad.max[0]) / 2;
    const cz = (pad.min[2] + pad.max[2]) / 2;
    const top = pad.max[1];
    const cell = cellIndex(n, half, cx, cz);
    const level = heights[cell]!.indexOf(top);
    if (level < 0) continue;
    const targets: number[] = [];
    const r = Math.ceil(PAD_REACH[1] / CELL);
    const [ix0, iz0] = [cell % n, Math.floor(cell / n)];
    for (let iz = Math.max(0, iz0 - r); iz <= Math.min(n - 1, iz0 + r); iz++) {
      for (let ix = Math.max(0, ix0 - r); ix <= Math.min(n - 1, ix0 + r); ix++) {
        const d = Math.hypot((ix - ix0) * CELL, (iz - iz0) * CELL);
        if (d < PAD_REACH[0] || d > PAD_REACH[1]) continue;
        const x = -half + (ix + 0.5) * CELL;
        const z = -half + (iz + 0.5) * CELL;
        heights[iz * n + ix]!.forEach((h, li) => {
          if (h <= top + PAD_MIN_RISE || h >= top + PAD_APEX - PLAYER.stepUp) return;
          // Open sky above the ledge: flying in under a floor above, the head hits its edge and you fall
          const ceiling = top + PAD_APEX + PLAYER.height;
          const roofed = buckets[bi(z) * nb + bi(x)]!.some(
            (c) =>
              c.min[1] > h + 0.05 &&
              c.min[1] < ceiling &&
              x >= c.min[0] &&
              x <= c.max[0] &&
              z >= c.min[2] &&
              z <= c.max[2],
          );
          if (!roofed) targets.push((iz * n + ix) * LEVELS + li);
        });
      }
    }
    if (targets.length) padJumps.set(cell * LEVELS + level, targets);
  }
  const grid = { n, half, heights, padJumps };
  grids.set(map, grid);
  return grid;
}

const cellIndex = (n: number, half: number, x: number, z: number) => {
  const ix = Math.max(0, Math.min(n - 1, Math.floor((x + half) / CELL)));
  const iz = Math.max(0, Math.min(n - 1, Math.floor((z + half) / CELL)));
  return iz * n + ix;
};

const cellOf = (g: NavGrid, x: number, z: number) => cellIndex(g.n, g.half, x, z);

/** Node = cell * 8 + index of the height in that cell (cells never have 8 floors). */
const LEVELS = 8;

function nearestNode(g: NavGrid, x: number, y: number, z: number): number | null {
  const c = cellOf(g, x, z);
  const hs = g.heights[c]!;
  if (!hs.length) return null;
  let best = 0;
  for (let i = 1; i < hs.length; i++) if (Math.abs(hs[i]! - y) < Math.abs(hs[best]! - y)) best = i;
  return c * LEVELS + best;
}

/** Waypoints (feet positions) from `from` to `to`, or null when there is no way. */
export function findPath(g: NavGrid, from: Vec3, to: Vec3): Vec3[] | null {
  const start = nearestNode(g, ...from);
  const goal = nearestNode(g, ...to);
  if (start === null || goal === null) return null;
  const pos = (node: number): Vec3 => {
    const c = Math.floor(node / LEVELS);
    return [
      -g.half + ((c % g.n) + 0.5) * CELL,
      g.heights[c]![node % LEVELS]!,
      -g.half + (Math.floor(c / g.n) + 0.5) * CELL,
    ];
  };
  const goalPos = pos(goal);
  const h = (node: number) => {
    const p = pos(node);
    return Math.hypot(p[0] - goalPos[0], p[1] - goalPos[1], p[2] - goalPos[2]);
  };
  const cost = new Map<number, number>([[start, 0]]);
  const came = new Map<number, number>();
  // Small binary heap of [f, node]
  const open: [number, number][] = [[h(start), start]];
  const push = (e: [number, number]) => {
    open.push(e);
    for (let i = open.length - 1; i > 0;) {
      const p = (i - 1) >> 1;
      if (open[p]![0] <= open[i]![0]) break;
      [open[p], open[i]] = [open[i]!, open[p]!];
      i = p;
    }
  };
  const pop = () => {
    const top = open[0]!;
    const last = open.pop()!;
    if (open.length) {
      open[0] = last;
      for (let i = 0; ;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < open.length && open[l]![0] < open[m]![0]) m = l;
        if (r < open.length && open[r]![0] < open[m]![0]) m = r;
        if (m === i) break;
        [open[m], open[i]] = [open[i]!, open[m]!];
        i = m;
      }
    }
    return top;
  };
  for (let expanded = 0; open.length && expanded < MAX_EXPANSIONS; expanded++) {
    const [, node] = pop();
    if (node === goal) {
      const path: Vec3[] = [];
      for (let k: number | undefined = node; k !== undefined; k = came.get(k)) path.push(pos(k));
      return path.reverse();
    }
    const c = Math.floor(node / LEVELS);
    const y = g.heights[c]![node % LEVELS]!;
    const ix = c % g.n;
    const iz = Math.floor(c / g.n);
    for (const [dx, dz] of NEIGHBOURS) {
      const nx = ix + dx;
      const nz = iz + dz;
      if (nx < 0 || nz < 0 || nx >= g.n || nz >= g.n) continue;
      const nc = nz * g.n + nx;
      // Diagonals only when both sides are open too (no cutting wall corners)
      if (dx && dz && (!g.heights[iz * g.n + nx]!.length || !g.heights[nz * g.n + ix]!.length)) continue;
      g.heights[nc]!.forEach((ny, li) => {
        const rise = ny - y;
        if (rise > STEP || -rise > DROP) return;
        const next = nc * LEVELS + li;
        const step = Math.hypot(dx * CELL, dz * CELL, rise);
        const total = cost.get(node)! + step;
        if (total >= (cost.get(next) ?? Infinity)) return;
        cost.set(next, total);
        came.set(next, node);
        push([total + h(next), next]);
      });
    }
    // Jump pad: straight onto a ledge
    for (const next of g.padJumps.get(node) ?? []) {
      const p = pos(next);
      const here = pos(node);
      const total = cost.get(node)! + Math.hypot(p[0] - here[0], p[1] - here[1], p[2] - here[2]) + PAD_COST;
      if (total >= (cost.get(next) ?? Infinity)) continue;
      cost.set(next, total);
      came.set(next, node);
      push([total + h(next), next]);
    }
  }
  return null;
}
