// Pueblo is built in levels: the great stair, the alley between the terrace houses and the arches between the
// azoteas must take a player up without help.
import { describe, expect, it } from 'vitest';
import {
  BTN_JUMP,
  BTN_JUMP_PRESSED,
  FIXED_DT,
  createMoveState,
  stepMovement,
  type MoveContext,
  type MoveState,
} from '../movement/movement';
import { getColliders, getMap } from './maps';

const YAW = { nz: 0, pz: Math.PI, px: -Math.PI / 2, nx: Math.PI / 2 };
const ROOF = 7.5;

function walk(st: MoveState, ctx: MoveContext, yaw: number, seconds: number) {
  for (let i = 0; i < seconds / FIXED_DT; i++)
    stepMovement(st, { seq: i, f: 1, s: 0, yaw, pitch: 0, b: 0, slot: 0 }, FIXED_DT, ctx);
}

describe('pueblo', () => {
  const map = getMap('pueblo', 'm');
  const ctx: MoveContext = { colliders: getColliders(map), walk: 7, adsMove: 1, fallback: [0, 0, 0] };

  it('the great stair climbs from the market to the church square', () => {
    const st = createMoveState(0, 0, -3.5);
    walk(st, ctx, YAW.nz, 1.5);
    expect(st.y).toBeCloseTo(4.5, 1);
    expect(st.z).toBeLessThan(-11);
  });

  it('the terrace street is reached from the market by its steps', () => {
    for (const s of [1, -1]) {
      const st = createMoveState(s * 8, 0, 3.5);
      walk(st, ctx, s > 0 ? YAW.px : YAW.nx, 1);
      expect(st.y).toBeCloseTo(1.5, 1);
    }
  });

  it('the alley between the terrace houses is climbed to the azoteas by wall jumping', () => {
    for (const side of [1, -1]) {
      const st = createMoveState(side * 24.1, 1.5, -4.5);
      let dir = 1;
      for (let i = 0; i < 400 && !(st.grounded && st.y > 3); i++) {
        const touching = Math.abs(st.x - side * 24.1) > 1.1 - 0.45;
        const tap = i === 0 || (touching && !st.grounded && i % 4 === 0);
        const ev = stepMovement(
          st,
          { seq: i, f: 0, s: dir, yaw: 0, pitch: 0, b: BTN_JUMP | (tap ? BTN_JUMP_PRESSED : 0), slot: 0 },
          FIXED_DT,
          ctx,
        );
        if (ev.wallJump) dir = -dir;
      }
      expect(st.grounded).toBe(true);
      expect(st.y).toBeCloseTo(ROOF, 1);
    }
  });

  it('the azoteas are joined by arches: A to H to G, and the church first floor to G', () => {
    const st = createMoveState(20, ROOF, -6);
    walk(st, ctx, YAW.nz, 3.6);
    expect(st.z).toBeLessThan(-27);
    expect(st.y).toBeCloseTo(ROOF, 1);
    const ch = createMoveState(-6.5, ROOF, -29.5);
    walk(ch, ctx, YAW.nx, 1.5);
    expect(ch.x).toBeLessThan(-14);
    expect(ch.y).toBeCloseTo(ROOF, 1);
  });

  /** Walks `seconds` and returns the highest floor stood on. */
  const highest = (st: MoveState, yaw: number, seconds: number) => {
    let top = st.y;
    for (let i = 0; i < seconds / FIXED_DT; i++) {
      stepMovement(st, { seq: i, f: 1, s: 0, yaw, pitch: 0, b: 0, slot: 0 }, FIXED_DT, ctx);
      if (st.grounded) top = Math.max(top, st.y);
    }
    return top;
  };
  // Every way up to an azotea (east side, from the first step; the west is its mirror): [name, x, y, z, yaw, top]
  it.each([
    ['A ground floor', 15.1, 2.05, -8.05, YAW.px, 4.5],
    ['A first floor to the roof', 22.05, 5.05, -7.8, YAW.pz, ROOF],
    ['B ground floor', 33, 2.05, -8.05, YAW.nx, 4.5],
    ['B first floor to the roof', 26.15, 5.05, -7.8, YAW.pz, ROOF],
    ['C outside stairs', 13.6, 1.5, 15.65, YAW.px, ROOF],
    ['G to its roof', 14.4, 5.05, -33.05, YAW.px, ROOF],
    ['H outside stairs', 28.65, 4.5, -21.2, YAW.pz, ROOF],
    ['church ground floor', 6.8, 5.05, -37.05, YAW.nx, ROOF],
    ['church first floor to the roof', 6.9, 8.05, -24.95, YAW.nx, 10.5],
  ] as const)('stairs: %s', (_, x, y, z, yaw, top) => {
    const mirror = yaw === YAW.px ? YAW.nx : yaw === YAW.nx ? YAW.px : yaw;
    for (const s of [1, -1])
      expect(highest(createMoveState(s * x, y, z), s > 0 ? yaw : mirror, 2), `side ${s}`).toBeGreaterThan(top - 0.05);
  });
});
