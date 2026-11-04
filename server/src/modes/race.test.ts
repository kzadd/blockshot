import { describe, expect, it } from 'vitest';
import { RACE_FALL_Y } from '@blockshot/shared';
import { makeRoom } from '../testing/fakeRoom';

describe('carrera', () => {
  it('runs through the checkpoints in order, sends fallers back to theirs and scores the finish', () => {
    const r = makeRoom('race', 2, 'circuito');
    expect(r.room.map.id).toBe('circuito');
    const cps = r.room.map.checkpoints;
    expect(cps.length).toBeGreaterThan(2);
    const a = r.join('Ana', 0, 0);
    const b = r.join('Beto', 0, 0);
    const now = Date.now();
    // Ana reaches the first checkpoint, then falls into the lava: back on that checkpoint
    r.place(a, cps[0]!.x, cps[0]!.z, cps[0]!.y);
    r.room.mode.tick!(r.room, now);
    r.place(a, 0, 0, RACE_FALL_Y - 1);
    r.room.mode.tick!(r.room, now);
    expect(Math.abs(a.x - cps[0]!.x)).toBeLessThan(cps[0]!.w / 2);
    expect(a.y).toBeCloseTo(cps[0]!.y, 1);
    // Skipping ahead to the finish does not count: checkpoints go in order
    const fin = cps[cps.length - 1]!;
    r.place(a, fin.x, fin.z, fin.y);
    r.room.mode.tick!(r.room, now);
    expect(a.caps).toBe(0);
    for (const c of cps.slice(1)) {
      r.place(a, c.x, c.z, c.y);
      r.room.mode.tick!(r.room, now);
    }
    expect(a.caps).toBe(1);
    // A new race: everybody is back at the start
    expect(Math.hypot(b.x - r.room.map.spawns[0]![0], b.z - r.room.map.spawns[0]![2])).toBeLessThan(10);
  });

  it('carries the sidearm and the knife only', () => {
    const r = makeRoom('race', 2, 'circuito');
    const a = r.join('Ana', 0, 0, { primary: 'sniper', secondary: 'mpistol' });
    expect(a.loadout).toEqual(['mpistol', 'knife']);
  });
});
