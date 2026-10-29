import { describe, expect, it } from 'vitest';
import { BARREL, CRATE, PICKUP, type MapBox } from '@blockshot/shared';
import { makeRoom } from '../testing/fakeRoom';
import { hitObjectAt, resetWorld, tickWorld } from './worldObjects';

const barrel = (x: number, z: number): MapBox => ({ x, y: 0, z, w: BARREL.w, h: BARREL.h, d: BARREL.w, c: 'xbarrel' });
const crate = (x: number, z: number): MapBox => ({ x, y: 0, z, w: 1.2, h: 1.2, d: 1.2, c: 'xcrate' });

/** A room on an open patch of Patio with our own barrels, crates and pickups (the cached map is not touched). */
function roomWithObjects() {
  const r = makeRoom('ffa');
  r.room.map = {
    ...r.room.map,
    barrels: [barrel(0, 28), barrel(2, 28)],
    crates: [crate(1, 30)],
    pickups: [{ k: 'hp', x: -20, y: 0, z: 30 }],
  };
  resetWorld(r.room);
  return r;
}

const blocks = (r: ReturnType<typeof makeRoom>, b: MapBox) =>
  r.room.colliders.some((c) => c.c === b.c && c.min[0] === b.x - b.w / 2 && c.min[2] === b.z - b.d / 2);

describe('map objects', () => {
  it('a shot barrel blows up: hurts a rival, sets off the next barrel and breaks the crate, credited to the shooter', () => {
    const r = roomWithObjects();
    const a = r.join('Ana', 0, 20);
    const b = r.join('Beto', 1, 29.2);
    const now = Date.now();
    const [first, second] = r.room.map.barrels;
    hitObjectAt(r.room, a, [0, 0.5, 28 + BARREL.w / 2], BARREL.hp, now);
    expect(r.channel.of('boom').length).toBe(2); // the chain
    expect(blocks(r, first!)).toBe(false);
    expect(blocks(r, second!)).toBe(false);
    expect(b.alive).toBe(false);
    expect(a.kills).toBe(1);
    expect(r.room.world.crateBack[0]).toBeGreaterThan(0);
    expect(r.channel.of('crate').length).toBe(1);
  });

  it('a fallen barrel stands again after its time, but not on top of somebody', () => {
    const r = roomWithObjects();
    const a = r.join('Ana', 0, 20);
    const now = Date.now();
    hitObjectAt(r.room, a, [0, 0.5, 28], BARREL.hp, now);
    const b = r.join('Beto', 0, 28);
    tickWorld(r.room, now + BARREL.respawnMs + 1);
    expect(blocks(r, r.room.map.barrels[0]!)).toBe(false);
    r.place(b, 0, 0);
    tickWorld(r.room, now + BARREL.respawnMs + 2);
    expect(blocks(r, r.room.map.barrels[0]!)).toBe(true);
    expect(r.room.world.barrelHp[0]).toBe(BARREL.hp);
  });

  it('a crate takes damage until it breaks, then lets bullets and players through', () => {
    const r = roomWithObjects();
    const a = r.join('Ana', 0, 20);
    const now = Date.now();
    hitObjectAt(r.room, a, [1, 0.6, 30 - 0.6], CRATE.hp - 1, now);
    expect(blocks(r, r.room.map.crates[0]!)).toBe(true);
    hitObjectAt(r.room, a, [1, 0.6, 30 - 0.6], 1, now);
    expect(blocks(r, r.room.map.crates[0]!)).toBe(false);
  });

  it('health on the floor heals a hurt player, not a healthy one, and comes back later', () => {
    const r = roomWithObjects();
    const now = Date.now();
    const full = r.join('Ana', -20, 30);
    tickWorld(r.room, now);
    expect(r.room.world.pickupBack[0]).toBe(0);
    full.hp = 30;
    tickWorld(r.room, now + 1);
    expect(full.hp).toBe(30 + PICKUP.hp);
    expect(r.room.world.pickupBack[0]).toBe(now + 1 + PICKUP.respawnMs);
    expect(r.channel.of('pickup', full.id)).toEqual(['hp']);
    full.hp = 10;
    tickWorld(r.room, now + 2);
    expect(full.hp).toBe(10);
    tickWorld(r.room, now + 2 + PICKUP.respawnMs);
    expect(full.hp).toBe(10 + PICKUP.hp);
  });
});
