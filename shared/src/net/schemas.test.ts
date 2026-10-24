import { describe, expect, it } from 'vitest';
import { CreateRoomSchema, InputSchema, MAX_INPUTS_PER_MESSAGE, ShootSchema, v } from './schemas';

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
});
