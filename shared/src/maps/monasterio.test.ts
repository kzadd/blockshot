// Monasterio: the routes up are real. The two narrow passages (church / refectory, granary / barn) are climbed by
// wall jumping from side to side, and the stairs to the cloister's upper gallery and up the bell tower are walked.
import { describe, expect, it } from 'vitest';
import {
  BTN_JUMP,
  BTN_JUMP_PRESSED,
  FIXED_DT,
  createMoveState,
  stepMovement,
  type MoveContext,
  type MoveInput,
  type MoveState,
} from '../movement/movement';
import { getColliders, getMap } from './maps';
import { STORY } from './structures';

const map = getMap('monasterio', 'm');
const ctx: MoveContext = { colliders: getColliders(map), walk: 7, adsMove: 1, fallback: [0, 0, 0] };
const input = (patch: Partial<MoveInput> = {}): MoveInput => ({
  seq: 0,
  f: 0,
  s: 0,
  yaw: 0,
  pitch: 0,
  b: 0,
  slot: 0,
  ...patch,
});
const YAW = { nz: 0, pz: Math.PI };

function walk(st: MoveState, yaw: number, seconds: number) {
  for (let i = 0; i < seconds / FIXED_DT; i++) stepMovement(st, input({ f: 1, yaw }), FIXED_DT, ctx);
}

/** Wall jumps up an alley running along z between walls at x = x0 and x = x1 (strafing to the next wall). */
function climbAlley(x0: number, x1: number, z: number): MoveState {
  const st = createMoveState((x0 + x1) / 2, 0, z);
  for (let i = 0; i < 10; i++) stepMovement(st, input(), FIXED_DT, ctx);
  let dir = 1;
  for (let i = 0; i < 400 && !(st.grounded && st.y > 1); i++) {
    const touching = st.x > x1 - 0.45 || st.x < x0 + 0.45;
    const tap = i === 0 || (touching && !st.grounded && i % 4 === 0);
    const ev = stepMovement(st, input({ s: dir, b: BTN_JUMP | (tap ? BTN_JUMP_PRESSED : 0) }), FIXED_DT, ctx);
    if (ev.wallJump) dir = -dir;
  }
  return st;
}

describe('monasterio', () => {
  it('stays under the box budget and is mirror-symmetric (but for the bell tower stairs)', () => {
    expect(map.boxes.length).toBeLessThan(900);
    const key = (x: number, y: number, z: number, w: number, h: number, d: number) => `${x},${y},${z},${w},${h},${d}`;
    const all = new Set(map.boxes.map((b) => key(b.x, b.y, b.z, b.w, b.h, b.d)));
    const tower = (b: { x: number; z: number }) => Math.abs(b.x) < 3 && b.z > -26 && b.z < -20;
    for (const b of map.boxes.filter((q) => !tower(q)))
      expect(all.has(key(-b.x || 0, b.y, b.z, b.w, b.h, b.d)), JSON.stringify(b)).toBe(true);
  });

  it.each([
    ['church / refectory', 14, 16.2, -33],
    ['granary / barn', 17.8, 20, 26],
  ])('the %s passage is climbed by wall jumps to a roof', (_, x0, x1, z) => {
    for (const s of [1, -1]) {
      const [a, b] = s > 0 ? [x0, x1] : [-x1, -x0];
      const st = climbAlley(a, b, z);
      expect(st.grounded).toBe(true);
      expect(st.y).toBeGreaterThan(2 * STORY - 0.1);
    }
  });

  it('the cloister stairs climb to the upper gallery', () => {
    const st = createMoveState(12.05, 0, 2.5);
    walk(st, YAW.nz, 1.2);
    expect(st.y).toBeCloseTo(STORY, 1);
  });

  it('the bell tower stairs climb from the cloister to the upper gallery door and the church roof', () => {
    // First flight (east wall, climbing south), out of the south door onto the upper gallery
    const st = createMoveState(2.05, 0.5, -25.1);
    walk(st, YAW.pz, 1.2);
    expect(st.y).toBeCloseTo(STORY, 1);
    // Second flight (west wall, climbing north) to the belfry, out of its north door onto the church roof
    const up = createMoveState(-2.05, STORY + 0.5, -20.9);
    walk(up, YAW.nz, 1.2);
    expect(up.y).toBeCloseTo(2 * STORY, 1);
    up.x = 0;
    walk(up, YAW.nz, 1);
    expect(up.z).toBeLessThan(-27);
    expect(up.y).toBeCloseTo(2 * STORY, 1);
  });
});
