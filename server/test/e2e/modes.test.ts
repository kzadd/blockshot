import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CHAR_BY_ID, INFECT, getMap, type KillEvent, type MatchEnd } from '@blockshot/shared';
import { Bot, shootUntil, sleep, startServer, type TestServer } from './harness';

const SPOT_A = [8, -2.5] as const;
const SPOT_B = [13, -2.5] as const;

let server: TestServer;
const bots: Bot[] = [];

beforeAll(async () => {
  server = await startServer();
});
afterAll(async () => {
  for (const b of bots) b.close();
  await server.stop();
});

async function room(mode: string, scoreLimit: number, chars: [string, string] = ['soldado', 'soldado']) {
  const a = new Bot(server.url, 'A');
  const b = new Bot(server.url, 'B');
  bots.push(a, b);
  const res = await a.create({ mapId: 'patio', size: 'm', mode, scoreLimit });
  if (!res.ok) throw new Error('create failed');
  await b.join(res.room.id);
  await a.spawn(chars[0]);
  await b.spawn(chars[1]);
  return { a, b };
}

/** b respawns, walks back to its spot and drops its protection. */
async function respawnAtSpot(b: Bot, char = 'soldado') {
  await sleep(3100);
  await b.spawn(char);
  await b.goTo(...SPOT_B);
  b.dropProtection();
}

describe('kill confirmed', () => {
  it('drops a tag that the killer team confirms', async () => {
    const { a, b } = await room('kc', 15);
    await a.idle(200);
    expect(a.me()?.tm).not.toBe(b.me()?.tm);
    await Promise.all([a.goTo(...SPOT_A), b.goTo(...SPOT_B)]);
    b.dropProtection();
    await shootUntil(a, b, () => a.count('kill') > 0);
    await a.idle(150);
    expect(a.state?.tg).toHaveLength(1);
    expect(a.state?.tg?.[0]?.[4]).toBe(b.me()?.tm);
    await a.goTo(...SPOT_B);
    await a.until(() => a.count('tag', (d: { type: string }) => d.type === 'confirm') > 0, 2000, 'confirm');
    await a.idle(150);
    const team = a.me()?.tm as 1 | 2;
    expect(a.state?.ts?.[team]).toBe(1);
    expect(a.state?.tg).toHaveLength(0);
    expect(a.me()?.cp).toBe(1);
  });
});

describe('infected', () => {
  it('picks the first infected, infects survivors and ends the match', async () => {
    const { a, b } = await room('infect', 2, ['soldado', 'rayo']);
    await a.idle(200);
    expect(a.me()?.tm).toBe(1);
    expect(b.me()?.tm).toBe(1);
    expect(a.state?.inf?.st).toBe(0);
    expect(a.state?.inf?.t).toBeGreaterThan(8000);
    await Promise.all([a.goTo(...SPOT_A), b.goTo(9.5, -2.5)]);
    const both = async (ms: number) => Promise.all([a.idle(ms), b.idle(ms)]);
    for (let i = 0; i < 260 && !a.state?.inf?.st; i++) await both(50);
    await both(100);
    expect(a.state?.inf?.st).toBe(1);
    expect(a.state?.inf?.t).toBeGreaterThan(100000);
    const zombie = a.me()?.tm === 2 ? a : b;
    const human = zombie === a ? b : a;
    expect(zombie.find('loadout', (d: { team?: number }) => d.team === 2)).toBeTruthy();
    const zombieChar = CHAR_BY_ID[zombie === a ? 'soldado' : 'rayo'];
    expect(zombie.me()?.mh).toBe(Math.round(zombieChar.hp * INFECT.hp));
    await both(4100);
    await shootUntil(zombie, human, () => zombie.count('kill') > 0, { tries: 10, every: 520, dy: 1 });
    expect(zombie.find<KillEvent>('kill')?.weapon).toBe('Cuchillo');
    await zombie.until(() => zombie.count('match:end') > 0, 2000, 'match end');
    expect(zombie.find<MatchEnd>('match:end')).toMatchObject({ winner: 'Los infectados', team: 2 });
  });
});

describe('streak rewards', () => {
  // Slow on purpose: the victim respawns 7 times and walks back to its spot every time
  it('gives radar at 5 and armor at 7 kills in a row', { timeout: 240_000 }, async () => {
    const { a, b } = await room('ffa', 20);
    await Promise.all([a.goTo(...SPOT_A), b.goTo(...SPOT_B)]);
    b.dropProtection();
    for (let k = 1; k <= 7; k++) {
      await shootUntil(a, b, () => a.count('kill') >= k);
      if (k === 5) {
        await a.idle(100);
        expect(a.me()?.rd).toBe(1);
      }
      a.reload(); // the bot does not auto-reload like the real client
      if (k < 7) await respawnAtSpot(b);
    }
    const last = a.events.filter(([e]) => e === 'kill').pop()?.[1] as KillEvent;
    expect(last).toMatchObject({ streak: 7, reward: 'Blindaje' });
    await a.idle(100);
    expect(a.me()?.ar).toBe(50);
    await respawnAtSpot(b);
    await sleep(150); // respect the rifle fire rate after the protection-dropping shot
    a.hold();
    b.shootAt(a);
    await a.idle(200);
    expect(a.me()?.h).toBe(100);
    expect(a.me()?.ar).toBe(26);
  });
});

describe('capture the flag', () => {
  it('takes the enemy flag and captures it at home', async () => {
    const { a } = await room('ctf', 3);
    await a.idle(200);
    const map = getMap('patio', 'm');
    const mine = a.me()?.tm as 1 | 2;
    const [ex, , ez] = map.bases[mine === 1 ? 2 : 1];
    const [hx, , hz] = map.bases[mine];
    await a.goTo(ex, ez);
    await a.until(() => a.count('flag', (d: { type: string }) => d.type === 'take') > 0, 2000, 'take');
    await a.goTo(hx, hz);
    await a.until(() => a.count('flag', (d: { type: string }) => d.type === 'capture') > 0, 2000, 'capture');
    await a.idle(150);
    expect(a.state?.ts?.[mine]).toBe(1);
    expect(a.me()?.cp).toBe(1);
  });
});

describe('gun game', () => {
  it('gives the next weapon on a kill', async () => {
    const { a, b } = await room('gungame', 5);
    await Promise.all([a.goTo(...SPOT_A), b.goTo(...SPOT_B)]);
    b.dropProtection();
    await shootUntil(a, b, () => a.count('kill') > 0);
    expect(a.find<KillEvent>('kill')?.weapon).toBe('Subfusil');
    await a.until(() => a.count('loadout', (d: { level: number }) => d.level === 1) > 0, 2000, 'level up');
    await a.idle(150);
    expect(a.me()?.lv).toBe(1);
  });
});
