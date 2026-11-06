import { describe, expect, it } from 'vitest';
import {
  BTN_SHOVE,
  FIXED_DT,
  MAX_QUEUED_INPUTS,
  MAX_SIM_BUDGET_S,
  SHOVE,
  WEAPONS,
  type MoveInput,
} from '@blockshot/shared';
import { applyDamage } from '../combat/damage';
import { bestPlays } from '../match/match';
import { makeRoom } from '../testing/fakeRoom';
import { queueInputs, sendAcks, simulateRoom } from './movement';
import { pickSpawn, spawnPlayer } from './spawn';

const cmd = (seq: number, f = 1, b = 0): MoveInput => ({ seq, f, s: 0, yaw: 0, pitch: 0, b, slot: 0 });

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
    spawnPlayer(room, p);
    queueInputs(p, [cmd(0), cmd(1)]);
    expect(p.inputs.map((c) => c.seq)).toEqual([0, 1]);
  });

  it('keeps the camouflage and finish picked at spawn, and ignores unknown ones', () => {
    const { room, join } = makeRoom('ffa');
    const p = join('A', 0, 20);
    spawnPlayer(room, p, { camo: 'tigre', finish: 'oro' });
    expect([p.camo, p.finish]).toEqual(['tigre', 'oro']);
    p.alive = false;
    spawnPlayer(room, p, { camo: 'rosa', finish: 'diamante' });
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
    const p = join('A', 5, 30); // open ground (the fountain stands at (0, 21.5))
    queueInputs(
      p,
      Array.from({ length: 30 }, (_, i) => cmd(i)),
    );
    for (let i = 0; i < 30; i++) simulateRoom(room, FIXED_DT, Date.now() + i);
    expect(p.z).toBeLessThan(30);
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

describe('pushes and the void', () => {
  it('the shove key (V) pushes whoever stands right in front, teammates too, no damage, once a second', () => {
    const { room, join, channel } = makeRoom('teams');
    const a = join('A', 5, 30);
    const b = join('B', 5, 29); // 1 m in front (yaw 0 looks towards -z)
    b.team = a.team;
    const c = join('C', 5, 31.5); // behind: never shoved
    queueInputs(a, [cmd(0, 0, BTN_SHOVE)]);
    simulateRoom(room, FIXED_DT, 1000);
    expect(b.move.vz).toBeCloseTo(-SHOVE.push);
    expect(b.move.vy).toBe(SHOVE.lift);
    expect(c.move.vz).toBe(0);
    expect(b.hp).toBe(b.maxHp);
    expect(channel.of('hitmarker', a.id)[0]).toMatchObject({ id: b.id, dmg: 0, kill: false });
    // its own client gets the push in the ack
    sendAcks(room);
    expect(channel.of('player:ack', b.id).at(-1)?.s.vz).toBeCloseTo(-SHOVE.push);
    // cooldown: a second press right away does nothing
    b.move.vz = 0;
    queueInputs(a, [cmd(1, 0, BTN_SHOVE)]);
    simulateRoom(room, FIXED_DT, 1000 + SHOVE.cooldownMs / 2);
    expect(b.move.vz).toBe(0);
    queueInputs(a, [cmd(2, 0, BTN_SHOVE)]);
    simulateRoom(room, FIXED_DT, 1000 + SHOVE.cooldownMs);
    expect(b.move.vz).toBeLessThan(0);
  });

  it('falling into the void is a death (the kill feed says so); not in the race', () => {
    const { room, join, place, channel } = makeRoom('ffa');
    const a = join('A');
    place(a, room.map.half + 5, 0, -19); // outside the walls, under the floor
    a.move.grounded = false;
    for (let i = 0; i < 30 && a.alive; i++) {
      queueInputs(a, [cmd(i, 0)]);
      simulateRoom(room, FIXED_DT, Date.now());
    }
    expect(a.alive).toBe(false);
    expect(a.deaths).toBe(1);
    expect(channel.of('kill')[0]).toMatchObject({ victim: a.id, weapon: 'Vacío' });
  });

  it('in the race shots push instead of hurting: no damage, no kill feed, the hitmarker still shows', () => {
    const { room, join, channel } = makeRoom('race', 2, 'circuito');
    const a = join('A', 0, 10);
    const b = join('B', 0, 5);
    for (let i = 0; i < 3; i++) applyDamage(room, a, b, 999, true, WEAPONS.pistol, [0, 1, 5]);
    expect(b.alive).toBe(true);
    expect(b.hp).toBe(b.maxHp);
    expect(b.move.vz).toBeCloseTo(-3 * SHOVE.push); // away from the shooter
    expect(b.move.vy).toBe(SHOVE.lift);
    expect(channel.of('kill')).toHaveLength(0);
    expect(channel.of('hitmarker', a.id)).toHaveLength(3);
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
