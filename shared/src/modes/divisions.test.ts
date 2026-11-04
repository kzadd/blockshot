import { describe, expect, it } from 'vitest';
import { DIVISIONS, divisionOf, seasonPoints } from './modes';

describe('season divisions', () => {
  it('points come mostly from wins and never go negative', () => {
    expect(seasonPoints({ wins: 1, kills: 0, deaths: 0, heads: 0, caps: 0, medals: 0 })).toBe(30);
    expect(seasonPoints({ wins: 0, kills: 0, deaths: 50, heads: 0, caps: 0, medals: 0 })).toBe(0);
  });
  it('each division starts at its threshold', () => {
    expect(divisionOf(0).name).toBe('Bronce');
    for (const d of DIVISIONS) {
      expect(divisionOf(d.from).name).toBe(d.name);
      if (d.from) expect(divisionOf(d.from - 1).name).not.toBe(d.name);
    }
  });
});
