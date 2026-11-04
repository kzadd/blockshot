// Every ladder and zipline of every map can really be used: a player walking at a ladder ends up on top of it,
// and a player jumping under either end of a zipline grabs it and rides it to the other end.
import { describe, expect, it } from 'vitest';
import {
  BTN_JUMP,
  BTN_JUMP_PRESSED,
  FIXED_DT,
  createMoveState,
  stepMovement,
  type MoveContext,
  type MoveInput,
} from '../movement/movement';
import { MAPS, floorBelow, getMap } from './maps';
import { LADDER_DIRS, climbables, liveColliders } from './objects';

// One size per map now; maps without ladders or ziplines (the race course) have nothing to check
const cases = MAPS.map((m) => [m.id, 'm'] as const).filter(([id]) => {
  const map = getMap(id, 'm');
  return map.ladders.length + map.ziplines.length > 0;
});
const ctxOf = (id: string, size: string): MoveContext => {
  const map = getMap(id, size);
  return { colliders: liveColliders(map), walk: 7, adsMove: 0.6, fallback: [0, -100, 0], ...climbables(map) };
};
const input = (seq: number, yaw: number, b = 0): MoveInput => ({ seq, f: 1, s: 0, yaw, pitch: 0.1, b, slot: 0 });

describe.each(cases)('climbing on %s:%s', (id, size) => {
  const map = getMap(id, size);
  const ctx = ctxOf(id, size);

  it.each(map.ladders.map((l, i) => [i, l] as const))('ladder %i takes you to the top', (_, l) => {
    const [dx, dz] = LADDER_DIRS[l.dir]!;
    const st = createMoveState(l.x - dx * 1.5, l.y0, l.z - dz * 1.5);
    const yaw = Math.atan2(-dx, -dz);
    let onTop = false;
    for (let s = 0; s < 420 && !onTop; s++) {
      stepMovement(st, input(s, yaw), FIXED_DT, ctx);
      // On top, or already hanging from the zipline that starts up there
      onTop = (st.grounded && st.y > l.y1 - 1.5) || st.zip >= 0;
    }
    expect(onTop, JSON.stringify(l)).toBe(true);
  });

  it.each(map.ziplines.map((z, i) => [i, z] as const))('zipline %i can be ridden from both ends', (_, line) => {
    for (const [from, to] of [
      [line[0], line[1]],
      [line[1], line[0]],
    ] as const) {
      // Standing on whatever is under this end, looking along the cable, jumping
      const away = [to[0] - from[0], to[2] - from[2]];
      const yaw = Math.atan2(-away[0]!, -away[1]!);
      const sx = from[0];
      const sz = from[2];
      const st = createMoveState(sx, floorBelow(map.boxes, sx, from[1] - 2, sz), sz);
      let grabbed = false;
      for (let s = 0; s < 40 && !grabbed; s++) {
        stepMovement(
          st,
          { ...input(s, yaw, s === 2 ? BTN_JUMP | BTN_JUMP_PRESSED : s < 9 ? BTN_JUMP : 0), f: 0 },
          FIXED_DT,
          ctx,
        );
        grabbed = st.zip >= 0;
      }
      expect(grabbed, `grab at ${JSON.stringify(from)}`).toBe(true);
      for (let s = 0; s < 600 && st.zip >= 0; s++) stepMovement(st, input(s, yaw), FIXED_DT, ctx);
      expect(Math.hypot(st.x - to[0], st.z - to[2]), `ride to ${JSON.stringify(to)}`).toBeLessThan(1.5);
    }
  });
});
