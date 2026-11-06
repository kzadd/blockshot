import { describe, expect, it } from 'vitest';
import { getColliders, getMap, type Collider } from '@blockshot/shared';

/** Open roof of the Obra skeleton: three stories of 3 m. */
const ROOF = 9;
import { findPath, navGrid } from './nav';

describe('bot navigation', () => {
  it('finds a walking path from the ground up the stairs to the top of the Obra skeleton', () => {
    const map = getMap('obra', 'm');
    const t = Math.round(Math.min(12, Math.max(7, 0.24 * map.half)));
    const g = navGrid(map, getColliders(map));
    const path = findPath(g, [-(map.half - 3), 0, 0], [0, ROOF, t * 0.5]);
    expect(path).not.toBeNull();
    expect(path!.at(-1)![1]).toBeCloseTo(ROOF, 1);
    // Up one step at a time: never a rise a player could not walk
    for (let i = 1; i < path!.length; i++) expect(path![i]![1] - path![i - 1]![1]).toBeLessThan(0.55);
  });

  it('goes round walls instead of through them', () => {
    const map = getMap('patio', 'm');
    const g = navGrid(map, getColliders(map));
    const path = findPath(g, [-(map.half - 3), 0, 0], [map.half - 3, 0, 0]);
    expect(path).not.toBeNull();
    expect(path!.length).toBeGreaterThan(10);
  });
});

describe('bot navigation on the two mode maps', () => {
  it('Sanatorio: from the courtyard a bot walks to every spawn, into the «zona segura» and up the water tower', () => {
    const map = getMap('sanatorio', 'm');
    const g = navGrid(map, getColliders(map));
    const targets: [number, number, number][] = [
      ...map.spawns.map(([x, y, z]): [number, number, number] => [x, y, z]),
      [18, 0, -34], // the operating theatre
      [-34, 9, 35], // the water tower roof
    ];
    for (const t of targets) {
      const path = findPath(g, [0, 0, 5], t);
      expect(path, JSON.stringify(t)).not.toBeNull();
      expect(path!.at(-1)![1]).toBeCloseTo(t[1], 1);
    }
  });

  it('Aduana: Red reaches each site by two ways, through the lane gate or through the middle', () => {
    const base = getMap('aduana', 'm');
    const wall = (x0: number, x1: number, z0: number, z1: number): Collider => ({
      c: 'wall',
      min: [x0, 0, z0],
      max: [x1, 6, z1],
    });
    // Blue's doors closed: attackers must use their own ways in
    const blue = [wall(26, 28, -24, -20), wall(26, 28, -2, 2), wall(26, 28, 18, 22), wall(26, 28, 32, 36)];
    const ways = {
      A: { site: [20, 0, -20], lane: wall(10, 12, -33, -30), middle: wall(13, 15.5, -12, -8) },
      B: { site: [20, 0, 20], lane: wall(10, 12, 30, 33), middle: wall(19.5, 23, 8, 12) },
    } as const;
    for (const { site, lane, middle } of Object.values(ways)) {
      for (const closed of [[], [lane], [middle], [lane, middle]]) {
        // A copy of the map: the grid is cached per map object
        const map = { ...base };
        const g = navGrid(map, [...getColliders(base), ...blue, ...closed]);
        const path = findPath(g, [-35, 0, 0], [...site]);
        if (closed.length === 2) expect(path).toBeNull();
        else expect(path?.at(-1)?.[0]).toBeCloseTo(site[0], 0);
      }
    }
  });
});
