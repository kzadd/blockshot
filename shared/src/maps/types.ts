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
  | 'pad';
export type PropKind = 'barrel' | 'planter' | 'trunk' | 'lamp' | 'sandbag' | 'pallet' | 'cactus' | 'car' | 'carTop';
export type BoxKind = StructureKind | PropKind;

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
  /** add a spawn point */
  S: (x: number, z: number) => void;
  /** add a decoration prop on whatever ground is at (x, z); dropped if it collides or covers a spawn */
  P: (x: number, z: number, parts: PropPart[]) => void;
  /** half side of the arena (it spans -H..H) */
  H: number;
  rand: () => number;
}

export type MapColors = Partial<Record<BoxKind, string>> & { floor: string; wall: string };

export type MapId = 'patio' | 'almacen' | 'desfiladero' | 'polvo' | 'ciudad';
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
  spawns: Spawn[];
  /** Capture the flag bases */
  bases: Record<SideTeam, Vec3>;
}
