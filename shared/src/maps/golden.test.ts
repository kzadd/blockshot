// Golden fingerprints taken from the original JavaScript config before the TypeScript migration.
// If one of these fails, gameplay data changed: update it only on purpose.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import * as shared from '../index';

const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 16);

const MAP_HASHES: Record<string, string> = {
  // 2026-10-29: map objects (barrels, crates, health and armour, ladders, ziplines) on every map, the six maps
  // reworked (more cover, high routes) and three new ones: Puerto, Estación and Nevada
  'patio:s': '54d0184caa6f8a09',
  'patio:m': '13779e4158dc2289',
  'patio:l': '7ba73db62f26a807',
  'almacen:s': 'f2b89977355a6278',
  'almacen:m': '9d42c71850adfb1b',
  'almacen:l': 'a680cc9eb3657221',
  'desfiladero:s': '1a980f443e916df3',
  'desfiladero:m': '174cc2b5378e238c',
  'desfiladero:l': 'd123fb843b5529e5',
  'polvo:s': '111fd2f5b38ab1d4',
  'polvo:m': 'bc3cb0368ae8fb57',
  'polvo:l': '2bf49d795c61d331',
  'ciudad:s': '0ef7d092751b45be',
  'ciudad:m': '878b1c4f2047bd02',
  'ciudad:l': '0a817ba086d067cf',
  'obra:s': '8ef3d67c85ca6f2d',
  'obra:m': 'd23a66941cf57f7e',
  'obra:l': '2ee1a2d841f44a39',
  'puerto:s': 'd1b1c32179a51cce',
  'puerto:m': 'e1ddd5bb6003f049',
  'puerto:l': '39897a3df5014d5f',
  'estacion:s': '71cf93979eb3cceb',
  'estacion:m': '7838a33f21bba3db',
  'estacion:l': '30cf7ee934493569',
  'nevada:s': '35274bf55230f84a',
  'nevada:m': '87c83507b07966fa',
  'nevada:l': '15a2299f9172f385',
};

const TABLE_HASHES = {
  // Balance pass (2026-10-24, checked with server/src/combat/duel.sim.test.ts): Rayo 8.6 m/s and 90 hp, Tanque 140 hp,
  // slower sniper aim, rifle 105 ms, more falloff on rifle and LMG, longer SMG range
  WEAPONS: '64ecc48c8062006e', // + marksman rifle; SMG nerf (Rayo); the launcher is now a bazooka (one rocket per load)
  CHARACTERS: 'b305eae771b62448', // abilities (key E) + Explorador and Artillero; Rayo 8.2 m/s; Artillero's bazooka
  MODES: '7b0e3729e18e0ee7', // two new modes: Dominio and Rondas
  PLAYER: '131216ce937cbbb8', // stamina back on; drains faster, slides cost more, lower speed cap
  MAPS: '0db50ccaebbe4b7b', // nine maps: + Puerto, Estación, Nevada
  MAP_SIZES: '0cd287561039dcb2',
  SKINS: '336d515d0bade54b', // creatures: the first ten plus Ninja, Pirata, Caballero, Vikingo, Esqueleto, Panda, Pingüino, Perro, Dinosaurio, Búho
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
