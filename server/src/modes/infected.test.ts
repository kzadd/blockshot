import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BARRICADE,
  BLACKOUT,
  BODY,
  FIXED_DT,
  INFECT,
  LAST_STAND,
  PLAYER,
  SCREAM,
  SHOVE,
  WEAPONS,
  ZOMBIES,
  createMoveState,
  stepMovement,
  BTN_JUMP,
  BTN_JUMP_PRESSED,
  type Vec3,
} from '@blockshot/shared';
import { hitPlank } from '../combat/abilities';
import { applyDamage, dieAlone } from '../combat/damage';
import { handleShoot } from '../combat/shooting';
import { buildSnapshot } from '../game/tick';
import { shove } from '../players/movement';
import type { Player } from '../players/player';
import { spawnPlayer } from '../players/spawn';
import { makeRoom, type FakeRoom } from '../testing/fakeRoom';

const tick = (r: FakeRoom) => r.room.mode.tick?.(r.room, Date.now());
const snap = (r: FakeRoom) => buildSnapshot(r.room, Date.now());
const me = (r: FakeRoom, p: Player) => snap(r).players.find((s) => s.id === p.id)!;
/** Joins `names` at x = 8, 11, 14… on Patio's open strip and waits for the first infected. */
function start(names: string[], mode: FakeRoom) {
  const ps = names.map((n, i) => mode.join(n, 8 + i * 3, -2.5));
  tick(mode);
  vi.advanceTimersByTime(INFECT.pickDelay);
  tick(mode);
  return ps;
}
const r0 = () => makeRoom('infect', 3);
/** Kills and respawns a player right away (in place). */
function respawn(r: FakeRoom, p: Player) {
  dieAlone(r.room, p, 'Admin');
  spawnPlayer(r.room, p);
  r.place(p, p.x, p.z);
}
const action = (r: FakeRoom, p: Player, d: Vec3) =>
  r.room.mode.action?.(r.room, p, [p.x, p.y + PLAYER.eye, p.z], d, Date.now());

beforeEach(() => vi.useFakeTimers({ now: 1_000_000 }));
afterEach(() => vi.useRealTimers());

describe('infectados: types', () => {
  it('the first infected is a Paciente cero: bigger, tougher, and stays one', () => {
    const r = r0();
    const ps = start(['A', 'B', 'C'], r);
    const alpha = ps.find((p) => p.team === 2)!;
    expect(alpha.zombie).toBe('alpha');
    expect(alpha.maxHp).toBe(Math.round(BODY.hp * ZOMBIES.alpha.hp));
    expect(r.room.mode.speedFactor?.(alpha)).toBe(ZOMBIES.alpha.speed);
    expect(me(r, alpha)).toMatchObject({ zt: 'alpha', sf: ZOMBIES.alpha.speed, fc: 0 });
    respawn(r, alpha);
    expect(alpha.zombie).toBe('alpha');
    expect(r.channel.notices().some((t) => t.includes('es el paciente cero! Corran'))).toBe(true);
  });

  it('a turned survivor respawns as the type picked, or takes turns; health and speed follow the type', () => {
    const r = r0();
    const ps = start(['A', 'B', 'C'], r);
    const alpha = ps.find((p) => p.team === 2)!;
    const [s1, s2] = ps.filter((p) => p.team === 1) as [Player, Player];
    applyDamage(r.room, alpha, s1, 999, false, WEAPONS.knife, [0, 1, 0]);
    expect(s1.team).toBe(2);
    s1.zombiePick = 'tank';
    spawnPlayer(r.room, s1);
    expect(s1.zombie).toBe('tank');
    expect(s1.maxHp).toBe(BODY.hp * ZOMBIES.tank.hp);
    expect(r.room.mode.speedFactor?.(s1)).toBe(ZOMBIES.tank.speed);
    // Nothing picked: a different type each life
    dieAlone(r.room, s2, 'Vacío');
    const seen = new Set<string>();
    for (let i = 0; i < 3; i++) {
      respawn(r, s2);
      seen.add(s2.zombie!);
      expect(s2.maxHp).toBe(Math.round(BODY.hp * ZOMBIES[s2.zombie!].hp));
    }
    expect([...seen].sort()).toEqual(['leaper', 'runner', 'tank']);
    // Survivors carry no type
    expect(me(r, alpha).zt).toBe('alpha');
  });

  it('the Saltador jumps higher (shared movement), and the Tanque cannot be shoved', () => {
    const jumpVy = (leap: boolean) => {
      const st = createMoveState(0, 0, 0);
      st.grounded = true;
      st.coyote = PLAYER.coyote;
      const input = { seq: 0, f: 0, s: 0, yaw: 0, pitch: 0, b: BTN_JUMP | BTN_JUMP_PRESSED, slot: 0 };
      stepMovement(st, input, FIXED_DT, { colliders: [], walk: 5, adsMove: 1, leap });
      return st.vy;
    };
    expect(jumpVy(true)).toBeGreaterThan(jumpVy(false) * 1.25);
    const r = r0();
    const [a, b] = start(['A', 'B'], r);
    const zombie = a!.team === 2 ? a! : b!;
    const human = zombie === a ? b! : a!;
    zombie.zombie = 'tank';
    r.place(human, zombie.x, zombie.z - 1); // facing -z hits whoever stands there
    human.ry = Math.atan2(zombie.x - human.x, zombie.z - human.z) + Math.PI;
    shove(r.room, human, Date.now());
    expect(zombie.move.vx).toBe(0);
    expect(zombie.move.vz).toBe(0);
    zombie.zombie = 'runner'; // any other type is pushed
    vi.advanceTimersByTime(SHOVE.cooldownMs);
    shove(r.room, human, Date.now());
    expect(zombie.move.vz).toBeGreaterThan(0);
  });
});

describe('infectados: scream', () => {
  it('slows the survivors in reach (they predict it from the snapshot), then needs the cooldown', () => {
    const r = r0();
    const ps = start(['A', 'B', 'C'], r);
    const alpha = ps.find((p) => p.team === 2)!;
    const [near, far] = ps.filter((p) => p.team === 1) as [Player, Player];
    r.place(alpha, 8, -2.5);
    r.place(near, 12, -2.5);
    r.place(far, 8 + SCREAM.radius + 5, -2.5);
    action(r, alpha, [1, 0, 0]);
    expect(r.channel.of('scream')[0]).toMatchObject({ id: alpha.id, hit: [near.id] });
    expect(r.room.mode.speedFactor?.(near)).toBe(SCREAM.slow);
    expect(me(r, near).sf).toBe(SCREAM.slow);
    expect(r.room.mode.speedFactor?.(far)).toBe(1);
    expect(me(r, alpha).fc).toBe(SCREAM.cooldownMs);
    action(r, alpha, [1, 0, 0]);
    expect(r.channel.of('scream')).toHaveLength(1); // cooling down
    vi.advanceTimersByTime(SCREAM.slowMs);
    expect(r.room.mode.speedFactor?.(near)).toBe(1);
    expect(me(r, near).sf).toBeUndefined();
  });

  it('only the Paciente cero screams', () => {
    const r = r0();
    const ps = start(['A', 'B', 'C'], r);
    const zombie = ps.find((p) => p.team === 1)!;
    dieAlone(r.room, zombie, 'Vacío');
    respawn(r, zombie);
    action(r, zombie, [1, 0, 0]);
    expect(r.channel.of('scream')).toHaveLength(0);
    expect(me(r, zombie).fc).toBeUndefined();
  });
});

describe('infectados: barricades', () => {
  it('a survivor boards up in front; it blocks, only the infected break it (the Tanque twice as fast)', () => {
    const r = r0();
    const ps = start(['A', 'B', 'C'], r);
    const zombie = ps.find((p) => p.team === 2)!;
    const [human, other] = ps.filter((p) => p.team === 1) as [Player, Player];
    r.place(human, 8, -2.5);
    r.place(zombie, 11, -2.5);
    r.place(other, 20, -2.5); // out of the knife's way
    const walls = r.room.colliders.length;
    action(r, human, [1, 0, 0]);
    const plank = r.room.deployables.find((d) => d.kind === 'plank')!;
    expect(plank).toMatchObject({ team: 1, hp: BARRICADE.hp });
    expect(plank.pos[0]).toBeCloseTo(8 + BARRICADE.dist);
    expect(r.room.colliders.length).toBe(walls + 1);
    expect(me(r, human).fc).toBe(BARRICADE.cooldownMs);
    // A survivor's shot does not hurt it
    const face: Vec3 = [plank.pos[0], 1.2, plank.pos[2]];
    hitPlank(r.room, human, face, 999);
    expect(plank.hp).toBe(BARRICADE.hp);
    // The infected knife it from the other side (through handleShoot: the knife reaches it, not the survivor)
    const eye: Vec3 = [zombie.x, zombie.y + PLAYER.eye, zombie.z];
    const hits = Math.ceil(BARRICADE.hp / WEAPONS.knife.damage);
    for (let i = 0; i < hits; i++) {
      handleShoot(r.room, zombie, { o: eye, d: [[-1, 0, 0]], lag: 0 });
      vi.advanceTimersByTime(WEAPONS.knife.fireRate + 50);
    }
    expect(r.room.deployables.some((d) => d.kind === 'plank')).toBe(false);
    expect(r.room.colliders.length).toBe(walls);
    // The Tanque: half the hits
    vi.advanceTimersByTime(BARRICADE.cooldownMs);
    action(r, human, [1, 0, 0]);
    const second = r.room.deployables.find((d) => d.kind === 'plank')!;
    zombie.zombie = 'tank';
    hitPlank(r.room, zombie, face, 50);
    expect(second.hp).toBe(BARRICADE.hp - 50 * BARRICADE.tankMult);
  });

  it('one barricade per survivor, and it falls apart after a while', () => {
    const r = r0();
    const ps = start(['A', 'B', 'C'], r);
    const human = ps.find((p) => p.team === 1)!;
    r.place(human, 8, -2.5);
    action(r, human, [1, 0, 0]);
    vi.advanceTimersByTime(BARRICADE.cooldownMs);
    action(r, human, [-1, 0, 0]);
    expect(r.room.deployables.filter((d) => d.kind === 'plank')).toHaveLength(1);
    expect(r.room.deployables[0]!.pos[0]).toBeCloseTo(8 - BARRICADE.dist);
    expect(r.room.deployables[0]!.until).toBe(Date.now() + BARRICADE.lifeMs);
  });
});

describe('infectados: last survivor and blackouts', () => {
  it('the last survivor gets more health and armour, and everybody sees him', () => {
    const r = r0();
    const ps = start(['A', 'B', 'C'], r);
    const [fell, last] = ps.filter((p) => p.team === 1) as [Player, Player];
    dieAlone(r.room, fell, 'Vacío');
    tick(r);
    expect(last.maxHp).toBe(BODY.hp * LAST_STAND.hp);
    expect(last.hp).toBe(last.maxHp);
    expect(last.armor).toBe(LAST_STAND.armor);
    expect(snap(r).inf).toMatchObject({ ls: last.id, la: 1 });
    vi.advanceTimersByTime(LAST_STAND.bannerMs);
    expect(snap(r).inf).toMatchObject({ ls: last.id });
    expect(snap(r).inf?.la).toBeUndefined();
  });

  it('the lights go out every so often, with a warning first', () => {
    const r = r0();
    start(['A', 'B', 'C'], r);
    const at = (ms: number) => {
      vi.advanceTimersByTime(ms);
      tick(r);
      return snap(r).inf?.bo;
    };
    expect(at(0)).toBeUndefined();
    expect(at(BLACKOUT.firstMs - BLACKOUT.warnMs)).toBe(1);
    expect(r.channel.notices()).toContain(`¡Apagón en ${BLACKOUT.warnMs / 1000} s!`);
    expect(at(BLACKOUT.warnMs)).toBe(2);
    expect(at(BLACKOUT.darkMs)).toBeUndefined();
    expect(at(BLACKOUT.everyMs - BLACKOUT.darkMs - BLACKOUT.warnMs)).toBe(1);
    expect(at(BLACKOUT.warnMs)).toBe(2);
  });
});
