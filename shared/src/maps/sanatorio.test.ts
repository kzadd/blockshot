// Sanatorio (built for Infectados): the stairwells and the water tower take a player up, the «zona segura» has
// only two ways in, and no straight line of sight runs across the map.
import { describe, expect, it } from 'vitest';
import { FIXED_DT, createMoveState, stepMovement, type MoveContext, type MoveState } from '../movement/movement';
import { rayAABB, type Collider } from '../physics/raycast';
import { PLAYER } from '../player/player';
import { getColliders, getMap, standAt } from './maps';

const map = getMap('sanatorio', 'm');
const cols = getColliders(map);
const ctx: MoveContext = { colliders: cols, walk: 7, adsMove: 1, fallback: [0, 0, 0] };
const F1 = 3;

/** A point of the north wing turned k quarter turns, as the builder does. */
const rot = (x: number, z: number, k: number): [number, number] => {
  let p: [number, number] = [x, z];
  for (let i = 0; i < k; i++) p = [-p[1], p[0]];
  return p;
};
/** Yaw that walks along the local direction (dx, dz) of wing k (yaw 0 looks towards -z). */
const yawOf = (dx: number, dz: number, k: number) => {
  const [x, z] = rot(dx, dz, k);
  return Math.atan2(-x, -z);
};
function walk(st: MoveState, yaw: number, seconds: number) {
  for (let i = 0; i < seconds / FIXED_DT; i++)
    stepMovement(st, { seq: i, f: 1, s: 0, yaw, pitch: 0, b: 0, slot: 0 }, FIXED_DT, ctx);
}
const start = (x: number, y: number, z: number, k: number) => {
  const [wx, wz] = rot(x, z, k);
  return createMoveState(wx, y, wz);
};

describe('sanatorio', () => {
  it('stays under the box budget', () => {
    expect(map.boxes.length).toBeLessThan(900);
  });

  it.each([0, 1, 2, 3])('the stairwell of wing %i climbs to the first floor', (k) => {
    const st = start(11.9, 0, -20.2, k);
    walk(st, yawOf(1, 0, k), 1.5);
    expect(st.y).toBeCloseTo(F1, 1);
  });

  it('the water tower stairs climb from the first floor to its roof', () => {
    const k = 2;
    const st = start(36.05, F1 + 0.55, -37, k);
    walk(st, yawOf(0, 1, k), 1.5);
    expect(st.y).toBeCloseTo(F1 + 3, 1);
    const up = start(31.95, F1 + 3.55, -32.9, k);
    walk(up, yawOf(0, -1, k), 1.5);
    expect(up.y).toBeCloseTo(F1 + 6, 1);
  });

  it('the «zona segura» (operating theatre) has exactly two doors, both walkable', () => {
    // Body-sized gaps along the four walls of the room (x 12..24, z -40..-24), at walking height
    const free = (x: number, z: number) =>
      !cols.some(
        (c: Collider) =>
          c.c !== 'floor' &&
          c.min[0] < x + PLAYER.radius &&
          c.max[0] > x - PLAYER.radius &&
          c.min[2] < z + PLAYER.radius &&
          c.max[2] > z - PLAYER.radius &&
          c.min[1] < PLAYER.height &&
          c.max[1] > 0.6,
      );
    let gaps = 0;
    const edges: [number, number, number, number][] = [
      [12, -24, 24, -24],
      [12, -40, 24, -40],
      [12, -40, 12, -24],
      [24, -40, 24, -24],
    ];
    for (const [x0, z0, x1, z1] of edges) {
      let open = false;
      for (let t = 0; t <= 1; t += 0.005) {
        const f = free(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t);
        if (f && !open) gaps++;
        open = f;
      }
    }
    expect(gaps).toBe(2);
    const fromCorridor = createMoveState(18, 0, -22.6);
    walk(fromCorridor, yawOf(0, -1, 0), 0.8);
    expect(fromCorridor.z).toBeLessThan(-25);
    const fromHall = createMoveState(26, 0, -30);
    walk(fromHall, yawOf(-1, 0, 0), 0.6);
    expect(fromHall.x).toBeLessThan(23);
  });

  it('has no long sightlines: nothing a standing player sees runs 40 m (half the map)', () => {
    let longest = 0;
    for (let x = -38; x <= 38; x += 2) {
      for (let z = -38; z <= 38; z += 2) {
        const under = cols.filter((c) => c.min[0] <= x && c.max[0] >= x && c.min[2] <= z && c.max[2] >= z);
        // The ground floor and the first floor (where there is one), with room to stand
        const floors = [
          ...(standAt(map.boxes, x, z) === 0 ? [0] : []),
          ...(under.some((c) => Math.abs(c.max[1] - F1) < 0.01) ? [F1] : []),
        ];
        for (const y of floors) {
          const o: [number, number, number] = [x, y + PLAYER.eye, z];
          if (under.some((c) => c.min[1] < o[1] && c.max[1] > y + 0.05)) continue;
          for (let i = 0; i < 32; i++) {
            const a = (i / 32) * Math.PI * 2;
            let t = 100;
            for (const c of cols) t = Math.min(t, rayAABB(o, [Math.cos(a), 0, Math.sin(a)], c.min, c.max));
            longest = Math.max(longest, t);
          }
        }
      }
    }
    expect(longest).toBeLessThan(40);
  });
});
