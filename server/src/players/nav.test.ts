import { describe, expect, it } from 'vitest';
import { getColliders, getMap } from '@blockshot/shared';

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
