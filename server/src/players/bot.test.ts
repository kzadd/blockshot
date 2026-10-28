import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CHAR_BY_ID, PAD, SIM_STEPS_PER_TICK, WEAPONS } from '@blockshot/shared';
import { applyDamage } from '../combat/damage';
import { buildSnapshot } from '../game/tick';
import { isLocalSocket } from '../network/gateway';
import { makeRoom } from '../testing/fakeRoom';
import { MAX_BOTS, addBot, isBot, removeBots, tickBots } from './bot';
import { simulateRoom } from './movement';
import { navGrid } from './nav';
import { spawnPlayer } from './spawn';

const STEP_MS = 1000 / 60;

describe('practice bots', () => {
  beforeEach(() => vi.useFakeTimers({ now: 1_000_000 }));
  afterEach(() => vi.useRealTimers());

  /** Simulates `ms` like the server: bots and movement every step, and (optionally) the mode rules every tick. */
  const run = (f: ReturnType<typeof makeRoom>, ms: number, modeRules = false) => {
    let tick = 0;
    for (let t = 0; t < ms; t += STEP_MS) {
      vi.advanceTimersByTime(STEP_MS);
      tickBots(f.room, Date.now());
      simulateRoom(f.room, STEP_MS / 1000, Date.now());
      if (modeRules && ++tick % SIM_STEPS_PER_TICK === 0 && !f.room.matchOver) f.room.mode.tick?.(f.room, Date.now());
    }
  };

  it('spawns, finds a rival in sight and kills it', () => {
    const f = makeRoom('ffa', undefined, 'polvo', 's');
    const me = f.join('Ana', 0, 0);
    expect(addBot(f.registry, f.room)).toBeNull();
    const bot = [...f.room.players.values()].find(isBot)!;
    run(f, STEP_MS);
    expect(bot.alive).toBe(true);
    // A hitscan gun: the bot's random pick could be the Artillero, whose launcher shells this loop never flies
    spawnPlayer(f.room, bot, CHAR_BY_ID.soldado, 'base');
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

  it('climbs the Obra stairs towards a rival on the roof and engages it', () => {
    const f = makeRoom('ffa', undefined, 'obra', 'm');
    const t = 10; // half side of the skeleton on the medium map
    const me = f.join('Ana', 0, 0);
    f.place(me, 0, t * 0.5, 9);
    me.protUntil = Number.MAX_SAFE_INTEGER; // only the climb is tested
    addBot(f.registry, f.room, 'hard');
    const bot = [...f.room.players.values()].find(isBot)!;
    run(f, STEP_MS);
    // A shotgun only fires up close, so it has to climb (a long gun may shoot from the ground)
    spawnPlayer(f.room, bot, CHAR_BY_ID.tanque, 'base');
    f.place(bot, -(f.room.map.half - 4), 0);
    run(f, 40000);
    // It stops to shoot as soon as it sees the rival, sometimes from the last flight: past the 2nd floor is enough
    expect(bot.y).toBeGreaterThan(6);
    expect(bot.shots).toBeGreaterThan(0);
  });

  it('takes out the secondary when the rival is out of shotgun range', () => {
    const f = makeRoom('ffa', undefined, 'polvo', 's');
    f.join('Ana', 0, 0);
    addBot(f.registry, f.room, 'easy');
    const bot = [...f.room.players.values()].find(isBot)!;
    run(f, STEP_MS);
    spawnPlayer(f.room, bot, CHAR_BY_ID.tanque, 'base');
    f.place(bot, 0, 25);
    bot.protUntil = 0;
    run(f, 1000);
    expect(bot.name).toBe('Bot 1 · Fácil');
    expect(bot.loadout[bot.slot]).toBe('revolver');
  });

  it('plays domination: walks to a zone and takes it', () => {
    const f = makeRoom('dom', undefined, 'patio', 'm');
    const me = f.join('Ana', 0, 0); // Red
    me.alive = false; // nobody to fight: only the objective
    addBot(f.registry, f.room, 'normal');
    const bot = [...f.room.players.values()].find(isBot)!;
    run(f, 40000, true);
    const owned = buildSnapshot(f.room, Date.now()).dz!.filter(([owner]) => owner === bot.team);
    expect(owned.length).toBeGreaterThan(0);
  });

  it('plays capture the flag: steals the rival flag and brings it home', () => {
    const f = makeRoom('ctf', undefined, 'patio', 's');
    const me = f.join('Ana', 0, 0); // Red
    me.alive = false;
    addBot(f.registry, f.room, 'normal');
    const bot = [...f.room.players.values()].find(isBot)!;
    run(f, 60000, true);
    // Read the announcements: a won match restarts (scores back to 0) and balancing may move the bot
    expect(f.channel.notices().some((n) => n.startsWith(`¡${bot.name} capturó`))).toBe(true);
  });

  it('takes a jump pad onto the Patio tower to pick up a tag', () => {
    const f = makeRoom('kc', undefined, 'patio', 'm');
    expect(navGrid(f.room.map, f.room.colliders).padJumps.size).toBeGreaterThan(0);
    // A Red player dies on top of the central tower and drops a tag there
    const me = f.join('Ana', 0, 0);
    f.place(me, 3, 5, 3);
    addBot(f.registry, f.room, 'normal');
    const bot = [...f.room.players.values()].find(isBot)!;
    run(f, STEP_MS);
    applyDamage(f.room, bot, me, 999, false, WEAPONS.rifle, [3, 4, 5]);
    // The bot starts next to the pad at the foot of the tower
    f.place(bot, 6.5, 11.5);
    let launched = false;
    for (let t = 0; t < 8000 && !f.room.teamScore[2]; t += 100) {
      run(f, 100, true);
      launched ||= bot.move.vy > PAD.power * 0.8;
    }
    expect(launched).toBe(true);
    expect(f.room.teamScore[2]).toBe(1); // tag confirmed up there
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
