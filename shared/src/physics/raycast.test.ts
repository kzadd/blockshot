import { describe, expect, it } from 'vitest';
import { WEAPONS, damageAt } from '../weapons/weapons';
import { HITBOX, castShot, hitboxes, rayAABB, raySphere, type HitTarget } from './raycast';

const target = (patch: Partial<HitTarget> = {}): HitTarget => ({
  id: 't',
  x: 0,
  y: 0,
  z: -10,
  sl: 0,
  cr: 0,
  alive: true,
  ...patch,
});

describe('raycast', () => {
  it('ray vs box and sphere', () => {
    expect(rayAABB([0, 0, 0], [0, 0, -1], [-1, -1, -6], [1, 1, -4])).toBeCloseTo(4);
    expect(rayAABB([0, 0, 0], [0, 0, 1], [-1, -1, -6], [1, 1, -4])).toBe(Infinity);
    expect(raySphere([0, 0, 0], [0, 0, -1], [0, 0, -5], 1)).toBeCloseTo(4);
    expect(raySphere([0, 3, 0], [0, 0, -1], [0, 0, -5], 1)).toBe(Infinity);
  });

  it('tells head from body and lowers both when crouching', () => {
    const head = castShot([0, HITBOX.headHeight, 0], [0, 0, -1], [], [target()], '', 100);
    expect(head.hit).toEqual({ type: 'player', id: 't', head: true });
    const body = castShot([0, 1, 0], [0, 0, -1], [], [target()], '', 100);
    expect(body.hit).toEqual({ type: 'player', id: 't', head: false });
    expect(hitboxes(target({ cr: 1 })).head[1]).toBeCloseTo(HITBOX.headHeight - HITBOX.lowered);
    // Just above a crouched head: misses the crouched player but would hit a standing one
    const y = HITBOX.headHeight - HITBOX.lowered + HITBOX.headRadius + 0.05;
    expect(castShot([0, y, 0], [0, 0, -1], [], [target({ cr: 1 })], '', 100).hit).toBeNull();
    expect(castShot([0, y, 0], [0, 0, -1], [], [target()], '', 100).hit?.type).toBe('player');
  });

  it('walls block shots, range limits them and the shooter is ignored', () => {
    const wall = { min: [-2, 0, -6] as [number, number, number], max: [2, 3, -5] as [number, number, number] };
    expect(castShot([0, 1, 0], [0, 0, -1], [wall], [target()], '', 100).hit).toEqual({ type: 'wall' });
    expect(castShot([0, 1, 0], [0, 0, -1], [], [target()], '', 5).hit).toBeNull();
    expect(castShot([0, 1, 0], [0, 0, -1], [], [target()], 't', 100).hit).toBeNull();
    expect(castShot([0, 1, 0], [0, 0, -1], [], [target({ alive: false })], '', 100).hit).toBeNull();
  });

  it('damage falls off between the falloff distances', () => {
    const w = WEAPONS.rifle;
    const [from, to, min] = w.falloff!;
    expect(damageAt(w, from - 1)).toBe(w.damage);
    expect(damageAt(w, to + 50)).toBeCloseTo(w.damage * min);
    expect(damageAt(w, (from + to) / 2)).toBeCloseTo(w.damage * (1 - 0.5 * (1 - min)));
    expect(damageAt(WEAPONS.sniper, 300)).toBe(WEAPONS.sniper.damage); // no falloff
  });
});
