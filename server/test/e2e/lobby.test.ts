import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { RoomSummary } from '@blockshot/shared';
import { Bot, startServer, sleep, type TestServer } from './harness';

let server: TestServer;
const bots: Bot[] = [];
const bot = (name: string) => {
  const b = new Bot(server.url, name);
  bots.push(b);
  return b;
};
const list = (b: Bot) => new Promise<RoomSummary[]>((r) => b.s.emit('rooms:list', r));

beforeAll(async () => {
  server = await startServer();
});
afterAll(async () => {
  for (const b of bots) b.close();
  await server.stop();
});

describe('lobby', () => {
  it('creates a room with defaults and sanitises bad input', async () => {
    const a = bot('');
    const res = await a.create({
      mode: 'nope',
      scoreLimit: 999,
      max: 99,
      mapId: 'x',
      size: 'z',
      name: '  Sala   uno  ',
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.room).toMatchObject({
      mode: 'ffa',
      scoreLimit: 20,
      mapId: 'patio',
      size: 'm',
      max: 24,
      name: 'Sala uno',
    });
    const rooms = await list(a);
    const r = rooms.find((x) => x.id === res.room.id);
    expect(r).toMatchObject({ players: 1, locked: false, host: 'Jugador', map: 'Patio', size: 'Mediano' });
    expect(r?.mode).toBe('Todos contra todos');
  });

  it('protects rooms with a password', async () => {
    const a = bot('Host');
    const res = await a.create({ password: 'secreto', mode: 'teams' });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const b = bot('Guest');
    expect(await b.join(res.room.id, 'mal')).toEqual({ ok: false, error: 'Contraseña incorrecta.' });
    const ok = await b.join(res.room.id, 'secreto');
    expect(ok.ok).toBe(true);
    expect((await list(b)).find((x) => x.id === res.room.id)?.locked).toBe(true);
  });

  it('rejects full and missing rooms', async () => {
    const a = bot('A');
    const res = await a.create({ max: 2 });
    if (!res.ok) throw new Error('create failed');
    expect((await bot('B').join(res.room.id)).ok).toBe(true);
    expect(await bot('C').join(res.room.id)).toEqual({ ok: false, error: 'La sala está llena.' });
    expect(await bot('D').join('nope')).toEqual({ ok: false, error: 'La sala ya no existe.' });
  });

  it('deletes a room when everybody leaves', async () => {
    const a = bot('Solo');
    const res = await a.create({});
    if (!res.ok) throw new Error('create failed');
    a.s.emit('room:leave');
    await sleep(200);
    expect((await list(a)).some((x) => x.id === res.room.id)).toBe(false);
  });

  it('answers the ping endpoint', async () => {
    const res = await fetch(`${server.url}/ping`);
    expect(await res.text()).toBe('ok');
  });
});
