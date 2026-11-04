import { describe, expect, it } from 'vitest';
import { PLAYER, SERVER_TICK_MS } from '@blockshot/shared';
import { makeRoom } from '../testing/fakeRoom';
import { snapshotRoom } from './tick';

describe('anti-camping', () => {
  it('drains health after staying in one spot too long (never below 1), and stops when you move', () => {
    const r = makeRoom('ffa');
    const a = r.join('Ana', 5, 30);
    let now = Date.now();
    const tick = (n: number) => {
      for (let i = 0; i < n; i++) snapshotRoom(r.room, (now += SERVER_TICK_MS));
    };
    tick(Math.ceil(PLAYER.campMs / SERVER_TICK_MS) - 2);
    expect(a.hp).toBe(a.maxHp);
    tick(Math.ceil(3000 / SERVER_TICK_MS));
    expect(a.hp).toBeLessThan(a.maxHp);
    expect(r.channel.notices().some((t) => t.includes('Muévete'))).toBe(true);
    tick(Math.ceil(60000 / SERVER_TICK_MS));
    expect(a.hp).toBe(1);
    // Moving away resets the clock: no more drain
    r.place(a, 5 + PLAYER.campRadius + 2, 30);
    const hp = a.hp;
    tick(Math.ceil(3000 / SERVER_TICK_MS));
    expect(a.hp).toBeGreaterThanOrEqual(hp);
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
