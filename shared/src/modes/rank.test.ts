import { describe, expect, it } from 'vitest';
import { RANK_TIERS, rankOf, rankPoints } from './rank';

describe('ranks', () => {
  it('season points: wins count most, never negative', () => {
    expect(rankPoints({ wins: 1, kills: 0, deaths: 0, heads: 0, caps: 0, medals: 0 })).toBe(30);
    expect(rankPoints({ wins: 0, kills: 0, deaths: 50, heads: 0, caps: 0, medals: 0 })).toBe(0);
  });

  it('each tier starts at its threshold, in three steps, up to Leyenda', () => {
    for (const [i, t] of RANK_TIERS.entries()) {
      expect(rankOf(t.from).tier).toBe(i);
      if (t.from) expect(rankOf(t.from - 1).tier).toBe(i - 1);
    }
    expect(rankOf(0)).toMatchObject({ label: 'Bronce I', next: 50 });
    expect(rankOf(149)).toMatchObject({ label: 'Bronce III', next: 150 });
    expect(rankOf(443)).toMatchObject({ label: 'Oro I' });
    expect(rankOf(99999)).toMatchObject({ label: 'Leyenda', next: null, progress: 1 });
  });
});
