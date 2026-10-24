// Maps: axis-aligned boxes generated from a seed, identical on the server and every client.
// Every box collides and blocks bullets. The 3D look of each kind lives in the client.
import { rng, round2, seedOf, type Vec3 } from '../core/math';
import { rayAABB, type Collider } from '../physics/raycast';
import { PLAYER } from '../player/player';
import { buildAlmacen } from './builders/almacen';
import { buildCiudad } from './builders/ciudad';
import { buildDesfiladero } from './builders/desfiladero';
import { buildPatio } from './builders/patio';
import { buildPolvo } from './builders/polvo';
import { PROP_COLORS } from './props';
import { ROOF_KINDS, STRUCTURE_COLORS } from './structures';
import type { BoxKind, GameMap, MapBox, MapDef, MapId, PropPart, SizeId, Spawn } from './types';

export const MAP_SIZES: Record<SizeId, { id: SizeId; name: string; half: number; players: number }> = {
  s: { id: 's', name: 'Pequeño', half: 26, players: 6 },
  m: { id: 'm', name: 'Mediano', half: 40, players: 12 },
  l: { id: 'l', name: 'Grande', half: 56, players: 20 },
};
export const isSizeId = (v: unknown): v is SizeId => typeof v === 'string' && v in MAP_SIZES;

const MAP_DEFS: Record<MapId, MapDef> = {
  patio: {
    name: 'Patio',
    tag: 'Equilibrado',
    desc: 'Torre central y habitaciones en las esquinas. Equilibrado.',
    build: buildPatio,
    wallH: 8,
    sky: '#9fd4ff',
    colors: {
      floor: '#d6cdb8',
      wall: '#b0705a',
      wall2: '#dcc6a2',
      platform: '#a8a196',
      step: '#c2bbaf',
      crate: '#c99a55',
      crate2: '#6f8f5a',
    },
  },
  almacen: {
    name: 'Almacén',
    tag: 'Combate cercano',
    desc: 'Pasillos entre contenedores. Combate cercano y esquinas.',
    build: buildAlmacen,
    wallH: 9,
    sky: '#c4d0dc',
    colors: {
      floor: '#a8a8a0',
      wall: '#5d6b78',
      platform: '#7d8a96',
      step: '#9aa6b1',
      rail: '#e0b33a',
      railing: '#e0b33a',
      metal: '#8d9aa6',
      crate: '#c9944a',
      crate2: '#8d6a3f',
      cont1: '#c0503e',
      cont2: '#3f78b5',
      cont3: '#4f9a5a',
    },
  },
  desfiladero: {
    name: 'Desfiladero',
    tag: 'Francotiradores',
    desc: 'Cañón entre dos mesetas. Líneas largas para francotiradores.',
    build: buildDesfiladero,
    wallH: 12,
    sky: '#ffd8a6',
    colors: {
      floor: '#e0c08f',
      wall: '#b0704a',
      wall2: '#c98a5a',
      platform: '#d19a64',
      step: '#a87a4e',
      bridge: '#8a6440',
      rock: '#9b8b7a',
      crate: '#d4a24c',
      concrete: '#d6bc94',
      stair: '#cdb089',
      slab: '#a8916f',
      plaster: '#ecd9b8',
    },
  },
  polvo: {
    name: 'Polvo',
    tag: 'Pasillos',
    desc: 'Pueblo del desierto: túnel, medio y pasillo largo hasta dos zonas.',
    build: buildPolvo,
    wallH: 9,
    sky: '#ffe7c2',
    colors: {
      floor: '#dcc49a',
      wall: '#c9a878',
      wall2: '#e0c9a0',
      roof: '#8a6a4a',
      platform: '#c7b08a',
      step: '#b9a27c',
      crate: '#c99a55',
      crate2: '#8f7a52',
    },
  },
  ciudad: {
    name: 'Ciudad',
    tag: 'Calles',
    desc: 'Manzanas de edificios, callejones, plazas y azoteas.',
    build: buildCiudad,
    wallH: 14,
    sky: '#a9cbe8',
    colors: {
      floor: '#6b6e74',
      wall: '#8a8f99',
      bld1: '#c9b79a',
      bld2: '#9fb0c4',
      bld3: '#d8c8b0',
      bld4: '#b58c74',
      platform: '#a8a196',
      step: '#bdb6aa',
      crate: '#c99a55',
    },
  },
};

export const MAPS = (Object.entries(MAP_DEFS) as [MapId, MapDef][]).map(([id, m]) => ({
  id,
  name: m.name,
  tag: m.tag,
  desc: m.desc,
}));
export const isMapId = (v: unknown): v is MapId => typeof v === 'string' && v in MAP_DEFS;

const DEFAULT_MAP: MapId = 'patio';
const DEFAULT_SIZE: SizeId = 'm';
/** Outer walls keep the player this far from the arena edge (m). */
const BOUNDS_MARGIN = 0.4;
/** Spawns look along the clearest of this many directions, preferring the centre. */
const SPAWN_YAW_RAYS = 16;
const SPAWN_YAW_REACH = 40;
const SPAWN_YAW_CENTER_BIAS = 4;
/** Props closer than this to a spawn point are dropped (m). */
const PROP_SPAWN_CLEARANCE = 1.3;
const OVERLAP_EPSILON = 0.01;

// Where to look when spawning: the clearest direction, with preference towards the centre
function spawnYaw(cols: Collider[], x: number, y: number, z: number): number {
  const o: Vec3 = [x, y + PLAYER.eye, z];
  const toCenter = Math.atan2(x, z);
  let best = toCenter;
  let bestScore = -Infinity;
  for (let i = 0; i < SPAWN_YAW_RAYS; i++) {
    const a = (i / SPAWN_YAW_RAYS) * Math.PI * 2;
    const d: Vec3 = [-Math.sin(a), 0, -Math.cos(a)];
    let t = SPAWN_YAW_REACH;
    for (const b of cols) t = Math.min(t, rayAABB(o, d, b.min, b.max));
    const score = t + SPAWN_YAW_CENTER_BIAS * Math.cos(a - toCenter);
    if (score > bestScore) {
      bestScore = score;
      best = a;
    }
  }
  return round2(best);
}

/** Height of the highest box top at (x, z). */
export function groundAt(boxes: readonly MapBox[], x: number, z: number): number {
  let y = 0;
  for (const b of boxes) {
    if (Math.abs(x - b.x) <= b.w / 2 && Math.abs(z - b.z) <= b.d / 2) y = Math.max(y, b.y + b.h);
  }
  return round2(y);
}

/** Height of the highest box top at (x, z) that is not above `y` (the floor under a point, not the roof over it). */
export function floorBelow(boxes: readonly MapBox[], x: number, y: number, z: number, tolerance = 0.2): number {
  let best = 0;
  for (const b of boxes) {
    const top = b.y + b.h;
    if (Math.abs(x - b.x) <= b.w / 2 && Math.abs(z - b.z) <= b.d / 2 && top <= y + tolerance)
      best = Math.max(best, top);
  }
  return best;
}

interface PendingProp {
  x: number;
  z: number;
  parts: PropPart[];
}

type Footprint = Pick<MapBox, 'x' | 'y' | 'z' | 'w' | 'h' | 'd'>;
const overlaps = (a: Footprint, b: Footprint) =>
  Math.abs(a.x - b.x) < (a.w + b.w) / 2 - OVERLAP_EPSILON &&
  Math.abs(a.z - b.z) < (a.d + b.d) / 2 - OVERLAP_EPSILON &&
  a.y < b.y + b.h - OVERLAP_EPSILON &&
  b.y < a.y + a.h - OVERLAP_EPSILON;

// Places the decoration props that fit: on the ground, not colliding with anything, away from spawns and out of buildings
function placeProps(boxes: MapBox[], points: [number, number][], props: PendingProp[]): void {
  let id = 0;
  for (const { x, z, parts } of props) {
    // Never inside a building nor on its roof
    if (boxes.some((b) => ROOF_KINDS.has(b.c) && Math.abs(x - b.x) <= b.w / 2 && Math.abs(z - b.z) <= b.d / 2))
      continue;
    const y = groundAt(boxes, x, z);
    const list: MapBox[] = parts.map(([dx, dy, dz, w, h, d, c]) => ({
      x: round2(x + dx),
      y: round2(y + dy),
      z: round2(z + dz),
      w,
      h,
      d,
      c,
      p: id + 1,
    }));
    const blocked = list.some(
      (b) =>
        boxes.some((o) => o.c !== 'floor' && (overlaps(b, o) || (o.c === 'pad' && overlaps({ ...b, y: o.y }, o)))) ||
        points.some(
          ([sx, sz]) =>
            Math.abs(sx - b.x) < b.w / 2 + PROP_SPAWN_CLEARANCE && Math.abs(sz - b.z) < b.d / 2 + PROP_SPAWN_CLEARANCE,
        ),
    );
    if (blocked) continue;
    id++;
    boxes.push(...list);
  }
}

export function getColliders(map: Pick<GameMap, 'boxes'>): Collider[] {
  return map.boxes.map((b) => ({
    c: b.c,
    min: [b.x - b.w / 2, b.y, b.z - b.d / 2],
    max: [b.x + b.w / 2, b.y + b.h, b.z + b.d / 2],
  }));
}

const mapCache = new Map<string, GameMap>();
export function getMap(mapId: string, sizeId: string): GameMap {
  const id = isMapId(mapId) ? mapId : DEFAULT_MAP;
  const size = isSizeId(sizeId) ? sizeId : DEFAULT_SIZE;
  const key = `${id}:${size}`;
  const cached = mapCache.get(key);
  if (cached) return cached;

  const def = MAP_DEFS[id];
  const H = MAP_SIZES[size].half;
  const boxes: MapBox[] = [];
  const points: [number, number][] = [];
  const B = (x: number, y: number, z: number, w: number, h: number, d: number, c: BoxKind = 'wall') => {
    boxes.push({ x: round2(x), y: round2(y), z: round2(z), w: round2(w), h: round2(h), d: round2(d), c });
  };
  const decor: MapBox[] = [];
  const D = (x: number, y: number, z: number, w: number, h: number, d: number, c: BoxKind = 'trim') => {
    decor.push({ x: round2(x), y: round2(y), z: round2(z), w: round2(w), h: round2(h), d: round2(d), c });
  };
  // Floor and outer walls
  B(0, -1, 0, 2 * H, 1, 2 * H, 'floor');
  B(0, 0, -H - 0.5, 2 * H + 2, def.wallH, 1);
  B(0, 0, H + 0.5, 2 * H + 2, def.wallH, 1);
  B(-H - 0.5, 0, 0, 1, def.wallH, 2 * H);
  B(H + 0.5, 0, 0, 1, def.wallH, 2 * H);
  const props: PendingProp[] = [];
  def.build({
    B,
    D,
    S: (x, z) => points.push([round2(x), round2(z)]),
    P: (x, z, parts) => props.push({ x, z, parts }),
    H,
    rand: rng(seedOf(key)),
  });
  placeProps(boxes, points, props);

  const cols = getColliders({ boxes });
  // Capture the flag bases: the westernmost spawn point (Red) and the easternmost (Blue)
  const side = (s: number) => [...points].sort((a, b) => s * (a[0] - b[0]) || Math.abs(a[1]) - Math.abs(b[1]))[0]!;
  const base = ([x, z]: [number, number]): Vec3 => [x, groundAt(boxes, x, z), z];
  const spawns: Spawn[] = points.map(([x, z]) => {
    const y = groundAt(boxes, x, z);
    return [x, y, z, spawnYaw(cols, x, y, z)];
  });
  const map: GameMap = {
    id,
    size,
    name: def.name,
    sizeName: MAP_SIZES[size].name,
    half: H,
    bounds: H - BOUNDS_MARGIN,
    wallH: def.wallH,
    sky: def.sky,
    colors: { ...PROP_COLORS, ...STRUCTURE_COLORS, ...def.colors },
    boxes,
    decor,
    spawns,
    bases: { 1: base(side(1)), 2: base(side(-1)) },
  };
  mapCache.set(key, map);
  return map;
}
