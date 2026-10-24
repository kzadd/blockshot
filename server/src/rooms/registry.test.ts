import { describe, expect, it } from 'vitest';
import { makeRoom } from '../testing/fakeRoom';
import { cleanText } from './registry';

describe('room registry', () => {
  it('sanitises names and falls back to defaults', () => {
    expect(cleanText('  hola   que   tal ', 24, 'x')).toBe('hola que tal');
    expect(cleanText('', 16, 'Jugador')).toBe('Jugador');
    expect(cleanText(42, 16, 'Jugador')).toBe('Jugador');
    expect(cleanText('a'.repeat(40), 16, 'x')).toHaveLength(16);
  });

  it('uses the mode default score when the asked one is not offered', () => {
    const { room } = makeRoom('ctf', 99);
    expect(room.scoreLimit).toBe(3);
    expect(makeRoom('ctf', 5).room.scoreLimit).toBe(5);
  });

  it('checks password and capacity when joining', () => {
    const { registry } = makeRoom('ffa');
    const locked = registry.create({ password: 'abc', max: 2 }, 'Host');
    expect(registry.canJoin(locked, 'nope')).toBe('Contraseña incorrecta.');
    expect(registry.canJoin(locked, 'abc')).toBeNull();
    registry.addPlayer(locked, 'x', 'X');
    registry.addPlayer(locked, 'y', 'Y');
    expect(registry.canJoin(locked, 'abc')).toBe('La sala está llena.');
    expect(registry.canJoin(undefined, '')).toBe('La sala ya no existe.');
  });

  it('removes a room when its last player leaves', () => {
    const { registry, room } = makeRoom('ffa');
    registry.addPlayer(room, 'solo', 'Solo');
    registry.removePlayer(room, 'solo');
    expect(registry.get(room.id)).toBeUndefined();
  });

  it('falls back to defaults for inherited keys instead of crashing', () => {
    const { registry } = makeRoom('ffa');
    const room = registry.create({ mode: 'constructor', mapId: 'toString', size: 'constructor' }, 'Host');
    expect([room.modeId, room.map.id, room.map.size]).toEqual(['ffa', 'patio', 'm']);
    expect(Number.isFinite(room.max)).toBe(true);
  });

  it('strips control and bidi characters from names', () => {
    expect(cleanText('An\u202Ea\u0000', 16, 'x')).toBe('Ana');
  });
});
