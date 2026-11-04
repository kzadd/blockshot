import { describe, expect, it } from 'vitest';
import {
  ABILITY_IDS,
  ACCESSORY_IDS,
  DEFAULT_CLASS,
  EXTRA_AMMO,
  PRIMARIES,
  SIDEARMS,
  WEAPONS,
  accessoryBlock,
} from '@blockshot/shared';
import { choiceIndex } from '../game/tick';
import { makeRoom } from '../testing/fakeRoom';
import { randomClass } from './bot';
import { spawnPlayer } from './spawn';

describe('class at spawn (trust boundary)', () => {
  it('equips the class picked and tells the client', () => {
    const { room, channel, join } = makeRoom('ffa');
    const p = join('A', 0, 20);
    p.alive = false;
    channel.clear();
    spawnPlayer(room, p, { primary: 'heavyrifle', secondary: 'revolver', ability: 'wall' });
    expect(p.loadout).toEqual(['heavyrifle', 'revolver', 'knife']);
    expect(p.cls).toEqual({ primary: 'heavyrifle', secondary: 'revolver', ability: 'wall', accessory: 'none' });
    expect(p.ammo.map((a) => a.mag)).toEqual([25, 6, 1]);
    expect(channel.of('player:spawned')[0]).toMatchObject({
      primary: 'heavyrifle',
      secondary: 'revolver',
      ability: 'wall',
      hp: 100,
    });
    expect(choiceIndex(p)).toEqual([PRIMARIES.indexOf('heavyrifle'), SIDEARMS.indexOf('revolver')]);
  });

  it('each part outside the lists falls back to the default on its own', () => {
    const { room, join } = makeRoom('ffa');
    const p = join('A', 0, 20);
    for (const [primary, secondary, ability] of [
      ['railgun', 'minigun', 'fly'], // power weapons, no such ability
      ['knife', 'knife', 'knife'],
      ['pistol', 'rifle', 'dash'], // a long gun is no sidearm; a pistol is no primary either (2026-11-04)
      ['__proto__', 'constructor', 'toString'],
    ]) {
      p.alive = false;
      spawnPlayer(room, p, { primary, secondary, ability });
      const want = {
        primary: PRIMARIES.includes(primary as never) ? primary : DEFAULT_CLASS.primary,
        secondary: DEFAULT_CLASS.secondary,
        ability: ABILITY_IDS.includes(ability as never) ? ability : DEFAULT_CLASS.ability,
        accessory: 'none',
      };
      expect(p.cls, `${primary}/${secondary}/${ability}`).toEqual(want);
    }
  });

  it('every class accepts the five sidearms; the sawed-off is a primary only', () => {
    const { room, join } = makeRoom('ffa');
    const p = join('A', 0, 20);
    for (const secondary of SIDEARMS) {
      p.alive = false;
      spawnPlayer(room, p, { primary: 'sawedoff', secondary });
      expect(p.loadout).toEqual(['sawedoff', secondary, 'knife']);
    }
    p.alive = false;
    spawnPlayer(room, p, { secondary: 'sawedoff' });
    expect(p.loadout).toEqual(['rifle', 'pistol', 'knife']);
  });

  it('an older client that only sends a character id gets the default class', () => {
    const { room, join } = makeRoom('ffa');
    const p = join('A', 0, 20);
    p.alive = false;
    spawnPlayer(room, p, { characterId: 'tanque' } as never);
    expect(p.cls).toEqual(DEFAULT_CLASS);
    expect(p.maxHp).toBe(100);
  });

  it('a respawn without a request keeps the class and looks', () => {
    const { room, join } = makeRoom('ffa');
    const p = join('A', 0, 20);
    p.alive = false;
    spawnPlayer(room, p, { primary: 'compact', secondary: 'mpistol', ability: 'dash', camo: 'tigre' });
    p.alive = false;
    spawnPlayer(room, p); // a mode respawning the player (rounds, freeze tag…)
    expect(p.loadout).toEqual(['compact', 'mpistol', 'knife']);
    expect([p.cls?.ability, p.camo]).toEqual(['dash', 'tigre']);
  });

  it('the accessory is checked like the rest: a silencer the weapons do not take is dropped', () => {
    const { room, channel, join } = makeRoom('ffa');
    const p = join('A', 0, 20);
    for (const [primary, secondary, accessory, want] of [
      ['rifle', 'pistol', 'silencer', 'silencer'],
      ['shotgun', 'pistol', 'silencer', 'none'], // shotguns
      ['launcher', 'pistol', 'silencer', 'none'], // explosives
      ['sniper', 'pistol', 'silencer', 'none'],
      ['rifle', 'heavypistol', 'silencer', 'none'], // the Desert Eagle
      ['shotgun', 'pistol', 'kevlar', 'kevlar'],
      ['rifle', 'pistol', 'jetpack', 'none'],
      ['rifle', 'pistol', '__proto__', 'none'],
    ]) {
      p.alive = false;
      channel.clear();
      spawnPlayer(room, p, { primary, secondary, accessory });
      expect(p.cls?.accessory, `${primary}/${secondary}/${accessory}`).toBe(want);
      expect(channel.of('player:spawned')[0]).toMatchObject({ accessory: want });
    }
  });

  it('extra ammo enlarges the magazines of the primary and the secondary (never the knife)', () => {
    const { room, join } = makeRoom('ffa');
    const p = join('A', 0, 20);
    p.alive = false;
    spawnPlayer(room, p, { primary: 'rifle', secondary: 'pistol', accessory: 'ammo' });
    const more = (m: number) => m + Math.round(m * EXTRA_AMMO.mag);
    expect(p.ammo.map((a) => a.mag)).toEqual([more(WEAPONS.rifle.mag), more(WEAPONS.pistol.mag), 1]);
  });

  it('the class picked in the in-match loadout menu is taken at the next respawn, checked then', () => {
    const { room, join } = makeRoom('ffa');
    const p = join('A', 0, 20, { primary: 'rifle' });
    p.nextCls = { primary: 'lmg', secondary: 'colt', ability: 'radar', accessory: 'silencer' };
    expect(p.loadout[0]).toBe('rifle'); // nothing changes while alive
    p.alive = false;
    spawnPlayer(room, p); // a mode respawning the player
    expect(p.cls).toEqual({ primary: 'lmg', secondary: 'colt', ability: 'radar', accessory: 'silencer' });
    expect(p.nextCls).toBeNull();
    // Anything not allowed falls back, as in a spawn request
    p.nextCls = { primary: 'railgun', accessory: 'kevlar' };
    p.alive = false;
    spawnPlayer(room, p);
    expect(p.cls).toMatchObject({ primary: 'rifle', accessory: 'kevlar' });
  });

  it('modes with their own weapons keep handing them out', () => {
    const { room, join } = makeRoom('insta');
    const p = join('A', 0, 20);
    p.alive = false;
    spawnPlayer(room, p, { primary: 'heavyrifle' });
    expect(p.loadout).toEqual(['railgun', 'knife']);
  });

  it('lives are counted per primary weapon', () => {
    const { room, join } = makeRoom('ffa');
    const p = join('A', 0, 20, { primary: 'sniper' });
    p.alive = false;
    spawnPlayer(room, p);
    p.alive = false;
    spawnPlayer(room, p, { primary: 'lightlmg' });
    expect(p.picks).toEqual({ sniper: 2, lightlmg: 1 });
  });

  it('bots build random classes from the allowed parts (a long gun as primary)', () => {
    for (let i = 0; i < 200; i++) {
      const c = randomClass();
      expect(ACCESSORY_IDS).toContain(c.accessory);
      expect(accessoryBlock(c.accessory, c.primary, c.secondary)).toBeNull();
      expect(PRIMARIES).toContain(c.primary);
      expect(SIDEARMS).not.toContain(c.primary);
      expect(SIDEARMS).toContain(c.secondary);
      expect(ABILITY_IDS).toContain(c.ability);
      expect(WEAPONS[c.primary].power).toBeFalsy();
    }
  });
});
