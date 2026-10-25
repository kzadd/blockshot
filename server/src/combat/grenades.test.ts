import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FIXED_DT, GRENADE, PLAYER, type Vec3 } from '@blockshot/shared';
import { makeRoom } from '../testing/fakeRoom';
import { blastDamage, throwGrenade, tickGrenades } from './grenades';

beforeEach(() => vi.useFakeTimers({ now: 1_000_000 }));
afterEach(() => vi.useRealTimers());

const run = (r: ReturnType<typeof makeRoom>, ms: number) => {
  for (let t = 0; t < ms; t += FIXED_DT * 1000) {
    vi.advanceTimersByTime(FIXED_DT * 1000);
    tickGrenades(r.room, FIXED_DT, Date.now());
  }
};
const floor = { c: 'ground', min: [-50, -1, -50] as Vec3, max: [50, 0, 50] as Vec3 };

describe('grenades', () => {
  it('damage falls with distance and stops at the radius', () => {
    expect(blastDamage(0)).toBe(GRENADE.maxDamage);
    expect(blastDamage(GRENADE.radius / 2)).toBeCloseTo((GRENADE.maxDamage + GRENADE.minDamage) / 2);
    expect(blastDamage(GRENADE.radius)).toBe(0);
  });

  it('bounces on the floor, explodes after the fuse and hurts rivals in range, not the thrower', () => {
    const r = makeRoom('ffa');
    r.room.colliders = [floor];
    const a = r.join('A', 0, 0);
    const near = r.join('Near', 0, -4);
    const far = r.join('Far', 0, -20);
    a.grenades = 1;
    // Dropped at the feet of `near`: it lands, bounces a little and stays there
    throwGrenade(r.room, a, [0, 1, -4], [0, -1, 0], Date.now());
    expect(a.grenades).toBe(0);
    run(r, GRENADE.fuseMs - 100);
    expect(r.room.grenades[0]!.pos[1]).toBeGreaterThan(0);
    expect(r.room.grenades[0]!.pos[1]).toBeLessThan(0.5);
    run(r, 200);
    expect(r.room.grenades).toHaveLength(0);
    expect(r.channel.of('boom')).toHaveLength(1);
    expect(near.alive).toBe(false);
    expect(r.channel.of('kill')[0]).toMatchObject({ killer: a.id, victim: near.id, weapon: 'Granada' });
    expect(far.hp).toBe(far.maxHp);
    expect(a.hp).toBe(a.maxHp);
  });

  it('a wall between the blast and a player shelters them; teammates are safe', () => {
    const r = makeRoom('teams');
    const wall = { c: 'wall', min: [-3, 0, -2.2] as Vec3, max: [3, 3, -1.8] as Vec3 };
    r.room.colliders = [floor, wall];
    const a = r.join('A', 0, 0); // team 1
    const rival = r.join('B', 0, -4); // team 2, behind the wall
    const mate = r.join('C', 1, 0); // team 1
    a.grenades = 1;
    throwGrenade(r.room, a, [0, PLAYER.eye, -0.5], [0, -1, 0], Date.now());
    run(r, GRENADE.fuseMs + 100);
    expect(r.channel.of('boom')).toHaveLength(1);
    expect(rival.hp).toBe(rival.maxHp);
    expect(mate.hp).toBe(mate.maxHp);
  });
});
