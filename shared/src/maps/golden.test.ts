// Golden fingerprints taken from the original JavaScript config before the TypeScript migration.
// If one of these fails, gameplay data changed: update it only on purpose.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import * as shared from '../index';

const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 16);

const MAP_HASHES: Record<string, string> = {
  'patio:s': '69f51e56e83bdd0e',
  'patio:m': '7e8f34b1271a8e73',
  'patio:l': 'e404ace138a30db6',
  'almacen:s': '28fc2af0d788c2f9',
  'almacen:m': '30a0f9d0d3cf174d',
  'almacen:l': 'e6f1a58cb6a1ab41',
  'desfiladero:s': '91960fda921437fb',
  'desfiladero:m': 'f6df51e5247c3d2d',
  'desfiladero:l': '0e69c206610df50c',
  'polvo:s': '3f75fc0f02b2c0ef',
  'polvo:m': '87dfc8c8c46119fc',
  'polvo:l': 'b061e1e7882b849d',
  'ciudad:s': 'b105cc877be14b0a',
  'ciudad:m': 'd00601f6b555f63f',
  'ciudad:l': 'f26e27d6dc034b52',
  // sixth map (construction site) added on purpose
  'obra:s': '4fbae09d2b1e274d',
  'obra:m': '45479f810f4d6784',
  'obra:l': '8c39ea14b4f07024',
};

const TABLE_HASHES = {
  // Balance pass (2026-10-24, checked with server/src/combat/duel.sim.test.ts): Rayo 8.6 m/s and 90 hp, Tanque 140 hp,
  // slower sniper aim, rifle 105 ms, more falloff on rifle and LMG, longer SMG range
  WEAPONS: 'd1ba1521e4a96c96',
  CHARACTERS: 'ee946d556cf3f25f',
  MODES: '87ca9b7c1b43670c',
  PLAYER: '0bf57b8a7e2429af',
  MAPS: '64018304e6c9b34c', // sixth map: Obra
  MAP_SIZES: '0cd287561039dcb2',
  SKINS: '376855100cbba893', // five cosmetic skins added (urbano, desierto, bosque, carbono, neon)
  GUN_LADDERS: '8f9323383a0b8d4b',
  STREAKS: 'c5eac1deecda3aac',
  STREAK_REWARDS: 'a57d0b99f6cfdc4d',
  FLAG: '209c1b3fd3745c04',
  TAG: '3b53c1a008d7d9b0',
  INFECT: '1eb963b0c5745b57',
  PAD: '58e8c85fad9211f2',
  TEAMS: '9ae68307961b7860',
} as const;

describe('gameplay data is unchanged', () => {
  it.each(Object.entries(MAP_HASHES))('map %s', (key, expected) => {
    const [id, size] = key.split(':') as [string, string];
    expect(hash(shared.getMap(id, size))).toBe(expected);
  });

  it.each(Object.entries(TABLE_HASHES))('table %s', (name, expected) => {
    expect(hash((shared as Record<string, unknown>)[name])).toBe(expected);
  });
});
