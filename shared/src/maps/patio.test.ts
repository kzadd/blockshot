// Patio is about its upper ring: the tower stairs reach the lookout, the terraces are reached by stairs and pads,
// every house has stairs to its roof, the walkways join the roofs, and the back alleys and the pavilion alleys are
// climbed by wall jumping.
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
const ROOF = 2 * STORY;
const map = getMap('patio', 'm');
const ctx: MoveContext = { colliders: getColliders(map), walk: 7, adsMove: 1, fallback: [0, 0, 0] };
const mirror = (yaw: number) => (yaw === YAW.px ? YAW.nx : yaw === YAW.nx ? YAW.px : yaw);

function walk(st: MoveState, yaw: number, seconds: number) {
  for (let i = 0; i < seconds / FIXED_DT; i++)
    stepMovement(st, { seq: i, f: 1, s: 0, yaw, pitch: 0, b: 0, slot: 0 }, FIXED_DT, ctx);
}

/** Wall jumps up an alley centred on x = cx (walls on both x sides), from (cx, y, z); returns the state at the end. */
function bounceX(cx: number, y: number, z: number, half = 1.1) {
  const st = createMoveState(cx, y, z);
  let dir = 1;
  for (let i = 0; i < 400 && !(st.grounded && st.y > y + 3); i++) {
    const touching = Math.abs(st.x - cx) > half - 0.45;
    const tap = i === 0 || (touching && !st.grounded && i % 4 === 0);
    const ev = stepMovement(
      st,
      { seq: i, f: 0, s: dir, yaw: 0, pitch: 0, b: BTN_JUMP | (tap ? BTN_JUMP_PRESSED : 0), slot: 0 },
      FIXED_DT,
      ctx,
    );
    if (ev.wallJump) dir = -dir;
  }
  return st;
}

describe('patio', () => {
  it('is mirror-symmetric with the flags on open ground at both ends', () => {
    expect(map.bases[1]).toEqual([-33, 0, 0]);
    expect(map.bases[2]).toEqual([33, 0, 0]);
    expect(map.boxes.length).toBeLessThan(900);
  });

  it.each([1, -1])('the tower stairs (side %i) climb to the lookout, and the first floor opens on the terrace', (s) => {
    // Ground floor: a flight up each side wall climbing north; out of the door onto the terrace
    const st = createMoveState(s * 3.05, 0.5, 1.75);
    walk(st, YAW.nz, 1.5);
    expect(st.y).toBeCloseTo(STORY, 1);
    st.z = -2.6; // in front of the terrace door
    walk(st, s > 0 ? YAW.px : YAW.nx, 1);
    expect(Math.abs(st.x)).toBeGreaterThan(4.5);
    expect(st.y).toBeCloseTo(STORY, 1);
    // First floor: along the south wall climbing east; second floor: along the north wall to the roof
    const up = createMoveState(-1.75, STORY + 0.5, 3.05);
    walk(up, YAW.px, 1.5);
    expect(up.y).toBeCloseTo(2 * STORY, 1);
    const top = createMoveState(1.75, 2 * STORY + 0.5, -3.05);
    walk(top, YAW.nx, 1.5);
    expect(top.y).toBeCloseTo(3 * STORY, 1);
  });

  it.each([1, -1])('the terrace (side %i) is reached by its stairs and by its jump pad', (s) => {
    const st = createMoveState(s * 5.5, 0, -9.5);
    walk(st, YAW.pz, 1.5);
    expect(st.y).toBeCloseTo(STORY, 1);
    const pad = createMoveState(s * 5.5, 0, 9.5);
    walk(pad, YAW.nz, 2);
    expect(pad.y).toBeCloseTo(STORY, 1);
    expect(pad.z).toBeLessThan(5);
  });

  // Every flight up to a roof (east half, from the first step; the west is its mirror): [name, x, y, z, yaw, top]
  it.each([
    ['corner house SE, ground floor', 27.85, 0.5, 36.85, YAW.px, STORY],
    ['corner house SE, to the roof', 36.85, STORY + 0.5, 33.25, YAW.pz, ROOF],
    ['corner house NE, ground floor', 27.85, 0.5, -36.85, YAW.px, STORY],
    ['corner house NE, to the roof', 36.85, STORY + 0.5, -33.25, YAW.nz, ROOF],
    ['gatehouse, ground floor', 29.05, 0.5, -4.15, YAW.pz, STORY],
    ['gatehouse, to the roof', 24.95, STORY + 0.5, 4.15, YAW.nz, ROOF],
    ['north pavilion, ground floor', 3.45, 0.5, -32.05, YAW.px, STORY],
    ['south pavilion, ground floor', 3.05, 0.5, 36.85, YAW.px, STORY],
    ['south pavilion, to the roof (the walkway)', 6.95, STORY + 0.5, 32.45, YAW.nx, ROOF],
  ] as const)('stairs: %s', (_, x, y, z, yaw, top) => {
    for (const s of [1, -1]) {
      // The highest floor stood on (the roofs have no parapet on every side: walking on, you fall off the edge)
      const st = createMoveState(s * x, y, z);
      let high = y;
      for (let i = 0; i < 1.5 / FIXED_DT; i++) {
        stepMovement(
          st,
          { seq: i, f: 1, s: 0, yaw: s > 0 ? yaw : mirror(yaw), pitch: 0, b: 0, slot: 0 },
          FIXED_DT,
          ctx,
        );
        if (st.grounded) high = Math.max(high, st.y);
      }
      expect(high, `side ${s}`).toBeCloseTo(top, 1);
    }
  });

  it('the walkways join the corner roofs all round, and the gatehouse roof bridges to them', () => {
    const north = createMoveState(30, ROOF, -36.4);
    walk(north, YAW.nx, 9.5);
    expect(north.x).toBeLessThan(-27);
    expect(north.y).toBeCloseTo(ROOF, 1);
    const east = createMoveState(36.4, ROOF, -30);
    walk(east, YAW.pz, 9.5);
    expect(east.z).toBeGreaterThan(27);
    expect(east.y).toBeCloseTo(ROOF, 1);
    for (const s of [1, -1]) {
      const gate = createMoveState(s * 28, ROOF, 3.6);
      walk(gate, s > 0 ? YAW.px : YAW.nx, 1.5);
      expect(Math.abs(gate.x)).toBeGreaterThan(35);
      expect(gate.y).toBeCloseTo(ROOF, 1);
    }
  });

  it.each([1, -1])('the back alley behind a corner house (side %i) is climbed to its roof by wall jumping', (s) => {
    const st = bounceX(s * 38.9, 0, -31);
    expect(st.grounded).toBe(true);
    expect(st.y).toBeCloseTo(ROOF, 1);
  });

  it.each([1, -1])('the alley between the pavilions (z side %i) is climbed to a roof by wall jumping', (s) => {
    const st = bounceX(0, 0, s > 0 ? 34 : -30);
    expect(st.grounded).toBe(true);
    expect(st.y).toBeCloseTo(ROOF, 1);
  });
});
