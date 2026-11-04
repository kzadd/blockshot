// Nevada: the routes up are real. The clefts through the ridge and the gap between the lodge and its cabins are
// climbed by wall jumping from side to side, the ridge by its ledges and rock steps, the lodge and the cabins by
// their stairs. (Ladders and ziplines are checked for every map in climb.test.ts.)
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
import { ALLEY_W, CLEFT_W, CLEFT_X, LODGE_HALF_W, RIDGE, ROOF } from './builders/nevada';
import { getColliders, getMap } from './maps';

const map = getMap('nevada', 'm');
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
const YAW = { nz: 0, pz: Math.PI, px: -Math.PI / 2, nx: Math.PI / 2 };
const flip = (yaw: number) => (yaw === YAW.px ? YAW.nx : yaw === YAW.nx ? YAW.px : yaw);

/** Wall jumps up a gap running along z between walls at x = x0 and x = x1 (strafing to the next wall). */
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

/** Walks (jumping when `jump`) for `seconds`, returns the highest floor stood on. */
function highest(st: MoveState, yaw: number, seconds: number, jump = false): number {
  let top = st.y;
  for (let i = 0; i < seconds / FIXED_DT; i++) {
    const b = jump ? BTN_JUMP | (i % 15 === 0 ? BTN_JUMP_PRESSED : 0) : 0;
    stepMovement(st, input({ f: 1, yaw, b }), FIXED_DT, ctx);
    if (st.grounded) top = Math.max(top, st.y);
  }
  return top;
}

describe('nevada', () => {
  it('stays under the box budget and is mirror-symmetric', () => {
    expect(map.boxes.length).toBeLessThan(900);
    const key = (x: number, y: number, z: number, w: number, h: number, d: number) => `${x},${y},${z},${w},${h},${d}`;
    const all = new Set(map.boxes.map((b) => key(b.x, b.y, b.z, b.w, b.h, b.d)));
    for (const b of map.boxes) expect(all.has(key(-b.x || 0, b.y, b.z, b.w, b.h, b.d)), JSON.stringify(b)).toBe(true);
    expect(map.spawns.length).toBeGreaterThanOrEqual(16);
    expect(map.bases[1][0]).toBeCloseTo(-map.bases[2][0]);
  });

  it.each([
    ['cleft through the ridge', CLEFT_X, CLEFT_X + CLEFT_W, -34, RIDGE],
    ['gap between the lodge and its cabin', LODGE_HALF_W, LODGE_HALF_W + ALLEY_W, 26.5, ROOF],
  ])('the %s is climbed by wall jumps to the top', (_, x0, x1, z, top) => {
    for (const s of [1, -1]) {
      const [a, b] = s > 0 ? [x0, x1] : [-x1, -x0];
      const st = climbAlley(a, b, z);
      expect(st.grounded, `side ${s}`).toBe(true);
      expect(st.y, `side ${s}`).toBeCloseTo(top, 1);
    }
  });

  it('the middle of the ridge is climbed by its boulder and ledge, up to the radio hut', () => {
    expect(highest(createMoveState(0, 0, -23), YAW.nz, 4, true)).toBeCloseTo(RIDGE, 1);
  });

  it('the side ridge is climbed by its boulder and ledge, and by the rock steps from the base', () => {
    for (const s of [1, -1]) {
      expect(highest(createMoveState(s * 19.5, 0, -25), YAW.nz, 4, true), `ledges ${s}`).toBeCloseTo(RIDGE, 1);
      expect(highest(createMoveState(s * 35.25, 0, -25), YAW.nz, 2), `steps ${s}`).toBeCloseTo(RIDGE, 1);
    }
  });

  // Every flight of stairs (east side, from the first step; the west is its mirror): [name, x, y, z, yaw, top]
  it.each([
    ['lodge ground floor', 7.45, 0.05, 31.05, YAW.nx, 3],
    ['lodge first floor to the roof', 7.45, 3.05, 22.95, YAW.nx, ROOF],
    ['cabin ground floor', 12.3, 0.55, 29.05, YAW.px, 3],
    ['cabin first floor to the roof', 16.9, 3.55, 22.95, YAW.nx, ROOF],
    ['small cabin outside stairs', 22.05, 0, 19.45, YAW.px, 3],
  ] as const)('stairs: %s', (_, x, y, z, yaw, top) => {
    for (const s of [1, -1])
      expect(highest(createMoveState(s * x, y, z), s > 0 ? yaw : flip(yaw), 2), `side ${s}`).toBeGreaterThan(
        top - 0.05,
      );
  });
});
