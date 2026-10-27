import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { canJoinTeam, autoBalance, teamCounts } from '../players/teams';
import { loadRanking, rankingRows, recordMatch, resetRanking } from '../stats/ranking';
import { makeRoom } from '../testing/fakeRoom';
import type { Logger } from '../logger';
import { CHAR_BY_ID, MATCH_RESTART_MS } from '@blockshot/shared';
import { spawnPlayer } from '../players/spawn';
import { adminChangeRoom, adminEnd, adminKill, adminRestart, adminSwitchTeam } from './admin';
import { startTournament } from './tournament';

const quiet = { info: () => {}, error: () => {}, warn: () => {}, debug: () => {} } as unknown as Logger;

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('balanced teams', () => {
  it('nobody can stack a team: joining the bigger side is refused, the smaller one is fine', () => {
    const r = makeRoom('teams');
    const ps = ['A', 'B', 'C', 'D'].map((n) => r.join(n)); // 2 v 2 (each joins the smaller team)
    expect(teamCounts(r.room)).toEqual({ 1: 2, 2: 2 });
    const red = ps.find((p) => p.team === 1)!;
    expect(canJoinTeam(r.room, red, 2)).toBe(false); // it would be 1 v 3
    r.join('E'); // 3 v 2 (a tie goes to Red)
    const blue = ps.find((p) => p.team === 2)!;
    expect(canJoinTeam(r.room, blue, 1)).toBe(false); // 4 v 1
    expect(canJoinTeam(r.room, red, 2)).toBe(true); // 2 v 3 is still within one
  });

  it('someone leaves mid-match: a dead player of the bigger team moves over, never one in a fight', () => {
    const r = makeRoom('teams');
    const ps = ['A', 'B', 'C', 'D', 'E', 'F'].map((n) => r.join(n));
    for (const p of ps.filter((q) => q.team === 2)) r.registry.removePlayer(r.room, p.id); // 3 v 0
    expect(autoBalance(r.room)).toBeNull(); // everyone alive: wait
    const red = ps.filter((p) => p.team === 1);
    red[0]!.alive = false;
    expect(autoBalance(r.room)).toBe(red[0]);
    expect(teamCounts(r.room)).toEqual({ 1: 2, 2: 1 });
    expect(autoBalance(r.room)).toBeNull(); // within one: done
  });

  it('modes without team changes (infected) are never rebalanced', () => {
    const r = makeRoom('infect');
    ['A', 'B', 'C'].map((n) => r.join(n)).forEach((p) => (p.alive = false));
    expect(autoBalance(r.room)).toBeNull();
  });
});

describe('admin tools', () => {
  it('kill: the player dies, nobody scores', () => {
    const r = makeRoom('ffa');
    const a = r.join('Ana');
    adminKill(r.room, a);
    expect(a.alive).toBe(false);
    expect(a.deaths).toBe(0);
    expect(r.channel.of('kill').at(-1)).toMatchObject({ victim: a.id, weapon: 'Admin' });
  });

  it('switch team skips the balance rule and respawns an alive player', () => {
    const r = makeRoom('teams');
    const a = r.join('Ana');
    const team = a.team;
    adminSwitchTeam(r.room, a);
    expect(a.team).not.toBe(team);
    expect(a.alive).toBe(true);
  });

  it('restart: scores back to zero and a new match starts at once', () => {
    const r = makeRoom('teams');
    const a = r.join('Ana');
    a.kills = 5;
    r.room.teamScore[1] = 5;
    adminRestart(r.room);
    expect(a.kills).toBe(0);
    expect(r.room.teamScore).toEqual({ 1: 0, 2: 0 });
    expect(a.alive).toBe(false); // respawns from the client on match:start
    expect(r.channel.of('match:start')).toHaveLength(1);
  });

  it('end: the leader wins with the results screen; change room moves map and mode now', () => {
    const r = makeRoom('ffa');
    const a = r.join('Ana');
    r.join('Bea');
    a.kills = 3;
    adminEnd(r.room);
    expect(r.channel.of('match:end').at(-1)).toMatchObject({ winner: 'Ana' });
    adminChangeRoom(r.room, { mapId: 'obra', mode: 'teams' });
    expect(r.room.map.id).toBe('obra');
    expect(r.room.modeId).toBe('teams');
    expect(r.room.matchOver).toBe(false);
  });
});

describe('league tournament', () => {
  it('rounds give points by place, only the map is voted, and the last round names the champion', () => {
    const r = makeRoom('teams');
    const [a, b, c] = ['Ana', 'Bea', 'Cris'].map((n) => r.join(n));
    startTournament(r.room, 3);
    adminChangeRoom(r.room, { mapId: r.room.map.id, mode: 'ffa' });
    expect(r.room.modeId).toBe('ffa');
    for (let round = 1; round <= 3; round++) {
      for (const p of [a, b, c]) {
        if (!p!.alive) spawnPlayer(r.room, p!, CHAR_BY_ID.soldado, 'base');
      }
      Object.assign(a!, { kills: 5 });
      Object.assign(b!, { kills: round === 2 ? 9 : 3 }); // Bea wins round 2
      Object.assign(c!, { kills: 1 });
      adminEnd(r.room);
      const end = r.channel.of('match:end').at(-1)!;
      expect(end.tour?.round).toBe(round);
      if (round < 3) {
        expect(end.vote.every((o) => o.mode === 'ffa')).toBe(true); // a league stays free for all
        vi.advanceTimersByTime(MATCH_RESTART_MS + 10);
      } else {
        expect(end.tour?.final).toBe(true);
        // Ana: 10 + 8 + 10 = 28 · Bea: 8 + 10 + 8 = 26 · Cris: 6 × 3 = 18
        expect(end.tour?.rows.map((x) => [x.name, x.pts])).toEqual([
          ['Ana', 28],
          ['Bea', 26],
          ['Cris', 18],
        ]);
        expect(r.room.tournament).toBeNull();
        expect(r.channel.notices().some((n) => n.includes('Ana gana el torneo'))).toBe(true);
      }
    }
  });
});

describe('ranking file', () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rank-'));
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('survives a restart: matches and wins are saved and read back', () => {
    const file = path.join(dir, 'ranking.json');
    loadRanking(file, quiet);
    const r = makeRoom('ffa');
    const a = r.join('Ana');
    const b = r.join('Bea');
    a.kills = 4;
    b.kills = 1;
    recordMatch(r.room, 'Ana', 0);
    loadRanking(file, quiet); // as if the server started again
    const rows = rankingRows();
    expect(rows[0]).toMatchObject({ name: 'Ana', matches: 1, wins: 1, kills: 4 });
    expect(rows[1]).toMatchObject({ name: 'Bea', matches: 1, wins: 0 });
  });

  it('a broken file is set aside, not overwritten; a new season keeps a copy', () => {
    const file = path.join(dir, 'ranking.json');
    fs.writeFileSync(file, '{ not json');
    loadRanking(file, quiet);
    expect(rankingRows()).toEqual([]);
    expect(fs.readdirSync(dir).some((f) => f.startsWith('ranking.json.bad-'))).toBe(true);
    const r = makeRoom('teams');
    r.join('Ana');
    recordMatch(r.room, 'Rojo', 1);
    resetRanking();
    expect(rankingRows()).toEqual([]);
    expect(fs.readdirSync(dir).filter((f) => /^ranking-.*\.json$/.test(f))).toHaveLength(1);
  });
});
