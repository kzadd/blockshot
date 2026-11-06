// Golden fingerprints taken from the original JavaScript config before the TypeScript migration.
// If one of these fails, gameplay data changed: update it only on purpose.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import * as shared from '../index';

const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 16);

const MAP_HASHES: Record<string, string> = {
  // 2026-11-05: on every map the outer walls rise above the highest reachable point (walls.test.ts): no way out
  'circuito:m': '3ecf56d8a73abe6e', // 2026-11-04 later: longer stepping stones, long jumps 5/5.5/6 m and an 8.8 m sprint gap for the UrT jump
  // 2026-10-29: map objects (barrels, crates, health and armour, ladders, ziplines) on every map, the six maps
  // reworked (more cover, high routes) and three new ones: Puerto, Estación and Nevada; 2026-11-03: ladders and
  // ziplines moved where they can really be used (climb.test.ts), props kept clear of ladders; power weapon spots; climbing clusters (parkour.ts); the straight race course; 2026-11-04: the parkour shaft is now an open alley (wall jump side to side)
  // 2026-11-04: one size per map (medium), every map rebuilt by hand (Urban Terror feel: roofs, wall-jump alleys)
  'patio:m': '3bcf9390365a6bda',
  'autopista:m': '30eb2e37b0926844',
  'monasterio:m': 'b91277f97e4605fb',
  'pueblo:m': '5d2e7c0cea2db22e',
  'ciudad:m': 'a988d062b8e3456d',
  'obra:m': '399d6a52689be93f',
  'puerto:m': '57ed58f6607f7aec',
  'estacion:m': '4628dd18d5ccf8ca',
  'nevada:m': '45b4ded23ed64acb', // 2026-11-04 later: pine trunks 0.4 m, as thick as drawn
  // 2026-11-05: two new maps built for one mode each: Sanatorio (Infectados) and Aduana (Bomba)
  'sanatorio:m': 'fdb5ea61417696bf',
  'aduana:m': '6f96aa37c5f9f026',
  // 2026-11-05: two new obstacle courses for Carrera de saltos: Verbena (a spiral over a pool) and Tarta (four tiers)
  'verbena:m': '28dd36f4b2e2ab5b',
  'tarta:m': 'd3d58a175577d571',
};

const TABLE_HASHES = {
  // Balance pass (2026-10-24, checked with server/src/combat/duel.sim.test.ts): Rayo 8.6 m/s and 90 hp, Tanque 140 hp,
  // slower sniper aim, rifle 105 ms, more falloff on rifle and LMG, longer SMG range
  WEAPONS: '40bac225e20d9723', // 2026-11-05: PSG1 (dmr) gets the sniper scope overlay (scope: true); 2026-11-04 later: UrT rates for LR300 / G36 / MP5K / UMP45 (more damage a bullet), SR8 145; marksman rifle, Rayo SMG nerf, the bazooka; power weapons (railgun, minigun, autoshotgun), the railgun scoped; Urban Terror tuning (precise, deadlier heads); 2026-11-04: loadout alternatives (heavy/light rifle, 2× carbine, tactical/compact SMG, heavy pistol, grenade launcher), checked with duel.sim; 2026-11-04: real model names (M4, AK103… AA-12), new Negev (lightlmg), UMP45, FR-F1, Colt 1911 and Benelli; MAC-11 a little tighter, HK69 faster follow-up (duel.sim)
  // 2026-11-04: the named characters are gone (CHARACTERS removed): one class per player, same body for everyone
  BODY: 'b6ead8b7ca246444', // 100 hp, 7.3 m/s × the held weapon's weight
  // 2026-11-04 (class builder, part 2): pistols are sidearms only (no «Pistolas» primary family)
  PRIMARY_FAMILIES: '492a2d22728cd353', // every non-power long gun is a primary, by family
  // 2026-11-04 (class builder, part 2): the class gets an accessory slot, «Ninguno» by default
  DEFAULT_CLASS: '615bc65e050d0c7c', // M4 + Beretta 92G + smoke, no accessory
  ABILITIES: 'c2bbe9f5827d9d03', // 2026-11-04: firing lowers the shield; the medkit only out of the fight (duel.sim)
  SHIELD: '2aac3e922565770e',
  MODES: '075441e1e93586a9', // 2026-11-05: + Traidores (traitor); 2026-11-04 later: gun game 10/15/20 weapons; 2026-11-04 later: Spanish names again (Supervivencia, Carrera de saltos, Disparo único); two new modes: Dominio and Rondas; Carrera (race, only on Circuito); 2026-11-04: Último en pie, InstaGib, Congelados and Bomba
  PLAYER: 'c47aff93dbf6be19', // 2026-11-05: stricter anti-camping (8 m zone, warning at 10 s, seen and drained 10 hp/s from 15 s, can kill); 2026-11-04 later: Urban Terror gravity (20.9) with a 1.85 m jump (8.8), CPMA air control, UrT diagonal wall jump (push 4.3, speed kept), Quake 3 air control and ground friction; stamina back on; drains faster, slides cost more, lower speed cap; wall jumps and ledge pulls (stronger, steered), anti-camping; 2026-11-04: Urban Terror wall jumps (bounce off, alternate walls) and jumps cost stamina; spawn protection and anti-camping wait for the first move (idleGrace); powerslide, exhausted = slower, cheaper jumps/slides and quicker recovery (bunny hop recovers in the air)
  MAPS: '8d84e1004ace6f24', // 2026-11-05: + Verbena and Tarta (race courses); + Sanatorio and Aduana; + Puerto, Estación, Nevada and the Circuito race course; 2026-11-04: Almacén, Desfiladero, Polvo and Ciudad replaced by Autopista, Monasterio, Pueblo and Casco Viejo; then Patio, Obra, Puerto, Estación, Nevada and Circuito rebuilt by hand too; Circuito tag «Carrera de saltos»
  MAP_SIZES: '0cd287561039dcb2',
  SKINS: '336d515d0bade54b', // creatures: the first ten plus Ninja, Pirata, Caballero, Vikingo, Esqueleto, Panda, Pingüino, Perro, Dinosaurio, Búho
  GUN_LADDERS: 'd9b0779192305903', // 2026-11-04: 10, 15 and 20 weapons from the full arsenal
  STREAKS: 'c5eac1deecda3aac',
  STREAK_REWARDS: 'c22a64e72ac24f73', // radar at 3, armour at 5, air strike at 7
  FLAG: '209c1b3fd3745c04',
  TAG: '3b53c1a008d7d9b0',
  INFECT: 'efbd45eea46bc46e', // 2026-11-05: one first infected per 4 players, hp ×2, speed ×1.25, 1 s respawn, survivors revealed in the last 30 s
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
