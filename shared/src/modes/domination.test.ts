import { describe, expect, it } from 'vitest';
import { MAPS, MAP_SIZES, getColliders, getMap } from '../maps/maps';
import type { SizeId } from '../maps/types';
import { bombSites, dominationZones, openGround } from './domination';

describe('domination zones', () => {
  for (const { id } of MAPS) {
    for (const size of Object.keys(MAP_SIZES) as SizeId[]) {
      it(`${id}:${size} has three fair zones on open ground`, () => {
        const map = getMap(id, size);
        const [a, b, c] = dominationZones(map);
        // A on the west (Red) side, C its mirror image (on its own ground), B on the centre line
        expect(a![0]).toBeLessThan(-2);
        expect(c).toEqual([-a![0], openGround(map).ground(-a![0], a![2]), a![2]]);
        expect(b![0]).toBe(0);
        // Nothing solid inside a zone's centre, above the ground it stands on (the floor, or a raised quay)
        for (const [x, y, z] of [a!, b!, c!]) {
          const blocked = getColliders(map).some(
            (k) =>
              k.max[1] > y + 0.05 && k.min[1] < y + 2 && k.min[0] < x && k.max[0] > x && k.min[2] < z && k.max[2] > z,
          );
          expect(blocked, `${x},${z}`).toBe(false);
        }
      });
    }
  }
});

describe('domination zones on a map that is not quite symmetric', () => {
  it('C stands on the ground at its own spot, not at the height of A', () => {
    const base = getMap('patio', 'm');
    const [a] = dominationZones(base);
    // A low platform (0.5 m) under C's spot only
    const map = {
      ...base,
      boxes: [...base.boxes, { x: -a![0], y: 0, z: a![2], w: 6, h: 0.5, d: 6, c: base.boxes[0]!.c }],
    };
    const [a2, , c] = dominationZones(map);
    expect(a2).toEqual(a);
    expect(c).toEqual([-a![0], 0.5, a![2]]);
  });
});

describe('bomb sites', () => {
  for (const { id } of MAPS) {
    it(`${id}: A north and B south on Blue's half, on open ground`, () => {
      const map = getMap(id, 'm');
      const [a, b] = bombSites(map);
      expect(a[0]).toBeGreaterThan(2);
      expect(b[0]).toBeGreaterThan(2);
      expect(a[2]).toBeLessThan(-2);
      expect(b[2]).toBeGreaterThan(2);
      for (const [x, y, z] of [a, b]) {
        const blocked = getColliders(map).some(
          (k) =>
            k.max[1] > y + 0.05 && k.min[1] < y + 2 && k.min[0] < x && k.max[0] > x && k.min[2] < z && k.max[2] > z,
        );
        expect(blocked, `${x},${z}`).toBe(false);
      }
    });
  }
});
