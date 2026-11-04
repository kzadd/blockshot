import { describe, expect, it } from 'vitest';
import { ladderVolume, ZIPLINE } from '../maps/objects';
import { PAD, PLAYER, staminaMult } from '../player/player';
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

  it('powerslides: turning the view while sliding turns the slide, keeping the speed of a straight one', () => {
    const slide = (turnTo: number) => {
      const st = grounded();
      run(st, ctxWith(), 60, () => input({ f: 1 }));
      run(st, ctxWith(), 1, () => input({ f: 1, b: BTN_CROUCH }));
      run(st, ctxWith(), 24, () => input({ f: 1, yaw: turnTo, b: BTN_CROUCH }));
      expect(st.sliding).toBe(true);
      return st;
    };
    const straight = slide(0);
    const turned = slide(Math.PI / 2); // now looking towards -x
    expect(turned.vx).toBeLessThan(-0.95 * Math.hypot(turned.vx, turned.vz));
    expect(Math.hypot(turned.vx, turned.vz)).toBeCloseTo(Math.hypot(straight.vx, straight.vz), 1);
  });

  it('air control: holding only forward turns the jump towards the view; a strafe key strafe jumps instead', () => {
    const jumpAndTurn = (s: number) => {
      const st = grounded();
      run(st, ctxWith(), 60, () => input({ f: 1 }));
      run(st, ctxWith(), 1, () => input({ f: 1, b: BTN_JUMP | BTN_JUMP_PRESSED }));
      // turn the view 90° to the left (towards -x) over a third of a second
      run(st, ctxWith(), 40, (i) => input({ f: 1, s, yaw: (Math.min(1, i / 20) * Math.PI) / 2 }));
      return st;
    };
    const w = jumpAndTurn(0);
    expect(w.vx).toBeLessThan(-0.95 * Math.hypot(w.vx, w.vz));
    // W + A keeps most of the old heading (it gains speed instead)
    const wa = jumpAndTurn(-1);
    expect(Math.abs(wa.vz)).toBeGreaterThan(Math.abs(w.vz) + 2);
  });

  it('a long bunny hop barely tires you (stamina recovers in the air), a slide still costs', () => {
    const st = grounded();
    // 20 s of hopping forward: about 27 jumps
    const ev = run(st, ctxWith(), 20 * 60, () => input({ f: 1, b: BTN_JUMP }));
    expect(ev.filter((e) => e.jump).length).toBeGreaterThan(20);
    expect(st.stamina).toBeGreaterThan(PLAYER.stamina - 25);
    expect(st.staminaLock).toBe(false);
    run(st, ctxWith(), 70, () => input({ f: 1 }));
    const before = st.stamina;
    expect(run(st, ctxWith(), 1, () => input({ f: 1, b: BTN_CROUCH }))[0]!.slide).toBe(true);
    expect(st.stamina).toBeCloseTo(before - PLAYER.slideCost, 0);
  });

  it('a heavy weapon tires more: sprint, jumps and wall jumps cost ×1/weight (a bunny hop is still sustainable)', () => {
    const heavy = { ...ctxWith(), staminaMult: staminaMult(0.8) }; // ×1.25
    // Sprinting one second
    const light = grounded();
    const loaded = grounded();
    run(light, ctxWith(), 60, () => input({ f: 1, b: BTN_SPRINT }));
    run(loaded, heavy, 60, () => input({ f: 1, b: BTN_SPRINT }));
    const drained = (st: MoveState) => PLAYER.stamina - st.stamina;
    expect(drained(loaded)).toBeCloseTo(drained(light) * 1.25, 0);
    expect(drained(loaded)).toBeGreaterThan(drained(light));
    // One jump
    const jumper = grounded();
    run(jumper, heavy, 1, () => input({ b: BTN_JUMP | BTN_JUMP_PRESSED }));
    expect(jumper.stamina).toBeCloseTo(PLAYER.stamina - PLAYER.jumpCost * 1.25);
    // 20 s of hopping with the heavy weapon: still about as many jumps, never exhausted
    const hopper = grounded(heavy);
    const ev = run(hopper, heavy, 20 * 60, () => input({ f: 1, b: BTN_JUMP }));
    expect(ev.filter((e) => e.jump).length).toBeGreaterThan(20);
    expect(hopper.staminaLock).toBe(false);
    // (the light hop keeps above stamina − 25; this one, the heaviest case, spends more but never runs dry)
    expect(hopper.stamina).toBeGreaterThan(PLAYER.stamina - 45);
  });

  it('exhausted (out of stamina) you move slower until rested', () => {
    const st = grounded();
    st.stamina = 0;
    st.staminaLock = true;
    run(st, ctxWith(), 60, () => input({ f: 1 }));
    expect(Math.hypot(st.vx, st.vz)).toBeCloseTo(WALK * PLAYER.tiredSpeed, 1);
    // Rested back to staminaMin: full speed again
    st.stamina = PLAYER.staminaMin;
    run(st, ctxWith(), 60, () => input({ f: 1 }));
    expect(Math.hypot(st.vx, st.vz)).toBeCloseTo(WALK, 1);
    // Spending the last stamina on a jump leaves you exhausted
    const tired = grounded();
    tired.stamina = PLAYER.jumpCost + 1;
    run(tired, ctxWith(), 1, () => input({ b: BTN_JUMP | BTN_JUMP_PRESSED }));
    expect(tired.staminaLock).toBe(true);
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
    run(st, ctx, 110, () => input({ f: 1 }));
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
    st.vy = 3; // on the way up
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
    st.vy = 3;
    run(st, ctx, 1, () => input({ b: BTN_JUMP }));
    run(st, ctx, 10, () => input());
    run(st, ctx, 1, () => input({ b: BTN_JUMP | BTN_JUMP_PRESSED }));
    expect(st.zip).toBe(-1);
    expect(st.z).toBeGreaterThan(-10);
  });

  it('rides a zipline both ways: from its low end, looking up the cable, it climbs to the high end', () => {
    const line: [[number, number, number], [number, number, number]] = [
      [0, 8, 0],
      [0, 4, -20],
    ];
    const ctx = { ...ctxWith(), ziplines: [line] };
    // Jumping under the low end (z = -20), looking towards +z (yaw π): no button needed to grab it
    const st = createMoveState(0, 4 - PLAYER.height - 0.3, -20);
    st.vy = 3;
    const ev = run(st, ctx, 1, () => input({ yaw: Math.PI, b: BTN_JUMP }));
    expect(ev[0]!.zip).toBe(true);
    for (let i = 0; i < 120 && st.zip >= 0; i++) run(st, ctx, 1, () => input({ yaw: Math.PI }));
    expect(st.zip).toBe(-1);
    expect(st.z).toBeGreaterThan(-1);
    expect(st.y).toBeGreaterThan(8 - ZIPLINE.hang - 0.5);
  });

  it('jumps off a wall in the air (Urban Terror style), alternating between two walls, a limited number of times', () => {
    // An alley: a wall to the east (+x) of a player in the air, close to it, and another one to the west
    const east: Collider = { c: 'wall', min: [0.4, 0, -5], max: [1.4, 20, 5] };
    const west: Collider = { c: 'wall', min: [-4.4, 0, -5], max: [-3.4, 20, 5] };
    const ctx = ctxWith(east, west);
    const st = createMoveState(0, 2, 0);
    const jumpAt = (x: number) => {
      st.x = x;
      st.vy = -1;
      st.wallJumpCd = 0;
      return run(st, ctx, 1, () => input({ b: BTN_JUMP | BTN_JUMP_PRESSED }))[0]!.wallJump;
    };
    expect(jumpAt(0)).toBe(true);
    expect(st.vx).toBeLessThan(-PLAYER.wallJumpPush + 1); // pushed away to the west
    expect(st.vy).toBeGreaterThan(PLAYER.wallJumpUp - 1);
    // Never twice off the same wall
    expect(jumpAt(0)).toBe(false);
    // Bouncing between the two: no more than PLAYER.wallJumps before landing
    let jumps = 1;
    for (let i = 0; i < 10; i++) if (jumpAt(i % 2 === 0 ? -3 : 0)) jumps++;
    expect(jumps).toBe(PLAYER.wallJumps);
  });

  it('a wall jump is a diagonal bounce (Urban Terror): mostly up, the run along the wall kept, a small push off it', () => {
    const east: Collider = { c: 'wall', min: [0.4, 0, -10], max: [1.4, 20, 10] };
    const st = createMoveState(0, 2, 0);
    st.vz = -7; // running north along the wall
    st.vy = -1;
    // holding forward, looking north-east (half into the wall, half along it)
    const ev = run(st, ctxWith(east), 1, () => input({ f: 1, yaw: -Math.PI / 4, b: BTN_JUMP | BTN_JUMP_PRESSED }))[0]!;
    expect(ev.wallJump).toBe(true);
    expect(st.vz).toBeLessThan(-7); // the run along the wall is kept, plus a push the way you steer
    expect(st.vx).toBeLessThan(-PLAYER.wallJumpPush + 0.5); // off the wall, but only the push
    expect(st.vx).toBeGreaterThan(-PLAYER.wallJumpPush - 0.5);
    expect(st.vy).toBeGreaterThan(-2 * st.vx); // much more up than out
  });

  it('climbs an alley of the maps (parkour.ts) by wall jumping from side to side, not off one wall', () => {
    // Two 6.5 m blocks 2.2 m apart, east and west of the player
    const H = 6.5;
    const east: Collider = { c: 'wall', min: [1.1, 0, -1.5], max: [3.3, H, 1.5] };
    const west: Collider = { c: 'wall', min: [-3.3, 0, -1.5], max: [-1.1, H, 1.5] };
    // Holding jump, tap it again on touching a wall. 'switch': strafe (A / D) towards the wall you are flying to;
    // 'hold': keep D held all the way (the bounce still carries you across); 'east': only ever the east wall
    const climb = (how: 'switch' | 'hold' | 'east') => {
      const ctx = ctxWith(east, west);
      const st = grounded(ctx);
      let dir = 1;
      for (let i = 0; i < 300 && !(st.grounded && st.y > 1); i++) {
        const touching = how === 'east' ? st.x > 1.1 - 0.45 : Math.abs(st.x) > 1.1 - 0.45;
        const tap = i === 0 || (touching && !st.grounded && i % 4 === 0);
        const ev = stepMovement(st, input({ s: dir, b: BTN_JUMP | (tap ? BTN_JUMP_PRESSED : 0) }), FIXED_DT, ctx);
        if (ev.wallJump && how === 'switch') dir = -dir;
      }
      return st;
    };
    for (const how of ['switch', 'hold'] as const) {
      const up = climb(how);
      expect(up.grounded, how).toBe(true);
      expect(up.y, how).toBeCloseTo(H, 1);
    }
    expect(climb('east').y).toBeLessThan(H - 2); // one wall alone never takes you to the roof
  });

  it('jumps cost stamina: wall jumps need it, and a tired jump is lower', () => {
    const wall: Collider = { c: 'wall', min: [0.4, 0, -5], max: [1.4, 20, 5] };
    const ctx = ctxWith(wall);
    const st = createMoveState(0, 2, 0);
    st.vy = -1;
    st.stamina = PLAYER.wallJumpCost - 1;
    expect(run(st, ctx, 1, () => input({ b: BTN_JUMP | BTN_JUMP_PRESSED }))[0]!.wallJump).toBe(false);
    const fresh = grounded();
    run(fresh, ctxWith(), 1, () => input({ b: BTN_JUMP | BTN_JUMP_PRESSED }));
    expect(fresh.stamina).toBe(PLAYER.stamina - PLAYER.jumpCost);
    const tired = grounded();
    tired.stamina = 0;
    run(tired, ctxWith(), 1, () => input({ b: BTN_JUMP | BTN_JUMP_PRESSED }));
    expect(tired.vy).toBeLessThan(fresh.vy);
  });

  it('wall jumps round a corner: off one wall, the next press finds the other one', () => {
    // A corner: a wall to the east (+x) and one to the north (-z), both touching
    const east: Collider = { c: 'wall', min: [0.4, 0, -5], max: [1.4, 20, 5] };
    const north: Collider = { c: 'wall', min: [-5, 0, -1.4], max: [5, 20, -0.4] };
    const st = createMoveState(0, 2, 0);
    st.vy = -1;
    // Just jumped off the east wall
    [st.wallNx, st.wallNz] = [-1, 0];
    st.wallJumps = PLAYER.wallJumps - 1;
    expect(run(st, ctxWith(east, north), 1, () => input({ b: BTN_JUMP | BTN_JUMP_PRESSED }))[0]!.wallJump).toBe(true);
    expect(st.wallNz).toBe(1); // the north wall's normal
    expect(st.vz).toBeGreaterThan(0); // off the north wall
  });

  it('on a ladder (holding forward) a jump press is no wall jump: nothing is spent', () => {
    const block: Collider = { c: 'wall', min: [-3, 0, -5], max: [3, 4, -1] };
    const ladder = ladderVolume({ x: 0, z: -1, y0: 0, y1: 4, dir: 0 });
    const ctx = { ...ctxWith(block), ladders: [ladder] };
    const st = createMoveState(0, 1, -0.7);
    st.vy = -1;
    const ev = run(st, ctx, 1, () => input({ f: 1, b: BTN_JUMP | BTN_JUMP_PRESSED }))[0]!;
    expect(ev.wallJump).toBe(false);
    expect([st.stamina, st.wallJumps, st.wallJumpCd]).toEqual([PLAYER.stamina, PLAYER.wallJumps, 0]);
    expect(st.climbing).toBe(true);
  });

  it('with a heavy weapon, too little left for one (heavier) jump already means exhausted', () => {
    const heavy = { ...ctxWith(), staminaMult: staminaMult(0.8) }; // a jump costs jumpCost × 1.25
    const st = grounded(heavy);
    st.stamina = PLAYER.jumpCost * 1.25 + PLAYER.jumpCost + 0.5; // after one jump: between jumpCost and its ×1.25
    run(st, heavy, 1, () => input({ b: BTN_JUMP | BTN_JUMP_PRESSED }));
    expect(st.stamina).toBeGreaterThan(PLAYER.jumpCost);
    expect(st.stamina).toBeLessThan(PLAYER.jumpCost * 1.25);
    expect(st.staminaLock).toBe(true);
  });

  it('pulls itself up onto a ledge within reach when jumping at it', () => {
    // A 2.2 m block ahead (towards -z): too high for a plain jump (1.6 m), within the ledge reach
    const block: Collider = { c: 'wall', min: [-3, 0, -6], max: [3, 2.2, -1] };
    const ctx = ctxWith(block);
    const st = grounded(ctx);
    run(st, ctx, 90, (i) => input({ f: 1, b: i === 10 ? BTN_JUMP | BTN_JUMP_PRESSED : i < 40 ? BTN_JUMP : 0 }));
    expect(st.y).toBeCloseTo(2.2, 1);
    expect(st.z).toBeLessThan(-1.2);
  });
});
