// Maps: axis-aligned boxes generated from a seed, identical on the server and every client.
// Every box collides and blocks bullets. The 3D look of each kind lives in the client.
import { rng, round2, seedOf, type Vec3 } from '../core/math';
import { rayAABB, type Collider } from '../physics/raycast';
import { PLAYER } from '../player/player';
import { buildAlmacen } from './builders/almacen';
import { buildCiudad } from './builders/ciudad';
import { buildDesfiladero } from './builders/desfiladero';
import { buildObra } from './builders/obra';
import { buildPatio } from './builders/patio';
import { buildPolvo } from './builders/polvo';
import { buildPuerto } from './builders/puerto';
import { buildEstacion } from './builders/estacion';
import { buildNevada } from './builders/nevada';
import { PROP_COLORS } from './props';
import { ROOF_KINDS, STRUCTURE_COLORS } from './structures';
import { BARREL, LADDER_DIRS, ZIPLINE } from './objects';
import type {
  BoxKind,
  GameMap,
  MapBox,
  MapDef,
  MapId,
  MapLadder,
  MapPickup,
  MapZipline,
  PropPart,
  SizeId,
  Spawn,
} from './types';

export const MAP_SIZES: Record<SizeId, { id: SizeId; name: string; half: number; players: number }> = {
  s: { id: 's', name: 'Pequeño', half: 26, players: 6 },
  m: { id: 'm', name: 'Mediano', half: 40, players: 12 },
  l: { id: 'l', name: 'Grande', half: 56, players: 20 },
};
export const isSizeId = (v: unknown): v is SizeId => typeof v === 'string' && Object.hasOwn(MAP_SIZES, v);

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
      plaster: '#e2c79c',
      slab: '#b39a74',
      stair: '#c9b08a',
      tile: '#d9a77a',
      frame: '#5b3d26',
      awning: '#b5553a',
      trim: '#f0e2c6',
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
  obra: {
    name: 'Obra',
    tag: 'Vertical',
    desc: 'Edificio en obra de tres plantas, andamios y grúa. Combate en altura.',
    build: buildObra,
    wallH: 10,
    sky: '#bcd4e6',
    colors: {
      floor: '#a39684',
      wall: '#c9c3b6',
      platform: '#b08a5a',
      step: '#a9a49a',
      concrete: '#b3afa6',
      slab: '#9c978e',
      stair: '#b8b2a6',
      railing: '#e8772e',
      metal: '#9aa6b1',
      rail: '#e9b824',
      brick: '#b8664a',
      crate: '#c99a55',
      crate2: '#8d6a3f',
      cont1: '#d9772e',
      cont2: '#4a7fb0',
    },
  },
  puerto: {
    name: 'Puerto',
    tag: 'Altura y agua',
    desc: 'Contenedores, un canal con grúa pórtico y un carguero en su dique. Tirolinas desde la grúa.',
    build: buildPuerto,
    wallH: 7,
    sky: '#9cc2dd',
    colors: {
      floor: '#4f5a5e',
      wall: '#7f8a90',
      quay: '#8f8c86',
      hull: '#b4432f',
      deck: '#8a6a4a',
      water: '#2b5b74',
      metal: '#d9a531',
      bridge: '#7a6a55',
      platform: '#9aa3ab',
      railing: '#e0b23a',
      roof: '#5a646c',
      tile: '#a8a39a',
      cont1: '#d9772e',
      cont2: '#4a7fb0',
      cont3: '#5f8f4e',
    },
  },
  estacion: {
    name: 'Estación',
    tag: 'Dos niveles',
    desc: 'Calles arriba y un andén hundido con un tren parado que se puede atravesar.',
    build: buildEstacion,
    wallH: 9,
    sky: '#b4cde3',
    colors: {
      floor: '#5d5a55',
      wall: '#9a6a52',
      quay: '#a29d93',
      platform: '#c9c3b6',
      step: '#bdb6aa',
      stair: '#b8b2a6',
      concrete: '#b3afa6',
      roof: '#59616b',
      train: '#c9662f',
      tile: '#d8d2c4',
      bridge: '#6e7680',
      railing: '#3a4048',
      wood: '#8a6a4a',
      brick: '#a8603f',
      plaster: '#d8c8b0',
      ballast: '#75706a',
      track: '#8d9399',
      sleeper: '#5a4632',
      tunnel: '#121417',
      awning: '#c0503e',
    },
  },
  nevada: {
    name: 'Nevada',
    tag: 'Bosque y nieve',
    desc: 'Puesto de montaña: lago helado al centro, bosques de pinos, torres de vigilancia con tirolina.',
    build: buildNevada,
    wallH: 5,
    sky: '#c9d7e4',
    colors: {
      floor: '#eef2f5',
      wall: '#8d8f8c',
      ice: '#b9dcef',
      rock: '#9aa0a6',
      wood: '#7a5a3c',
      roof: '#4d5560',
      railing: '#6b4e33',
      pine: '#3f6e4a',
      logs: '#8a6440',
      sandbag: '#a89a78',
    },
  },
};

export const MAPS = (Object.entries(MAP_DEFS) as [MapId, MapDef][]).map(([id, m]) => ({
  id,
  name: m.name,
  tag: m.tag,
  desc: m.desc,
}));
export const isMapId = (v: unknown): v is MapId => typeof v === 'string' && Object.hasOwn(MAP_DEFS, v);

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

/** Where something stands at (x, z): the lowest box top with room for a body above it (under roofs, not on them). */
export function standAt(boxes: readonly MapBox[], x: number, z: number, room = PLAYER.height): number {
  const here = boxes.filter((b) => Math.abs(x - b.x) <= b.w / 2 && Math.abs(z - b.z) <= b.d / 2);
  const tops = [0, ...here.map((b) => b.y + b.h)].sort((a, b) => a - b);
  for (const t of tops) if (!here.some((b) => b.y < t + room && b.y + b.h > t + 0.01)) return round2(t);
  return round2(tops[tops.length - 1]!);
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
  const barrels: [number, number][] = [];
  const crates: [number, number, number, number | undefined][] = [];
  const pickups: [MapPickup['k'], number, number, number | undefined][] = [];
  const ladders: MapLadder[] = [];
  const ziplines: MapZipline[] = [];
  def.build({
    B,
    D,
    S: (x, z) => points.push([round2(x), round2(z)]),
    P: (x, z, parts) => props.push({ x, z, parts }),
    BR: (x, z) => barrels.push([x, z]),
    BK: (x, z, s = 1.2, y) => crates.push([x, z, s, y]),
    PK: (k, x, z, y) => pickups.push([k, x, z, y]),
    LD: (x, z, y1, dir) => ladders.push({ x: round2(x), z: round2(z), y0: 0, y1: round2(y1), dir }),
    ZL: (a, b) => ziplines.push([a.map(round2) as Vec3, b.map(round2) as Vec3]),
    H,
    rand: rng(seedOf(key)),
  });
  placeProps(boxes, points, props);
  // Objects stand on the ground there (decided once every box is in)
  const objBox = (x: number, z: number, w: number, h: number, c: MapBox['c'], y?: number): MapBox => ({
    x: round2(x),
    y: y ?? standAt(boxes, x, z),
    z: round2(z),
    w,
    h,
    d: w,
    c,
  });
  const barrelBoxes = barrels.map(([x, z]) => objBox(x, z, BARREL.w, BARREL.h, 'xbarrel'));
  const crateBoxes = crates.map(([x, z, s, y]) => objBox(x, z, s, s, 'xcrate', y));
  // A zipline whose rider would go through something on the way is dropped (cables are checked once, here)
  const riderHits = (x: number, y: number, z: number) =>
    boxes.some(
      (b) =>
        Math.abs(x - b.x) < b.w / 2 + 0.3 &&
        Math.abs(z - b.z) < b.d / 2 + 0.3 &&
        y - ZIPLINE.hang < b.y + b.h &&
        y - 0.3 > b.y,
    );
  const clearLines = ziplines.filter(([a, b]) => {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    for (let d = 1; d < len - 1.5; d += 0.5) {
      const t = d / len;
      if (riderHits(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t)) return false;
    }
    return true;
  });
  // A ladder's foot: the floor just in front of its wall
  for (const l of ladders) {
    const [dx, dz] = LADDER_DIRS[l.dir]!;
    l.y0 = floorBelow(boxes, l.x - dx * 0.3, l.y1 - 0.5, l.z - dz * 0.3);
  }

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
    barrels: barrelBoxes,
    crates: crateBoxes,
    pickups: pickups.map(([k, x, z, y]) => ({ k, x: round2(x), y: y ?? standAt(boxes, x, z), z: round2(z) })),
    ladders,
    ziplines: clearLines,
  };
  mapCache.set(key, map);
  return map;
}
