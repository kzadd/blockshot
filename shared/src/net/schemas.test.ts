import { describe, expect, it } from 'vitest';
import { OUTFIT_COLORS, SKINS, isOutfitColor, isSkinId } from '../characters/characters';
import { CreateRoomSchema, InputSchema, MAX_INPUTS_PER_MESSAGE, ShootSchema, SpawnSchema, v } from './schemas';

const ok = (schema: v.GenericSchema, data: unknown) => v.safeParse(schema, data).success;
const cmd = { seq: 1, f: 1, s: 0, yaw: 0.5, pitch: 0, b: 3, slot: 0 };

describe('message schemas', () => {
  it('accepts what the real client sends', () => {
    expect(
      ok(CreateRoomSchema, { nickname: 'Ana', mapId: 'patio', size: 'm', mode: 'ffa', scoreLimit: 20, max: 12 }),
    ).toBe(true);
    expect(ok(InputSchema, { c: [cmd, { ...cmd, seq: 2 }] })).toBe(true);
    expect(ok(ShootSchema, { o: [1, 2, 3], d: [[0, 0, -1]], lag: 100 })).toBe(true);
  });

  it('rejects wrong types, non-finite numbers and oversized batches', () => {
    expect(ok(CreateRoomSchema, { nickname: 42 })).toBe(false);
    expect(ok(ShootSchema, { o: [1, 2], d: [[0, 0, -1]] })).toBe(false);
    expect(ok(ShootSchema, { o: [1, 2, Infinity], d: [[0, 0, -1]] })).toBe(false);
    expect(ok(ShootSchema, { o: [1, 2, 3], d: [] })).toBe(false);
    expect(ok(InputSchema, { c: [{ ...cmd, f: 3 }] })).toBe(false);
    expect(ok(InputSchema, { c: [{ ...cmd, seq: 1.5 }] })).toBe(false);
    expect(
      ok(InputSchema, { c: Array.from({ length: MAX_INPUTS_PER_MESSAGE + 1 }, (_, i) => ({ ...cmd, seq: i })) }),
    ).toBe(false);
  });

  it('accepts a spawn with any palette outfit colour, or none, and nothing else', () => {
    expect(ok(SpawnSchema, { characterId: 'soldado', skin: 'neon' })).toBe(true);
    for (const c of OUTFIT_COLORS)
      expect(ok(SpawnSchema, { characterId: 'rayo', skin: 'base', color: c.hex })).toBe(true);
    expect(ok(SpawnSchema, { characterId: 'rayo', color: '#123456' })).toBe(false);
    expect(ok(SpawnSchema, { characterId: 'rayo', color: 0x3f7fe0 })).toBe(false);
    expect(ok(SpawnSchema, { characterId: 'rayo', color: 'red' })).toBe(false);
  });
});

describe('cosmetics', () => {
  it('has ten skins with unique ids that the server accepts', () => {
    expect(SKINS).toHaveLength(10);
    expect(new Set(SKINS.map((k) => k.id)).size).toBe(SKINS.length);
    for (const k of SKINS) expect(isSkinId(k.id)).toBe(true);
    expect(isSkinId('rgb')).toBe(false);
  });

  it('offers eight distinct outfit colours as #rrggbb', () => {
    expect(OUTFIT_COLORS).toHaveLength(8);
    expect(new Set(OUTFIT_COLORS.map((c) => c.hex)).size).toBe(8);
    for (const c of OUTFIT_COLORS) expect(c.hex).toMatch(/^#[0-9a-f]{6}$/);
    expect(isOutfitColor('#3f7fe0')).toBe(true);
    expect(isOutfitColor('#000000')).toBe(false);
    expect(isOutfitColor(undefined)).toBe(false);
  });
});
