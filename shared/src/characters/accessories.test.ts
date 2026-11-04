import { describe, expect, it } from 'vitest';
import { WEAPON_HANDLING, bloomRecovery } from '../weapons/handling';
import { WEAPONS, type WeaponId } from '../weapons/weapons';
import { PLAYER, staminaMult } from '../player/player';
import {
  ACCESSORIES,
  ACCESSORY_IDS,
  BANDAGE,
  EXTRA_AMMO,
  HELMET,
  KEVLAR,
  LASER,
  LIMB_MULT,
  SILENCER,
  accessoryBlock,
  accessoryGrenades,
  accessorySpeed,
  fitAccessory,
  gearedWeapon,
  regenOf,
  silenced,
  silencerBlock,
  zoneDamage,
} from './accessories';
import { BODY, PRIMARIES, SIDEARMS, classOf, speedWith } from './characters';

describe('accessories', () => {
  it('eight choices, «Ninguno» first, each with its effect and its price in Spanish', () => {
    expect(ACCESSORY_IDS).toEqual(['none', 'kevlar', 'helmet', 'silencer', 'laser', 'ammo', 'goggles', 'bandage']);
    expect(ACCESSORIES.none.name).toBe('Ninguno');
    for (const id of ACCESSORY_IDS) {
      expect(ACCESSORIES[id].line, id).toBeTruthy();
      expect(ACCESSORIES[id].cost, id).toBeTruthy();
    }
  });

  it('the silencer does not go on shotguns, explosives, the SR8 or the Desert Eagle', () => {
    const blocked = [...PRIMARIES, ...SIDEARMS].filter((w) => silencerBlock(w));
    expect(blocked.sort()).toEqual(
      ['benelli', 'grenadelauncher', 'heavypistol', 'launcher', 'sawedoff', 'shotgun', 'sniper'].sort(),
    );
    expect(accessoryBlock('silencer', 'rifle', 'pistol')).toBeNull();
    expect(accessoryBlock('silencer', 'shotgun', 'pistol')).toContain('SPAS-12');
    expect(accessoryBlock('silencer', 'rifle', 'heavypistol')).toContain('Desert Eagle');
    expect(fitAccessory('silencer', 'sniper', 'pistol')).toBe('none');
    // The rest go with anything
    for (const acc of ACCESSORY_IDS.filter((a) => a !== 'silencer'))
      for (const w of PRIMARIES) expect(accessoryBlock(acc, w, 'heavypistol'), `${acc}/${w}`).toBeNull();
    expect(classOf({ primary: 'benelli', accessory: 'silencer' }).accessory).toBe('none');
    expect(classOf({ primary: 'smg', accessory: 'silencer' }).accessory).toBe('silencer');
  });

  it('the silencer costs no damage; the laser tightens the hip-fire cone and the moving spread, not aiming', () => {
    expect(SILENCER.damage).toBe(1);
    expect(gearedWeapon('rifle', 'silencer').damage).toBe(WEAPONS.rifle.damage);
    expect(gearedWeapon('rifle', 'silencer').spread).toBe(WEAPONS.rifle.spread);
    expect(silenced('rifle', 'silencer')).toBe(true);
    expect(silenced('knife', 'silencer')).toBe(false);
    expect(silenced('rifle', 'laser')).toBe(false);
    expect(LASER.hipSpread).toBe(0.6);
    const smg = gearedWeapon('smg', 'laser');
    expect(smg.spread).toBeCloseTo(WEAPONS.smg.spread * 0.6);
    if (WEAPONS.smg.moveSpread !== undefined)
      expect(smg.moveSpread).toBeCloseTo(WEAPONS.smg.moveSpread * LASER.moveSpread);
    expect(smg.adsSpread).toBe(WEAPONS.smg.adsSpread);
    expect(smg.damage).toBe(WEAPONS.smg.damage);
  });

  it('extra ammo enlarges both magazines and adds a grenade; the knife and the power weapons never change', () => {
    for (const w of [...PRIMARIES, ...SIDEARMS])
      if (WEAPONS[w].mag > 1)
        expect(gearedWeapon(w, 'ammo').mag, w).toBe(WEAPONS[w].mag + Math.round(WEAPONS[w].mag * EXTRA_AMMO.mag));
    expect(accessoryGrenades('ammo')).toBe(1);
    expect(accessoryGrenades('kevlar')).toBe(0);
    expect(gearedWeapon('launcher', 'ammo').mag).toBe(1); // a one-shot launcher stays one shot
    for (const w of ['knife', 'railgun', 'minigun'] as WeaponId[])
      for (const acc of ACCESSORY_IDS) expect(gearedWeapon(w, acc), `${w}/${acc}`).toBe(WEAPONS[w]);
    // Cached: the same object every time, and no accessory is the plain weapon
    expect(gearedWeapon('rifle', 'ammo')).toBe(gearedWeapon('rifle', 'ammo'));
    expect(gearedWeapon('rifle', 'none')).toBe(WEAPONS.rifle);
    expect(gearedWeapon('rifle', 'kevlar')).toEqual(WEAPONS.rifle);
  });

  it('Kevlar makes you 10 % slower; the helmet weighs nothing', () => {
    expect(accessorySpeed('kevlar')).toBe(KEVLAR.speed);
    expect(KEVLAR.speed).toBe(0.9);
    expect(accessorySpeed('helmet')).toBe(1);
    expect(accessorySpeed('laser')).toBe(1);
    expect(speedWith('rifle', 'kevlar')).toBeCloseTo(BODY.speed * WEAPONS.rifle.weight * KEVLAR.speed, 1);
    expect(speedWith('rifle', 'kevlar')).toBeLessThan(speedWith('rifle'));
  });
});

describe('hit zones', () => {
  const rifle = WEAPONS.rifle;
  it('head × the weapon, torso × 1, legs × 0.6', () => {
    expect(LIMB_MULT).toBe(0.6);
    expect(zoneDamage(10, rifle, 'head')).toBeCloseTo(10 * rifle.headMult);
    expect(zoneDamage(10, rifle, 'torso')).toBe(10);
    expect(zoneDamage(10, rifle, 'limb')).toBeCloseTo(6);
  });

  it('Kevlar protects the torso, the helmet the head (tuned with duel.sim); nothing protects the legs', () => {
    expect(zoneDamage(10, rifle, 'torso', 'kevlar')).toBeCloseTo(10 * KEVLAR.torso);
    expect(zoneDamage(10, rifle, 'head', 'kevlar')).toBeCloseTo(10 * rifle.headMult);
    expect(zoneDamage(10, rifle, 'head', 'helmet')).toBeCloseTo(10 * rifle.headMult * HELMET.head);
    expect(zoneDamage(10, rifle, 'torso', 'helmet')).toBe(10);
    expect(zoneDamage(10, rifle, 'limb', 'kevlar')).toBeCloseTo(6);
    expect(zoneDamage(10, rifle, 'limb', 'helmet')).toBeCloseTo(6);
    // With the helmet no rifle kills with one head shot
    for (const w of ['rifle', 'heavyrifle', 'lightrifle', 'carbine'] as WeaponId[])
      expect(zoneDamage(WEAPONS[w].damage, WEAPONS[w], 'head', 'helmet'), w).toBeLessThan(BODY.hp);
    expect(zoneDamage(10, rifle, 'torso', 'laser')).toBe(10);
  });

  it('the SR8 still kills with one torso shot (even through Kevlar); a head shot kills even through the helmet', () => {
    const sr8 = WEAPONS.sniper;
    expect(zoneDamage(sr8.damage, sr8, 'torso')).toBeGreaterThanOrEqual(BODY.hp);
    expect(zoneDamage(sr8.damage, sr8, 'torso', 'kevlar')).toBeGreaterThanOrEqual(BODY.hp);
    expect(zoneDamage(sr8.damage, sr8, 'limb')).toBeLessThan(BODY.hp);
    expect(zoneDamage(sr8.damage, sr8, 'head', 'helmet')).toBeGreaterThanOrEqual(BODY.hp);
    // The FR-F1 head shot too: the head stays a kill zone for heavy hitters
    expect(zoneDamage(WEAPONS.frf1.damage, WEAPONS.frf1, 'head', 'helmet')).toBeGreaterThanOrEqual(BODY.hp);
  });

  it('bandages bring health back sooner and faster', () => {
    expect(regenOf('none', PLAYER.regenDelay, PLAYER.regenRate)).toEqual([PLAYER.regenDelay, PLAYER.regenRate]);
    expect(regenOf('bandage', PLAYER.regenDelay, PLAYER.regenRate)).toEqual([
      PLAYER.regenDelay - BANDAGE.sooner,
      PLAYER.regenRate * BANDAGE.rate,
    ]);
  });
});

describe('bloom recovery by posture', () => {
  const still = { vx: 0, vz: 0, grounded: true, crouching: false, sliding: false };
  const k = WEAPON_HANDLING.bloom.posture;
  it('×1.5 crouched and still, ×1 standing, ×0.4 running, ×0.1 in the air', () => {
    expect(bloomRecovery({ ...still, crouching: true })).toBe(1.5);
    expect(bloomRecovery(still)).toBe(1);
    expect(bloomRecovery({ ...still, vx: 6 })).toBe(0.4);
    expect(bloomRecovery({ ...still, grounded: false })).toBe(0.1);
    expect(bloomRecovery({ ...still, grounded: false, crouching: true })).toBe(0.1);
    expect(bloomRecovery({ ...still, vz: 9, sliding: true, crouching: true })).toBe(k.run);
    // Crouch-walking is like standing; a slow drift under stillSpeed still counts as still
    expect(bloomRecovery({ ...still, vx: 3, crouching: true })).toBe(1);
    expect(bloomRecovery({ ...still, vx: k.stillSpeed * 0.5 })).toBe(1);
  });
});

describe('stamina by weapon weight', () => {
  it('1 / weight, never below 1 nor above the cap', () => {
    expect(staminaMult(WEAPONS.lmg.weight)).toBeCloseTo(1 / 0.9);
    expect(staminaMult(0.8)).toBeCloseTo(1.25);
    expect(staminaMult(0.5)).toBe(1.3);
    for (const w of [...SIDEARMS, 'knife'] as WeaponId[]) expect(staminaMult(WEAPONS[w].weight), w).toBe(1);
    // Heavier weapon, more tiring
    expect(staminaMult(WEAPONS.lmg.weight)).toBeGreaterThan(staminaMult(WEAPONS.lightlmg.weight));
    expect(PLAYER.staminaDrain).toBeGreaterThan(0);
  });
});
