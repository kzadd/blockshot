// Casco Viejo is about climbing: the clock tower stairs reach the lookout, the gatehouse stairs reach its roof,
// the planks join the roofs, and the alleys between the north rows are climbed by wall jumping.
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
import { STORY } from './structures';

const YAW = { px: -Math.PI / 2, nx: Math.PI / 2, pz: Math.PI, nz: 0 };
const map = getMap('ciudad', 'm');
const ctx: MoveContext = { colliders: getColliders(map), walk: 7, adsMove: 1, fallback: [0, 0, 0] };

function walk(st: MoveState, yaw: number, seconds: number) {
  for (let i = 0; i < seconds / FIXED_DT; i++)
    stepMovement(st, { seq: i, f: 1, s: 0, yaw, pitch: 0, b: 0, slot: 0 }, FIXED_DT, ctx);
}

describe('ciudad', () => {
  it('the clock tower stairs climb to the lookout', () => {
    // Story 0: north flight climbing east; story 1: south flight climbing west; story 2: north flight to the roof
    const st = createMoveState(-2, 0.5, -2.05);
    walk(st, YAW.px, 1.5);
    expect(st.y).toBeCloseTo(STORY, 1);
    walk(st, YAW.pz, 1);
    walk(st, YAW.nx, 1.5);
    expect(st.y).toBeCloseTo(2 * STORY, 1);
    walk(st, YAW.nz, 1);
    walk(st, YAW.px, 1.5);
    expect(st.y).toBeCloseTo(3 * STORY, 1);
  });

  it.each([1, -1])('the gatehouse stairs (side %i) reach its roof, and a plank leads to the next one', (s) => {
    // East half: flight along the east wall climbing north → south, then the west one climbing back north
    const st = createMoveState(s * 6.05, 0.5, -24.8);
    walk(st, YAW.pz, 1);
    expect(st.y).toBeCloseTo(STORY, 1);
    st.x = s * 2.95;
    st.z = -14.8;
    walk(st, YAW.nz, 1);
    expect(st.y).toBeCloseTo(2 * STORY, 1);
    // From the roof edge over the lane: across the plank onto the north house
    st.x = s * 6.5;
    st.z = -24;
    st.vx = st.vz = 0; // teleported: without the momentum of the last walk
    walk(st, s > 0 ? YAW.px : YAW.nx, 1);
    expect(Math.abs(st.x)).toBeGreaterThan(12);
    expect(st.y).toBeCloseTo(2 * STORY, 1);
  });

  // Each flight: start on its first step (east half), the way it climbs, the floor it reaches
  const flights: [string, number, number, number, keyof typeof YAW, number][] = [
    ['north house, ground floor', 23.05, 0.5, -24.35, 'pz', STORY],
    ['north house, to the roof', 12.45, STORY + 0.5, -16.9, 'nz', 2 * STORY],
    ['base house, ground floor', 39.05, 0.5, -25.35, 'pz', STORY],
    ['base house, to the roof', 39.05, STORY + 0.5, -13.8, 'nz', 2 * STORY],
    ['café house, ground floor', 13.05, 0.5, 11.55, 'px', STORY],
    ['café house, to the roof', 22.45, STORY + 0.5, 4.45, 'nx', 2 * STORY],
  ];
  it.each(
    flights.flatMap(([name, ...f]) => [1, -1].map((s) => [`${name}, ${s > 0 ? 'east' : 'west'}`, ...f, s] as const)),
  )('stairs: %s', (_, x, y, z, dir, top, s) => {
    const st = createMoveState(s * x, y, z);
    const yaw = s > 0 || (dir !== 'px' && dir !== 'nx') ? YAW[dir] : YAW[dir === 'px' ? 'nx' : 'px'];
    walk(st, yaw, 1.2);
    expect(st.y).toBeCloseTo(top, 1);
  });

  it('an alley between the north rows is climbed by wall jumping from side to side', () => {
    // Alley x 7..9.2 between two 6 m roofs; looking north, strafing towards the wall you fly to
    const st = createMoveState(8.1, 0, -36);
    let dir = 1;
    for (let i = 0; i < 300 && !(st.grounded && st.y > 1); i++) {
      const touching = Math.abs(st.x - 8.1) > 1.1 - 0.45;
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
    expect(st.y).toBeCloseTo(2 * STORY, 1);
  });
});
