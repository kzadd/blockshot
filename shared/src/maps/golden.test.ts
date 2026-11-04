// Golden fingerprints taken from the original JavaScript config before the TypeScript migration.
// If one of these fails, gameplay data changed: update it only on purpose.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import * as shared from '../index';

const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 16);

const MAP_HASHES: Record<string, string> = {
  'circuito:m': '1ad3c5443b6a1889', // 2026-11-04 later: longer stepping stones, long jumps 5/5.5/6 m and an 8.8 m sprint gap for the UrT jump
  // 2026-10-29: map objects (barrels, crates, health and armour, ladders, ziplines) on every map, the six maps
  // reworked (more cover, high routes) and three new ones: Puerto, Estación and Nevada; 2026-11-03: ladders and
  // ziplines moved where they can really be used (climb.test.ts), props kept clear of ladders; power weapon spots; climbing clusters (parkour.ts); the straight race course; 2026-11-04: the parkour shaft is now an open alley (wall jump side to side)
  // 2026-11-04: one size per map (medium), every map rebuilt by hand (Urban Terror feel: roofs, wall-jump alleys)
  'patio:m': 'a2f1bc82dce5e717',
  'autopista:m': '8d3f6a52a100054a',
  'monasterio:m': 'b017382bbb82702a',
  'pueblo:m': '1d6869939dfbadc6',
  'ciudad:m': 'ef466097e622da96',
  'obra:m': '7e87ba9a40d79b1a',
  'puerto:m': '65a03da69c4c8a43',
  'estacion:m': 'f2223e8becdbf2c5',
  'nevada:m': '00910330a30dd1f5', // 2026-11-04 later: pine trunks 0.4 m, as thick as drawn
};

const TABLE_HASHES = {
  // Balance pass (2026-10-24, checked with server/src/combat/duel.sim.test.ts): Rayo 8.6 m/s and 90 hp, Tanque 140 hp,
  // slower sniper aim, rifle 105 ms, more falloff on rifle and LMG, longer SMG range
  WEAPONS: '899cc3b594c31ee1', // 2026-11-04 later: UrT rates for LR300 / G36 / MP5K / UMP45 (more damage a bullet), SR8 145; marksman rifle, Rayo SMG nerf, the bazooka; power weapons (railgun, minigun, autoshotgun), the railgun scoped; Urban Terror tuning (precise, deadlier heads); 2026-11-04: loadout alternatives (heavy/light rifle, 2× carbine, tactical/compact SMG, heavy pistol, grenade launcher), checked with duel.sim; 2026-11-04: real model names (M4, AK103… AA-12), new Negev (lightlmg), UMP45, FR-F1, Colt 1911 and Benelli; MAC-11 a little tighter, HK69 faster follow-up (duel.sim)
  // 2026-11-04: the named characters are gone (CHARACTERS removed): one class per player, same body for everyone
  BODY: 'b6ead8b7ca246444', // 100 hp, 7.3 m/s × the held weapon's weight
  // 2026-11-04 (class builder, part 2): pistols are sidearms only (no «Pistolas» primary family)
  PRIMARY_FAMILIES: '492a2d22728cd353', // every non-power long gun is a primary, by family
  // 2026-11-04 (class builder, part 2): the class gets an accessory slot, «Ninguno» by default
  DEFAULT_CLASS: '615bc65e050d0c7c', // M4 + Beretta 92G + smoke, no accessory
  ABILITIES: 'c2bbe9f5827d9d03', // 2026-11-04: firing lowers the shield; the medkit only out of the fight (duel.sim)
  SHIELD: '2aac3e922565770e',
  MODES: 'aff07e81962a1784', // 2026-11-04 later: gun game 10/15/20 weapons; 2026-11-04 later: Spanish names again (Supervivencia, Carrera de saltos, Disparo único); two new modes: Dominio and Rondas; Carrera (race, only on Circuito); 2026-11-04: Último en pie, InstaGib, Congelados and Bomba
  PLAYER: '21f8df651c07a68c', // 2026-11-04 later: Urban Terror gravity (20.9) with a 1.85 m jump (8.8), CPMA air control, UrT diagonal wall jump (push 4.3, speed kept), Quake 3 air control and ground friction; stamina back on; drains faster, slides cost more, lower speed cap; wall jumps and ledge pulls (stronger, steered), anti-camping; 2026-11-04: Urban Terror wall jumps (bounce off, alternate walls) and jumps cost stamina; spawn protection and anti-camping wait for the first move (idleGrace); powerslide, exhausted = slower, cheaper jumps/slides and quicker recovery (bunny hop recovers in the air)
  MAPS: '38da5edc73bd5085', // + Puerto, Estación, Nevada and the Circuito race course; 2026-11-04: Almacén, Desfiladero, Polvo and Ciudad replaced by Autopista, Monasterio, Pueblo and Casco Viejo; then Patio, Obra, Puerto, Estación, Nevada and Circuito rebuilt by hand too; Circuito tag «Carrera de saltos»
  MAP_SIZES: '0cd287561039dcb2',
  SKINS: '336d515d0bade54b', // creatures: the first ten plus Ninja, Pirata, Caballero, Vikingo, Esqueleto, Panda, Pingüino, Perro, Dinosaurio, Búho
  GUN_LADDERS: 'd9b0779192305903', // 2026-11-04: 10, 15 and 20 weapons from the full arsenal
  STREAKS: 'c5eac1deecda3aac',
  STREAK_REWARDS: 'c22a64e72ac24f73', // radar at 3, armour at 5, air strike at 7
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
