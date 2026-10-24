import { afterEach, describe, expect, it, vi } from 'vitest';
import { PLAYER, WEAPONS, damageAt, type Vec3 } from '@blockshot/shared';
import { recordPosition } from '../players/history';
import type { Player } from '../players/player';
import { makeRoom } from '../testing/fakeRoom';
import { handleReload, handleShoot, handleSwitch } from './shooting';

// Open line of fire in Patio (medium)
const A: [number, number] = [8, -2.5];
const B: [number, number] = [13, -2.5];
const CHEST = 1.3;
const HEAD = 1.64;

const eye = (p: Player): Vec3 => [p.x, p.y + PLAYER.eye, p.z];
function aim(from: Player, x: number, y: number, z: number): Vec3 {
  const o = eye(from);
  const v: Vec3 = [x - o[0], y - o[1], z - o[2]];
  const len = Math.hypot(...v);
  return [v[0] / len, v[1] / len, v[2] / len];
}
const shotAt = (from: Player, to: Player, dy = CHEST) => ({
  o: eye(from),
  d: [aim(from, to.x, to.y + dy, to.z)],
  lag: 0,
});

afterEach(() => vi.useRealTimers());

function duel(mode: 'ffa' | 'teams' = 'ffa') {
  const r = makeRoom(mode);
  const a = r.join('A', ...A);
  const b = r.join('B', ...B);
  return { ...r, a, b };
}

describe('handleShoot', () => {
  it('hits the body and the head with the weapon multiplier', () => {
    vi.useFakeTimers();
    const { room, a, b, channel } = duel();
    handleShoot(room, a, shotAt(a, b));
    expect(b.hp).toBe(100 - WEAPONS.rifle.damage);
    vi.advanceTimersByTime(200);
    handleShoot(room, a, shotAt(a, b, HEAD));
    const marks = channel.of('hitmarker', a.id);
    expect(marks[1]).toMatchObject({ head: true, dmg: Math.round(WEAPONS.rifle.damage * WEAPONS.rifle.headMult) });
    expect(a).toMatchObject({ shots: 2, hits: 2, heads: 1 });
  });

  // Every weapon of every character: one shot (all pellets) at 5 m deals its exact damage
  const ARSENAL = [
    ['soldado', 0, 'rifle'],
    ['soldado', 1, 'pistol'],
    ['cazador', 0, 'sniper'],
    ['tanque', 0, 'shotgun'],
    ['tanque', 1, 'revolver'],
    ['rayo', 0, 'smg'],
    ['bastion', 0, 'lmg'],
    ['soldado', 2, 'knife'],
  ] as const;
  it.each(ARSENAL)('%s slot %i fires the %s', (character, slot, weaponId) => {
    const r = makeRoom('ffa');
    const a = r.join('A', ...A, character);
    const w = WEAPONS[weaponId];
    // the knife only reaches 2.6 m
    const b = r.join('B', w.melee ? A[0] + 1.5 : 12, -2.5, 'tanque');
    b.ry = Math.PI / 2; // facing the shooter: no backstab
    expect(a.loadout[slot]).toBe(weaponId);
    a.slot = slot;
    const dir = aim(a, b.x, b.y + CHEST, b.z);
    handleShoot(r.room, a, { o: eye(a), d: Array.from({ length: w.pellets }, () => dir), lag: 0 });
    const dist = Math.hypot(b.x - a.x, b.y + CHEST - (a.y + PLAYER.eye), b.z - a.z);
    const expected = w.melee ? w.damage : Math.min(150, damageAt(w, dist - 0.38) * w.pellets);
    expect(150 - b.hp).toBeCloseTo(expected, 0);
  });

  it('respects the fire rate and the magazine, and reloads', () => {
    vi.useFakeTimers();
    const { room, a, b } = duel();
    handleShoot(room, a, shotAt(a, b));
    handleShoot(room, a, shotAt(a, b)); // too soon
    expect(a.ammo[0]!.mag).toBe(WEAPONS.rifle.mag - 1);
    a.ammo[0]!.mag = 0;
    vi.advanceTimersByTime(500);
    handleShoot(room, a, shotAt(a, b));
    expect(a.shots).toBe(1);
    handleReload(a);
    vi.advanceTimersByTime(WEAPONS.rifle.reload);
    handleShoot(room, a, shotAt(a, b));
    expect(a.ammo[0]!.mag).toBe(WEAPONS.rifle.mag - 1);
    expect(a.shots).toBe(2);
  });

  it('switching weapons cancels the reload', () => {
    const { a } = duel();
    a.ammo[0]!.mag = 3;
    handleReload(a);
    expect(a.ammo[0]!.reloadEnd).toBeGreaterThan(0);
    handleSwitch(a, 1);
    expect(a.ammo[0]!.reloadEnd).toBe(0);
    expect(a.slot).toBe(1);
    handleSwitch(a, 7); // no such slot
    expect(a.slot).toBe(1);
  });

  it('rejects shots from far away, with too many pellets or bad directions', () => {
    const { room, a, b } = duel();
    handleShoot(room, a, { ...shotAt(a, b), o: [a.x, a.y + PLAYER.eye + 10, a.z] });
    handleShoot(room, a, { ...shotAt(a, b), d: [aim(a, b.x, b.y + 1, b.z), aim(a, b.x, b.y + 1, b.z)] });
    handleShoot(room, a, { ...shotAt(a, b), d: [[0, 2, 0]] });
    expect(a.shots).toBe(0);
    expect(b.hp).toBe(100);
  });

  it('damage drops with distance (falloff)', () => {
    const r = makeRoom('ffa');
    // clear 23 m line south of the tower
    const a = r.join('A', -10, -14);
    const b = r.join('B', 13, -14, 'tanque');
    a.slot = 1; // pistol: falloff from 20 m
    handleShoot(r.room, a, shotAt(a, b));
    const dist = Math.hypot(b.x - a.x, b.z - a.z);
    expect(r.channel.of('hitmarker', a.id)[0]?.dmg).toBe(Math.round(damageAt(WEAPONS.pistol, dist)));
    expect(r.channel.of('hitmarker', a.id)[0]?.dmg).toBeLessThan(WEAPONS.pistol.damage);
  });

  it('rewinds the target to where the shooter saw it (lag compensation)', () => {
    vi.useFakeTimers();
    const { room, a, b } = duel();
    recordPosition(b, Date.now());
    vi.advanceTimersByTime(199);
    recordPosition(b, Date.now()); // still there…
    vi.advanceTimersByTime(1);
    b.z = B[1] + 8; // …then it moved away
    recordPosition(b, Date.now());
    const old = { ...b, x: B[0], z: B[1] };
    // aimed where b was 200 ms ago: without rewinding it is a miss…
    handleShoot(room, a, { o: eye(a), d: [aim(a, old.x, CHEST, old.z)], lag: 0 });
    expect(b.hp).toBe(100);
    // …and rewound by the shooter's delay it is a hit
    vi.advanceTimersByTime(100);
    recordPosition(b, Date.now());
    handleShoot(room, a, { o: eye(a), d: [aim(a, old.x, CHEST, old.z)], lag: 250 });
    expect(b.hp).toBeLessThan(100);
  });

  it('never hits teammates', () => {
    const { room, a, b } = duel('teams');
    b.team = a.team;
    handleShoot(room, a, shotAt(a, b));
    expect(b.hp).toBe(100);
  });

  it('knife: hits a close target without pixel aim and kills from behind', () => {
    vi.useFakeTimers();
    const r = makeRoom('ffa');
    const a = r.join('A', 13, -1.1);
    const b = r.join('B', ...B, 'tanque');
    a.slot = 2;
    b.ry = 0; // looks towards -z, so a (on its +z side) is behind it
    // aimed a bit off: the melee assist still finds it
    handleShoot(r.room, a, { o: eye(a), d: [aim(a, b.x + 0.4, b.y + 0.8, b.z)], lag: 0 });
    expect(b.alive).toBe(false);
    expect(r.channel.of('kill')[0]?.weapon).toBe('Cuchillo');
  });

  it('knife from the front only deals its normal damage', () => {
    const r = makeRoom('ffa');
    const a = r.join('A', 13, -3.9);
    const b = r.join('B', ...B, 'tanque');
    a.slot = 2;
    b.ry = 0; // a is in front of b
    handleShoot(r.room, a, { o: eye(a), d: [aim(a, b.x, b.y + 1, b.z)], lag: 0 });
    expect(b.hp).toBe(150 - WEAPONS.knife.damage);
  });
});
