// Map objects that change during a match: health and armour on the floor, explosive barrels and wooden crates
// that break, plus the ladders and ziplines the movement uses. The server owns their state; the client draws them
// and keeps the same colliders (live barrels and crates block movement and bullets like any wall).
import type { Collider } from '../physics/raycast';
import { GRENADE_WEAPON } from '../weapons/grenade';
import type { Weapon } from '../weapons/weapons';
import type { GameMap, MapBox, MapLadder } from './types';
import { getColliders } from './maps';

/** Health and armour on the floor: what they give, how close you must walk and when they come back. */
export const PICKUP = { hp: 40, armor: 50, reach: 1.1, respawnMs: 30000 };
/** Explosive barrel: hit points, blast (like a smaller grenade) and when it stands again. */
export const BARREL = { hp: 30, radius: 5, maxDamage: 95, minDamage: 20, respawnMs: 45000, w: 0.8, h: 1.15 };
export const BARREL_WEAPON: Weapon = { ...GRENADE_WEAPON, name: 'Barril' };
/** Wooden crate that breaks after enough damage and is rebuilt later. */
/** Explosions hit wood harder than bullets (`blast` × their damage). */
export const CRATE = { hp: 150, respawnMs: 40000, blast: 2 };
/** Ladders: climbing speed and the reach of the ladder in front of its wall (m). */
export const LADDER = { speed: 4.2, reach: 0.5, width: 0.9 };
/** Ziplines: riding speed, how close the hands must be to grab the cable and how far below it you hang (m). */
export const ZIPLINE = { speed: 13, grab: 0.9, hang: 2.05, letGoS: 0.5 };

/** Which barrels and crates are down right now (indices into map.barrels / map.crates). */
export interface ObjectsDown {
  barrels: ReadonlySet<number>;
  crates: ReadonlySet<number>;
}

const box = (b: MapBox): Collider => ({
  c: b.c,
  min: [b.x - b.w / 2, b.y, b.z - b.d / 2],
  max: [b.x + b.w / 2, b.y + b.h, b.z + b.d / 2],
});

/** Map boxes plus the barrels and crates standing now: what movement, bullets and grenades collide with. */
export function liveColliders(map: Pick<GameMap, 'boxes' | 'barrels' | 'crates'>, down?: ObjectsDown): Collider[] {
  return [
    ...getColliders(map),
    ...map.barrels.filter((_, i) => !down?.barrels.has(i)).map(box),
    ...map.crates.filter((_, i) => !down?.crates.has(i)).map(box),
  ];
}

/** Direction a climber faces on each ladder (dir 0..3: -z, +x, +z, -x). */
export const LADDER_DIRS: readonly [number, number][] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

/** The space in front of a ladder where a player climbs it. */
export function ladderVolume(l: MapLadder): Collider {
  const [dx, dz] = LADDER_DIRS[l.dir]!;
  // Centred a little out from the wall; wider along the wall than away from it
  const cx = l.x - dx * LADDER.reach * 0.5;
  const cz = l.z - dz * LADDER.reach * 0.5;
  const hx = dx ? LADDER.reach / 2 : LADDER.width / 2;
  const hz = dz ? LADDER.reach / 2 : LADDER.width / 2;
  return { c: 'ladder', min: [cx - hx, l.y0, cz - hz], max: [cx + hx, l.y1 + 0.15, cz + hz] };
}

const climbCache = new WeakMap<object, { ladders: Collider[]; ziplines: GameMap['ziplines'] }>();
/** The map's ladder volumes and ziplines, as the movement context takes them (computed once per map). */
export function climbables(map: Pick<GameMap, 'ladders' | 'ziplines'>): {
  ladders: Collider[];
  ziplines: GameMap['ziplines'];
} {
  let c = climbCache.get(map);
  if (!c) climbCache.set(map, (c = { ladders: map.ladders.map(ladderVolume), ziplines: map.ziplines }));
  return c;
}
