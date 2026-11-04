// Obra is built around climbing: the skeleton's stair cores, the scaffolds, the neighbour block's stairs and the
// plank bridge must be walkable without jumping; the two alleys are climbed by wall jumping and the crane boom is
// reached from the skeleton roof with a ledge pull.
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

const YAW = { nz: 0, pz: Math.PI, px: -Math.PI / 2, nx: Math.PI / 2 };
const mirror = (yaw: number) => (yaw === YAW.px ? YAW.nx : yaw === YAW.nx ? YAW.px : yaw);

describe('obra', () => {
  const map = getMap('obra', 'm');
  const ctx: MoveContext = { colliders: getColliders(map), walk: 7, adsMove: 1, fallback: [0, 0, 0] };

  /** Walks until `until` holds (or `seconds` run out); returns the state. */
  const walk = (st: MoveState, yaw: number, seconds: number, until: (s: MoveState) => boolean = () => false) => {
    for (let i = 0; i < seconds / FIXED_DT && !until(st); i++)
      stepMovement(st, { seq: i, f: 1, s: 0, yaw, pitch: 0, b: 0, slot: 0 }, FIXED_DT, ctx);
    return st;
  };
  /** Walks `seconds` and returns the highest floor stood on. */
  const highest = (st: MoveState, yaw: number, seconds: number) => {
    let top = st.y;
    for (let i = 0; i < seconds / FIXED_DT; i++) {
      stepMovement(st, { seq: i, f: 1, s: 0, yaw, pitch: 0, b: 0, slot: 0 }, FIXED_DT, ctx);
      if (st.grounded) top = Math.max(top, st.y);
    }
    return top;
  };

  it.each([1, -1])('the stair core (side %i) climbs to the open roof, a switchback per story', (s) => {
    // Band A (outer) climbs north on stories 0 and 2, band B (inner) climbs back south on story 1
    const st = createMoveState(s * 7.35, 0, 2.8);
    walk(st, YAW.nz, 2, (q) => q.z < -2.6);
    expect(st.y).toBeCloseTo(STORY, 1);
    st.x = s * 5.85;
    walk(st, YAW.pz, 2, (q) => q.z > 2.6);
    expect(st.y).toBeCloseTo(2 * STORY, 1);
    st.x = s * 7.35;
    walk(st, YAW.nz, 2, (q) => q.z < -2.6);
    expect(st.y).toBeCloseTo(3 * STORY, 1);
  });

  it.each([1, -1])('the scaffold (side %i) climbs to its second deck, level with the second floor', (s) => {
    const st = createMoveState(s * 11.25, 0, 12.2);
    walk(st, YAW.nz, 3, (q) => q.z < 1.6);
    expect(st.y).toBeCloseTo(STORY, 1);
    st.x = s * 11.6;
    walk(st, YAW.nz, 1.5, (q) => q.z < -4);
    expect(st.y).toBeCloseTo(2 * STORY, 1);
    // and onto the skeleton's second floor
    walk(st, s > 0 ? YAW.nx : YAW.px, 1, (q) => Math.abs(q.x) < 8);
    expect(st.y).toBeCloseTo(2 * STORY, 1);
  });

  it('the plank bridge joins the skeleton second floor to the neighbour block roof', () => {
    const st = walk(createMoveState(0, 2 * STORY, 8), YAW.pz, 3, (q) => q.z > 26);
    expect(st.z).toBeGreaterThan(26);
    expect(st.y).toBeCloseTo(2 * STORY, 1);
  });

  // Every flight of stairs, east side from its first step (the west is its mirror): [name, x, y, z, yaw, top]
  it.each([
    ['block ground floor', 3.4, 0.05, 31, YAW.px, STORY],
    ['block first floor to the roof', 3.4, STORY + 0.05, 23, YAW.px, 2 * STORY],
    ['site office ground floor', 25.2, 0.05, -28.55, YAW.px, STORY],
    ['site office outside stairs', 33.9, 0, -23.85, YAW.nx, 2 * STORY],
  ] as const)('stairs: %s', (_, x, y, z, yaw, top) => {
    for (const s of [1, -1])
      expect(highest(createMoveState(s * x, y, z), s > 0 ? yaw : mirror(yaw), 2), `side ${s}`).toBeGreaterThan(
        top - 0.05,
      );
  });

  /** Wall jumps up an alley along z between walls at x0 and x1 (both > 0, mirrored by `side`). */
  const alleyClimb = (side: number, x0: number, x1: number, z: number, minTop: number) => {
    const mid = (x0 + x1) / 2;
    const half = (x1 - x0) / 2;
    const st = createMoveState(side * mid, 0, z);
    let dir = 1;
    for (let i = 0; i < 400 && !(st.grounded && st.y > minTop - 0.5); i++) {
      const touching = Math.abs(st.x - side * mid) > half - 0.45;
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
  };

  it.each([1, -1])('the alley between the block and its containers is climbed by wall jumping (side %i)', (s) => {
    const st = alleyClimb(s, 12, 14.2, 25, 5.2);
    expect(st.grounded).toBe(true);
    expect(st.y).toBeGreaterThan(5.1);
  });

  it.each([1, -1])('the alley by the site office is climbed by wall jumping (side %i)', (s) => {
    const st = alleyClimb(s, 22.3, 24.5, -28.9, 5.2);
    expect(st.grounded).toBe(true);
    expect(st.y).toBeGreaterThan(5.1);
  });

  it('the crane boom is reached from the skeleton roof and walked to the landing on the mast', () => {
    // Under the boom's tip, jumping north while holding jump: a ledge pull onto it
    const st = createMoveState(0, 3 * STORY, -3.5);
    for (let i = 0; i < 120 && !(st.grounded && st.y > 11); i++)
      stepMovement(
        st,
        { seq: i, f: 1, s: 0, yaw: YAW.nz, pitch: 0, b: BTN_JUMP | (i === 10 ? BTN_JUMP_PRESSED : 0), slot: 0 },
        FIXED_DT,
        ctx,
      );
    expect(st.y).toBeCloseTo(12, 1);
    walk(st, YAW.nz, 4, (q) => q.z < -28.5);
    expect(st.y).toBeCloseTo(12, 1);
    expect(st.z).toBeLessThan(-28);
  });
});
