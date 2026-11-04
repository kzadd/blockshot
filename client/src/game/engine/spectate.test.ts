import { describe, expect, it } from 'vitest';
import { canWatch, pickTarget, shouldSpectate, type SpectateCandidate, type SpectateRules } from './spectate';

const p = (id: string, tm: 0 | 1 | 2, a = 1): SpectateCandidate => ({ id, tm, a });
const team: SpectateRules = { myId: 'me', myTeam: 1, teams: true };
const ffa: SpectateRules = { myId: 'me', myTeam: 0, teams: false };

describe('shouldSpectate', () => {
  it('only while dead during a round being played', () => {
    expect(shouldSpectate(false, true, { p: 1, n: 2, t: 1000 })).toBe(true);
    expect(shouldSpectate(true, true, { p: 1, n: 2, t: 1000 })).toBe(false);
    expect(shouldSpectate(false, false, { p: 1, n: 2, t: 1000 })).toBe(false);
    expect(shouldSpectate(false, true, { p: 2, n: 2, t: 1000 })).toBe(false);
    expect(shouldSpectate(false, true, { p: 0, n: 0, t: 0 })).toBe(false);
    expect(shouldSpectate(false, true, null)).toBe(false);
  });
});

describe('canWatch', () => {
  it('never yourself nor the dead', () => {
    expect(canWatch(p('me', 1), team)).toBe(false);
    expect(canWatch(p('a', 1, 0), team)).toBe(false);
  });
  it('team modes: teammates only', () => {
    expect(canWatch(p('a', 1), team)).toBe(true);
    expect(canWatch(p('b', 2), team)).toBe(false);
  });
  it('free for all: anyone alive', () => {
    expect(canWatch(p('a', 0), ffa)).toBe(true);
  });
});

describe('pickTarget', () => {
  const list = [p('me', 1, 0), p('a', 1), p('x', 2), p('b', 1, 0), p('c', 1)];

  it('starts with the first one that can be watched', () => {
    expect(pickTarget(list, null, 0, team)).toBe('a');
  });
  it('keeps the current one while alive', () => {
    expect(pickTarget(list, 'c', 0, team)).toBe('c');
  });
  it('cycles forwards and backwards over living teammates, wrapping around', () => {
    expect(pickTarget(list, 'a', 1, team)).toBe('c');
    expect(pickTarget(list, 'c', 1, team)).toBe('a');
    expect(pickTarget(list, 'a', -1, team)).toBe('c');
    expect(pickTarget(list, 'c', -1, team)).toBe('a');
  });
  it('skips enemies and the dead', () => {
    expect(pickTarget(list, 'a', 1, team)).not.toBe('x');
    expect(pickTarget(list, 'a', 1, team)).not.toBe('b');
  });
  it('when the watched one dies, moves to the next after it', () => {
    const later = [p('me', 1, 0), p('a', 1), p('x', 2), p('b', 1), p('c', 1, 0), p('d', 1)];
    expect(pickTarget(later, 'c', 0, team)).toBe('d');
    expect(pickTarget(later, 'd', 0, team)).toBe('d');
  });
  it('a player that left: starts again from the first', () => {
    expect(pickTarget(list, 'gone', 0, team)).toBe('a');
    expect(pickTarget(list, 'gone', -1, team)).toBe('c');
  });
  it('the only one left stays, even when cycling', () => {
    const one = [p('me', 1, 0), p('a', 1), p('x', 2)];
    expect(pickTarget(one, 'a', 1, team)).toBe('a');
    expect(pickTarget(one, 'a', -1, team)).toBe('a');
  });
  it('nobody to watch: null (overview camera)', () => {
    expect(pickTarget([p('me', 1, 0), p('x', 2), p('b', 1, 0)], 'b', 0, team)).toBeNull();
    expect(pickTarget([], null, 1, team)).toBeNull();
  });
  it('free for all: enemies too', () => {
    const lms = [p('me', 0, 0), p('x', 0), p('y', 0)];
    expect(pickTarget(lms, 'x', 1, ffa)).toBe('y');
  });
});
