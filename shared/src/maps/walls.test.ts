import { describe, expect, it } from 'vitest';
import { PAD, PLAYER } from '../player/player';
import { CLIMB, MAPS, getMap } from './maps';

describe('outer walls', () => {
  it('reach over a pad flight plus every wall jump', () => {
    expect(CLIMB).toBeGreaterThan(PAD.power ** 2 / (2 * PLAYER.gravity) + PLAYER.wallJumps * 2);
  });

  it.each(MAPS.map((m) => m.id))('%s: the outer walls stand above the highest reachable point', (id) => {
    const map = getMap(id, 'm');
    const walls = map.boxes.slice(1, 5);
    const top = Math.max(...map.boxes.slice(5).map((b) => b.y + b.h));
    expect(walls.map((b) => b.y + b.h)).toEqual(Array(4).fill(map.wallH));
    expect(map.wallH).toBeGreaterThan(top + CLIMB);
    // they close the whole edge of the map
    expect(Math.max(...walls.map((b) => Math.max(b.w, b.d)))).toBeGreaterThanOrEqual(2 * map.half);
  });
});
