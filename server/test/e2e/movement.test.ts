import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CHAR_BY_ID, WEAPONS, type MoveInput } from '@blockshot/shared';
import { Bot, sleep, startServer, type TestServer } from './harness';

let server: TestServer;
const bots: Bot[] = [];

beforeAll(async () => {
  server = await startServer();
});
afterAll(async () => {
  for (const b of bots) b.close();
  await server.stop();
});

async function solo(name: string) {
  const a = new Bot(server.url, name);
  bots.push(a);
  const res = await a.create({ mapId: 'patio', size: 'm' });
  if (!res.ok) throw new Error('create failed');
  await a.spawn('soldado');
  return a;
}

describe('authoritative movement', () => {
  it('simulates jump pads on the server', async () => {
    const a = await solo('Pad');
    // Patio jump pad at (4.6, 9): walk to just south of it and run north (yaw 0 looks towards -z)
    await a.goTo(4.6, 12);
    let top = 0;
    const raw = a.s as unknown as { emit: (ev: string, d: unknown) => void };
    let seq = 1_000_000;
    for (let i = 0; i < 30; i++) {
      const c: MoveInput[] = [0, 1, 2].map(() => ({ seq: seq++, f: 1, s: 0, yaw: 0, pitch: 0, b: 0, slot: 0 }));
      raw.emit('player:input', { c });
      await sleep(50);
      top = Math.max(top, a.pos.y);
    }
    expect(top).toBeGreaterThan(4);
  });

  it('does not let a client move faster by sending more commands', async () => {
    const a = await solo('Speedy');
    await a.idle(300);
    const start = { ...a.pos };
    const raw = a.s as unknown as { emit: (ev: string, d: unknown) => void };
    let seq = 2_000_000;
    const yaw = Math.atan2(start.x, start.z); // towards the centre of the map
    const t0 = Date.now();
    // 3× real time: 9 commands every 50 ms instead of 3
    for (let i = 0; i < 20; i++) {
      const c: MoveInput[] = Array.from({ length: 9 }, () => ({
        seq: seq++,
        f: 1,
        s: 0,
        yaw,
        pitch: 0,
        b: 0,
        slot: 0,
      }));
      raw.emit('player:input', { c });
      await sleep(50);
    }
    const seconds = (Date.now() - t0) / 1000;
    const dist = Math.hypot(a.pos.x - start.x, a.pos.z - start.z);
    const walk = CHAR_BY_ID.soldado.speed * WEAPONS.rifle.weight;
    // Real time plus the jitter bank, never three times as far
    expect(dist).toBeLessThan(walk * (seconds + 0.5));
  });
});
