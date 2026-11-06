import { describe, expect, it } from 'vitest';
import { SERVER_TICK_MS, ZONE_PLANS, ZONE_DPS, zoneAt, zoneCycleMs } from '@blockshot/shared';
import { makeRoom } from '../testing/fakeRoom';
import { pickSpawn } from '../players/spawn';

describe('shrinking zone', () => {
  it('stays open, then closes to its smallest radius, hurting more and more', () => {
    const plan = ZONE_PLANS.rounds!;
    expect(zoneAt(plan, plan.openMs - 1, 60)).toEqual({ r: 60, dps: 0, open: true });
    expect(zoneAt(plan, plan.openMs + plan.shrinkMs / 4, 60)).toMatchObject({ dps: ZONE_DPS[0], open: false });
    expect(zoneAt(plan, plan.openMs + (plan.shrinkMs * 3) / 4, 60).dps).toBe(ZONE_DPS[1]);
    expect(zoneAt(plan, plan.openMs + plan.shrinkMs + 1, 60)).toMatchObject({ r: plan.minR, dps: ZONE_DPS[2] });
  });

  it('Por equipos: kills whoever stays outside, spares who is inside, respawns inside and opens again', () => {
    const r = makeRoom('teams');
    const plan = ZONE_PLANS.teams!;
    let now = Date.now();
    const tick = (ms: number) => {
      for (let t = 0; t < ms; t += SERVER_TICK_MS) r.room.mode.tick!(r.room, (now += SERVER_TICK_MS));
    };
    const zone = () => r.room.mode.snapshot!(r.room, now).zn!;
    tick(SERVER_TICK_MS);
    const [x, , z, full] = zone();
    const inner = r.join('Ana', x, z);
    const outer = r.join('Beto', x > 0 ? -r.room.map.half + 2 : r.room.map.half - 2, z);
    tick(plan.openMs - SERVER_TICK_MS);
    expect(outer.hp).toBe(outer.maxHp); // open: nobody hurt
    expect(r.channel.notices().some((t) => t.includes('La zona se cierra en'))).toBe(true);
    tick(plan.shrinkMs);
    expect(zone()[3]).toBeCloseTo(plan.minR, 0);
    expect(zone()[3]).toBeLessThan(full);
    expect(outer.alive).toBe(false);
    expect(r.channel.of('kill').some((k) => k.victim === outer.id && k.weapon === 'Zona')).toBe(true);
    expect(inner.hp).toBe(inner.maxHp);
    // Closed: a respawn lands inside
    for (let i = 0; i < 20; i++) {
      const [sx, , sz] = pickSpawn(r.room, outer);
      expect(Math.hypot(sx - x, sz - z)).toBeLessThanOrEqual(plan.minR);
    }
    tick(zoneCycleMs(plan) - plan.openMs - plan.shrinkMs + SERVER_TICK_MS);
    expect(zone()[3]).toBeGreaterThan(plan.minR * 2); // a new cycle: the whole map open again
  });

  it('the round modes have no zone between rounds', () => {
    const r = makeRoom('rounds');
    r.join('Ana', 5, 30);
    expect(r.room.mode.snapshot!(r.room, Date.now()).zn).toBeNull();
  });
});
