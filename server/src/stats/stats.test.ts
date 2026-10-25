import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MATCH_RESTART_MS, MULTI_KILL_MS, WEAPONS } from '@blockshot/shared';
import { applyDamage } from '../combat/damage';
import type { Player } from '../players/player';
import { makeRoom, type FakeRoom } from '../testing/fakeRoom';
import { resetSessionStats, sessionStats } from './sessionStats';

const at: [number, number, number] = [0, 1, 0];
const kill = (r: FakeRoom, a: Player, b: Player, { w = WEAPONS.rifle, dmg = 999, head = false } = {}) =>
  applyDamage(r.room, a, b, dmg, head, w, at);
const revive = (p: Player) => Object.assign(p, { alive: true, hp: p.maxHp });
const medals = (r: FakeRoom) => r.channel.of('kill').map((k) => k.medals);

beforeEach(() => {
  vi.useFakeTimers();
  resetSessionStats();
});
afterEach(() => vi.useRealTimers());

describe('medals', () => {
  it('first blood, double and triple kill, revenge', () => {
    const r = makeRoom('ffa', 50);
    const [a, b, c, d] = ['A', 'B', 'C', 'D'].map((n, i) => r.join(n, i * 3, 0));
    kill(r, a!, b!);
    kill(r, a!, c!);
    kill(r, a!, d!);
    vi.advanceTimersByTime(MULTI_KILL_MS + 1);
    revive(b!);
    kill(r, b!, a!);
    revive(a!);
    kill(r, a!, b!);
    expect(medals(r)).toEqual([['first'], ['double'], ['triple'], ['revenge'], ['revenge']]);
    expect(a!.medals).toBe(4);
  });

  it('backstab, long shot and kills from the air', () => {
    const r = makeRoom('ffa', 50);
    const a = r.join('A', 0, 0);
    const b = r.join('B', 0, 60);
    kill(r, a, b); // first blood out of the way
    vi.advanceTimersByTime(MULTI_KILL_MS + 1);
    revive(b);
    kill(r, a, b, { head: true });
    vi.advanceTimersByTime(MULTI_KILL_MS + 1);
    revive(b);
    kill(r, a, b, { w: WEAPONS.knife, dmg: WEAPONS.knife.backstab! });
    vi.advanceTimersByTime(MULTI_KILL_MS + 1);
    revive(b);
    a.move.grounded = false;
    kill(r, a, b);
    expect(medals(r).slice(1)).toEqual([['longshot'], ['backstab'], ['air']]);
  });
});

describe('session stats', () => {
  it('adds up finished matches and the live one, per name, without bots or double counting', () => {
    const r = makeRoom('ffa', 2);
    const a = r.join('Ana');
    const b = r.join('Beto', 3, 0, 'rayo');
    kill(r, a, b);
    revive(b);
    kill(r, a, b); // limit reached: the match ends
    vi.advanceTimersByTime(MATCH_RESTART_MS);
    revive(b);
    kill(r, b, a);
    const rows = sessionStats([r.room]);
    expect(rows.find((x) => x.name === 'Ana')).toMatchObject({ kills: 2, deaths: 1, picks: { soldado: 1 } });
    expect(rows.find((x) => x.name === 'Beto')).toMatchObject({ kills: 1, deaths: 2, picks: { rayo: 1 } });
    r.registry.removePlayer(r.room, b.id);
    expect(sessionStats([r.room]).find((x) => x.name === 'Beto')).toMatchObject({ kills: 1, deaths: 2 });
  });
});
