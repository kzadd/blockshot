// Circuito is a race course of movement tricks over lava: every section must be beatable with the real movement.
// A simple runner heads for each waypoint in turn and jumps when the floor ends under it (and holds jump in the
// air, which pulls it up onto ledges), so these tests prove the gaps, the ledges, the zipline, the slide tunnel,
// the jump pads, the long jumps, the wall-jump chimney and the last climb to the finish.
import { describe, expect, it } from 'vitest';
import {
  BTN_CROUCH,
  BTN_JUMP,
  BTN_JUMP_PRESSED,
  BTN_SPRINT,
  FIXED_DT,
  createMoveState,
  stepMovement,
  type MoveContext,
  type MoveState,
} from '../movement/movement';
import { RACE_FALL_Y } from '../modes/modes';
import { floorBelow, getMap } from './maps';
import { climbables, liveColliders } from './objects';

const map = getMap('circuito', 'm');
const ctx: MoveContext = {
  colliders: liveColliders(map),
  walk: 7,
  adsMove: 1,
  fallback: [0, -100, 0],
  ...climbables(map),
};
const solids = [...map.boxes, ...map.tiles];
const facing = (dx: number, dz: number) => Math.atan2(-dx, -dz);
const cps = map.checkpoints;
/** Height of the course slabs over the lava. */
const Y = 4;

interface RunOpts {
  sprint?: boolean;
  /** hold crouch from this x on (moving west) */
  crouchBelowX?: number;
  seconds?: number;
}

/**
 * Runs through the waypoints [x, z] in turn: forward towards the next one, a jump where the floor ends ahead,
 * jump held while in the air (ledge pulls). Stops when it falls into the lava. Returns the final state.
 */
function run(st: MoveState, waypoints: [number, number][], opts: RunOpts = {}): MoveState {
  let i = 0;
  let from: [number, number] = [st.x, st.z];
  for (let s = 0; s < (opts.seconds ?? 12) / FIXED_DT && i < waypoints.length; s++) {
    const [tx, tz] = waypoints[i]!;
    const dx = tx - st.x;
    const dz = tz - st.z;
    // Reached (or passed) this waypoint: on to the next one
    if (st.grounded && (Math.hypot(dx, dz) < 0.8 || dx * (tx - from[0]) + dz * (tz - from[1]) < 0)) {
      from = [tx, tz];
      i++;
      continue;
    }
    const len = Math.hypot(dx, dz);
    const edge =
      st.grounded && floorBelow(solids, st.x + (dx / len) * 0.25, st.y + 0.1, st.z + (dz / len) * 0.25) < st.y - 0.3;
    let b = 0;
    if (edge) b |= BTN_JUMP | BTN_JUMP_PRESSED;
    else if (!st.grounded) b |= BTN_JUMP;
    if (opts.sprint) b |= BTN_SPRINT;
    if (opts.crouchBelowX !== undefined && st.x < opts.crouchBelowX) b |= BTN_CROUCH;
    stepMovement(st, { seq: s, f: 1, s: 0, yaw: facing(dx, dz), pitch: 0, b, slot: 0 }, FIXED_DT, ctx);
    if (st.y < RACE_FALL_Y) break;
  }
  // Let it settle
  for (let s = 0; s < 30; s++) stepMovement(st, { seq: s, f: 0, s: 0, yaw: 0, pitch: 0, b: 0, slot: 0 }, FIXED_DT, ctx);
  return st;
}

const on = (st: MoveState, c: (typeof cps)[number]) =>
  Math.abs(st.x - c.x) <= c.w / 2 && Math.abs(st.z - c.z) <= c.d / 2 && Math.abs(st.y - c.y) < 0.2;

describe('circuito', () => {
  it('has the start, six checkpoints and the finish, each one standing ground over the lava', () => {
    expect(cps.length).toBe(7);
    expect(map.spawns.length).toBeGreaterThanOrEqual(12);
    for (const c of cps) expect(floorBelow(map.boxes, c.x, c.y + 0.1, c.z), JSON.stringify(c)).toBeCloseTo(c.y, 2);
    for (const [, y] of map.spawns) expect(y).toBe(Y);
  });

  it('1 · from the start across the stepping stones and the sweeper slab to CP1', () => {
    const [x, y, z] = map.spawns[4]!;
    const st = run(createMoveState(x, y, z), [
      [-29.5, -28.5],
      [-25.75, -29.2],
      [-18.5, -26.8],
      [-11.5, -29.2],
      [-5, -28],
      [11.5, -28],
    ]);
    expect(on(st, cps[0]!)).toBe(true);
  });

  it('2 · the two ledges pull you up onto the tower, then the zipline takes you down to CP2', () => {
    const st = run(createMoveState(11.5, Y, -28), [
      [30, -28],
      [34, -23.6],
    ]);
    expect(st.y).toBeCloseTo(8.8, 1);
    // Looking south, jump at the cable and ride it down
    let grabbed = false;
    for (let s = 0; s < 400; s++) {
      const b = s < 10 ? BTN_JUMP | (s === 0 ? BTN_JUMP_PRESSED : 0) : 0;
      stepMovement(st, { seq: s, f: 0, s: 0, yaw: facing(0, 1), pitch: 0, b, slot: 0 }, FIXED_DT, ctx);
      grabbed ||= st.zip >= 0;
      if (grabbed && st.zip < 0 && st.grounded) break;
    }
    expect(grabbed).toBe(true);
    expect(on(st, cps[1]!)).toBe(true);
  });

  it('3 · across the dropping tiles and the hammer bridge to CP3, then the slide tunnel', () => {
    const st = run(createMoveState(32, Y, 0), [[cps[2]!.x, 0]]);
    expect(on(st, cps[2]!)).toBe(true);
    run(st, [[3, 0]]);
    expect(st.y).toBe(Y);
    expect(st.x).toBeLessThan(4);
    // Standing up, the tunnel's low roof stops you
    const blocked = run(createMoveState(2, Y, 0), [[-12, 0]], { seconds: 2 });
    expect(blocked.x).toBeGreaterThan(-1.5);
    // Sliding (crouch while running) takes you through it
    const slid = run(createMoveState(4, Y, 0), [[-15, 0]], { crouchBelowX: 0.5, seconds: 3 });
    expect(slid.x).toBeLessThan(-8.5);
    expect(slid.y).toBeCloseTo(Y, 1);
  });

  it('4 · the pusher bridge leads to CP4, and the jump pads over to the south leg (CP5)', () => {
    const st = run(createMoveState(-9, Y, 0), [[-30, 0]]);
    expect(on(st, cps[3]!)).toBe(true);
    const padded = run(createMoveState(-35, Y, -3), [[-35, 30]], { seconds: 5 });
    expect(on(padded, cps[4]!)).toBe(true);
  });

  it('5 · the long jumps: walking jumps for the first three, a sprint for the last one, to CP6', () => {
    const st = run(createMoveState(-33, Y, 28), [
      [-28.5, 28],
      [-21.5, 27],
      [-12.5, 29],
      [-4, 27],
    ]);
    expect(st.y).toBe(Y);
    expect(st.x).toBeGreaterThan(-4.5);
    const walked = run({ ...st }, [[8, 28]]);
    expect(walked.y).toBeLessThan(RACE_FALL_Y);
    const sprinted = run({ ...st }, [[8, 28]], { sprint: true });
    expect(on(sprinted, cps[5]!)).toBe(true);
  });

  it('6 · the chimney is climbed by wall jumping from side to side', () => {
    const st = createMoveState(13, Y, 28);
    let dir = 1;
    for (let i = 0; i < 400 && !(st.grounded && st.y > Y + 1); i++) {
      const touching = Math.abs(st.z - 28) > 1.1 - 0.45;
      const tap = i === 0 || (touching && !st.grounded && i % 4 === 0);
      const ev = stepMovement(
        st,
        { seq: i, f: 0, s: dir, yaw: facing(1, 0), pitch: 0, b: BTN_JUMP | (tap ? BTN_JUMP_PRESSED : 0), slot: 0 },
        FIXED_DT,
        ctx,
      );
      if (ev.wallJump) dir = -dir;
    }
    expect(st.grounded).toBe(true);
    expect(st.y).toBeCloseTo(Y + 6, 1);
  });

  it('7 · over the high islands and up the last ledge to the finish', () => {
    const st = run(createMoveState(16, Y + 6, 28), [
      [23.5, 28],
      [31, 28],
      [36.5, 28],
    ]);
    expect(on(st, cps[6]!)).toBe(true);
  });
});
