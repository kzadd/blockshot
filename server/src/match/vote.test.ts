import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MATCH_RESTART_MS, VOTE_OPTIONS, WEAPONS } from '@blockshot/shared';
import { applyDamage } from '../combat/damage';
import { makeRoom } from '../testing/fakeRoom';
import { endMatch } from './match';
import { castVote } from './vote';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('end of match vote', () => {
  it('offers different maps, never the same map and mode again, and moves the room to the winner', () => {
    const r = makeRoom('ffa', 10);
    const [a, b, c] = ['A', 'B', 'C'].map((n) => r.join(n));
    endMatch(r.room, 'A');
    const { vote } = r.channel.of('match:end')[0]!;
    expect(vote).toHaveLength(VOTE_OPTIONS);
    expect(new Set(vote.map((o) => o.mapId)).size).toBe(VOTE_OPTIONS);
    expect(vote.some((o) => o.mapId === 'patio' && o.mode === 'ffa')).toBe(false);
    castVote(r.room, a!.id, 2);
    castVote(r.room, b!.id, 2);
    castVote(r.room, c!.id, 0);
    castVote(r.room, c!.id, 1); // changing your vote replaces it
    expect(r.channel.of('vote').at(-1)).toEqual([0, 1, 2]);
    vi.advanceTimersByTime(MATCH_RESTART_MS);
    expect(r.room.map.id).toBe(vote[2]!.mapId);
    expect(r.room.modeId).toBe(vote[2]!.mode);
    expect(r.channel.of('room:changed')[0]).toMatchObject({ mapId: vote[2]!.mapId, mode: vote[2]!.mode });
    expect(r.channel.of('match:start')).toHaveLength(1);
  });
});

describe('team balance', () => {
  it('deals players out by last match, best first, in a snake', () => {
    const r = makeRoom('teams', 100);
    const ps = ['A', 'B', 'C', 'D'].map((n, i) => r.join(n, i * 3, 0));
    // A and C (the two best) start on the same team
    ps.forEach((p, i) => (p.team = i % 2 === 0 ? 1 : 2));
    ps[0]!.kills = 10;
    ps[2]!.kills = 8;
    ps[1]!.kills = 2;
    applyDamage(r.room, ps[3]!, ps[1]!, 0, false, WEAPONS.rifle, [0, 0, 0]);
    endMatch(r.room, 'Equipo Rojo', 1);
    r.room.vote = null; // same map and mode: only the balance
    vi.advanceTimersByTime(MATCH_RESTART_MS);
    expect(ps.map((p) => p.team)).toEqual([1, 2, 2, 1]);
    expect(r.channel.notices()).toContain('Equipos equilibrados según la última partida');
  });
});
