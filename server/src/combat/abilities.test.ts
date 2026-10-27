import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BTN_DASH,
  DASH,
  FIXED_DT,
  MEDKIT_HP,
  MINE,
  RADAR_MS,
  SMOKE,
  WALL,
  createMoveState,
  getColliders,
  getMap,
  stepMovement,
  type Collider,
} from '@blockshot/shared';
import { makeRoom } from '../testing/fakeRoom';
import { shieldBlocks, smokeBlocks, tickAbilities, useAbility } from './abilities';
import { launchRound, tickGrenades } from './grenades';

const LOOK_NORTH: [number, number, number] = [0, 0, -1];

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('abilities', () => {
  it('wall: stands in front, blocks movement and bullets, has a cooldown and goes away', () => {
    const r = makeRoom('ffa');
    const a = r.join('Ana', 0, 30, 'bastion');
    const now = Date.now();
    expect(useAbility(r.room, a, [0, 1.6, 30], LOOK_NORTH, now)).toBe(true);
    const wall = r.room.deployables.find((d) => d.kind === 'wall')!;
    expect(wall.pos[2]).toBeCloseTo(30 - WALL.dist);
    expect(r.room.colliders.length).toBe(getColliders(r.room.map).length + 1);
    expect(useAbility(r.room, a, [0, 1.6, 30], LOOK_NORTH, now + 1000)).toBe(false); // cooldown
    tickAbilities(r.room, now + WALL.durationMs + 1);
    expect(r.room.deployables).toHaveLength(0);
    expect(r.room.colliders.length).toBe(getColliders(r.room.map).length);
  });

  it('wall: never on top of a player (no sitio), and the cooldown is not spent', () => {
    const r = makeRoom('ffa');
    const a = r.join('Ana', 0, 30, 'bastion');
    r.join('Bea', 0, 30 - WALL.dist);
    expect(useAbility(r.room, a, [0, 1.6, 30], LOOK_NORTH, Date.now())).toBe(false);
    expect(a.abilityAt).toBe(0);
    expect(r.channel.notices().at(-1)).toMatch(/sitio para el muro/);
  });

  it('mine: arms, ignores teammates, hurts a rival but cannot kill one at full health', () => {
    const r = makeRoom('teams');
    const hunter = r.join('Caza', 0, 30, 'cazador');
    const mate = r.join('Mate', 20, 30);
    const rival = r.join('Riva', 20, 20);
    if (mate.team !== hunter.team) [mate.team, rival.team] = [hunter.team, mate.team];
    const now = Date.now();
    useAbility(r.room, hunter, [0, 1.6, 30], LOOK_NORTH, now);
    r.place(hunter, 10, 10);
    r.place(rival, 0.5, 30);
    tickAbilities(r.room, now + 100); // not armed yet
    expect(r.room.deployables).toHaveLength(1);
    r.place(rival, 20, 20);
    r.place(mate, 0.5, 30);
    tickAbilities(r.room, now + MINE.armMs + 1); // a teammate walks over it
    expect(r.room.deployables).toHaveLength(1);
    r.place(mate, 20, 30);
    r.place(rival, 0.5, 30);
    tickAbilities(r.room, now + MINE.armMs + 2);
    expect(r.room.deployables).toHaveLength(0);
    expect(rival.alive).toBe(true);
    expect(rival.hp).toBeLessThan(rival.maxHp);
    expect(rival.hp).toBeGreaterThan(0);
  });

  it('shield: blocks shots from the front only, for a few seconds', () => {
    const r = makeRoom('ffa');
    const t = r.join('Tan', 0, 0, 'tanque');
    t.ry = 0; // facing -z
    const now = Date.now();
    useAbility(r.room, t, [0, 1.6, 0], LOOK_NORTH, now);
    expect(shieldBlocks(t, [0, 1.6, -10], now)).toBe(true); // in front
    expect(shieldBlocks(t, [0, 1.6, 10], now)).toBe(false); // from behind
    expect(shieldBlocks(t, [0, 1.6, -10], t.shieldUntil + 1)).toBe(false); // over
  });

  it('smoke: the canister pops into a cloud nobody sees through, which clears later', () => {
    const r = makeRoom('ffa');
    const s = r.join('Sol', 0, 30, 'soldado');
    const now = Date.now();
    useAbility(r.room, s, [0, 1.6, 30], LOOK_NORTH, now);
    expect(r.room.grenades).toHaveLength(1);
    for (let t = 0; t <= SMOKE.fuseMs; t += 1000 / 60) tickGrenades(r.room, FIXED_DT, now + t);
    tickGrenades(r.room, FIXED_DT, now + SMOKE.fuseMs + 20);
    const cloud = r.room.deployables.find((d) => d.kind === 'smoke')!;
    expect(cloud).toBeDefined();
    expect(r.channel.of('boom')).toHaveLength(0); // no blast, no damage
    const [x, y, z] = cloud.pos;
    expect(smokeBlocks(r.room, [x - 10, y + 1, z], [x + 10, y + 1, z])).toBe(true);
    expect(smokeBlocks(r.room, [x - 10, y + 20, z], [x + 10, y + 20, z])).toBe(false);
    tickAbilities(r.room, now + SMOKE.fuseMs + SMOKE.durationMs + 100);
    expect(r.room.deployables).toHaveLength(0);
  });

  it('radar shows the rivals for a few seconds; the medkit heals, but not at full health', () => {
    const r = makeRoom('ffa');
    const e = r.join('Exp', 0, 30, 'explorador');
    const a = r.join('Art', 10, 30, 'artillero');
    const now = Date.now();
    expect(useAbility(r.room, e, [0, 1.6, 30], LOOK_NORTH, now)).toBe(true);
    expect(e.radarUntil).toBe(now + RADAR_MS);
    expect(useAbility(r.room, a, [10, 1.6, 30], LOOK_NORTH, now)).toBe(false); // full health: nothing spent
    expect(a.abilityAt).toBe(0);
    a.hp = 30;
    expect(useAbility(r.room, a, [10, 1.6, 30], LOOK_NORTH, now)).toBe(true);
    expect(a.hp).toBe(30 + MEDKIT_HP);
  });

  it('grenade launcher: the round flies and blows up on a rival, hurting the ones around', () => {
    const r = makeRoom('ffa');
    const art = r.join('Art', 0, 30, 'artillero');
    const rival = r.join('Riv', 0, 28.4); // in front of the low wall at z 27.8
    const now = Date.now();
    launchRound(r.room, art, [0, 1.2, 29.5], LOOK_NORTH, now);
    for (let i = 0; i < 60 && r.room.grenades.length; i++) tickGrenades(r.room, FIXED_DT, now + i * 16);
    expect(r.room.grenades).toHaveLength(0);
    expect(r.channel.of('boom')).toHaveLength(1);
    expect(rival.hp).toBeLessThan(rival.maxHp);
    expect(art.hp).toBe(art.maxHp); // no self damage
  });

  it('dash: part of the movement, only for the dash character, then on cooldown', () => {
    const cols = getColliders(getMap('patio', 'm'));
    const st = createMoveState(0, 0, 30);
    st.grounded = true;
    const ctx = { colliders: cols, walk: 8.6, adsMove: 1, fallback: [0, 0, 30] as [number, number, number] };
    const input = { seq: 1, f: 1, s: 0, yaw: 0, pitch: 0, b: BTN_DASH, slot: 0 };
    expect(stepMovement(st, input, FIXED_DT, ctx).dash).toBe(false); // not Rayo
    expect(stepMovement(st, input, FIXED_DT, { ...ctx, dash: true }).dash).toBe(true);
    expect(Math.hypot(st.vx, st.vz)).toBeGreaterThan(DASH.speed * 0.9);
    expect(stepMovement(st, { ...input, seq: 2 }, FIXED_DT, { ...ctx, dash: true }).dash).toBe(false); // cooldown
    // A real dash, not a slide: several metres without falling (on an open floor)
    const open = {
      ...ctx,
      dash: true,
      colliders: [{ c: 'concrete', min: [-50, -1, -50], max: [50, 0, 50] } as Collider],
    };
    const fly = createMoveState(0, 0, 0);
    fly.grounded = true;
    stepMovement(fly, input, FIXED_DT, open);
    for (let i = 0; i < Math.round(DASH.timeS / FIXED_DT); i++) stepMovement(fly, { ...input, b: 0 }, FIXED_DT, open);
    expect(-fly.z).toBeGreaterThan(5.5);
    expect(fly.y).toBeGreaterThanOrEqual(-0.01);
  });
});
