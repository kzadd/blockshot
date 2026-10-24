// Grid A* over a map's boxes, so test bots can walk between two points like a player would.
import { PLAYER, getColliders, type GameMap } from '@blockshot/shared';

const CELL = 0.5;
/** Extra clearance around obstacles (m). */
const CLEARANCE = 0.15;
/** Boxes lower than this are walked over; higher ones block. */
const WALKABLE_HEIGHT = PLAYER.stepUp;

export type Point = { x: number; z: number };

export class NavGrid {
  private readonly n: number;
  private readonly blocked: Uint8Array;

  constructor(private readonly map: GameMap) {
    this.n = Math.ceil((2 * map.half) / CELL);
    this.blocked = new Uint8Array(this.n * this.n);
    const pad = PLAYER.radius + CLEARANCE;
    for (const b of getColliders(map)) {
      const blocks = b.c === 'pad' || (b.max[1] > WALKABLE_HEIGHT && b.min[1] < PLAYER.height);
      if (b.c === 'floor' || !blocks) continue;
      const [i0, j0] = this.cell(b.min[0] - pad, b.min[2] - pad);
      const [i1, j1] = this.cell(b.max[0] + pad, b.max[2] + pad);
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) this.set(i, j);
    }
    // the outer walls
    for (let k = 0; k < this.n; k++) {
      this.set(k, 0);
      this.set(k, this.n - 1);
      this.set(0, k);
      this.set(this.n - 1, k);
    }
  }

  private cell(x: number, z: number): [number, number] {
    const h = this.map.half;
    return [Math.floor((x + h) / CELL), Math.floor((z + h) / CELL)];
  }
  private centre(i: number, j: number): Point {
    const h = this.map.half;
    return { x: -h + (i + 0.5) * CELL, z: -h + (j + 0.5) * CELL };
  }
  private inside(i: number, j: number): boolean {
    return i >= 0 && j >= 0 && i < this.n && j < this.n;
  }
  private set(i: number, j: number): void {
    if (this.inside(i, j)) this.blocked[i * this.n + j] = 1;
  }
  private free(i: number, j: number): boolean {
    return this.inside(i, j) && !this.blocked[i * this.n + j];
  }

  /** Nearest free cell (the start may be inside the clearance band of a wall). */
  private nearestFree(i: number, j: number): [number, number] {
    for (let r = 0; r < 8; r++) {
      for (let di = -r; di <= r; di++) {
        for (let dj = -r; dj <= r; dj++) if (this.free(i + di, j + dj)) return [i + di, j + dj];
      }
    }
    return [i, j];
  }

  private lineFree(a: Point, b: Point): boolean {
    const d = Math.hypot(b.x - a.x, b.z - a.z);
    const steps = Math.ceil(d / (CELL / 2));
    for (let k = 0; k <= steps; k++) {
      const t = steps ? k / steps : 0;
      const [i, j] = this.cell(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t);
      if (!this.free(i, j)) return false;
    }
    return true;
  }

  /** Waypoints from `from` to `to` (the final point is `to` itself), or null if unreachable. */
  path(from: Point, to: Point): Point[] | null {
    const [si, sj] = this.nearestFree(...this.cell(from.x, from.z));
    const [ti, tj] = this.nearestFree(...this.cell(to.x, to.z));
    const n = this.n;
    const key = (i: number, j: number) => i * n + j;
    const g = new Float64Array(n * n).fill(Infinity);
    const prev = new Int32Array(n * n).fill(-1);
    const open: [number, number][] = [[key(si, sj), 0]];
    g[key(si, sj)] = 0;
    const hScore = (k: number) => Math.hypot(Math.floor(k / n) - ti, (k % n) - tj);
    const goal = key(ti, tj);
    while (open.length) {
      open.sort((a, b) => a[1] - b[1]);
      const [k] = open.shift()!;
      if (k === goal) break;
      const i = Math.floor(k / n);
      const j = k % n;
      for (let di = -1; di <= 1; di++) {
        for (let dj = -1; dj <= 1; dj++) {
          if (!di && !dj) continue;
          const ni = i + di;
          const nj = j + dj;
          if (!this.free(ni, nj) || (di && dj && (!this.free(i + di, j) || !this.free(i, j + dj)))) continue;
          const nk = key(ni, nj);
          const cost = g[k]! + Math.hypot(di, dj);
          if (cost < g[nk]!) {
            g[nk] = cost;
            prev[nk] = k;
            open.push([nk, cost + hScore(nk)]);
          }
        }
      }
    }
    if (prev[goal] === -1 && goal !== key(si, sj)) return null;
    const cells: Point[] = [];
    for (let k = goal; k !== -1; k = prev[k]!) cells.unshift(this.centre(Math.floor(k / n), k % n));
    // String pulling: keep only the waypoints needed to go around obstacles
    const out: Point[] = [];
    let anchor = from;
    for (let idx = 1; idx < cells.length; idx++) {
      if (!this.lineFree(anchor, cells[idx]!)) {
        anchor = cells[idx - 1]!;
        out.push(anchor);
      }
    }
    out.push(to);
    return out;
  }
}
