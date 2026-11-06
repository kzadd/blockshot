import { describe, expect, it } from 'vitest';
import { PLAYER, SERVER_TICK_MS } from '@blockshot/shared';
import { makeRoom } from '../testing/fakeRoom';
import { buildSnapshot, snapshotRoom } from './tick';

describe('anti-camping', () => {
  it('warns, then shows the camper to rivals and drains health until it dies; moving inside the zone does not help', () => {
    const r = makeRoom('ffa');
    const a = r.join('Ana', 5, 30);
    let now = Date.now();
    const tick = (ms: number) => {
      for (let t = 0; t < ms; t += SERVER_TICK_MS) snapshotRoom(r.room, (now += SERVER_TICK_MS));
    };
    const camp = () => buildSnapshot(r.room, now).players.find((p) => p.id === a.id)?.camp;
    tick(PLAYER.campWarnMs - 500);
    expect(r.channel.notices().some((t) => t.includes('Sal de esta zona'))).toBe(false);
    // Shuffling around inside the zone keeps the clock running
    r.place(a, 5 + PLAYER.campRadius - 1, 30);
    tick(1000);
    expect(r.channel.notices().some((t) => t.includes('Sal de esta zona'))).toBe(true);
    expect(a.hp).toBe(a.maxHp);
    expect(camp()).toBeUndefined();
    tick(PLAYER.campMs - PLAYER.campWarnMs);
    expect(camp()).toBe(1);
    expect(a.hp).toBeLessThan(a.maxHp);
    // Draining on kills: a death through the normal path
    tick((a.maxHp / PLAYER.campDrain) * 1000 + 1000);
    expect(a.alive).toBe(false);
    expect(a.deaths).toBe(1);
    expect(r.channel.of('kill').some((k) => k.victim === a.id && k.weapon === 'Campeo')).toBe(true);
  });

  it('leaving the zone clears it', () => {
    const r = makeRoom('ffa');
    const a = r.join('Ana', 5, 30);
    let now = Date.now();
    const tick = (ms: number) => {
      for (let t = 0; t < ms; t += SERVER_TICK_MS) snapshotRoom(r.room, (now += SERVER_TICK_MS));
    };
    tick(PLAYER.campMs + 2000);
    expect(a.hp).toBeLessThan(a.maxHp);
    r.place(a, 5 + PLAYER.campRadius + 1, 30);
    const hp = a.hp;
    tick(3000);
    expect(a.hp).toBeGreaterThanOrEqual(hp);
    expect(buildSnapshot(r.room, now).players[0]!.camp).toBeUndefined();
  });

  it('is off in the race', () => {
    const r = makeRoom('race', undefined, 'circuito');
    const a = r.join('Ana');
    const [x, y, z] = r.room.map.spawns[0]!;
    r.place(a, x, z, y); // on the start line, over the lava
    let now = Date.now();
    for (let t = 0; t < PLAYER.campMs + 3000; t += SERVER_TICK_MS) snapshotRoom(r.room, (now += SERVER_TICK_MS));
    expect(a.hp).toBe(a.maxHp);
    expect(a.life).toBe(1); // never sent back: it stood there all along
  });

  it('does not run between rounds (round modes: waiting for players, the break)', () => {
    const r = makeRoom('rounds');
    const a = r.join('Ana', 5, 30); // alone: the round waits for a rival
    let now = Date.now();
    for (let t = 0; t < PLAYER.campMs + 3000; t += SERVER_TICK_MS) snapshotRoom(r.room, (now += SERVER_TICK_MS));
    expect(r.room.mode.paused?.()).toBe(true);
    expect(r.channel.notices().some((t) => t.includes('Sal de esta zona'))).toBe(false);
    expect(a.hp).toBe(a.maxHp);
  });

  it('waits for a player who has not moved since spawning: protection held and no drain, up to idleGrace', () => {
    const r = makeRoom('ffa');
    const a = r.join('Ana', 5, 30);
    a.protUntil = a.spawnTime + PLAYER.spawnProtection; // as spawned (the test join drops it)
    let now = a.spawnTime;
    const tick = (ms: number) => {
      for (let t = 0; t < ms; t += SERVER_TICK_MS) snapshotRoom(r.room, (now += SERVER_TICK_MS));
    };
    // Still reading a menu well past the normal protection: still protected, full health
    tick(PLAYER.spawnProtection + 3000);
    expect(a.protUntil).toBeGreaterThan(now);
    expect(a.hp).toBe(a.maxHp);
    // After idleGrace it stops waiting: the protection runs out and the anti-camping clock starts
    tick(PLAYER.idleGrace + PLAYER.spawnProtection);
    expect(a.protUntil).toBeLessThan(now);
    tick(PLAYER.campMs + 3000);
    expect(a.hp).toBeLessThan(a.maxHp);
  });

  it('shooting ends the wait at once', () => {
    const r = makeRoom('ffa');
    const a = r.join('Ana', 5, 30);
    a.protUntil = 0; // what shooting does
    snapshotRoom(r.room, a.spawnTime + SERVER_TICK_MS);
    expect(a.idle).toBe(false);
    expect(a.protUntil).toBe(0);
  });
});
