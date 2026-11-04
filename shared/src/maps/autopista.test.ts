// Autopista: the routes onto the motorway deck and up the roofs really work with the player's movement.
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
import { getMap } from './maps';
import { climbables, liveColliders } from './objects';

const map = getMap('autopista', 'm');
const ctx: MoveContext = {
  colliders: liveColliders(map),
  walk: 7,
  adsMove: 1,
  fallback: [0, 0, 0],
  ...climbables(map),
};
/** Yaw that faces the direction (dx, dz). */
const facing = (dx: number, dz: number) => Math.atan2(-dx, -dz);
const input = (seq: number, patch: Partial<MoveInput>): MoveInput => ({
  seq,
  f: 0,
  s: 0,
  yaw: 0,
  pitch: 0,
  b: 0,
  slot: 0,
  ...patch,
});
function walk(st: MoveState, dx: number, dz: number, seconds: number) {
  for (let i = 0; i < seconds / FIXED_DT; i++) stepMovement(st, input(i, { f: 1, yaw: facing(dx, dz) }), FIXED_DT, ctx);
}

describe('autopista', () => {
  it.each([
    ['north-east', 1, -1],
    ['south-west', -1, 1],
  ] as const)('the %s on-ramp climbs onto the deck', (_, sx, sz) => {
    const st = createMoveState(sx * 7, 0, sz * 6);
    walk(st, 0, sz, 3);
    expect(st.y).toBeCloseTo(6, 1);
    walk(st, -sx, 0, 1); // across onto the carriageway
    expect(st.y).toBeCloseTo(6, 1);
    expect(Math.abs(st.x)).toBeLessThan(4.5);
  });

  it('the footbridge leads from the deck into the top floor of the tall block', () => {
    const st = createMoveState(3, 6, -33);
    walk(st, 1, 0, 3);
    expect(st.y).toBeCloseTo(6, 1);
    expect(st.x).toBeGreaterThan(19);
  });

  it('the alley between the south blocks is climbed by wall jumping to the low roof', () => {
    // Alley z 24..26.2 between the low block (roof 6 m, to the north) and the tall one; bounce from wall to wall
    const st = createMoveState(22, 0, 25.1);
    let dir = 1;
    for (let i = 0; i < 400 && !(st.grounded && st.y > 1); i++) {
      const touching = st.z < 24 + 0.45 || st.z > 26.2 - 0.45;
      // (no more taps once above the roof: the bounce has done its job)
      const tap = i === 0 || (touching && !st.grounded && st.y < 6 && i % 4 === 0);
      // Facing west, strafing moves along z
      const ev = stepMovement(
        st,
        input(i, { s: dir, yaw: facing(-1, 0), b: BTN_JUMP | (tap ? BTN_JUMP_PRESSED : 0) }),
        FIXED_DT,
        ctx,
      );
      if (ev.wallJump) dir = -dir;
    }
    expect(st.grounded).toBe(true);
    expect(st.y).toBeCloseTo(6, 1);
  });
});
