// Maps: axis-aligned boxes generated from a seed, identical on the server and every client.
// Every box collides and blocks bullets. The 3D look of each kind lives in the client.
import { rng, round2, seedOf, type Vec3 } from '../core/math';
import { rayAABB, type Collider } from '../physics/raycast';
import { PLAYER } from '../player/player';
import { buildAutopista } from './builders/autopista';
import { buildCiudad } from './builders/ciudad';
import { buildMonasterio } from './builders/monasterio';
import { buildObra } from './builders/obra';
import { buildPatio } from './builders/patio';
import { buildPueblo } from './builders/pueblo';
import { buildPuerto } from './builders/puerto';
import { buildEstacion } from './builders/estacion';
import { buildNevada } from './builders/nevada';
import { buildCircuito } from './builders/circuito';
import { addParkour } from './parkour';
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
    desc: 'Patio amurallado: torre mirador en el centro, casas en las esquinas y pasarelas sobre los muros.',
    build: buildPatio,
    wallH: 9,
    sky: '#9fd4ff',
    colors: {
      floor: '#d6cdb8',
      wall: '#b0705a',
      wall2: '#dcc6a2',
      platform: '#a8a196',
      step: '#c2bbaf',
      crate: '#c99a55',
      crate2: '#6f8f5a',
      bridge: '#9a7550',
    },
  },
  autopista: {
    name: 'Autopista',
    tag: 'Paso elevado',
    desc: 'Barrio partido por un paso elevado: azoteas, gasolinera y coches abandonados bajo el puente.',
    build: buildAutopista,
    wallH: 11,
    sky: '#b9c3cc',
    colors: {
      floor: '#6f706d',
      wall: '#8a877f',
      wall2: '#c8c4b8',
      bridge: '#5c5d5e',
      concrete: '#9e9b93',
      brick: '#9c6a57',
      plaster: '#c4b9a5',
      platform: '#d6d2c6',
      step: '#aaa69c',
      slab: '#7d7a74',
      stair: '#a39d90',
      railing: '#3d4248',
      metal: '#8a939b',
      crate: '#b98c50',
      cont1: '#b5513f',
      cont2: '#4d6b4a',
      awning: '#a8463a',
      trim: '#d9d3c4',
    },
  },
  monasterio: {
    name: 'Monasterio',
    tag: 'Claustro',
    desc: 'Claustro con arcadas, campanario, huerto y muralla con adarve.',
    build: buildMonasterio,
    wallH: 7,
    sky: '#b9d3ea',
    colors: {
      floor: '#cdb48a',
      wall: '#b39773',
      wall2: '#d9c49e',
      roof: '#b4573a',
      platform: '#6f9248',
      step: '#a88a64',
      rock: '#9c8c74',
      crate: '#b98a4e',
      crate2: '#d8bf72',
      plaster: '#eadbbd',
      brick: '#b0653f',
      stair: '#c9b28c',
      tile: '#c27c56',
      wood: '#8a6440',
      railing: '#4a3a2a',
      trim: '#efe3c9',
      frame: '#5b3d26',
      shutter: '#5f7d4a',
      water: '#4f86a6',
    },
  },
  pueblo: {
    name: 'Pueblo',
    tag: 'Cuestas',
    desc: 'Pueblo blanco junto al mar: escalinatas, patios, iglesia en lo alto y azoteas.',
    build: buildPueblo,
    wallH: 11,
    sky: '#cfe6f5',
    colors: {
      floor: '#d8c39c',
      wall: '#f1ede4',
      wall2: '#cdb48a',
      roof: '#b8603e',
      platform: '#d2bc92',
      step: '#c4ab80',
      stair: '#cdb68e',
      plaster: '#f6f3ec',
      slab: '#c2714a',
      tile: '#b9623f',
      wood: '#8a6440',
      crate: '#b98a4e',
      crate2: '#8f7a52',
      railing: '#1f3f73',
      trim: '#fbf9f4',
      frame: '#2456a0',
      shutter: '#2f6db5',
      awning: '#2f6db5',
      quay: '#cbb48c',
      hull: '#2a5c9a',
      deck: '#a87a4f',
      metal: '#3a4450',
      water: '#2f7fb0',
    },
  },
  ciudad: {
    name: 'Casco Viejo',
    tag: 'Tejados',
    desc: 'Ciudad vieja: calles estrechas, plaza con torre del reloj, callejones y tejados conectados.',
    build: buildCiudad,
    wallH: 10,
    sky: '#a9cbe8',
    colors: {
      floor: '#9a948a',
      wall: '#c8b8a0',
      bld1: '#e6b3ad',
      bld2: '#b4d1bc',
      bld3: '#ead08e',
      bld4: '#a9c3df',
      plaster: '#efe1c6',
      brick: '#b5654a',
      slab: '#8f8b84',
      roof: '#9c4a32',
      bridge: '#8a6440',
      quay: '#aaa49a',
      water: '#3f7f95',
      wood: '#8a6a4a',
      tile: '#d8cbb0',
      stair: '#bdb3a2',
      trim: '#f3ecdf',
      frame: '#5b3d26',
      shutter: '#4f7a5a',
      awning: '#b5553a',
      railing: '#2f3338',
      platform: '#a8a196',
      step: '#bdb6aa',
      crate: '#c99a55',
      crate2: '#8d6a3f',
    },
  },
  obra: {
    name: 'Obra',
    tag: 'Vertical',
    desc: 'Esqueleto de hormigón de tres plantas con andamios, una grúa de pluma transitable y un bloque vecino a medio levantar. Combate en altura.',
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
      roof: '#8b8f93',
      wood: '#a5824f',
    },
  },
  puerto: {
    name: 'Puerto',
    tag: 'Altura y agua',
    desc: 'Carguero en un canal: cubierta, puente y bodega. Grúa pórtico, pasarela, almacenes y contenedores.',
    build: buildPuerto,
    wallH: 9,
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
  circuito: {
    name: 'Circuito',
    tag: 'Carrera de saltos',
    desc: 'Pista sobre lava en tres tramos: saltos, cornisas, tirolina, losas que caen, martillos, túnel para deslizarse, chimenea de rebotes y la meta en lo alto.',
    build: buildCircuito,
    wallH: 4,
    sky: '#f2b77a',
    colors: {
      floor: '#3a1c12',
      wall: '#5a3a30',
      rock: '#8a5c44',
      platform: '#4c9dff',
      step: '#7fb6ff',
      metal: '#ffd23a',
      railing: '#ffd23a',
      lava: '#ff5a1f',
      awning: '#ff7a1a',
      pad: '#46d37f',
    },
  },
  estacion: {
    name: 'Estación',
    tag: 'Dos niveles',
    desc: 'Calles arriba y andenes hundidos: un tren parado que se recorre, vestíbulo, pasarelas, marquesinas y garitas.',
    build: buildEstacion,
    wallH: 12,
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
      metal: '#6f7a84',
      cont1: '#3f6f8f',
      shutter: '#4f6f5a',
    },
  },
  nevada: {
    name: 'Nevada',
    tag: 'Bosque y nieve',
    desc: 'Puesto de montaña: lago helado al centro, cresta rocosa con radio, refugio de dos plantas y torres con tirolina.',
    build: buildNevada,
    wallH: 9,
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
      wall2: '#dfe7ee',
      metal: '#8a949c',
      crate: '#8a6a44',
      crate2: '#6f5536',
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
  // Every map is laid out by hand for one size (the medium one); `sizeId` is still accepted from old clients
  void sizeId;
  const size = DEFAULT_SIZE;
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
  const powerSpots: [number, number, number | undefined][] = [];
  const checkpoints: GameMap['checkpoints'] = [];
  const hazards: GameMap['hazards'] = [];
  const tiles: MapBox[] = [];
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
    PW: (x, z, y) => powerSpots.push([x, z, y]),
    CP: (x, y, z, w, d) => checkpoints.push({ x: round2(x), y: round2(y), z: round2(z), w, d }),
    HZ: (h) => hazards.push(h),
    TL: (x, y, z, s) => tiles.push({ x: round2(x), y: round2(y - 0.5), z: round2(z), w: s, h: 0.5, d: s, c: 'xtile' }),
    H,
    rand: rng(seedOf(key)),
  });
  // Props keep clear of spawn points and of the ground in front of every ladder
  const ladderSpots = ladders.map((l): [number, number] => {
    const [dx, dz] = LADDER_DIRS[l.dir]!;
    return [l.x - dx * 0.8, l.z - dz * 0.8];
  });
  placeProps(boxes, [...points, ...ladderSpots, ...powerSpots.map(([x, z]): [number, number] => [x, z])], props);
  // Places to climb in the open ground (not on the race course)
  if (id !== 'circuito')
    addParkour(
      boxes,
      H,
      [
        ...points,
        ...ladderSpots,
        ...powerSpots.map(([x, z]): [number, number] => [x, z]),
        ...pickups.map(([, x, z]): [number, number] => [x, z]),
        ...barrels,
        ...crates.map(([x, z]): [number, number] => [x, z]),
      ],
      ziplines,
      rng(seedOf(`${key}:parkour`)),
      id === 'nevada',
    );
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
    powerSpots: powerSpots.map(([x, z, y]): Vec3 => [round2(x), y ?? standAt(boxes, x, z), round2(z)]),
    checkpoints,
    hazards,
    tiles,
  };
  mapCache.set(key, map);
  return map;
}
