import { describe, expect, it } from 'vitest';
import { FIXED_DT, createMoveState, stepMovement, type MoveContext, type MoveState } from '../movement/movement';
import { PLAYER } from '../player/player';
import { MAPS, MAP_SIZES, getColliders, getMap } from './maps';
import { DOOR_H, DOOR_W, STEP_RISE, STORY, house, mirrorHouse, type HouseSpec } from './structures';
import type { BoxKind, MapBox, SizeId } from './types';

const WALK = 7;
/** yaw that walks towards each direction (yaw 0 looks towards -z) */
const YAW = { px: -Math.PI / 2, nx: Math.PI / 2, pz: Math.PI, nz: 0 };

// Two-story house: door on the south wall, stairs along the north wall, outside stairs on the east wall
const SPEC: HouseSpec = {
  x: 0,
  z: 0,
  w: 10,
  d: 9,
  stories: 2,
  wall: 'brick',
  doors: [{ side: 's' }],
  windows: [{ side: 'w' }, { side: 'w', story: 1 }],
  stairs: [{ side: 'n', at: -3, dir: 1 }],
  outside: { side: 'e', at: -4.3, dir: 1 },
};

function build(spec: HouseSpec): MoveContext {
  const boxes: MapBox[] = [{ x: 0, y: -1, z: 0, w: 60, h: 1, d: 60, c: 'floor' }];
  const decor: MapBox[] = [];
  const add =
    (list: MapBox[]) =>
    (x: number, y: number, z: number, w: number, h: number, d: number, c: BoxKind = 'wall') =>
      list.push({ x, y, z, w, h, d, c });
  house({ B: add(boxes), D: add(decor) }, spec);
  return { colliders: getColliders({ boxes }), walk: WALK, adsMove: 1, fallback: [0, 0, 0] };
}

function walk(st: MoveState, ctx: MoveContext, yaw: number, seconds: number, until?: (s: MoveState) => boolean) {
  for (let i = 0; i < seconds / FIXED_DT && !until?.(st); i++)
    stepMovement(st, { seq: i, f: 1, s: 0, yaw, pitch: 0, b: 0, slot: 0 }, FIXED_DT, ctx);
}

describe('buildings', () => {
  it('doors fit a standing player and steps never need a jump', () => {
    expect(DOOR_H).toBeGreaterThan(PLAYER.height + 0.3);
    expect(DOOR_W).toBeGreaterThan(PLAYER.radius * 4);
    expect(STEP_RISE).toBeLessThanOrEqual(PLAYER.stepUp);
    expect(STORY % STEP_RISE).toBe(0);
  });

  it('walks in through the door', () => {
    const ctx = build(SPEC);
    const st = createMoveState(0, 0, 7);
    walk(st, ctx, YAW.nz, 1.5);
    expect(st.z).toBeLessThan(2);
    expect(st.y).toBe(0);
  });

  it('walks up the inside stairs to the first floor', () => {
    const ctx = build(SPEC);
    const st = createMoveState(-4.2, 0, -3.55);
    walk(st, ctx, YAW.px, 2.5);
    expect(st.y).toBeCloseTo(STORY, 1);
    expect(st.x).toBeGreaterThan(1);
  });

  it('walks up the outside stairs onto the roof', () => {
    const ctx = build(SPEC);
    const st = createMoveState(5.65, 0, -7);
    walk(st, ctx, YAW.pz, 4, (s) => s.z > 2.6);
    for (let i = 0; i < 60; i++)
      stepMovement(st, { seq: i, f: 0, s: 0, yaw: 0, pitch: 0, b: 0, slot: 0 }, FIXED_DT, ctx);
    expect(st.y).toBeCloseTo(2 * STORY, 1);
    walk(st, ctx, YAW.nx, 1);
    expect(st.x).toBeLessThan(3);
    expect(st.y).toBeCloseTo(2 * STORY, 1);
  });

  it('a mirrored house still works', () => {
    const ctx = build(mirrorHouse({ ...SPEC }, -1, -1));
    const st = createMoveState(4.2, 0, 3.55);
    walk(st, ctx, YAW.nx, 2.5);
    expect(st.y).toBeCloseTo(STORY, 1);
  });
});

describe('every map', () => {
  const all = MAPS.flatMap(({ id }) => (Object.keys(MAP_SIZES) as SizeId[]).map((size) => [id, size] as const));

  it.each(all)('%s:%s spawns have room for a standing player', (id, size) => {
    const map = getMap(id, size);
    const r = PLAYER.radius;
    for (const [x, y, z] of map.spawns) {
      const inside = map.boxes.filter(
        (b) =>
          b.c !== 'floor' &&
          Math.abs(x - b.x) < b.w / 2 + r &&
          Math.abs(z - b.z) < b.d / 2 + r &&
          y + 0.01 < b.y + b.h &&
          y + PLAYER.height > b.y,
      );
      expect(inside, `spawn ${x},${z}`).toEqual([]);
    }
  });
});
