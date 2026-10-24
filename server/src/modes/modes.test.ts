import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FLAG, INFECT, MATCH_RESTART_MS, TAG, WEAPONS, gunLadder } from '@blockshot/shared';
import { applyDamage } from '../combat/damage';
import { buildSnapshot } from '../game/tick';
import type { Player } from '../players/player';
import { makeRoom, type FakeRoom } from '../testing/fakeRoom';

const at: [number, number, number] = [0, 1, 0];
const kill = (r: FakeRoom, a: Player, b: Player, w = WEAPONS.rifle) => applyDamage(r.room, a, b, 999, false, w, at);
const tick = (r: FakeRoom) => r.room.mode.tick?.(r.room, Date.now());
/** respawn in place */
const revive = (p: Player) => Object.assign(p, { alive: true, hp: p.maxHp });

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('free for all', () => {
  it('ends the match when somebody reaches the kill limit', () => {
    const r = makeRoom('ffa', 10);
    const a = r.join('A');
    const b = r.join('B');
    a.kills = 9;
    kill(r, a, b);
    expect(r.room.matchOver).toBe(true);
    expect(r.channel.of('match:end')[0]).toMatchObject({ winner: 'A', team: 0 });
  });

  it('restarts after MATCH_RESTART_MS with clean stats', () => {
    const r = makeRoom('ffa', 10);
    const a = r.join('A');
    a.kills = 9;
    a.armor = 30;
    kill(r, a, r.join('B'));
    vi.advanceTimersByTime(MATCH_RESTART_MS);
    expect(r.room.matchOver).toBe(false);
    expect(a).toMatchObject({ kills: 0, deaths: 0, armor: 0, streak: 0 });
    expect(r.channel.of('match:start')).toHaveLength(1);
  });
});

describe('team deathmatch', () => {
  it('puts newcomers in the smaller team and scores kills for the killer team', () => {
    const r = makeRoom('teams', 20);
    const a = r.join('A');
    const b = r.join('B');
    const c = r.join('C');
    expect([a.team, b.team, c.team]).toEqual([1, 2, 1]);
    kill(r, b, a);
    expect(r.room.teamScore).toEqual({ 1: 0, 2: 1 });
    r.room.teamScore[2] = 19;
    kill(r, b, c);
    expect(r.channel.of('match:end')[0]).toMatchObject({ winner: 'Equipo Azul', team: 2 });
  });
});

describe('capture the flag', () => {
  const setup = () => {
    const r = makeRoom('ctf', 3);
    const red = r.join('Red');
    const blue = r.join('Blue');
    return { r, red, blue, bases: r.room.map.bases };
  };

  it('spawns each team in its own half', () => {
    const { r, red, blue } = setup();
    const { room } = r;
    expect(red.team).toBe(1);
    expect(blue.team).toBe(2);
    expect(room.mode.filterSpawns!(room, red, room.map.spawns).every((s) => s[0] < -1)).toBe(true);
    expect(room.mode.filterSpawns!(room, blue, room.map.spawns).every((s) => s[0] > 1)).toBe(true);
  });

  it('takes, drops, returns and captures the flag', () => {
    const { r, red, blue, bases } = setup();
    r.place(red, bases[2][0], bases[2][2]);
    tick(r);
    expect(r.channel.of('flag').map((f) => f.type)).toEqual(['take']);
    // The carrier dies: the flag drops where it was
    kill(r, blue, red);
    tick(r);
    expect(r.channel.of('flag').at(-1)).toMatchObject({ type: 'drop', team: 2 });
    // A blue player touches it: it goes home
    r.place(blue, bases[2][0], bases[2][2]);
    tick(r);
    expect(r.channel.of('flag').at(-1)).toMatchObject({ type: 'return', team: 2 });
    // Red takes it again and brings it home
    r.place(blue, 0, 0);
    red.alive = true;
    r.place(red, bases[2][0], bases[2][2]);
    tick(r);
    r.place(red, bases[1][0], bases[1][2]);
    tick(r);
    expect(r.channel.of('flag').at(-1)).toMatchObject({ type: 'capture', team: 2, name: 'Red' });
    expect(r.room.teamScore[1]).toBe(1);
    expect(red.caps).toBe(1);
  });

  it('a dropped flag returns by itself after FLAG.returnMs', () => {
    const { r, red, blue, bases } = setup();
    r.place(red, bases[2][0], bases[2][2]);
    tick(r);
    r.place(red, 0, 0);
    tick(r);
    kill(r, blue, red);
    tick(r);
    vi.advanceTimersByTime(FLAG.returnMs + 1);
    tick(r);
    expect(r.channel.of('flag').at(-1)).toMatchObject({ type: 'return', team: 2 });
    expect(buildSnapshot(r.room, Date.now()).fl?.[2]).toMatchObject({ h: 1, c: null });
  });
});

describe('gun game', () => {
  it('levels up on kills, demotes on knife kills and is won with the knife', () => {
    const r = makeRoom('gungame', 5);
    const ladder = gunLadder(5);
    const a = r.join('A');
    const b = r.join('B');
    expect(a.loadout).toEqual([ladder[0], 'knife']);
    kill(r, a, b);
    expect(a.level).toBe(1);
    expect(a.loadout[0]).toBe(ladder[1]);
    b.level = 2;
    revive(b);
    kill(r, a, b, WEAPONS.knife);
    expect(b.level).toBe(1);
    expect(r.channel.notices().some((n) => n.includes('cuchillazo'))).toBe(true);
    a.level = ladder.length - 1;
    revive(b);
    kill(r, a, b, WEAPONS.knife);
    expect(r.channel.of('match:end')[0]).toMatchObject({ winner: 'A' });
  });
});

describe('kill confirmed', () => {
  it('drops a tag; rivals confirm it, mates deny it, it expires', () => {
    const r = makeRoom('kc', 15);
    const a = r.join('A');
    const b = r.join('B');
    const b2 = r.join('B2');
    expect([a.team, b.team, b2.team]).toEqual([1, 2, 1]);
    r.place(b, 5, 5);
    kill(r, a, b);
    expect(buildSnapshot(r.room, Date.now()).tg).toHaveLength(1);
    r.place(a, 5, 5);
    tick(r);
    expect(r.channel.of('tag', a.id)).toEqual([{ type: 'confirm' }]);
    expect(r.room.teamScore[1]).toBe(1);

    // a dies at (9, 9); its own team (b2) denies the tag
    r.place(a, 9, 9);
    kill(r, b, a);
    r.place(b2, 9, 9);
    tick(r);
    expect(r.channel.of('tag', b2.id)).toEqual([{ type: 'deny' }]);
    expect(r.room.teamScore[2]).toBe(0);

    r.place(b2, -9, -9);
    kill(r, a, b2);
    vi.advanceTimersByTime(TAG.lifeMs + 1);
    tick(r);
    expect(buildSnapshot(r.room, Date.now()).tg).toHaveLength(0);
  });
});

describe('infected', () => {
  it('picks the first infected, infects survivors and the infected win', () => {
    const r = makeRoom('infect', 2);
    const a = r.join('A');
    const b = r.join('B');
    expect([a.team, b.team]).toEqual([1, 1]);
    tick(r);
    expect(buildSnapshot(r.room, Date.now()).inf).toMatchObject({ st: 0 });
    vi.advanceTimersByTime(INFECT.pickDelay);
    tick(r);
    const zombie = a.team === 2 ? a : b;
    const human = zombie === a ? b : a;
    expect(zombie.loadout).toEqual(['knife']);
    expect(zombie.maxHp).toBe(Math.round(100 * INFECT.hp));
    expect(r.room.mode.speedFactor?.(zombie)).toBe(INFECT.speed);
    expect(r.room.mode.streakRewards).toBe(false);
    // newcomers join the infected once the infection started
    expect(r.join('Late').team).toBe(2);
    kill(r, zombie, human, WEAPONS.knife);
    expect(human.team).toBe(2);
    tick(r);
    expect(r.channel.of('match:end')[0]).toMatchObject({ winner: 'Los infectados', team: 2 });
  });

  it('survivors win when time runs out; a new match puts everybody back as survivors', () => {
    const r = makeRoom('infect', 2);
    r.join('A');
    r.join('B');
    tick(r);
    vi.advanceTimersByTime(INFECT.pickDelay);
    tick(r);
    vi.advanceTimersByTime(2 * 60000);
    tick(r);
    expect(r.channel.of('match:end')[0]).toMatchObject({ winner: 'Los supervivientes', team: 1 });
    vi.advanceTimersByTime(MATCH_RESTART_MS);
    expect([...r.room.players.values()].every((p) => p.team === 1)).toBe(true);
  });

  it('picks another infected if the infected leaves', () => {
    const r = makeRoom('infect', 3);
    r.join('A');
    r.join('B');
    tick(r);
    vi.advanceTimersByTime(INFECT.pickDelay);
    tick(r);
    const zombie = [...r.room.players.values()].find((p) => p.team === 2)!;
    r.registry.removePlayer(r.room, zombie.id);
    tick(r);
    expect(r.channel.notices()).toContain('No quedan infectados: se elige otro');
    expect(buildSnapshot(r.room, Date.now()).inf?.st).toBe(0);
  });
});
