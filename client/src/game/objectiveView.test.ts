import { describe, expect, it } from 'vitest';
import { FREEZE, type BombSnapshot, type IceSnapshot } from '@blockshot/shared';
import { bombSeen, oneLife, thawTarget } from './objectiveView';

const bomb = (st: 0 | 1 | 2): BombSnapshot => ({ st, c: st ? null : 'a', x: 0, y: 0, z: 0, s: -1, pp: 0, dp: 0, t: 0 });

describe('bombSeen', () => {
  it('carried: only the carrier team', () => {
    expect(bombSeen(bomb(0), 1, 1)).toBe(true);
    expect(bombSeen(bomb(0), 2, 1)).toBe(false);
    expect(bombSeen(bomb(0), 2, undefined)).toBe(false);
  });
  it('dropped: the attackers; planted: everybody', () => {
    expect(bombSeen(bomb(1), 1, undefined)).toBe(true);
    expect(bombSeen(bomb(1), 2, undefined)).toBe(false);
    expect(bombSeen(bomb(2), 2, undefined)).toBe(true);
  });
});

describe('thawTarget', () => {
  const ice: IceSnapshot[] = [
    ['rival', 0, 0, 0, 2, 0],
    ['far', 10, 0, 0, 1, 0],
    ['mate', 0.5, 0, 0, 1, 40],
  ];
  it('picks the frozen teammate in range, never a rival', () => {
    expect(thawTarget(ice, 1, 0, 0)?.[0]).toBe('mate');
    expect(thawTarget(ice, 2, 0, 0)?.[0]).toBe('rival');
    expect(thawTarget(ice, 1, 10 + FREEZE.radius, 0)).toBeNull();
  });
});

it('oneLife: the round modes without respawn', () => {
  expect(['rounds', 'lms', 'freeze', 'bomb'].every((m) => oneLife(m as never))).toBe(true);
  expect(oneLife('ffa')).toBe(false);
});
