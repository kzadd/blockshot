import { describe, expect, it } from 'vitest';
import { ABILITY_IDS } from '../abilities/abilities';
import {
  DEFAULT_CLASS,
  PRIMARIES,
  PRIMARY_FAMILIES,
  SIDEARMS,
  classFromIndex,
  classIndex,
  classOf,
} from '../characters/characters';
import { POWER_WEAPONS, WEAPONS, type WeaponId } from '../weapons/weapons';
import { loadoutOf } from './modes';

describe('class (primary, sidearm, ability, accessory)', () => {
  it('a valid class is carried in keys 1 and 2', () => {
    const cls = classOf({ primary: 'heavyrifle', secondary: 'heavypistol', ability: 'dash' });
    expect(cls).toEqual({ primary: 'heavyrifle', secondary: 'heavypistol', ability: 'dash', accessory: 'none' });
    expect(loadoutOf('ffa', cls)).toEqual(['heavyrifle', 'heavypistol', 'knife']);
    expect(loadoutOf('teams', classOf({ primary: 'grenadelauncher' }), 0, 8, 1)).toEqual([
      'grenadelauncher',
      'pistol',
      'knife',
    ]);
  });

  it('the default class is M4 + Beretta 92G + smoke, no accessory', () => {
    expect(DEFAULT_CLASS).toEqual({ primary: 'rifle', secondary: 'pistol', ability: 'smoke', accessory: 'none' });
    expect(classOf()).toEqual(DEFAULT_CLASS);
    expect(classOf(null)).toEqual(DEFAULT_CLASS);
    expect([WEAPONS.rifle.name, WEAPONS.pistol.name]).toEqual(['M4', 'Beretta 92G']);
  });

  it('each part is checked on its own: anything not allowed falls back to the default', () => {
    for (const bad of ['railgun', 'minigun', 'autoshotgun', 'knife', '', 'nope', '__proto__', null, undefined]) {
      expect(classOf({ primary: bad, secondary: bad, ability: bad, accessory: bad }), String(bad)).toEqual(
        DEFAULT_CLASS,
      );
    }
    // Pistols are sidearms only (2026-11-04): never a primary
    for (const w of SIDEARMS) expect(classOf({ primary: w }).primary, w).toBe('rifle');
    // A long gun is no sidearm; the sawed-off is a primary now
    expect(classOf({ secondary: 'sawedoff' }).secondary).toBe('pistol');
    expect(classOf({ secondary: 'rifle' }).secondary).toBe('pistol');
    expect(classOf({ primary: 'sawedoff', secondary: 'colt', ability: 'nope', accessory: 'kevlar' })).toEqual({
      primary: 'sawedoff',
      secondary: 'colt',
      ability: 'smoke',
      accessory: 'kevlar',
    });
  });

  it('every non-power weapon is a primary; the five sidearms are the secondaries; every ability is allowed', () => {
    const all = (Object.keys(WEAPONS) as WeaponId[]).filter(
      (w) => !WEAPONS[w].power && !WEAPONS[w].melee && !SIDEARMS.includes(w),
    );
    expect([...PRIMARIES].sort()).toEqual([...all].sort());
    for (const w of SIDEARMS) expect(PRIMARIES, w).not.toContain(w);
    expect(new Set(PRIMARIES).size).toBe(PRIMARIES.length);
    expect(SIDEARMS).toEqual(['pistol', 'colt', 'heavypistol', 'revolver', 'mpistol']);
    for (const w of [...PRIMARIES, ...SIDEARMS]) expect(POWER_WEAPONS.includes(w) || WEAPONS[w].melee, w).toBeFalsy();
    for (const ability of ABILITY_IDS) expect(classOf({ ability }).ability).toBe(ability);
    expect(PRIMARY_FAMILIES.map((f) => f.name)).toEqual([
      'Fusiles',
      'Precisión',
      'Subfusiles',
      'Escopetas',
      'Ametralladoras',
      'Explosivos',
    ]);
  });

  it('snapshots send the weapons as indices that come back as the same class', () => {
    for (const primary of PRIMARIES)
      for (const secondary of SIDEARMS)
        expect(classFromIndex(classIndex({ primary, secondary }))).toEqual({ primary, secondary });
    expect(classIndex(DEFAULT_CLASS)).toEqual([0, 0]);
    expect(classFromIndex(undefined)).toEqual({ primary: 'rifle', secondary: 'pistol' });
    expect(classFromIndex([999, -3])).toEqual({ primary: 'rifle', secondary: 'pistol' });
  });

  it('modes that hand out their own weapons ignore the class', () => {
    const cls = classOf({ primary: 'pdw', secondary: 'mpistol' });
    expect(loadoutOf('insta', cls, 0, 8, 0)).toEqual(['railgun', 'knife']);
    expect(loadoutOf('infect', cls, 0, 8, 2)).toEqual(['knife']);
    expect(loadoutOf('race', cls, 0, 8, 0)).toEqual(['mpistol', 'knife']);
    expect(loadoutOf('gungame', cls, 0, 10, 0)).toEqual(['rifle', 'knife']);
    // Infected survivors keep their class
    expect(loadoutOf('infect', cls, 0, 8, 1)).toEqual(['pdw', 'mpistol', 'knife']);
  });
});
