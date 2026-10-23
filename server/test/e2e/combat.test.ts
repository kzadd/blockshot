import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { KillEvent } from '@blockshot/shared';
import { Bot, shootUntil, sleep, startServer, type TestServer } from './harness';

// Open spot in Patio (medium): two bots 5 m apart with a clear line of fire
const SPOT_A = [8, -2.5] as const;
const SPOT_B = [13, -2.5] as const;
const HEAD_DY = 1.64;

let server: TestServer;
const bots: Bot[] = [];

beforeAll(async () => {
  server = await startServer();
});
afterAll(async () => {
  for (const b of bots) b.close();
  await server.stop();
});

async function duel(mode = 'ffa', charA = 'soldado', charB = 'soldado') {
  const a = new Bot(server.url, 'A');
  const b = new Bot(server.url, 'B');
  bots.push(a, b);
  const res = await a.create({ mapId: 'patio', size: 'm', mode });
  if (!res.ok) throw new Error('create failed');
  await b.join(res.room.id);
  await a.spawn(charA);
  await b.spawn(charB);
  await Promise.all([a.goTo(...SPOT_A), b.goTo(...SPOT_B)]);
  return { a, b };
}

describe('combat', () => {
  // Walking to the firing spot takes longer than the protection lasts: that damage is blocked during the
  // protection is covered by the applyDamage unit test; here the protocol side is checked.
  it('reports spawn protection and drops it when the player shoots', async () => {
    const a = new Bot(server.url, 'A');
    bots.push(a);
    await a.create({ mapId: 'patio', size: 'm' });
    await a.spawn();
    await a.idle(150);
    expect(a.me()?.pr).toBe(1);
    a.dropProtection();
    await a.idle(150);
    expect(a.me()?.pr).toBe(0);
  });

  it('applies body and head damage with the weapon multipliers', async () => {
    const { a, b } = await duel();
    b.dropProtection();
    await sleep(100);
    await shootUntil(a, b, () => a.count('hitmarker') > 0, { tries: 3 });
    expect(a.find<{ dmg: number; head: boolean }>('hitmarker')).toMatchObject({ dmg: 24, head: false });
    a.events = [];
    await sleep(150);
    await shootUntil(a, b, () => a.count('hitmarker') > 0, { tries: 3, dy: HEAD_DY });
    expect(a.find<{ dmg: number; head: boolean }>('hitmarker')).toMatchObject({ dmg: 38, head: true });
  });

  it('kills, scores and regenerates', async () => {
    const { a, b } = await duel();
    b.dropProtection();
    await shootUntil(a, b, () => a.count('kill') > 0);
    const kill = a.find<KillEvent>('kill');
    expect(kill).toMatchObject({ killer: a.id, victim: b.id, weapon: 'Rifle de asalto', streak: 1, killerName: 'A' });
    await a.idle(200);
    expect(a.me()?.k).toBe(1);
    expect(a.state?.players.find((p) => p.id === b.id)).toMatchObject({ d: 1, a: 0 });
  });

  it('heals after 5 s without damage', async () => {
    const { a, b } = await duel();
    b.dropProtection();
    await shootUntil(a, b, () => a.count('hitmarker') > 0, { tries: 3 });
    await b.idle(300);
    expect(b.me()?.h).toBe(76);
    await b.idle(5000 + 2000);
    expect(b.me()?.h).toBe(100);
  });

  it('backstabs with the knife for 200 damage', async () => {
    const { a, b } = await duel('ffa', 'soldado', 'tanque');
    b.dropProtection();
    a.switchSlot(2);
    // b looks towards -z (yaw 0); standing on its +z side is behind it
    await a.goTo(SPOT_B[0], SPOT_B[1] + 1.4);
    await shootUntil(a, b, () => a.count('kill') > 0, { tries: 4, every: 520, dy: 1 });
    expect(a.find<KillEvent>('kill')).toMatchObject({ weapon: 'Cuchillo', victim: b.id });
  });

  it('has no friendly fire in team modes', async () => {
    const { a, b } = await duel('teams');
    await a.idle(200);
    const teamA = a.me()?.tm;
    b.s.emit('team:set', { team: teamA ?? 0 });
    await b.until(() => b.me()?.tm === teamA, 3000, 'team switch');
    await Promise.all([a.goTo(...SPOT_A), b.goTo(...SPOT_B)]);
    b.dropProtection();
    await shootUntil(a, b, () => false, { tries: 4 });
    expect(a.count('hitmarker')).toBe(0);
  });

  it('enforces the team switch cooldown', async () => {
    const { a } = await duel('teams');
    await a.idle(200);
    const t = a.me()?.tm === 1 ? 2 : 1;
    a.s.emit('team:set', { team: t });
    await a.idle(300);
    a.s.emit('team:set', { team: t === 1 ? 2 : 1 });
    await a.until(() => a.count('notice', (n: string) => n.startsWith('Espera unos segundos')) > 0, 2000, 'cooldown');
  });
});
