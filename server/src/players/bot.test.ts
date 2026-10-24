import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isLocalSocket } from '../network/gateway';
import { makeRoom } from '../testing/fakeRoom';
import { MAX_BOTS, addBot, isBot, removeBots, tickBots } from './bot';
import { simulateRoom } from './movement';

const STEP_MS = 1000 / 60;

describe('practice bots', () => {
  beforeEach(() => vi.useFakeTimers({ now: 1_000_000 }));
  afterEach(() => vi.useRealTimers());

  const run = (f: ReturnType<typeof makeRoom>, ms: number) => {
    for (let t = 0; t < ms; t += STEP_MS) {
      vi.advanceTimersByTime(STEP_MS);
      tickBots(f.room, Date.now());
      simulateRoom(f.room, STEP_MS / 1000, Date.now());
    }
  };

  it('spawns, finds a rival in sight and kills it', () => {
    const f = makeRoom('ffa', undefined, 'polvo', 's');
    const me = f.join('Ana', 0, 0);
    expect(addBot(f.registry, f.room)).toBeNull();
    const bot = [...f.room.players.values()].find(isBot)!;
    run(f, STEP_MS);
    expect(bot.alive).toBe(true);
    f.place(bot, 0, 8);
    bot.protUntil = 0;
    me.protUntil = Number.MAX_SAFE_INTEGER; // no damage yet: the bot must not fire before its reaction time
    run(f, 300);
    expect(me.hp).toBe(me.maxHp);
    me.protUntil = 0;
    run(f, 8000);
    expect(me.deaths).toBeGreaterThan(0);
    expect(bot.kills).toBeGreaterThan(0);
  });

  it('is capped per room and does not keep an empty room open', () => {
    const f = makeRoom('ffa');
    f.join('Ana');
    for (let i = 0; i < MAX_BOTS; i++) expect(addBot(f.registry, f.room)).toBeNull();
    expect(addBot(f.registry, f.room)).toMatch(/bots/);
    expect(removeBots(f.registry, f.room)).toBe(MAX_BOTS);
    addBot(f.registry, f.room);
    f.registry.removePlayer(f.room, 'p1');
    expect(f.registry.count()).toBe(0);
  });
});

describe('isLocalSocket', () => {
  it('only trusts the server PC, also behind a local proxy', () => {
    expect(isLocalSocket('127.0.0.1', undefined)).toBe(true);
    expect(isLocalSocket('::1', undefined)).toBe(true);
    expect(isLocalSocket('::ffff:127.0.0.1', undefined)).toBe(true);
    expect(isLocalSocket('::ffff:192.168.1.20', undefined)).toBe(false);
    expect(isLocalSocket('::ffff:127.0.0.1', '192.168.1.20')).toBe(false);
    expect(isLocalSocket('127.0.0.1', '::1')).toBe(true);
    // A student spoofing the header through the proxy: the proxy appends the real address last
    expect(isLocalSocket('127.0.0.1', '127.0.0.1, 192.168.1.20')).toBe(false);
    // ...and sending it straight to the server does nothing
    expect(isLocalSocket('192.168.1.20', '127.0.0.1')).toBe(false);
  });
});
