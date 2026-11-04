// Balance rules: everybody has the same body, so every weapon trades one strength for one weakness and no number
// drifts far enough to make one of them the obvious pick. Change a value in weapons.ts and these say what it broke.
// The duel simulation (server/src/combat/duel.sim.test.ts) checks the same against moving, aiming players.
import { describe, expect, it } from 'vitest';
import { WEAPONS, damageAt, type WeaponId } from '../weapons/weapons';
import { BODY, PRIMARIES, SIDEARMS, speedWith } from './characters';

const MID_RANGE = 15;
const HP = BODY.hp;
/** Body-shot time to kill with an automatic primary must stay inside this band (ms). */
const AUTO_TTK: [number, number] = [300, 500]; // Urban Terror pace: quick kills, precise when still
/** Same for the hitscan sidearms (key 2): slower than a primary, but still a real fallback. */
const SIDEARM_TTK: [number, number] = [450, 750];
const AUTOMATICS = [
  'rifle',
  'heavyrifle',
  'lightrifle',
  'carbine',
  'smg',
  'ump45',
  'pdw',
  'compact',
  'lmg',
  'lightlmg',
] as const;

const shotsToKill = (w: WeaponId, hp = HP, dist = MID_RANGE, head = false) =>
  Math.ceil(hp / (damageAt(WEAPONS[w], dist) * (head ? WEAPONS[w].headMult : 1)));
const ttk = (w: WeaponId) => (shotsToKill(w) - 1) * WEAPONS[w].fireRate;

describe('balance', () => {
  it('speed comes only from the weapon held: the body times its weight', () => {
    for (const w of [...PRIMARIES, ...SIDEARMS, 'knife'] as WeaponId[])
      expect(speedWith(w), w).toBeCloseTo(BODY.speed * WEAPONS[w].weight, 1);
    // No primary makes you much faster than the M4, and the heavy ones are slower
    for (const w of PRIMARIES) expect(speedWith(w) / speedWith('rifle'), w).toBeLessThanOrEqual(1.1);
    for (const w of ['lmg', 'launcher', 'grenadelauncher'] as const)
      expect(speedWith(w), w).toBeLessThan(speedWith('rifle'));
    // The sidearm is the way to move faster
    for (const w of SIDEARMS) expect(speedWith(w), w).toBeGreaterThanOrEqual(speedWith('rifle'));
  });

  it('automatic primaries kill in a similar time', () => {
    for (const w of AUTOMATICS) {
      const t = ttk(w);
      expect(t, w).toBeGreaterThanOrEqual(AUTO_TTK[0]);
      expect(t, w).toBeLessThanOrEqual(AUTO_TTK[1]);
    }
  });

  it('sidearms kill slower than a primary, but still kill', () => {
    for (const w of SIDEARMS) {
      const t = ttk(w);
      expect(t, w).toBeGreaterThanOrEqual(SIDEARM_TTK[0]);
      expect(t, w).toBeLessThanOrEqual(SIDEARM_TTK[1]);
    }
  });

  it('the SR8 one-shots to the body; the FR-F1 needs the head', () => {
    expect(shotsToKill('sniper', HP, 100)).toBe(1);
    expect(shotsToKill('frf1', HP, 100)).toBe(2);
    expect(shotsToKill('frf1', HP, 100, true)).toBe(1);
    // FR-F1: lighter and quicker to aim than the SR8
    expect(WEAPONS.frf1.weight).toBeGreaterThan(WEAPONS.sniper.weight);
    expect(WEAPONS.frf1.adsSpeed).toBeGreaterThan(WEAPONS.sniper.adsSpeed);
    expect(WEAPONS.frf1.bolt && WEAPONS.frf1.scope).toBe(true);
  });

  it('each weapon plays its role against the one it is built on', () => {
    const W = WEAPONS;
    // AK103: hits harder, fires slower, kicks more than the M4; it needs a body shot less
    expect(W.heavyrifle.damage).toBeGreaterThan(W.rifle.damage);
    expect(W.heavyrifle.fireRate).toBeGreaterThan(W.rifle.fireRate);
    expect(W.heavyrifle.recoil).toBeGreaterThan(W.rifle.recoil);
    expect(shotsToKill('heavyrifle')).toBeLessThan(shotsToKill('rifle'));
    // LR300 (Urban Terror, 2026-11-04): the M4's punch at a slower rate (~450 rpm), and steadier
    expect(W.lightrifle.damage).toBeLessThanOrEqual(W.rifle.damage);
    expect(W.lightrifle.fireRate).toBeGreaterThan(W.rifle.fireRate);
    expect(W.lightrifle.recoil).toBeLessThan(W.rifle.recoil);
    // G36: a 2× sight and the tightest aimed spread of the automatics
    expect(W.carbine.zoom).toBe(2);
    for (const w of AUTOMATICS) if (w !== 'carbine') expect(W.carbine.adsSpread, w).toBeLessThan(W[w].adsSpread);
    // UMP45: bigger bullets, slower fire and a smaller magazine than the MP5K
    expect(W.ump45.damage).toBeGreaterThan(W.smg.damage);
    expect(W.ump45.fireRate).toBeGreaterThan(W.smg.fireRate);
    expect(W.ump45.mag).toBe(25);
    // P90: big magazine, reaches further than the MP5K
    expect(W.pdw.mag).toBeGreaterThanOrEqual(45);
    expect(W.pdw.falloff![0]).toBeGreaterThan(W.smg.falloff![0]);
    // MAC-11: the fastest gun a class carries, the widest spread, the shortest reach
    const carried = [...PRIMARIES, ...SIDEARMS];
    expect(Math.min(...carried.map((w) => W[w].fireRate))).toBe(W.compact.fireRate);
    expect(W.compact.spread).toBeGreaterThan(W.smg.spread);
    expect(damageAt(W.compact, 30)).toBeLessThan(damageAt(W.smg, 30));
    // Negev: a 90-round belt, lighter and quicker to aim than the M60, less damage and a wider cone
    expect(W.lightlmg.mag).toBe(90);
    expect(W.lightlmg.weight).toBeGreaterThan(W.lmg.weight);
    expect(W.lightlmg.adsSpeed).toBeGreaterThan(W.lmg.adsSpeed);
    expect(W.lightlmg.damage).toBeLessThan(W.lmg.damage);
    expect(W.lightlmg.spread).toBeGreaterThan(W.lmg.spread);
    // Benelli: quicker follow-up than the SPAS-12, less damage per shot
    expect(W.benelli.fireRate).toBeLessThan(W.shotgun.fireRate);
    expect(W.benelli.damage * W.benelli.pellets).toBeLessThan(W.shotgun.damage * W.shotgun.pellets);
    // Recortada: a wider cone and less reach than the SPAS-12, two quick shots
    expect(W.sawedoff.spread).toBeGreaterThan(W.shotgun.spread);
    expect(W.sawedoff.range).toBeLessThan(W.shotgun.range);
    expect(W.sawedoff.fireRate).toBeLessThan(W.shotgun.fireRate);
    // Desert Eagle: fewer, heavier, slower shots with more kick than the Beretta; the Colt sits in between
    expect(W.heavypistol.damage).toBeGreaterThan(W.pistol.damage);
    expect(W.heavypistol.fireRate).toBeGreaterThan(W.pistol.fireRate);
    expect(W.heavypistol.mag).toBeLessThan(W.pistol.mag);
    expect(W.heavypistol.recoil).toBeGreaterThan(W.pistol.recoil);
    for (const k of ['damage', 'fireRate', 'recoil'] as const) {
      expect(W.colt[k], k).toBeGreaterThan(W.pistol[k]);
      expect(W.colt[k], k).toBeLessThan(W.heavypistol[k]);
    }
    // HK69: lobbed rounds, more of them than the bazooka
    expect(W.grenadelauncher.projectile && W.grenadelauncher.lob).toBe(true);
    expect(W.grenadelauncher.mag).toBeGreaterThan(W.launcher.mag);
  });

  it('the SPAS-12 one-shots up close; the Benelli and the Recortada need two', () => {
    const full = (w: WeaponId) => WEAPONS[w].damage * WEAPONS[w].pellets;
    expect(full('shotgun')).toBeGreaterThanOrEqual(HP);
    expect(full('benelli')).toBeLessThan(HP);
    expect(full('sawedoff')).toBeGreaterThanOrEqual(HP * 0.8);
  });
});
