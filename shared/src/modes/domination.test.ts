import { describe, expect, it } from 'vitest';
import { MAPS, MAP_SIZES, getColliders, getMap } from '../maps/maps';
import type { SizeId } from '../maps/types';
import { dominationZones } from './domination';

describe('domination zones', () => {
  for (const { id } of MAPS) {
    for (const size of Object.keys(MAP_SIZES) as SizeId[]) {
      it(`${id}:${size} has three fair zones on open ground`, () => {
        const map = getMap(id, size);
        const [a, b, c] = dominationZones(map);
        // A on the west (Red) side, C its mirror image, B on the centre line
        expect(a![0]).toBeLessThan(-2);
        expect(c).toEqual([-a![0], 0, a![2]]);
        expect(b![0]).toBe(0);
        // Nothing solid inside a zone's centre
        for (const [x, , z] of [a!, b!, c!]) {
          const blocked = getColliders(map).some(
            (k) => k.max[1] > 0.05 && k.min[1] < 2 && k.min[0] < x && k.max[0] > x && k.min[2] < z && k.max[2] > z,
          );
          expect(blocked, `${x},${z}`).toBe(false);
        }
      });
    }
  }
});
