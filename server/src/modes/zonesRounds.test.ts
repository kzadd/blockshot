import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DOM,
  MAPS,
  ROUNDS,
  SERVER_TICK_MS,
  WEAPONS,
  bombSites,
  dominationZones,
  getMap,
  mapFits,
} from '@blockshot/shared';
import { applyDamage } from '../combat/damage';
import { buildSnapshot } from '../game/tick';
import { adminKill } from '../match/admin';
import type { Player } from '../players/player';
import { pickSpawn } from '../players/spawn';
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

beforeEach(() => vi.useFakeTimers({ now: 1_000_000 }));
afterEach(() => vi.useRealTimers());

describe('domination', () => {
  it('a lone player takes a zone, a rival in it stops the capture, holding it scores points', () => {
    const r = makeRoom('dom', 100);
    const red = r.join('Rojo');
    const blue = r.join('Azul');
    expect([red.team, blue.team]).toEqual([1, 2]);
    const [a] = dominationZones(r.room.map);
    r.place(red, a![0], a![2]);
    r.place(blue, 30, 30);
    play(r, DOM.captureMs / 2);
    expect(buildSnapshot(r.room, Date.now()).dz![0]).toEqual([0, expect.closeTo(50, -1), 0]);
    // A rival walks in: contested, nothing moves
    r.place(blue, a![0] + 1, a![2]);
    play(r, 1000);
    const contested = buildSnapshot(r.room, Date.now()).dz![0]!;
    expect(contested[2]).toBe(1);
    r.place(blue, 30, 30);
    play(r, DOM.captureMs / 2 + 200);
    expect(buildSnapshot(r.room, Date.now()).dz![0]![0]).toBe(1);
    expect(red.caps).toBe(1);
    expect(r.channel.notices()).toContain('Equipo Rojo captura la zona A');
    play(r, DOM.scoreEveryMs * 3);
    expect(r.room.teamScore[1]).toBeGreaterThanOrEqual(3);
    expect(r.room.teamScore[2]).toBe(0);
  });
});

describe('rounds', () => {
  it('waits for a rival, then plays rounds without respawning until one team is out', () => {
    const r = makeRoom('rounds', 3);
    const red = r.join('Rojo');
    expect(buildSnapshot(r.room, Date.now()).rd).toMatchObject({ p: 0 });
    const blue = r.join('Azul');
    play(r, ROUNDS.breakMs + 100);
    expect(buildSnapshot(r.room, Date.now()).rd).toMatchObject({ p: 1, n: 1 });
    expect(r.room.mode.canSpawn?.(r.room, blue)).toBe(false);
    kill(r, red, blue);
    expect(r.room.teamScore[1]).toBe(1);
    expect(r.channel.notices()).toContain('Equipo Rojo gana la ronda 1');
    // The next round brings everybody back
    play(r, ROUNDS.breakMs + 100);
    expect(blue.alive).toBe(true);
    expect(buildSnapshot(r.room, Date.now()).rd).toMatchObject({ p: 1, n: 2 });
    kill(r, red, blue);
    expect(r.room.teamScore[1]).toBe(2);
    play(r, ROUNDS.breakMs + 100);
    kill(r, red, blue);
    expect(r.channel.of('match:end')[0]).toMatchObject({ winner: 'Equipo Rojo', team: 1 });
  });

  it("the admin's «Matar» wiping a team out ends the round (nobody scores the kill)", () => {
    const r = makeRoom('rounds', 3);
    r.join('Rojo');
    const blue = r.join('Azul');
    play(r, ROUNDS.breakMs + 100);
    adminKill(r.room, blue);
    expect(r.room.teamScore[1]).toBe(1);
    expect(r.channel.notices()).toContain('Equipo Rojo gana la ronda 1');
  });

  it('when time runs out the team with more players alive wins the round', () => {
    const r = makeRoom('rounds', 5);
    r.join('A');
    r.join('B');
    const c = r.join('C'); // Red has two players
    play(r, ROUNDS.breakMs + 100);
    expect(c.team).toBe(1);
    // Everybody at the zone's centre: the shrinking zone must not decide it
    const [x, y, z] = r.room.mode.snapshot!(r.room, Date.now()).zn!;
    for (const p of r.room.players.values()) r.place(p, x, z, y);
    play(r, ROUNDS.roundMs);
    expect(r.room.teamScore).toEqual({ 1: 1, 2: 0 });
  });
});

describe('team sides', () => {
  const maps = MAPS.filter((m) => mapFits(m.id, 'bomb')).map((m) => m.id);
  it.each(maps)('%s: Bomba and Supervivencia spawn Red west, Blue east; the bomb sites are on Blue’s side', (mapId) => {
    for (const mode of ['bomb', 'rounds'] as const) {
      const r = makeRoom(mode, 3, mapId);
      const red = r.join('Rojo');
      const blue = r.join('Azul');
      expect([red.team, blue.team]).toEqual([1, 2]);
      for (let i = 0; i < 10; i++) {
        expect(pickSpawn(r.room, red)[0]).toBeLessThan(0);
        expect(pickSpawn(r.room, blue)[0]).toBeGreaterThan(0);
      }
    }
    for (const [x] of bombSites(getMap(mapId, 'm'))) expect(x).toBeGreaterThan(0);
  });
});
