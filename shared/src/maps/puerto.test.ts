// Puerto's routes: the gangways and the hold cross the ship, the footbridge joins the offices, the container alleys are
// climbed by wall jumping, a catwalk leads from the containers to the warehouse roof, and every stair goes up.
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
/** Quay, ship's deck (and first floors), container tops, roofs. */
const QUAY = 1;
const DECK = 4;
const STACK = 6.2;
const ROOF = 7;

describe('puerto', () => {
  const map = getMap('puerto', 'm');
  const ctx: MoveContext = { colliders: getColliders(map), walk: 7, adsMove: 1, fallback: [0, 0, 0] };
  const walk = (st: MoveState, yaw: number, seconds: number) => {
    for (let i = 0; i < seconds / FIXED_DT; i++)
      stepMovement(st, { seq: i, f: 1, s: 0, yaw, pitch: 0, b: 0, slot: 0 }, FIXED_DT, ctx);
  };

  it('the gangways climb from both quays onto the deck', () => {
    for (const s of [1, -1]) {
      const st = createMoveState(s * 14, QUAY, -2);
      walk(st, s > 0 ? YAW.nx : YAW.px, 1.6);
      expect(st.y).toBeCloseTo(DECK, 1);
      expect(Math.abs(st.x)).toBeLessThan(4);
    }
  });

  it('the hold is crossed from one channel to the other through the doors in the hull', () => {
    const st = createMoveState(-6.5, 0, -6);
    walk(st, YAW.px, 2.2);
    expect(st.x).toBeGreaterThan(6);
  });

  it('the footbridge joins the first floors of both offices', () => {
    const st = createMoveState(15, DECK, -33);
    walk(st, YAW.nx, 5);
    expect(st.x).toBeLessThan(-14);
    expect(st.y).toBeCloseTo(DECK, 1);
  });

  it('a catwalk leads from the container tops to the warehouse roof', () => {
    for (const s of [1, -1]) {
      const st = createMoveState(s * 20, STACK, -14.5);
      walk(st, YAW.pz, 1.5);
      expect(st.z).toBeGreaterThan(-6);
      expect(st.y).toBeCloseTo(ROOF, 1);
    }
  });

  /** Wall jumps up the alley centred on `c` (x or z), bouncing across it; returns the state when it lands. */
  const alley = (x: number, z: number, across: 'x' | 'z') => {
    const st = createMoveState(x, QUAY, z);
    const c = across === 'x' ? x : z;
    // Strafing right with yaw 0 goes +x; with yaw px (facing +x) it goes +z
    const yaw = across === 'x' ? 0 : YAW.px;
    let dir = 1;
    for (let i = 0; i < 400 && !(st.grounded && st.y > QUAY + 2); i++) {
      const touching = Math.abs((across === 'x' ? st.x : st.z) - c) > 1.1 - 0.45;
      const tap = i === 0 || (touching && !st.grounded && i % 4 === 0);
      const ev = stepMovement(
        st,
        { seq: i, f: 0, s: dir, yaw, pitch: 0, b: BTN_JUMP | (tap ? BTN_JUMP_PRESSED : 0), slot: 0 },
        FIXED_DT,
        ctx,
      );
      if (ev.wallJump) dir = -dir;
    }
    return st;
  };

  it('the north container alleys are climbed to the tops by wall jumping', () => {
    for (const s of [1, -1]) {
      const st = alley(s * 20, -16.9, 'z');
      expect(st.grounded, `side ${s}`).toBe(true);
      expect(st.y).toBeCloseTo(STACK, 1);
    }
  });

  it('the south container alleys are climbed to the tops by wall jumping', () => {
    for (const s of [1, -1]) {
      const st = alley(s * 24.4, 23, 'x');
      expect(st.grounded, `side ${s}`).toBe(true);
      expect(st.y).toBeCloseTo(STACK, 1);
    }
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
  // Every stair (east side, from the first step; the west is its mirror): [name, x, y, z, yaw, top]
  it.each([
    ['office ground floor', 12.9, QUAY + 0.55, -37.05, YAW.px, DECK],
    ['office first floor to the roof', 21.05, DECK + 1.05, -37.1, YAW.pz, ROOF],
    ['warehouse ground floor', 31.05, QUAY + 0.55, -7.25, YAW.pz, DECK],
    ['warehouse first floor to the roof', 31.05, DECK + 0.55, 3.55, YAW.pz, ROOF],
    ['hold up to the deck', 3.8, 0.55, -14.95, YAW.pz, DECK],
    ['shed outside stairs', 38.15, QUAY, 13.6, YAW.pz, DECK],
  ] as const)('stairs: %s', (_, x, y, z, yaw, top) => {
    const mirror = yaw === YAW.px ? YAW.nx : yaw === YAW.nx ? YAW.px : yaw;
    for (const s of [1, -1])
      expect(highest(createMoveState(s * x, y, z), s > 0 ? yaw : mirror, 2), `side ${s}`).toBeGreaterThan(top - 0.05);
  });
});
