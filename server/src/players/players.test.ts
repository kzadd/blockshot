import { describe, expect, it } from 'vitest';
import { CHAR_BY_ID, FIXED_DT, MAX_QUEUED_INPUTS, MAX_SIM_BUDGET_S, type MoveInput } from '@blockshot/shared';
import { bestPlays } from '../match/match';
import { makeRoom } from '../testing/fakeRoom';
import { queueInputs, simulateRoom } from './movement';
import { pickSpawn, spawnPlayer } from './spawn';

const cmd = (seq: number, f = 1): MoveInput => ({ seq, f, s: 0, yaw: 0, pitch: 0, b: 0, slot: 0 });

describe('input queue', () => {
  it('ignores repeated or old commands and caps the queue', () => {
    const { join } = makeRoom('ffa');
    const p = join('A');
    queueInputs(p, [cmd(1), cmd(2), cmd(2), cmd(1), cmd(3)]);
    expect(p.inputs.map((c) => c.seq)).toEqual([1, 2, 3]);
    queueInputs(
      p,
      Array.from({ length: MAX_QUEUED_INPUTS * 2 }, (_, i) => cmd(10 + i)),
    );
    expect(p.inputs).toHaveLength(MAX_QUEUED_INPUTS);
  });

  it('a respawn accepts a client that numbers its commands from 0 again (new map after a vote)', () => {
    const { room, join } = makeRoom('ffa');
    const p = join('A', 0, 20);
    p.lastSeq = 20000; // last command of the previous match
    spawnPlayer(room, p, CHAR_BY_ID.soldado, 'base');
    queueInputs(p, [cmd(0), cmd(1)]);
    expect(p.inputs.map((c) => c.seq)).toEqual([0, 1]);
  });

  it('keeps the camouflage and finish picked at spawn, and ignores unknown ones', () => {
    const { room, join } = makeRoom('ffa');
    const p = join('A', 0, 20);
    spawnPlayer(room, p, CHAR_BY_ID.soldado, 'base', undefined, 'tigre', 'oro');
    expect([p.camo, p.finish]).toEqual(['tigre', 'oro']);
    p.alive = false;
    spawnPlayer(room, p, CHAR_BY_ID.soldado, 'base', undefined, 'rosa', 'diamante');
    expect([p.camo, p.finish]).toEqual(['liso', 'estandar']);
  });

  it('only simulates the time that passed (plus the jitter bank)', () => {
    const { room, join } = makeRoom('ffa');
    const p = join('A', 0, 20);
    queueInputs(p, Array.from({ length: 600 }, (_, i) => cmd(i)).slice(0, MAX_QUEUED_INPUTS));
    simulateRoom(room, FIXED_DT, Date.now());
    expect(p.lastSeq).toBe(0); // one tick → one step
    for (let i = 0; i < 100; i++) simulateRoom(room, FIXED_DT, Date.now());
    expect(p.lastSeq).toBe(MAX_QUEUED_INPUTS - 1);
    // the bank never exceeds MAX_SIM_BUDGET_S
    for (let i = 0; i < 100; i++) simulateRoom(room, FIXED_DT, Date.now());
    expect(p.simBudget).toBeLessThanOrEqual(MAX_SIM_BUDGET_S);
  });

  it('moves the player forwards (yaw 0 looks towards -z) and records it for lag compensation', () => {
    const { room, join } = makeRoom('ffa');
    const p = join('A', 0, 20);
    queueInputs(
      p,
      Array.from({ length: 30 }, (_, i) => cmd(i)),
    );
    for (let i = 0; i < 30; i++) simulateRoom(room, FIXED_DT, Date.now() + i);
    expect(p.z).toBeLessThan(20);
    expect(p.hist.length).toBeGreaterThan(0);
  });

  it('dead players do not move and their queue is dropped', () => {
    const { room, join } = makeRoom('ffa');
    const p = join('A', 0, 20);
    p.alive = false;
    queueInputs(p, [cmd(1), cmd(2)]);
    simulateRoom(room, FIXED_DT, Date.now());
    expect(p.inputs).toHaveLength(0);
    expect(p.z).toBe(20);
  });
});

describe('spawns', () => {
  it('spawns away from enemies', () => {
    const { room, join, place } = makeRoom('ffa');
    const a = join('A');
    const b = join('B');
    const [sx, , sz] = room.map.spawns[0]!;
    place(a, sx, sz);
    for (let i = 0; i < 20; i++) {
      const s = pickSpawn(room, b);
      expect(Math.hypot(s[0] - sx, s[2] - sz)).toBeGreaterThan(20);
    }
  });
});

describe('best plays', () => {
  it('reports longest streak, headshots and accuracy (10 shots minimum)', () => {
    const { room, join } = makeRoom('ffa');
    const a = join('Ana');
    const b = join('Beto');
    Object.assign(a, { bestStreak: 5, heads: 1, shots: 9, hits: 9 });
    Object.assign(b, { bestStreak: 2, heads: 4, shots: 20, hits: 10 });
    expect(bestPlays(room)).toEqual([
      { t: 'Más bajas seguidas', v: '5', n: 'Ana' },
      { t: 'Tiros a la cabeza', v: '4', n: 'Beto' },
      { t: 'Precisión', v: '50 %', n: 'Beto · 10 de 20' },
    ]);
  });

  it('speed comes from the weapon actually held, not from the slot claimed in the input', () => {
    const run = (claimedSlot: number) => {
      const { room, join } = makeRoom('ffa');
      const p = join('A', 0, 20);
      queueInputs(
        p,
        Array.from({ length: 30 }, (_, i) => ({ ...cmd(i), slot: claimedSlot })),
      );
      for (let i = 0; i < 30; i++) simulateRoom(room, FIXED_DT, Date.now() + i);
      return 20 - p.z;
    };
    // slot 2 is the knife (lighter than the rifle in slot 0) but the player holds the rifle
    expect(run(2)).toBeCloseTo(run(0), 6);
  });
});
