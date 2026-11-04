// Estación is built on two levels: every stair between the street and the station, the stairs up the blocks and the
// signal boxes, the wall-jump alleys, the climbs onto the canopies and the walk through the train must really work.
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
import { CANOPY, HALL_ROOF, ROOF, STREET } from './builders/estacion';
import { getColliders, getMap } from './maps';

const YAW = { nz: 0, pz: Math.PI, px: -Math.PI / 2, nx: Math.PI / 2 };
type Dir = keyof typeof YAW;
const map = getMap('estacion', 'm');
const ctx: MoveContext = { colliders: getColliders(map), walk: 7, adsMove: 1, fallback: [0, -100, 0] };

/** The yaw of `dir` on side s (x mirrored on the west). */
const yawOf = (dir: Dir, s: number) => YAW[s > 0 ? dir : dir === 'px' ? 'nx' : dir === 'nx' ? 'px' : dir];

/** Walks (holding jump if `jump`) and returns the highest floor stood on. */
function highest(st: MoveState, yaw: number, seconds: number, jump = false) {
  let top = st.y;
  for (let i = 0; i < seconds / FIXED_DT; i++) {
    const b = jump ? BTN_JUMP | (i % 12 === 0 ? BTN_JUMP_PRESSED : 0) : 0;
    stepMovement(st, { seq: i, f: 1, s: 0, yaw, pitch: 0, b, slot: 0 }, FIXED_DT, ctx);
    if (st.grounded) top = Math.max(top, st.y);
  }
  return top;
}

describe('estacion', () => {
  // Every flight (east side, from its foot; the west is its mirror): [name, x, y, z, dir, top]
  it.each([
    ['grand stair from the north platform to the ticket hall', 0, 1, -14.6, 'nz', STREET],
    ['island up to the footbridge', 16.15, 1, 4.9, 'nz', STREET],
    ['north platform up to the street', 19.4, 1, -14.35, 'px', STREET],
    ['south platform up to the street', 19.4, 1, 14.35, 'px', STREET],
    ['north tunnel end up to the street', 32.6, 0, -14.3, 'px', STREET],
    ['south tunnel end up to the street', 32.6, 0, 14.3, 'px', STREET],
    ['block A, ground floor', 13.9, STREET + 0.55, -35.05, 'px', STREET + 3],
    ['block A, to the roof', 20.1, STREET + 3.55, -25.95, 'nx', ROOF],
    ['block B, ground floor', 30.2, STREET + 0.55, -35.05, 'nx', STREET + 3],
    ['block B, outside stairs', 31.65, STREET + 0.55, -35.1, 'pz', ROOF],
    ['block C, ground floor', 5.9, STREET + 0.55, 33.05, 'px', STREET + 3],
    ['block C, to the roof', 12.1, STREET + 3.55, 24.95, 'nx', ROOF],
    ['block D, ground floor', 22.7, STREET + 0.55, 33.05, 'nx', STREET + 3],
    ['block D, outside stairs', 24.65, STREET + 0.55, 24.7, 'pz', ROOF],
    ['signal box, ground floor', 25.9, 1.55, -2.05, 'px', 4],
    ['signal box, to the roof', 30.1, 4.55, 2.05, 'nx', 7],
  ] as const)('stairs: %s', (_, x, y, z, dir, top) => {
    for (const s of x === 0 ? [1] : [1, -1])
      expect(highest(createMoveState(s * x, y, z), yawOf(dir, s), 2.4), `side ${s}`).toBeGreaterThan(top - 0.05);
  });

  it.each([
    ['north, between blocks A and B', 22.1, -30],
    ['south, between blocks C and D', 14.1, 29],
  ] as const)('the alley %s is climbed to the roofs by wall jumping', (_, ax, z) => {
    for (const side of [1, -1]) {
      const cx = side * ax;
      const st = createMoveState(cx, STREET, z);
      let dir = 1;
      for (let i = 0; i < 400 && !(st.grounded && st.y > STREET + 1); i++) {
        const touching = Math.abs(st.x - cx) > 1.1 - 0.45;
        const tap = i === 0 || (touching && !st.grounded && i % 4 === 0);
        const ev = stepMovement(
          st,
          { seq: i, f: 0, s: dir, yaw: 0, pitch: 0, b: BTN_JUMP | (tap ? BTN_JUMP_PRESSED : 0), slot: 0 },
          FIXED_DT,
          ctx,
        );
        if (ev.wallJump) dir = -dir;
      }
      expect(st.grounded, `side ${side}`).toBe(true);
      expect(st.y, `side ${side}`).toBeCloseTo(ROOF, 1);
    }
  });

  it.each([
    ['from the footbridge onto the island canopy', 14.9, STREET, -3, 'px'],
    ['from the footbridge onto the west part of the island canopy', 13.1, STREET, -3, 'nx'],
    ['from the south street edge onto the side canopy', 4, STREET, 15.8, 'nz'],
    ['from the north street edge onto the side canopy', 20, STREET, -15.8, 'pz'],
  ] as const)('ledge pull: %s', (_, x, y, z, dir) => {
    for (const s of [1, -1])
      expect(highest(createMoveState(s * x, y, z), yawOf(dir, s), 1.5, true), `side ${s}`).toBeCloseTo(CANOPY, 1);
  });

  it('the luggage carts lead onto the train roofs', () => {
    for (const s of [1, -1])
      expect(highest(createMoveState(s * 20.5, 1, 2.6), YAW.pz, 1.5, true), `side ${s}`).toBeGreaterThan(3.45);
  });

  it('the train can be walked through from end to end', () => {
    const st = createMoveState(-28, 0.55, 7);
    let top = 0;
    for (let i = 0; i < 9 / FIXED_DT && st.x < 28; i++) {
      stepMovement(st, { seq: i, f: 1, s: 0, yaw: YAW.px, pitch: 0, b: 0, slot: 0 }, FIXED_DT, ctx);
      top = Math.max(top, st.y);
    }
    expect(st.x).toBeGreaterThan(28);
    expect(top).toBeLessThan(1.2);
  });

  it('a bridge joins block A first floor to the hall roof, which runs out onto the north canopy', () => {
    for (const s of [1, -1]) {
      const st = createMoveState(s * 14, STREET + 3.05, -28);
      highest(st, yawOf('nx', s), 1.2);
      expect(Math.abs(st.x), `side ${s}`).toBeLessThan(8);
      expect(st.y, `side ${s}`).toBeCloseTo(HALL_ROOF, 1);
    }
    const st = createMoveState(0, HALL_ROOF, -22);
    highest(st, YAW.pz, 2);
    expect(st.z).toBeGreaterThan(-12);
    expect(st.y).toBeCloseTo(CANOPY, 1);
  });

  it('the canopies are a high route across the station: a running jump over each track', () => {
    const st = createMoveState(5, CANOPY, -13);
    for (let i = 0; i < 4 / FIXED_DT; i++) {
      // jump at the edge of each canopy (north side → island → south side)
      const edge = (st.z > -8.9 && st.z < -8.6) || (st.z > 5.7 && st.z < 6);
      const b = st.grounded && edge ? BTN_JUMP | BTN_JUMP_PRESSED : 0;
      stepMovement(st, { seq: i, f: 1, s: 0, yaw: YAW.pz, pitch: 0, b, slot: 0 }, FIXED_DT, ctx);
    }
    expect(st.z).toBeGreaterThan(10);
    expect(st.y).toBeCloseTo(CANOPY, 1);
  });
});
