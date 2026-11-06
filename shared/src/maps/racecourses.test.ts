// Verbena and Tarta are obstacle courses for the Carrera mode: every leg, from one checkpoint to the next, must be
// beatable with the real movement. Same simple runner as circuito.test.ts: it heads for each waypoint in turn, jumps
// where the floor ends ahead and holds jump in the air (ledge pulls). Hazards are left out (they only knock you).
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
import { RACE_FALL_Y, mapFits } from '../modes/modes';
import { floorBelow, getMap } from './maps';
import { climbables, liveColliders } from './objects';
import type { GameMap, MapId } from './types';

const facing = (dx: number, dz: number) => Math.atan2(-dx, -dz);

function runner(map: GameMap) {
  const ctx: MoveContext = {
    colliders: liveColliders(map),
    walk: 7,
    adsMove: 1,
    fallback: [0, -100, 0],
    ...climbables(map),
  };
  const solids = [...map.boxes, ...map.tiles];
  return (st: MoveState, waypoints: [number, number][], seconds = 15): MoveState => {
    let i = 0;
    let from: [number, number] = [st.x, st.z];
    for (let s = 0; s < seconds / FIXED_DT && i < waypoints.length; s++) {
      const [tx, tz] = waypoints[i]!;
      const dx = tx - st.x;
      const dz = tz - st.z;
      if (st.grounded && (Math.hypot(dx, dz) < 0.8 || dx * (tx - from[0]) + dz * (tz - from[1]) < 0)) {
        from = [tx, tz];
        i++;
        continue;
      }
      const len = Math.hypot(dx, dz);
      const edge =
        st.grounded && floorBelow(solids, st.x + (dx / len) * 0.25, st.y + 0.1, st.z + (dz / len) * 0.25) < st.y - 0.3;
      const b = edge ? BTN_JUMP | BTN_JUMP_PRESSED : st.grounded ? 0 : BTN_JUMP;
      stepMovement(st, { seq: s, f: 1, s: 0, yaw: facing(dx, dz), pitch: 0, b, slot: 0 }, FIXED_DT, ctx);
      if (st.y < RACE_FALL_Y) break;
    }
    for (let s = 0; s < 30; s++)
      stepMovement(st, { seq: s, f: 0, s: 0, yaw: 0, pitch: 0, b: 0, slot: 0 }, FIXED_DT, ctx);
    return st;
  };
}

/** For each leg: the waypoints from the previous checkpoint's centre (or the middle spawn) to the next checkpoint. */
const LEGS: Record<'verbena' | 'tarta', [number, number][][]> = {
  verbena: [
    [
      [-31.2, 22.5],
      [-28.8, 15.5],
      [-31.2, 8.5],
      [-30, 2],
      [-30, -14.5],
    ],
    [[-30, -31.6]],
    [
      [-24, -31.6],
      [21.5, -31.6],
    ],
    [
      [31.5, -31.6],
      [31.5, -22.6],
      [31.9, -15.1],
      [31.1, -7.6],
      [31.5, -0.05],
    ],
    [[31.5, 26]],
    [
      [22, 25],
      [15.7, 27],
      [9.4, 25],
      [-0.35, 26],
    ],
    [
      [0, 16.5],
      [0, 9],
      [0, -0.75],
    ],
  ],
  tarta: [
    [
      [-20, 30],
      [-6.5, 28.5],
      [0.5, 31.5],
      [7.5, 28.5],
      [15, 30],
    ],
    [
      [35, 30],
      [34.5, 20.25],
    ],
    [
      [34.5, 10],
      [21.15, 10],
    ],
    [
      [-5.5, 10],
      [-13, 10.4],
      [-20.5, 9.6],
      [-31, 10],
    ],
    [
      [-33.5, 7],
      [-33.5, 0.25],
      [-31, -10],
      [-18, -10],
      [-4.5, -9],
      [3.5, -11],
      [12, -9],
      [21, -10],
    ],
    [
      [32, -10],
      [33, -25.25],
    ],
    [
      [28, -28],
      [-8, -28],
    ],
    [[-32.75, -28]],
  ],
};

describe.each(Object.keys(LEGS) as ('verbena' | 'tarta')[])('%s', (id) => {
  const map = getMap(id, 'm');
  const cps = map.checkpoints;
  const run = runner(map);
  const on = (st: MoveState, c: (typeof cps)[number]) =>
    Math.abs(st.x - c.x) <= c.w / 2 && Math.abs(st.z - c.z) <= c.d / 2 && Math.abs(st.y - c.y) < 0.2;

  it('is a race course only, with a start for twelve and checkpoints standing on solid ground', () => {
    expect(mapFits(id as MapId, 'race')).toBe(true);
    expect(mapFits(id as MapId, 'ffa')).toBe(false);
    expect(cps.length).toBe(LEGS[id].length);
    expect(map.spawns.length).toBeGreaterThanOrEqual(12);
    expect(map.hazards.length).toBeGreaterThan(8);
    expect(map.tiles.length).toBeGreaterThan(20);
    for (const c of cps) expect(floorBelow(map.boxes, c.x, c.y + 0.1, c.z), JSON.stringify(c)).toBeCloseTo(c.y, 2);
    // Each checkpoint higher than (or level with) the one before: the course climbs to the finish
    for (let i = 1; i < cps.length; i++) expect(cps[i]!.y).toBeGreaterThanOrEqual(cps[i - 1]!.y);
  });

  it.each(LEGS[id].map((w, i) => [i, w] as const))('leg %i reaches the next checkpoint', (i, waypoints) => {
    const [x, y, z] =
      i === 0 ? map.spawns[Math.floor(map.spawns.length / 2)]! : [cps[i - 1]!.x, cps[i - 1]!.y, cps[i - 1]!.z];
    const st = run(createMoveState(x, y, z), waypoints);
    expect(on(st, cps[i]!), `${st.x.toFixed(1)},${st.y.toFixed(1)},${st.z.toFixed(1)}`).toBe(true);
  });
});
