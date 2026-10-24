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
  'almacen:s': '9d3c8f537545f749',
  'almacen:m': 'f53acec140361bde',
  'almacen:l': 'de3bc230a78565dc',
  'desfiladero:s': 'ac41c132a2da7698',
  'desfiladero:m': 'e0f30e8b9e8c1c10',
  'desfiladero:l': '0d87db5b0434b0d7',
  'polvo:s': '63489419317c867e',
  'polvo:m': '2be33816dceb0b40',
  'polvo:l': 'e355fcc13d02ef34',
  'ciudad:s': '827ebbd0d0b00f9d',
  'ciudad:m': 'df2c8f08300f2e3b',
  'ciudad:l': '2b19f199dd2305f8',
};

const TABLE_HASHES = {
  WEAPONS: '21f5599b47a110a7',
  CHARACTERS: '2009178fe674681e',
  MODES: '87ca9b7c1b43670c',
  PLAYER: '0bf57b8a7e2429af',
  MAPS: 'b76607c240b9cebc',
  MAP_SIZES: '0cd287561039dcb2',
  SKINS: 'da7c934da2871503',
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
