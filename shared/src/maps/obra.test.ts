// Obra is built around climbing: the skeleton stairs and the scaffold stairs must be walkable without jumping.
import { describe, expect, it } from 'vitest';
import { FIXED_DT, createMoveState, stepMovement, type MoveContext, type MoveState } from '../movement/movement';
import { MAP_SIZES, getColliders, getMap } from './maps';
import { STORY } from './structures';
import type { SizeId } from './types';

const WALK = 7;
const YAW = { px: -Math.PI / 2, nx: Math.PI / 2 };

function walk(st: MoveState, ctx: MoveContext, yaw: number, seconds: number) {
  for (let i = 0; i < seconds / FIXED_DT; i++)
    stepMovement(st, { seq: i, f: 1, s: 0, yaw, pitch: 0, b: 0, slot: 0 }, FIXED_DT, ctx);
}

describe.each(Object.keys(MAP_SIZES) as SizeId[])('obra:%s', (size) => {
  const map = getMap('obra', size);
  const ctx: MoveContext = { colliders: getColliders(map), walk: WALK, adsMove: 1, fallback: [0, 0, 0] };
  const t = Math.round(Math.min(12, Math.max(7, 0.24 * map.half)));

  it('the skeleton stairs climb to the open roof', () => {
    // Bottom of the first flight (outer band along the north edge), then switchback east / west / east
    const st = createMoveState(-3.6, 0, -t + 0.85);
    walk(st, ctx, YAW.px, 1.2);
    expect(st.y).toBeCloseTo(STORY, 1);
    st.z += 1.3; // step across into the second band
    walk(st, ctx, YAW.nx, 1.2);
    expect(st.y).toBeCloseTo(2 * STORY, 1);
    st.z -= 1.3;
    walk(st, ctx, YAW.px, 1.2);
    expect(st.y).toBeCloseTo(3 * STORY, 1);
  });

  it('the south scaffold stairs reach its top deck', () => {
    // South scaffold: deck 1 is reached from the west end, its long flight starts east and climbs west
    const sw = Math.min(2 * t - 2, 14);
    const sz = Math.min(t + 5, map.half - 6);
    const st = createMoveState(sw / 2 + 7.5, 0, sz);
    walk(st, ctx, YAW.nx, 1.8);
    expect(st.y).toBeCloseTo(2 * STORY, 1);
  });
});
