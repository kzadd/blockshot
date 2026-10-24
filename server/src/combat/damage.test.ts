import { describe, expect, it } from 'vitest';
import { WEAPONS } from '@blockshot/shared';
import { makeRoom } from '../testing/fakeRoom';
import { applyDamage } from './damage';

const at = [0, 1, 0] as [number, number, number];

describe('applyDamage', () => {
  it('is blocked by spawn protection', () => {
    const { room, join, channel } = makeRoom('ffa');
    const a = join('A');
    const b = join('B');
    b.protUntil = Date.now() + 1000;
    applyDamage(room, a, b, 50, false, WEAPONS.rifle, at);
    expect(b.hp).toBe(100);
    expect(channel.of('hitmarker')).toHaveLength(0);
  });

  it('spends armor before health and tells both players', () => {
    const { room, join, channel } = makeRoom('ffa');
    const a = join('A');
    const b = join('B');
    b.armor = 30;
    applyDamage(room, a, b, 50, true, WEAPONS.rifle, at);
    expect(b.armor).toBe(0);
    expect(b.hp).toBe(80);
    expect(channel.of('damaged', b.id)[0]).toMatchObject({ hp: 80 });
    expect(channel.of('hitmarker', a.id)[0]).toMatchObject({ head: true, kill: false, dmg: 50 });
  });

  it('kills: stats, streaks, kill event and the end of the victim streak', () => {
    const { room, join, channel } = makeRoom('ffa');
    const a = join('A');
    const b = join('B');
    b.streak = 4;
    applyDamage(room, a, b, 200, false, WEAPONS.sniper, at);
    expect(b).toMatchObject({ alive: false, hp: 0, deaths: 1, streak: 0 });
    expect(a).toMatchObject({ kills: 1, streak: 1, bestStreak: 1 });
    expect(channel.of('kill')[0]).toMatchObject({ killer: a.id, victim: b.id, weapon: 'Francotirador', ended: 4 });
  });

  it('gives radar at 5 and armor at 7 kills in a row, but not in Infected', () => {
    const { room, join } = makeRoom('ffa');
    const a = join('A');
    a.streak = 4;
    applyDamage(room, a, join('B'), 999, false, WEAPONS.rifle, at);
    expect(a.radarUntil).toBeGreaterThan(Date.now());
    a.streak = 6;
    applyDamage(room, a, join('C'), 999, false, WEAPONS.rifle, at);
    expect(a.armor).toBe(50);

    const inf = makeRoom('infect');
    const z = inf.join('Z');
    z.streak = 4;
    applyDamage(inf.room, z, inf.join('Y'), 999, false, WEAPONS.knife, at);
    expect(z.radarUntil).toBe(0);
  });
});
