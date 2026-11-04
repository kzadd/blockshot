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
    expect(head.hit).toEqual({ type: 'player', id: 't', head: true, zone: 'head' });
    const body = castShot([0, 1, 0], [0, 0, -1], [], [target()], '', 100);
    expect(body.hit).toEqual({ type: 'player', id: 't', head: false, zone: 'torso' });
    expect(hitboxes(target({ cr: 1 })).head[1]).toBeCloseTo(HITBOX.headHeight - HITBOX.lowered);
    // Just above a crouched head: misses the crouched player but would hit a standing one
    const y = HITBOX.headHeight - HITBOX.lowered + HITBOX.headRadius + 0.05;
    expect(castShot([0, y, 0], [0, 0, -1], [], [target({ cr: 1 })], '', 100).hit).toBeNull();
    expect(castShot([0, y, 0], [0, 0, -1], [], [target()], '', 100).hit?.type).toBe('player');
  });

  it('splits the body box into torso and legs (lowered with the body when crouching)', () => {
    const hip = HITBOX.bodyHeight * HITBOX.legs;
    expect(hitboxes(target()).hip).toBeCloseTo(hip);
    const zone = (y: number, t = target()) => {
      const hit = castShot([0, y, 0], [0, 0, -1], [], [t], '', 100).hit;
      return hit?.type === 'player' ? hit.zone : null;
    };
    expect(zone(hip + 0.05)).toBe('torso');
    expect(zone(hip - 0.05)).toBe('limb');
    expect(zone(0.2)).toBe('limb');
    // Crouched, the hip comes down too: what was torso height standing is still torso
    const crouched = target({ cr: 1 });
    expect(hitboxes(crouched).hip).toBeCloseTo((HITBOX.bodyHeight - HITBOX.lowered) * HITBOX.legs);
    expect(zone(0.6, crouched)).toBe('torso');
    expect(zone(0.3, crouched)).toBe('limb');
    // A shot from above into the top of a standing body is a torso hit (the zone is where it goes in)
    const down = castShot([0, 3, -10.33], [0, -1, 0], [], [target()], '', 100).hit;
    expect(down).toMatchObject({ zone: 'torso' });
  });

  it('walls block shots, range limits them and the shooter is ignored', () => {
    const wall = { min: [-2, 0, -6] as [number, number, number], max: [2, 3, -5] as [number, number, number] };
    expect(castShot([0, 1, 0], [0, 0, -1], [wall], [target()], '', 100).hit).toEqual({ type: 'wall' });
    expect(castShot([0, 1, 0], [0, 0, -1], [], [target()], '', 5).hit).toBeNull();
    expect(castShot([0, 1, 0], [0, 0, -1], [], [target()], 't', 100).hit).toBeNull();
    expect(castShot([0, 1, 0], [0, 0, -1], [], [target({ alive: false })], '', 100).hit).toBeNull();
  });

  it('shots go through railings', () => {
    const rail = {
      c: 'railing',
      min: [-2, 0, -6] as [number, number, number],
      max: [2, 1, -5.9] as [number, number, number],
    };
    expect(castShot([0, 0.5, 0], [0, 0, -1], [rail], [target()], '', 100).hit?.type).toBe('player');
    expect(castShot([0, 0.5, 0], [0, 0, -1], [{ ...rail, c: 'wall' }], [target()], '', 100).hit).toEqual({
      type: 'wall',
    });
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
