// Balance rules: every character trades one strength for one weakness, and no number drifts far enough to make
// one of them the obvious pick. Change a value in characters.ts / weapons.ts and these say what it broke.
import { describe, expect, it } from 'vitest';
import { WEAPONS, damageAt, type WeaponId } from '../weapons/weapons';
import { CHARACTERS, CHAR_BY_ID, speedWith } from './characters';

const MID_RANGE = 15;
/** Body-shot time to kill a Soldado with an automatic primary must stay inside this band (ms). */
const AUTO_TTK: [number, number] = [350, 550];

const shotsToKill = (w: WeaponId, hp: number, dist = MID_RANGE, head = false) =>
  Math.ceil(hp / (damageAt(WEAPONS[w], dist) * (head ? WEAPONS[w].headMult : 1)));
const ttk = (w: WeaponId, hp: number) => (shotsToKill(w, hp) - 1) * WEAPONS[w].fireRate;

describe('balance', () => {
  const speeds = CHARACTERS.map((c) => speedWith(c, c.primary));
  const soldado = CHAR_BY_ID.soldado;

  it('the fastest character is at most ~20 % faster than the Soldado', () => {
    expect(Math.max(...speeds) / speedWith(soldado, soldado.primary)).toBeLessThanOrEqual(1.22);
  });

  it('more health means slower (no character is both tougher and faster than another)', () => {
    for (const a of CHARACTERS)
      for (const b of CHARACTERS)
        if (a.hp > b.hp)
          expect(speedWith(a, a.primary), `${a.name} vs ${b.name}`).toBeLessThanOrEqual(speedWith(b, b.primary));
  });

  it('automatic primaries kill a Soldado in a similar time', () => {
    for (const w of ['rifle', 'smg', 'lmg'] as const) {
      const t = ttk(w, soldado.hp);
      expect(t, w).toBeGreaterThanOrEqual(AUTO_TTK[0]);
      expect(t, w).toBeLessThanOrEqual(AUTO_TTK[1]);
    }
  });

  it('the sniper one-shots everybody to the body except the Tanque, who needs a headshot', () => {
    for (const c of CHARACTERS) {
      expect(shotsToKill('sniper', c.hp, 100, true), c.name).toBe(1);
      expect(shotsToKill('sniper', c.hp, 100) === 1, c.name).toBe(c.id !== 'tanque');
    }
  });

  it('the shotgun one-shots up close, except the Tanque', () => {
    const full = WEAPONS.shotgun.damage * WEAPONS.shotgun.pellets;
    expect(full).toBeGreaterThanOrEqual(CHAR_BY_ID.bastion.hp);
    expect(full).toBeLessThan(CHAR_BY_ID.tanque.hp);
  });
});
