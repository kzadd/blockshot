// Golden fingerprints taken from the original JavaScript config before the TypeScript migration.
// If one of these fails, gameplay data changed: update it only on purpose.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import * as shared from '../index';

const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 16);

const MAP_HASHES: Record<string, string> = {
  'patio:s': 'ef18d7dca8bb0386',
  'patio:m': 'd012305acf7b7033',
  'patio:l': '9d777c357ea21b8d',
  'almacen:s': '5a86a92fb635548e',
  'almacen:m': '3c4d1c44e6c5b4a2',
  'almacen:l': 'f296f4f7cf5b5d6f',
  'desfiladero:s': '55aa8cb484847c5d',
  'desfiladero:m': 'aae0d1a0b01a572d',
  'desfiladero:l': 'd6ea89c9edefe2e2',
  'polvo:s': '63eca244324e473f',
  'polvo:m': '348d515cae5d2c7d',
  'polvo:l': '5d0f94050b7d1d7b',
  'ciudad:s': '46d921cb3bf3b553',
  'ciudad:m': 'abd87e6174468458',
  'ciudad:l': '11d9d65f2b727f73',
};

const TABLE_HASHES = {
  WEAPONS: '21f5599b47a110a7',
  CHARACTERS: '2009178fe674681e',
  MODES: '87ca9b7c1b43670c',
  PLAYER: '0bf57b8a7e2429af',
  MAPS: 'b76607c240b9cebc',
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
