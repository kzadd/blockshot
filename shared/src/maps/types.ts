import type { Vec3 } from '../core/math';
import type { SideTeam } from '../modes/modes';

/** Box kinds: structural blocks plus decoration props. The client decides how each one looks. */
export type StructureKind =
  | 'floor'
  | 'wall'
  | 'wall2'
  | 'platform'
  | 'step'
  | 'crate'
  | 'crate2'
  | 'rail'
  | 'cont1'
  | 'cont2'
  | 'cont3'
  | 'bridge'
  | 'rock'
  | 'roof'
  | 'bld1'
  | 'bld2'
  | 'bld3'
  | 'bld4'
  | 'pad'
  // building materials
  | 'brick'
  | 'plaster'
  | 'concrete'
  | 'metal'
  | 'wood'
  | 'slab'
  | 'stair'
  | 'tile'
  | 'railing'
  // ports: quay paving, a ship's painted hull and its deck planks
  | 'quay'
  | 'hull'
  | 'deck'
  // stations: train carriages
  | 'train';
/** Map objects with a life of their own (maps/objects.ts): explosive barrels and crates that break. */
export type ObjectKind = 'xbarrel' | 'xcrate' | 'xtile';
export type PropKind =
  'barrel' | 'planter' | 'trunk' | 'lamp' | 'sandbag' | 'pallet' | 'cactus' | 'car' | 'carTop' | 'pine' | 'logs';
/** Decoration that never collides (window and door frames, eaves, shutters, awnings). */
export type DecorKind =
  'trim' | 'frame' | 'shutter' | 'awning' | 'water' | 'ballast' | 'track' | 'sleeper' | 'tunnel' | 'ice' | 'lava';
export type BoxKind = StructureKind | PropKind | DecorKind | ObjectKind;

export type PickupKind = 'hp' | 'armor';
/** Health or armour lying on the floor at (x, y, z). */
export interface MapPickup {
  k: PickupKind;
  x: number;
  y: number;
  z: number;
}
/** Ladder against a wall: (x, z) on the wall face, from y0 up to y1; `dir` is where a climber faces (0..3: -z, +x, +z, -x). */
export interface MapLadder {
  x: number;
  z: number;
  y0: number;
  y1: number;
  dir: 0 | 1 | 2 | 3;
}
/**
 * Moving obstacle (maps/hazards.ts): a sweeper bar spinning round (x, z) at height y, a hammer swinging across the
 * track under a pivot `len` over (x, y, z), or a block pushing out from the side `side` of the track.
 */
export interface MapHazard {
  k: 'sweeper' | 'hammer' | 'pusher';
  x: number;
  y: number;
  z: number;
  /** sweeper: arm length; hammer: rope length; pusher: how far it reaches across the track (m) */
  len: number;
  /** ms per cycle */
  period: number;
  /** 0..1 of a cycle, so neighbours are out of step */
  phase: number;
  /** pusher: the side it comes from (+1: +z, -1: -z) */
  side?: number;
}
/** Zipline cable between two points (riders slide towards the lower end). */
export type MapZipline = [Vec3, Vec3];

/** Axis-aligned box. x, z = centre · y = base · w, h, d = size. `p` = prop id (decoration). */
export interface MapBox {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  c: BoxKind;
  p?: number;
}

/** Part of a decoration prop: [dx, dy, dz, width, height, depth, kind] */
export type PropPart = [number, number, number, number, number, number, BoxKind];

export type BoxFn = (x: number, y: number, z: number, w: number, h: number, d: number, c?: BoxKind) => void;

export interface MapBuildContext {
  /** add a box */
  B: BoxFn;
  /** add a decoration box: drawn by the client but it never collides nor blocks bullets */
  D: BoxFn;
  /** add a spawn point */
  S: (x: number, z: number) => void;
  /** add a decoration prop on whatever ground is at (x, z); dropped if it collides or covers a spawn */
  P: (x: number, z: number, parts: PropPart[]) => void;
  /** an explosive barrel standing on whatever ground is at (x, z) */
  BR: (x: number, z: number) => void;
  /** a wooden crate of side `s` that breaks, on the ground at (x, z) (or at height y) */
  BK: (x: number, z: number, s?: number, y?: number) => void;
  /** health or armour on whatever ground is at (x, z) (or at height y) */
  PK: (k: PickupKind, x: number, z: number, y?: number) => void;
  /** a ladder from the floor at (x, z) (a point on the wall face) up to y1, the climber facing `dir` */
  LD: (x: number, z: number, y1: number, dir: MapLadder['dir']) => void;
  /** a zipline cable from a to b */
  ZL: (a: Vec3, b: Vec3) => void;
  /** a spot where power weapons appear, on whatever ground is at (x, z) (or at height y) */
  PW: (x: number, z: number, y?: number) => void;
  /** a race checkpoint: the area w × d centred at (x, z) with its floor at y (in order; the last is the finish) */
  CP: (x: number, y: number, z: number, w: number, d: number) => void;
  /** a moving obstacle that knocks players back (maps/hazards.ts) */
  HZ: (h: MapHazard) => void;
  /** a floor tile (side s, top at y) that drops a moment after someone steps on it, and comes back later */
  TL: (x: number, y: number, z: number, s: number) => void;
  /** half side of the arena (it spans -H..H) */
  H: number;
  rand: () => number;
}

export type MapColors = Partial<Record<BoxKind, string>> & { floor: string; wall: string };

export type MapId =
  'patio' | 'autopista' | 'monasterio' | 'pueblo' | 'ciudad' | 'obra' | 'puerto' | 'estacion' | 'nevada' | 'circuito';
export type SizeId = 's' | 'm' | 'l';

export interface MapDef {
  name: string;
  tag: string;
  desc: string;
  build: (ctx: MapBuildContext) => void;
  wallH: number;
  sky: string;
  colors: MapColors;
}

/** [x, y, z, yaw] */
export type Spawn = [number, number, number, number];

export interface GameMap {
  id: MapId;
  size: SizeId;
  name: string;
  sizeName: string;
  half: number;
  bounds: number;
  wallH: number;
  sky: string;
  colors: MapColors;
  boxes: MapBox[];
  /** decoration only (no collision): trims, frames, eaves */
  decor: MapBox[];
  /** objects (maps/objects.ts): not in `boxes`, the server says which stand */
  barrels: MapBox[];
  crates: MapBox[];
  pickups: MapPickup[];
  ladders: MapLadder[];
  ziplines: MapZipline[];
  /** where power weapons appear */
  powerSpots: Vec3[];
  /** moving obstacles and dropping floor tiles (race course) */
  hazards: MapHazard[];
  tiles: MapBox[];
  /** race checkpoints in order (Carrera mode), the last one is the finish */
  checkpoints: { x: number; y: number; z: number; w: number; d: number }[];
  spawns: Spawn[];
  /** Capture the flag bases */
  bases: Record<SideTeam, Vec3>;
}
