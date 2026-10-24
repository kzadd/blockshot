// Buildings made of boxes: walls with door and window openings, floors with stairwells, stairs, balconies,
// railings and flat roofs. Every structural piece is an ordinary collider; frames, cornices and shutters
// are decoration (ctx.D) so they never snag the player.
import type { BoxFn, BoxKind, MapBuildContext } from './types';

/** Floor-to-floor height of a story (m). A multiple of STEP_RISE so stairs land exactly on the floor. */
export const STORY = 3;
/** Thickness of the floors between stories (m). */
export const SLAB = 0.2;
/** Thickness of the floor laid over the ground inside a house (m); far below PLAYER.stepUp. */
export const GROUND_T = 0.04;
/** Thickness of the roof slab; its top is the roof level (m). */
export const ROOF_T = 0.3;
export const WALL_T = 0.3;
/** Doors: wide enough for a sprinting player and taller than PLAYER.height. */
export const DOOR_W = 1.6;
export const DOOR_H = 2.4;
export const WINDOW_W = 1.2;
/** Window openings start at chest height: you can shoot through them but not walk through. */
export const WINDOW_SILL = 1.1;
export const WINDOW_TOP = 2.1;
/** Stairs: each step can be walked up without jumping (PLAYER.stepUp). */
export const STEP_RISE = 0.5;
export const STEP_RUN = 0.6;
export const STAIR_W = 1.3;
export const RAIL_H = 1;
export const RAIL_T = 0.12;
export const PARAPET_H = 1;
export const BALCONY_D = 1.4;
/** Extra width of a stairwell on its open side, so a player on the stairs never bumps the floor above. */
const WELL_MARGIN = 0.4;
/** Frame bars around openings and how far they stand out of the wall (decoration). */
const FRAME = 0.12;
const FRAME_OUT = 0.05;
/** Cornice band under the roof edge (decoration). */
const CORNICE_H = 0.25;
const CORNICE_OUT = 0.12;
const SHUTTER_W = 0.45;
/** How deep decoration bands sink into the wall they hug (hidden, avoids gaps). */
const BAND_INSET = 0.05;
/** Awnings over doors: height, depth, thickness and overhang past the door sides (decoration). */
const AWNING_Y = DOOR_H + 0.25;
const AWNING_D = 1;
const AWNING_T = 0.14;
const AWNING_OVER = 0.3;
const MIN_PIECE = 0.01;

/** Wall sides of a building: n = -z, s = +z, w = -x, e = +x. */
export type Side = 'n' | 's' | 'e' | 'w';
/** A hole in a wall. `c` is the centre along the wall (absolute), `y0`..`y1` its height above the wall base. */
export interface Opening {
  c: number;
  w: number;
  y0: number;
  y1: number;
}
export const doorAt = (c: number, w = DOOR_W): Opening => ({ c, w, y0: 0, y1: DOOR_H });
export const windowAt = (c: number, w = WINDOW_W): Opening => ({ c, w, y0: WINDOW_SILL, y1: WINDOW_TOP });

interface WallOptions {
  t?: number;
  /** decoration kind for frames around the openings (null = none) */
  frame?: BoxKind | null;
  /** decoration kind for shutters beside windows */
  shutter?: BoxKind;
}

/**
 * Straight wall along `run` (it lies at the fixed coordinate `at` of the other axis) from `from` to `to`,
 * between heights y and y + h, with openings. Splits into solid pieces, sills and lintels.
 */
export function wall(
  ctx: Pick<MapBuildContext, 'B' | 'D'>,
  run: 'x' | 'z',
  at: number,
  from: number,
  to: number,
  y: number,
  h: number,
  kind: BoxKind,
  openings: Opening[] = [],
  { t = WALL_T, frame = 'frame', shutter }: WallOptions = {},
): void {
  const put = (fn: BoxFn, a0: number, a1: number, y0: number, y1: number, c: BoxKind, thick = t, off = 0) => {
    if (a1 - a0 < MIN_PIECE || y1 - y0 < MIN_PIECE) return;
    const m = (a0 + a1) / 2;
    if (run === 'x') fn(m, y0, at + off, a1 - a0, y1 - y0, thick, c);
    else fn(at + off, y0, m, thick, y1 - y0, a1 - a0, c);
  };
  let cur = from;
  for (const o of [...openings].sort((p, q) => p.c - q.c)) {
    const a0 = Math.max(cur, o.c - o.w / 2);
    const a1 = Math.min(to, o.c + o.w / 2);
    if (a1 <= a0) continue;
    put(ctx.B, cur, a0, y, y + h, kind);
    put(ctx.B, a0, a1, y, y + o.y0, kind);
    put(ctx.B, a0, a1, y + o.y1, y + h, kind);
    if (frame) {
      const deep = t + 2 * FRAME_OUT;
      put(ctx.D, a0 - FRAME / 2, a0 + FRAME / 2, y + o.y0, y + o.y1, frame, deep);
      put(ctx.D, a1 - FRAME / 2, a1 + FRAME / 2, y + o.y0, y + o.y1, frame, deep);
      put(ctx.D, a0 - FRAME / 2, a1 + FRAME / 2, y + o.y1, y + o.y1 + FRAME, frame, deep);
      if (o.y0 > 0) put(ctx.D, a0 - FRAME, a1 + FRAME, y + o.y0 - FRAME, y + o.y0, frame, deep + 2 * FRAME_OUT);
    }
    if (shutter && o.y0 > 0) {
      // A pair of open shutters on both faces, flat against the wall
      for (const face of [1, -1]) {
        const off = face * (t / 2 + FRAME_OUT / 2);
        put(ctx.D, a0 - FRAME - SHUTTER_W, a0 - FRAME, y + o.y0, y + o.y1, shutter, FRAME_OUT, off);
        put(ctx.D, a1 + FRAME, a1 + FRAME + SHUTTER_W, y + o.y0, y + o.y1, shutter, FRAME_OUT, off);
      }
    }
    cur = a1;
  }
  put(ctx.B, cur, to, y, y + h, kind);
}

/**
 * Straight flight of stairs: `steps` solid columns starting on height `y0`, the first one beginning at
 * along-coordinate `start` and climbing towards `dir` (±1). The band spans `c0`..`c1` across.
 * The last step can be longer (a landing). Returns the along-coordinate where the flight ends.
 */
export function flight(
  B: BoxFn,
  run: 'x' | 'z',
  start: number,
  dir: 1 | -1,
  c0: number,
  c1: number,
  y0: number,
  steps: number,
  kind: BoxKind = 'stair',
  landing = STEP_RUN,
): number {
  let s = start;
  for (let i = 1; i <= steps; i++) {
    const len = i === steps ? landing : STEP_RUN;
    const m = s + (dir * len) / 2;
    const across = Math.abs(c1 - c0);
    if (run === 'x') B(m, y0, (c0 + c1) / 2, len, i * STEP_RISE, across, kind);
    else B((c0 + c1) / 2, y0, m, across, i * STEP_RISE, len, kind);
    s += dir * len;
  }
  return s;
}

/** Rectangle [x0, x1] × [z0, z1]. */
export interface Rect {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

/** Horizontal slab over `r` between heights y - t and y, with optional rectangular holes (stairwells). */
export function slab(B: BoxFn, r: Rect, y: number, t: number, kind: BoxKind, holes: Rect[] = []): void {
  // Sweep along x: cut the slab into columns at every hole edge, then each column into rows around the holes
  const xs = [...new Set([r.x0, r.x1, ...holes.flatMap((h) => [h.x0, h.x1])])]
    .filter((x) => x >= r.x0 && x <= r.x1)
    .sort((a, b) => a - b);
  for (let i = 0; i + 1 < xs.length; i++) {
    const a = xs[i]!;
    const b = xs[i + 1]!;
    if (b - a < MIN_PIECE) continue;
    const cuts = holes.filter((h) => h.x0 < b - MIN_PIECE && h.x1 > a + MIN_PIECE).sort((p, q) => p.z0 - q.z0);
    let z = r.z0;
    for (const h of cuts) {
      if (h.z0 - z > MIN_PIECE) B((a + b) / 2, y - t, (z + h.z0) / 2, b - a, t, h.z0 - z, kind);
      z = Math.max(z, h.z1);
    }
    if (r.z1 - z > MIN_PIECE) B((a + b) / 2, y - t, (z + r.z1) / 2, b - a, t, r.z1 - z, kind);
  }
}

/** Railing (a thin solid bar the player can jump over) from (x0, z0) to (x1, z1), axis aligned, on height y. */
export function railing(B: BoxFn, x0: number, z0: number, x1: number, z1: number, y: number, h = RAIL_H): void {
  const w = Math.max(RAIL_T, Math.abs(x1 - x0));
  const d = Math.max(RAIL_T, Math.abs(z1 - z0));
  B((x0 + x1) / 2, y, (z0 + z1) / 2, w, h, d, 'railing');
}

// ------------------------------------------------------------ Houses

/** Door or window in a building wall. `at` = offset from the centre of that wall. */
export interface Hole {
  side: Side;
  at?: number;
  story?: number;
  w?: number;
}
/** Stair flight hugging the inner (or, for `outside`, the outer) face of wall `side`. */
export interface Flight {
  side: Side;
  /** where the bottom step starts, as an offset from the centre of that wall */
  at: number;
  /** climbing direction along the wall (+1 = towards +x or +z) */
  dir: 1 | -1;
  /** story it starts on (interior flights) */
  story?: number;
}
/** Interior wall across the whole building. `run` = the axis it runs along; `at` = its offset from the centre. */
export interface Partition {
  run: 'x' | 'z';
  at: number;
  story?: number;
  /** door offset along the partition (none = solid) */
  door?: number;
}
export interface Balcony {
  side: Side;
  at?: number;
  w: number;
  story?: number;
}

export interface HouseSpec {
  /** centre and outer footprint */
  x: number;
  z: number;
  w: number;
  d: number;
  stories?: number;
  wall: BoxKind;
  /** upper floors */
  floor?: BoxKind;
  /** thin floor covering the ground story (none = the map floor shows) */
  ground?: BoxKind;
  roof?: BoxKind;
  /** decoration kinds (null = none) */
  frame?: BoxKind | null;
  trim?: BoxKind | null;
  shutter?: BoxKind;
  doors?: Hole[];
  windows?: Hole[];
  /** interior stairs; a flight on the top story climbs through a hatch to the roof */
  stairs?: Flight[];
  /** exterior stairs from the ground up to the roof */
  outside?: Flight;
  partitions?: Partition[];
  balconies?: Balcony[];
  /** low wall around the roof (default: when the roof can be reached) */
  parapet?: boolean;
  /** decoration kind of a small awning over every ground-floor door */
  awning?: BoxKind;
}

interface SideGeo {
  run: 'x' | 'z';
  /** coordinate of the wall centre line on the other axis */
  at: number;
  /** outwards direction (±1 on the other axis) */
  out: 1 | -1;
  /** centre of the wall along `run` */
  c: number;
  from: number;
  to: number;
}

function sideGeo(h: HouseSpec, side: Side): SideGeo {
  const t = WALL_T;
  switch (side) {
    case 'n':
      return { run: 'x', at: h.z - h.d / 2 + t / 2, out: -1, c: h.x, from: h.x - h.w / 2, to: h.x + h.w / 2 };
    case 's':
      return { run: 'x', at: h.z + h.d / 2 - t / 2, out: 1, c: h.x, from: h.x - h.w / 2, to: h.x + h.w / 2 };
    case 'w':
      return { run: 'z', at: h.x - h.w / 2 + t / 2, out: -1, c: h.z, from: h.z - h.d / 2 + t, to: h.z + h.d / 2 - t };
    case 'e':
      return { run: 'z', at: h.x + h.w / 2 - t / 2, out: 1, c: h.z, from: h.z - h.d / 2 + t, to: h.z + h.d / 2 - t };
  }
}

/** Rectangle from an along-range and an across-range on a wall's axes. */
function bandRect(run: 'x' | 'z', a0: number, a1: number, c0: number, c1: number): Rect {
  const [lo, hi] = a0 < a1 ? [a0, a1] : [a1, a0];
  const [clo, chi] = c0 < c1 ? [c0, c1] : [c1, c0];
  return run === 'x' ? { x0: lo, x1: hi, z0: clo, z1: chi } : { x0: clo, x1: chi, z0: lo, z1: hi };
}

const STEPS_PER_STORY = Math.round(STORY / STEP_RISE);

/**
 * A building you can walk into: walls with doors and windows on every story, floors with stairwells,
 * interior stairs, balconies and a flat roof (with a parapet and a hatch or outside stairs to reach it).
 */
export function house(ctx: Pick<MapBuildContext, 'B' | 'D'>, h: HouseSpec): void {
  const { B, D } = ctx;
  const stories = h.stories ?? 1;
  const roofY = stories * STORY;
  const floorKind = h.floor ?? 'wood';
  const roofKind = h.roof ?? 'slab';
  const frame = h.frame === undefined ? 'frame' : h.frame;
  const trim = h.trim === undefined ? 'trim' : h.trim;
  const t = WALL_T;
  const inner: Rect = { x0: h.x - h.w / 2 + t, x1: h.x + h.w / 2 - t, z0: h.z - h.d / 2 + t, z1: h.z + h.d / 2 - t };

  // Stairwells: one hole in the floor above every interior flight
  const wells = new Map<number, Rect[]>();
  for (const f of h.stairs ?? []) {
    const g = sideGeo(h, f.side);
    const story = f.story ?? 0;
    const base = story * STORY;
    const c0 = g.at - (g.out * t) / 2; // inner face
    const c1 = c0 - g.out * STAIR_W;
    const start = g.c + f.at;
    const end = flight(B, g.run, start, f.dir, c0, c1, base, STEPS_PER_STORY);
    const well = bandRect(g.run, start - f.dir * WELL_MARGIN, end, c0, c1 - g.out * WELL_MARGIN);
    wells.set(story + 1, [...(wells.get(story + 1) ?? []), well]);
    // Railings round the well on the floor above: the open long side and the bottom end
    const top = (story + 1) * STORY;
    const edge = c1 - g.out * (WELL_MARGIN + RAIL_T / 2);
    const back = start - f.dir * (WELL_MARGIN + RAIL_T / 2);
    if (g.run === 'x') {
      railing(B, back, edge, end, edge, top);
      railing(B, back, c0, back, edge, top);
    } else {
      railing(B, edge, back, edge, end, top);
      railing(B, c0, back, edge, back, top);
    }
  }

  if (h.ground) slab(B, inner, GROUND_T, GROUND_T, h.ground);

  // Walls, story by story, with their openings
  const sides: Side[] = ['n', 's', 'w', 'e'];
  for (let s = 0; s < stories; s++) {
    const y = s * STORY;
    const top = s === stories - 1 ? roofY - ROOF_T : (s + 1) * STORY - SLAB;
    const wallH = (s === stories - 1 ? roofY - ROOF_T : (s + 1) * STORY) - y;
    for (const side of sides) {
      const g = sideGeo(h, side);
      const holes: Opening[] = [
        ...(h.doors ?? [])
          .filter((o) => o.side === side && (o.story ?? 0) === s)
          .map((o) => doorAt(g.c + (o.at ?? 0), o.w)),
        ...(h.balconies ?? [])
          .filter((o) => o.side === side && (o.story ?? 1) === s)
          .map((o) => doorAt(g.c + (o.at ?? 0))),
        ...(h.windows ?? [])
          .filter((o) => o.side === side && (o.story ?? 0) === s)
          .map((o) => windowAt(g.c + (o.at ?? 0), o.w)),
      ];
      wall(ctx, g.run, g.at, g.from, g.to, y, wallH, h.wall, holes, { frame, shutter: h.shutter });
      if (h.awning && s === 0) {
        for (const o of holes.filter((q) => q.y0 === 0)) {
          const across = g.at + g.out * (t / 2 + AWNING_D / 2);
          if (g.run === 'x') D(o.c, AWNING_Y, across, o.w + 2 * AWNING_OVER, AWNING_T, AWNING_D, h.awning);
          else D(across, AWNING_Y, o.c, AWNING_D, AWNING_T, o.w + 2 * AWNING_OVER, h.awning);
        }
      }
    }
    for (const p of (h.partitions ?? []).filter((q) => (q.story ?? 0) === s)) {
      const holes = p.door === undefined ? [] : [doorAt((p.run === 'x' ? h.x : h.z) + p.door)];
      if (p.run === 'x')
        wall(ctx, 'x', h.z + p.at, inner.x0, inner.x1, y, top - y, h.wall, holes, { frame, t: WALL_T });
      else wall(ctx, 'z', h.x + p.at, inner.z0, inner.z1, y, top - y, h.wall, holes, { frame, t: WALL_T });
    }
    // Floor of the next story (inside the walls) and a string course outside
    if (s + 1 < stories) {
      const level = (s + 1) * STORY;
      slab(B, inner, level, SLAB, floorKind, wells.get(s + 1));
      if (trim) band(D, h, level - SLAB, SLAB, FRAME_OUT, trim);
    }
  }

  // Balconies: a slab sticking out with railings round it
  for (const b of h.balconies ?? []) {
    const g = sideGeo(h, b.side);
    const level = (b.story ?? 1) * STORY;
    const c0 = g.at + (g.out * t) / 2; // outer face
    const c1 = c0 + g.out * BALCONY_D;
    const a0 = g.c + (b.at ?? 0) - b.w / 2;
    const a1 = a0 + b.w;
    const r = bandRect(g.run, a0, a1, c0, c1);
    slab(B, r, level, SLAB, floorKind);
    const front = c1 - (g.out * RAIL_T) / 2;
    if (g.run === 'x') {
      railing(B, a0, front, a1, front, level);
      for (const a of [a0 + RAIL_T / 2, a1 - RAIL_T / 2]) railing(B, a, c0, a, c1 - g.out * RAIL_T, level);
    } else {
      railing(B, front, a0, front, a1, level);
      for (const a of [a0 + RAIL_T / 2, a1 - RAIL_T / 2]) railing(B, c0, a, c1 - g.out * RAIL_T, a, level);
    }
  }

  // Roof (with a hatch over a top-story flight) and the stairs outside
  const roof: Rect = { x0: h.x - h.w / 2, x1: h.x + h.w / 2, z0: h.z - h.d / 2, z1: h.z + h.d / 2 };
  slab(B, roof, roofY, ROOF_T, roofKind, wells.get(stories));
  let gap: { side: Side; a0: number; a1: number } | null = null;
  if (h.outside) {
    const f = h.outside;
    const g = sideGeo(h, f.side);
    const c0 = g.at + (g.out * t) / 2;
    const c1 = c0 + g.out * STAIR_W;
    const start = g.c + f.at;
    const end = flight(B, g.run, start, f.dir, c0, c1, 0, Math.round(roofY / STEP_RISE), 'stair', STAIR_W);
    gap = { side: f.side, a0: Math.min(end, end - f.dir * STAIR_W), a1: Math.max(end, end - f.dir * STAIR_W) };
  }
  if (h.parapet ?? (h.outside !== undefined || wells.has(stories))) {
    for (const side of sides) {
      const g = sideGeo(h, side);
      const holes =
        gap && gap.side === side ? [{ c: (gap.a0 + gap.a1) / 2, w: gap.a1 - gap.a0, y0: 0, y1: PARAPET_H }] : [];
      wall(ctx, g.run, g.at, g.from, g.to, roofY, PARAPET_H, h.wall, holes, { frame: null });
    }
    if (trim) {
      // Coping on top of the parapet
      for (const side of sides) {
        const g = sideGeo(h, side);
        const segs =
          gap && gap.side === side
            ? [
                [g.from, gap.a0],
                [gap.a1, g.to],
              ]
            : [[g.from, g.to]];
        for (const [a0, a1] of segs) {
          if (a1! - a0! < MIN_PIECE) continue;
          const m = (a0! + a1!) / 2;
          const deep = t + 2 * FRAME_OUT;
          if (g.run === 'x') D(m, roofY + PARAPET_H, g.at, a1! - a0!, FRAME, deep, trim);
          else D(g.at, roofY + PARAPET_H, m, deep, FRAME, a1! - a0!, trim);
        }
      }
    }
  }
  if (trim) {
    band(D, h, roofY - CORNICE_H, CORNICE_H, CORNICE_OUT, trim);
  }
}

/** Decoration band round the outside of a footprint (string courses, cornices), standing `out` off the walls. */
function band(D: BoxFn, h: Rect2, y: number, height: number, out: number, kind: BoxKind): void {
  const deep = out + BAND_INSET;
  const w = h.w + 2 * out;
  for (const s of [1, -1]) {
    D(h.x, y, h.z + s * (h.d / 2 + out / 2 - BAND_INSET / 2), w, height, deep, kind);
    D(h.x + s * (h.w / 2 + out / 2 - BAND_INSET / 2), y, h.z, deep, height, h.d, kind);
  }
}
type Rect2 = Pick<HouseSpec, 'x' | 'z' | 'w' | 'd'>;

/** Mirrors a house spec written for the (+x, +z) corner into the (sx, sz) one; x and z are left as given. */
export function mirrorHouse(h: HouseSpec, sx: number, sz: number): HouseSpec {
  const side = (s: Side): Side =>
    sx < 0 && (s === 'e' || s === 'w')
      ? s === 'e'
        ? 'w'
        : 'e'
      : sz < 0 && (s === 'n' || s === 's')
        ? s === 'n'
          ? 's'
          : 'n'
        : s;
  const along = (s: Side) => (s === 'n' || s === 's' ? sx : sz);
  const hole = <T extends Hole | Balcony>(o: T): T => ({ ...o, side: side(o.side), at: (o.at ?? 0) * along(o.side) });
  const fl = (f: Flight): Flight => ({
    ...f,
    side: side(f.side),
    at: f.at * along(f.side),
    dir: (f.dir * along(f.side)) as 1 | -1,
  });
  return {
    ...h,
    doors: h.doors?.map(hole),
    windows: h.windows?.map(hole),
    balconies: h.balconies?.map(hole),
    stairs: h.stairs?.map(fl),
    outside: h.outside && fl(h.outside),
    partitions: h.partitions?.map((p) => ({
      ...p,
      at: p.at * (p.run === 'x' ? sz : sx),
      door: p.door === undefined ? undefined : p.door * (p.run === 'x' ? sx : sz),
    })),
  };
}

/** Kinds that cover what is under them: maps seen from above draw them see-through. */
export const ROOF_KINDS: ReadonlySet<BoxKind> = new Set<BoxKind>(['slab', 'roof', 'wood']);

/** Default colours of the building kinds (minimap, previews and 3D tint). */
export const STRUCTURE_COLORS: Partial<Record<BoxKind, string>> = {
  brick: '#c27158',
  plaster: '#e8dcc6',
  concrete: '#b9b6ae',
  metal: '#7f8b96',
  wood: '#a87a4f',
  slab: '#8f8b84',
  stair: '#b8ad9b',
  tile: '#d3c9b6',
  railing: '#3a3f47',
  trim: '#efe8da',
  frame: '#6b4a2b',
  shutter: '#4f7a8a',
  awning: '#c0503e',
};
