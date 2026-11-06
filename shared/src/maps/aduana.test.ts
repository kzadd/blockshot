// Aduana (built for Bomba): Red spawns west and Blue east, the two sites sit on Blue's half (A north in the loading
// yard, B south in the warehouse), the dock is walked up and no Red spawn sees a site.
import { describe, expect, it } from 'vitest';
import { FIXED_DT, createMoveState, stepMovement, type MoveContext } from '../movement/movement';
import { rayAABB } from '../physics/raycast';
import { PLAYER } from '../player/player';
import { bombSites } from '../modes/domination';
import { getColliders, getMap } from './maps';

const map = getMap('aduana', 'm');
const cols = getColliders(map);

describe('aduana', () => {
  it('Red spawns at the west end, Blue at the east end, twelve each', () => {
    expect(map.spawns.filter((s) => s[0] < -28)).toHaveLength(12);
    expect(map.spawns.filter((s) => s[0] > 28)).toHaveLength(12);
    expect(map.spawns).toHaveLength(24);
  });

  it('site A is the loading yard (north) and site B the warehouse (south), both on Blue’s half', () => {
    const [a, b] = bombSites(map);
    expect(a).toEqual([20, 0, -20]);
    expect(b).toEqual([20, 0, 20]);
    // B is under the warehouse roof
    expect(cols.some((c) => c.c === 'roof' && c.min[0] < 20 && c.max[0] > 20 && c.min[2] < 20 && c.max[2] > 20)).toBe(
      true,
    );
  });

  it('no Red spawn sees a bomb site', () => {
    for (const [sx, sy, sz] of map.spawns.filter((s) => s[0] < 0)) {
      for (const [x, y, z] of bombSites(map)) {
        const o: [number, number, number] = [sx, sy + PLAYER.eye, sz];
        const d = [x - sx, y + 1 - o[1], z - sz];
        const len = Math.hypot(d[0]!, d[1]!, d[2]!);
        const dir: [number, number, number] = [d[0]! / len, d[1]! / len, d[2]! / len];
        expect(Math.min(...cols.map((c) => rayAABB(o, dir, c.min, c.max)))).toBeLessThan(len);
      }
    }
  });

  it('the dock steps take a player up onto the dock of site A', () => {
    const ctx: MoveContext = { colliders: cols, walk: 7, adsMove: 1, fallback: [0, 0, 0] };
    const st = createMoveState(19, 0, -31);
    for (let i = 0; i < 1 / FIXED_DT; i++)
      stepMovement(st, { seq: i, f: 1, s: 0, yaw: 0, pitch: 0, b: 0, slot: 0 }, FIXED_DT, ctx);
    expect(st.y).toBeCloseTo(1, 1);
    expect(st.z).toBeLessThan(-36);
  });
});
