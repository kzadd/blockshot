import { describe, expect, it } from 'vitest';
import { ladderVolume, ZIPLINE } from '../maps/objects';
import { PAD, PLAYER } from '../player/player';
import type { Collider } from '../physics/raycast';
import {
  BTN_CROUCH,
  BTN_JUMP,
  BTN_JUMP_PRESSED,
  BTN_SHOT,
  BTN_SPRINT,
  FIXED_DT,
  createMoveState,
  stepMovement,
  type MoveContext,
  type MoveInput,
  type MoveState,
} from './movement';

const FLOOR: Collider = { c: 'floor', min: [-100, -1, -100], max: [100, 0, 100] };
const WALK = 7;
const ctxWith = (...extra: Collider[]): MoveContext => ({
  colliders: [FLOOR, ...extra],
  walk: WALK,
  adsMove: 0.6,
  fallback: [0, 0, 0],
});
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

function run(st: MoveState, ctx: MoveContext, steps: number, make: (i: number) => MoveInput) {
  const events = [];
  for (let i = 0; i < steps; i++) events.push(stepMovement(st, make(i), FIXED_DT, ctx));
  return events;
}

function grounded(ctx = ctxWith()): MoveState {
  const st = createMoveState(0, 0, 0);
  run(st, ctx, 5, () => input());
  expect(st.grounded).toBe(true);
  return st;
}

describe('movement simulation', () => {
  it('stands on the floor', () => {
    const st = grounded();
    expect(st.y).toBe(0);
    expect(st.vy).toBe(0);
  });

  it('accelerates to walking speed forwards (yaw 0 looks towards -z)', () => {
    const st = grounded();
    run(st, ctxWith(), 60, () => input({ f: 1 }));
    expect(Math.hypot(st.vx, st.vz)).toBeCloseTo(WALK, 1);
    expect(st.z).toBeLessThan(-4);
    expect(Math.abs(st.x)).toBeLessThan(1e-9);
  });

  it('sprints 30 % faster', () => {
    const st = grounded();
    run(st, ctxWith(), 90, () => input({ f: 1, b: BTN_SPRINT }));
    expect(Math.hypot(st.vx, st.vz)).toBeCloseTo(WALK * PLAYER.sprint, 1);
  });

  it('a shot blocks sprinting for a moment', () => {
    const st = grounded();
    run(st, ctxWith(), 60, () => input({ f: 1, b: BTN_SPRINT }));
    stepMovement(st, input({ f: 1, b: BTN_SPRINT | BTN_SHOT }), FIXED_DT, ctxWith());
    expect(st.sprinting).toBe(false);
    run(st, ctxWith(), 30, () => input({ f: 1, b: BTN_SPRINT }));
    expect(st.sprinting).toBe(true);
  });

  it('jumps about jump² / 2g high and lands with an event', () => {
    const st = grounded();
    let top = 0;
    const events = run(st, ctxWith(), 90, (i) => {
      top = Math.max(top, st.y);
      return input({ b: i === 0 ? BTN_JUMP | BTN_JUMP_PRESSED : 0 });
    });
    // Gravity is applied before moving (semi-implicit Euler, like the original), so the apex is a bit lower
    expect(Math.abs(top - (PLAYER.jump * PLAYER.jump) / (2 * PLAYER.gravity))).toBeLessThan(0.1);
    expect(events[0]?.jump).toBe(true);
    expect(st.grounded).toBe(true);
  });

  it('remembers a jump pressed just before landing (jump buffer)', () => {
    const st = createMoveState(0, 1, 0);
    let jumped = false;
    run(st, ctxWith(), 40, (i) => input({ b: i === 10 ? BTN_JUMP_PRESSED : 0 }));
    // press happened in the air ~0.17 s after starting the fall from 1 m: landing comes at ~0.28 s
    jumped = st.vy > 0 || st.y > 0.01;
    expect(jumped).toBe(true);
  });

  it('stops at walls', () => {
    const wall: Collider = { c: 'wall', min: [-5, 0, -3], max: [5, 4, -2] };
    const ctx = ctxWith(wall);
    const st = grounded(ctx);
    run(st, ctx, 120, () => input({ f: 1 }));
    expect(st.z).toBeCloseTo(-2 + PLAYER.radius, 2);
  });

  it('walks up steps of up to stepUp but not higher', () => {
    const low: Collider = { c: 'step', min: [-5, 0, -30], max: [5, 0.5, -2] };
    const ctx = ctxWith(low);
    const st = grounded(ctx);
    run(st, ctx, 60, () => input({ f: 1 }));
    expect(st.y).toBeGreaterThan(0.49);
    const high: Collider = { c: 'crate', min: [-5, 0, -30], max: [5, 0.8, -2] };
    const st2 = grounded(ctxWith(high));
    run(st2, ctxWith(high), 60, () => input({ f: 1 }));
    expect(st2.y).toBe(0);
  });

  it('launches from jump pads', () => {
    const pad: Collider = { c: 'pad', min: [-1, 0, -1], max: [1, PAD.h, 1] };
    const ctx = ctxWith(pad);
    const st = createMoveState(0, 1, 0);
    let top = 0;
    const events = run(st, ctx, 120, () => {
      top = Math.max(top, st.y);
      return input();
    });
    expect(events.some((e) => e.pad)).toBe(true);
    expect(top).toBeGreaterThan(5);
  });

  it('slides with a speed boost and keeps it with slide-hop', () => {
    const st = grounded();
    run(st, ctxWith(), 60, () => input({ f: 1 }));
    const [ev] = run(st, ctxWith(), 1, () => input({ f: 1, b: BTN_CROUCH }));
    expect(ev?.slide).toBe(true);
    expect(Math.hypot(st.vx, st.vz)).toBeGreaterThan(WALK * 1.5);
    expect(st.height).toBe(PLAYER.crouchHeight);
  });

  it('keeps speed while bunny hopping (no ground friction between jumps)', () => {
    const st = grounded();
    run(st, ctxWith(), 60, () => input({ f: 1 }));
    run(st, ctxWith(), 1, () => input({ f: 1, b: BTN_CROUCH }));
    const boosted = Math.hypot(st.vx, st.vz);
    run(st, ctxWith(), 120, () => input({ f: 1, b: BTN_JUMP }));
    expect(Math.hypot(st.vx, st.vz)).toBeGreaterThan(WALK * 1.2);
    expect(Math.hypot(st.vx, st.vz)).toBeLessThanOrEqual(Math.max(boosted, WALK * PLAYER.maxSpeed) + 1e-9);
  });

  it('never exceeds the absolute speed cap', () => {
    const st = grounded();
    for (let k = 0; k < 20; k++) {
      run(st, ctxWith(), 20, (i) =>
        input({ f: 1, s: k % 2 ? 1 : -1, yaw: i * 0.05, b: i < 10 ? BTN_CROUCH : BTN_JUMP }),
      );
      expect(Math.hypot(st.vx, st.vz)).toBeLessThanOrEqual(WALK * PLAYER.maxSpeed + 1e-9);
    }
  });

  it('is deterministic: the same inputs give exactly the same state', () => {
    const script = (i: number) =>
      input({
        seq: i,
        f: 1,
        s: Math.sin(i) > 0 ? 1 : 0,
        yaw: i * 0.013,
        b: i % 37 === 0 ? BTN_JUMP | BTN_JUMP_PRESSED : i % 50 < 10 ? BTN_CROUCH : 0,
      });
    const a = createMoveState(0, 0, 0);
    const b = createMoveState(0, 0, 0);
    run(a, ctxWith(), 600, script);
    run(b, ctxWith(), 600, script);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('puts the player back when falling out of the map', () => {
    const st = createMoveState(0, -19, 0);
    const ctx: MoveContext = { ...ctxWith(), colliders: [], fallback: [3, 1, 4] };
    run(st, ctx, 30, () => input());
    expect(st.x).toBe(3);
    expect(st.z).toBe(4);
  });

  it('climbs a ladder onto the roof holding forward, and down holding back', () => {
    // A block from z -5 to -1, 4 m high; the ladder on its +z face, the climber facing -z
    const block: Collider = { c: 'wall', min: [-3, 0, -5], max: [3, 4, -1] };
    const ladder = ladderVolume({ x: 0, z: -1, y0: 0, y1: 4, dir: 0 });
    const ctx = { ...ctxWith(block), ladders: [ladder] };
    const st = grounded(ctx);
    run(st, ctx, 85, () => input({ f: 1 }));
    expect(st.y).toBeCloseTo(4, 1);
    expect(st.z).toBeLessThan(-1.2);
    // Back down: walk back to the edge and keep going back
    const down = createMoveState(0, 3, -0.7);
    run(down, ctx, 120, () => input({ f: -1 }));
    expect(down.y).toBe(0);
  });

  it('rides a zipline down to its lower end and lets go there', () => {
    const line: [[number, number, number], [number, number, number]] = [
      [0, 8, 0],
      [0, 4, -20],
    ];
    const ctx = { ...ctxWith(), ziplines: [line] };
    // In the air with the hands at the cable, jump held: grabs it
    const st = createMoveState(0, 8 - PLAYER.height - 0.1 - 0.2, -1);
    const ev = run(st, ctx, 1, () => input({ b: BTN_JUMP }));
    expect(ev[0]!.zip).toBe(true);
    expect(st.zip).toBe(0);
    run(st, ctx, 120, () => input());
    expect(st.zip).toBe(-1);
    expect(st.z).toBeLessThan(-19);
    expect(st.y).toBeLessThan(4 - ZIPLINE.hang + 0.5);
  });

  it('lets go of a zipline when jump is pressed again', () => {
    const ctx = {
      ...ctxWith(),
      ziplines: [
        [
          [0, 8, 0],
          [0, 4, -20],
        ],
      ] as [[number, number, number], [number, number, number]][],
    };
    const st = createMoveState(0, 8 - PLAYER.height - 0.3, -1);
    run(st, ctx, 1, () => input({ b: BTN_JUMP }));
    run(st, ctx, 10, () => input());
    run(st, ctx, 1, () => input({ b: BTN_JUMP | BTN_JUMP_PRESSED }));
    expect(st.zip).toBe(-1);
    expect(st.z).toBeGreaterThan(-10);
  });
});
