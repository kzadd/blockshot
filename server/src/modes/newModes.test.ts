import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BOMB, FREEZE, POWER, ROUNDS, SERVER_TICK_MS, WEAPONS, bombSites } from '@blockshot/shared';
import { applyDamage } from '../combat/damage';
import { handleShoot } from '../combat/shooting';
import { resetWorld, tickWorld } from '../combat/worldObjects';
import { buildSnapshot } from '../game/tick';
import type { Player } from '../players/player';
import { autoBalance, requestTeam } from '../players/teams';
import { makeRoom, type FakeRoom } from '../testing/fakeRoom';

const kill = (r: FakeRoom, a: Player, b: Player) => {
  b.protUntil = 0; // every round respawns with spawn protection
  applyDamage(r.room, a, b, 999, false, WEAPONS.rifle, [0, 1, 0]);
};
/** Runs the mode's tick for `ms`, like the server does every SERVER_TICK_MS. */
const play = (r: FakeRoom, ms: number) => {
  for (let t = 0; t < ms; t += SERVER_TICK_MS) {
    vi.advanceTimersByTime(SERVER_TICK_MS);
    r.room.mode.tick?.(r.room, Date.now());
  }
};
const snap = (r: FakeRoom) => buildSnapshot(r.room, Date.now());
/** Waits out the break: the next round starts. */
const nextRound = (r: FakeRoom) => play(r, ROUNDS.breakMs + 100);

beforeEach(() => vi.useFakeTimers({ now: 1_000_000 }));
afterEach(() => vi.useRealTimers());

describe('último en pie', () => {
  it('the last one alive wins the round; first to the limit wins the match', () => {
    const r = makeRoom('lms', 3);
    const a = r.join('Ana');
    expect(snap(r).rd).toMatchObject({ p: 0 }); // waiting for a second player
    const b = r.join('Bea');
    const c = r.join('Cris');
    expect([a.team, b.team, c.team]).toEqual([0, 0, 0]);
    nextRound(r);
    expect(snap(r).rd).toMatchObject({ p: 1, n: 1 });
    kill(r, a, b);
    expect(r.room.mode.canSpawn?.(r.room, b)).toBe(false);
    expect(a.caps).toBe(0);
    kill(r, a, c);
    expect(a.caps).toBe(1);
    expect(r.channel.notices()).toContain('Ana gana la ronda 1 (1 de 3)');
    // Everybody is back for the next round
    nextRound(r);
    expect([a, b, c].every((p) => p.alive)).toBe(true);
    kill(r, c, a);
    kill(r, c, b);
    expect(c.caps).toBe(1);
    for (let i = 0; i < 2; i++) {
      nextRound(r);
      kill(r, a, b);
      kill(r, a, c);
    }
    expect(r.channel.of('match:end')[0]).toMatchObject({ winner: 'Ana' });
  });

  it('when time runs out the one with most health wins the round (a tie: nobody)', () => {
    const r = makeRoom('lms', 5);
    const a = r.join('Ana');
    const b = r.join('Bea');
    nextRound(r);
    b.hp = 40;
    play(r, ROUNDS.roundMs);
    expect([a.caps, b.caps]).toEqual([1, 0]);
    nextRound(r);
    play(r, ROUNDS.roundMs);
    expect([a.caps, b.caps]).toEqual([1, 0]);
    expect(r.channel.notices()).toContain('Ronda 2: nadie en pie');
  });
});

describe('instagib', () => {
  it('the railgun kills in one hit anywhere, even through armour; the knife does not', () => {
    const r = makeRoom('insta', 15);
    const a = r.join('Ana');
    const b = r.join('Bea', 0, -10, { ability: 'shield' });
    expect(a.loadout).toEqual(['railgun', 'knife']);
    expect(a.grenades).toBe(0);
    b.armor = 50;
    applyDamage(r.room, a, b, WEAPONS.railgun.damage, false, WEAPONS.railgun, [0, 1, -10]);
    expect(b.alive).toBe(false);
    expect(a.kills).toBe(1);
    const c = r.join('Cris', 0, -5);
    applyDamage(r.room, a, c, WEAPONS.knife.damage, false, WEAPONS.knife, [0, 1, -5]);
    expect(c.alive).toBe(true);
  });

  it('the railgun never runs out of ammo and no power weapon appears', () => {
    const r = makeRoom('insta', 15);
    const a = r.join('Ana');
    for (let i = 0; i < WEAPONS.railgun.mag + 2; i++) {
      vi.advanceTimersByTime(WEAPONS.railgun.fireRate + 10);
      handleShoot(r.room, a, { o: [a.x, a.y + 1.6, a.z], d: [[0, 1, 0]], lag: 0 });
    }
    expect(a.shots).toBe(WEAPONS.railgun.mag + 2);
    expect(a.ammo[0]!.mag).toBe(WEAPONS.railgun.mag);
    r.room.map = { ...r.room.map, powerSpots: [[0, 0, 30]] };
    const start = Date.now();
    resetWorld(r.room);
    tickWorld(r.room, start + POWER.firstMs + 1);
    expect(r.room.world.power).toBeNull();
  });
});

describe('congelados', () => {
  it('a killed player is frozen where he fell and a teammate next to him thaws him', () => {
    const r = makeRoom('freeze', 3);
    const red = r.join('Rojo');
    const blue = r.join('Azul');
    const red2 = r.join('Rojo 2');
    expect([red.team, blue.team, red2.team]).toEqual([1, 2, 1]);
    nextRound(r);
    r.place(red, -10, 5);
    r.place(red2, -30, -30);
    kill(r, blue, red);
    expect(r.room.mode.canSpawn?.(r.room, red)).toBe(false);
    expect(snap(r).ic).toEqual([[red.id, -10, 0, 5, 1, 0]]);
    expect(r.room.teamScore).toEqual({ 1: 0, 2: 0 });
    // A teammate stands by the statue: half way after half the time
    r.place(red2, -10 + FREEZE.radius / 2, 5);
    play(r, FREEZE.thawMs / 2);
    expect(snap(r).ic![0]![5]).toBeCloseTo(50, -1);
    play(r, FREEZE.thawMs / 2 + 200);
    expect(red.alive).toBe(true);
    expect([red.x, red.z]).toEqual([-10, 5]);
    expect(red.protUntil).toBeGreaterThan(Date.now());
    expect(red2.caps).toBe(1);
    expect(snap(r).ic).toEqual([]);
    expect(r.channel.notices()).toContain('Rojo 2 descongeló a Rojo');
  });

  it('a team all frozen loses the round; then everybody is back; time up: fewer frozen wins', () => {
    const r = makeRoom('freeze', 3);
    const red = r.join('Rojo');
    const blue = r.join('Azul');
    const red2 = r.join('Rojo 2');
    nextRound(r);
    kill(r, blue, red);
    kill(r, blue, red2);
    expect(r.room.teamScore).toEqual({ 1: 0, 2: 1 });
    expect(r.channel.notices()).toContain('Equipo Azul gana la ronda 1');
    nextRound(r);
    expect([red, blue, red2].every((p) => p.alive)).toBe(true);
    expect(snap(r).ic).toEqual([]);
    kill(r, red, blue); // Blue's only player frozen: Red wins
    expect(r.room.teamScore).toEqual({ 1: 1, 2: 1 });
    nextRound(r);
    r.place(red2, 30, 30);
    kill(r, blue, red);
    play(r, ROUNDS.roundMs);
    expect(r.room.teamScore).toEqual({ 1: 1, 2: 2 });
  });
});

describe('bomba', () => {
  const setup = (limit = 3) => {
    const r = makeRoom('bomb', limit);
    const red = r.join('Rojo');
    const blue = r.join('Azul');
    nextRound(r);
    return { r, red, blue, sites: bombSites(r.room.map) };
  };

  it('two sites on Blue’s half, one north and one south, on open ground', () => {
    const { r, sites } = setup();
    const [a, b] = sites;
    expect(a[0]).toBeGreaterThan(0);
    expect(b[0]).toBeGreaterThan(0);
    expect(a[2]).toBeLessThan(0);
    expect(b[2]).toBeGreaterThan(0);
    expect(r.room.modeId).toBe('bomb');
  });

  it('a Red player carries the bomb; planted, it explodes and Red wins the round', () => {
    const { r, red, blue, sites } = setup();
    play(r, 100);
    expect(snap(r).bm).toMatchObject({ st: 0, c: red.id });
    r.place(blue, -30, 30);
    const [x, y, z] = sites[0];
    r.place(red, x, z, y);
    play(r, BOMB.plantMs / 2);
    expect(snap(r).bm).toMatchObject({ st: 0, s: 0, pp: expect.closeTo(50, -1) });
    play(r, BOMB.plantMs / 2 + 200);
    expect(snap(r).bm).toMatchObject({ st: 2, s: 0, c: null });
    expect(r.channel.notices()).toContain('¡Bomba plantada en A!');
    // Time running out does not save Blue once it is planted; Red dying does not either
    play(r, BOMB.fuseMs - 1000);
    kill(r, blue, red);
    expect(r.room.teamScore).toEqual({ 1: 0, 2: 0 });
    play(r, 1200);
    expect(r.room.teamScore).toEqual({ 1: 1, 2: 0 });
    expect(r.channel.notices()).toContain('¡La bomba ha explotado!');
  });

  it('a Blue player next to the planted bomb defuses it', () => {
    const { r, red, blue, sites } = setup();
    play(r, 100);
    const [x, y, z] = sites[1];
    r.place(red, x, z, y);
    play(r, BOMB.plantMs + 200);
    expect(snap(r).bm).toMatchObject({ st: 2, s: 1 });
    r.place(red, -30, -30);
    r.place(blue, x + 0.5, z, y);
    play(r, BOMB.defuseMs / 2);
    expect(snap(r).bm!.dp).toBeCloseTo(50, -1);
    // Stepping away starts it again
    r.place(blue, x + 10, z, y);
    play(r, 100);
    expect(snap(r).bm!.dp).toBe(0);
    r.place(blue, x + 0.5, z, y);
    play(r, BOMB.defuseMs + 200);
    expect(r.room.teamScore).toEqual({ 1: 0, 2: 1 });
    expect(r.channel.notices()).toContain('Bomba desactivada por Azul');
  });

  it('the bomb drops where its carrier dies and another Red picks it up; Red all dead before a plant: Blue wins', () => {
    const r = makeRoom('bomb', 3);
    const red = r.join('Rojo');
    const blue = r.join('Azul');
    const red2 = r.join('Rojo 2');
    nextRound(r);
    play(r, 100);
    const carrier = snap(r).bm!.c === red.id ? red : red2;
    const other = carrier === red ? red2 : red;
    r.place(carrier, -12, 4);
    r.place(other, -30, -30);
    play(r, 100);
    kill(r, blue, carrier);
    play(r, 100);
    expect(snap(r).bm).toMatchObject({ st: 1, c: null, x: -12, z: 4 });
    r.place(other, -12, 4);
    play(r, 100);
    expect(snap(r).bm).toMatchObject({ st: 0, c: other.id });
    kill(r, blue, other);
    expect(r.room.teamScore).toEqual({ 1: 0, 2: 1 });
  });

  it('time running out without a plant: Blue wins; all Blue dead: Red wins', () => {
    const { r, red, blue } = setup();
    play(r, ROUNDS.roundMs);
    expect(r.room.teamScore).toEqual({ 1: 0, 2: 1 });
    nextRound(r);
    kill(r, red, blue);
    expect(r.room.teamScore).toEqual({ 1: 1, 2: 1 });
  });
});

describe('round modes: no escape mid-round', () => {
  it('congelados: a frozen player can neither switch team nor be balanced out of his statue, and stays out', () => {
    const r = makeRoom('freeze', 3);
    const red = r.join('Rojo');
    const blue = r.join('Azul');
    const red2 = r.join('Rojo 2');
    r.join('Rojo 3').team = 1; // 3 v 1
    nextRound(r);
    r.place(red2, 30, 30);
    kill(r, blue, red);
    expect(requestTeam(r.room, red, 2, Date.now())).toMatch(/ronda/);
    expect(red.team).toBe(1);
    // 3 v 1 with a dead Red: balancing waits for the break
    expect(autoBalance(r.room)).toBeNull();
    expect(red.team).toBe(1);
    // Even moved some other way (the admin), he is out until the next round
    red.team = 2;
    play(r, 100);
    expect(r.room.mode.canSpawn?.(r.room, red)).toBe(false);
  });

  it('rondas: an alive player cannot switch team (and respawn on the other side) during a round; in the break he can', () => {
    const r = makeRoom('rounds', 3);
    const red = r.join('Rojo');
    const blue = r.join('Azul');
    const red2 = r.join('Rojo 2');
    nextRound(r);
    vi.advanceTimersByTime(10_000); // past the switch cooldown
    red.hp = 10;
    expect(requestTeam(r.room, red, 2, Date.now())).toMatch(/ronda/);
    expect([red.team, red.hp]).toEqual([1, 10]);
    kill(r, blue, red);
    kill(r, blue, red2);
    expect(r.room.teamScore).toEqual({ 1: 0, 2: 1 }); // the break
    expect(requestTeam(r.room, red2, 2, Date.now())).toBeNull();
    expect(red2.team).toBe(2);
  });

  it('bomba: team changes also wait for the break', () => {
    const r = makeRoom('bomb', 3);
    const red = r.join('Rojo');
    r.join('Azul');
    r.join('Rojo 2');
    nextRound(r);
    vi.advanceTimersByTime(10_000);
    expect(requestTeam(r.room, red, 2, Date.now())).toMatch(/ronda/);
    expect(red.team).toBe(1);
  });
});

describe('round modes: someone leaving ends the round', () => {
  it('último en pie: the second to last leaves, the last one alive wins the round', () => {
    const r = makeRoom('lms', 3);
    const a = r.join('Ana');
    const b = r.join('Bea');
    const c = r.join('Cris');
    nextRound(r);
    kill(r, a, b);
    r.registry.removePlayer(r.room, c.id);
    play(r, 100);
    expect(a.caps).toBe(1);
  });

  it('rondas: the last alive of a team leaves, the other team wins the round', () => {
    const r = makeRoom('rounds', 3);
    const red = r.join('Rojo');
    const blue = r.join('Azul');
    r.join('Rojo 2');
    const blue2 = r.join('Azul 2');
    nextRound(r);
    kill(r, red, blue);
    r.registry.removePlayer(r.room, blue2.id);
    play(r, 100);
    expect(r.room.teamScore).toEqual({ 1: 1, 2: 0 });
  });

  it('último en pie: only players who picked a class count to start', () => {
    const r = makeRoom('lms', 3);
    r.join('Ana');
    r.registry.addPlayer(r.room, 'menu', 'Bea'); // still on the character screen
    nextRound(r);
    expect(snap(r).rd).toMatchObject({ p: 0 });
  });

  for (const mode of ['rounds', 'freeze', 'bomb'] as const) {
    it(`${mode}: a team whose only player is on the character screen does not lose rounds for free`, () => {
      const r = makeRoom(mode, 3);
      r.join('Rojo');
      r.registry.addPlayer(r.room, 'menu', 'Azul'); // Blue, still choosing a class
      nextRound(r);
      play(r, 100);
      expect(snap(r).rd).toMatchObject({ p: 0 });
      expect(r.room.teamScore).toEqual({ 1: 0, 2: 0 });
    });
  }
});

describe('power weapons', () => {
  for (const mode of ['gungame', 'infect'] as const) {
    it(`${mode}: no power weapon appears`, () => {
      const r = makeRoom(mode, 15);
      r.join('Ana');
      r.room.map = { ...r.room.map, powerSpots: [[0, 0, 30]] };
      const start = Date.now();
      resetWorld(r.room);
      tickWorld(r.room, start + POWER.firstMs + 1);
      expect(r.room.world.power).toBeNull();
    });
  }
});
