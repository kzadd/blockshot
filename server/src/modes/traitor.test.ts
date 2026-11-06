import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EXPELLED, HIDDEN_KILLER, PLAYER, ROUNDS, TRAITOR, WEAPONS, type Vec3 } from '@blockshot/shared';
import { applyDamage } from '../combat/damage';
import { buildSnapshot } from '../game/tick';
import type { Player } from '../players/player';
import { makeRoom, type FakeRoom } from '../testing/fakeRoom';

const tick = (r: FakeRoom) => r.room.mode.tick?.(r.room, Date.now());
const snap = (r: FakeRoom) => buildSnapshot(r.room, Date.now());
const role = (r: FakeRoom, p: Player) => r.channel.of('traitor:role', p.id).at(-1);
const press = (r: FakeRoom, p: Player) =>
  r.room.mode.action?.(r.room, p, [p.x, p.y + PLAYER.eye, p.z], [0, 0, 1] as Vec3, Date.now());
const vote = (r: FakeRoom, p: Player, id: string) => r.room.mode.meetingVote?.(r.room, p, id);
const kill = (r: FakeRoom, by: Player, victim: Player, w = WEAPONS.pistol) =>
  applyDamage(r.room, by, victim, 999, false, w, [victim.x, 1, victim.z]);

/** Joins `names` and plays the first round (everybody placed 3 m apart, protection off). */
function start(names: string[]) {
  const r = makeRoom('traitor', 5);
  const ps = names.map((n) => r.join(n));
  tick(r);
  vi.advanceTimersByTime(ROUNDS.breakMs);
  tick(r);
  ps.forEach((p, i) => {
    r.place(p, i * 3, 0);
    p.protUntil = 0;
  });
  const traitors = ps.filter((p) => role(r, p)?.traitor);
  const innocents = ps.filter((p) => !role(r, p)?.traitor);
  return { r, ps, traitors, innocents };
}

beforeEach(() => vi.useFakeTimers({ now: 1_000_000 }));
afterEach(() => vi.useRealTimers());

describe('traidores: roles', () => {
  it('plays on its maps only, with the sidearm and the knife', () => {
    const { r, ps } = start(['A', 'B', 'C']);
    expect(r.room.map.id).toBe('sanatorio'); // asked for Patio
    expect(ps[0]!.loadout).toEqual([ps[0]!.cls!.secondary, 'knife']);
  });

  it('one traitor per 5 players (at least one); each hears only its own role, traitors their mates', () => {
    const small = start(['A', 'B', 'C']);
    expect(small.traitors).toHaveLength(1);
    expect(role(small.r, small.traitors[0]!)).toEqual({ traitor: true, mates: [] });
    for (const p of small.innocents) expect(role(small.r, p)).toEqual({ traitor: false, mates: [] });
    // Never broadcast
    expect(small.r.channel.sent.some((s) => s.event === 'traitor:role' && s.to === null)).toBe(false);

    const big = start(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']);
    expect(big.traitors).toHaveLength(2);
    const [t1, t2] = big.traitors as [Player, Player];
    expect(role(big.r, t1)!.mates).toEqual([t2.id]);
    expect(role(big.r, t2)!.mates).toEqual([t1.id]);
  });

  it('bots are never traitors while there are people', () => {
    const r = makeRoom('traitor', 5);
    const human = r.join('Ana');
    for (const n of ['1', '2', '3']) {
      r.registry.addPlayer(r.room, `bot:${n}`, `Bot ${n}`);
      r.room.players.get(`bot:${n}`)!.cls = human.cls;
    }
    tick(r);
    vi.advanceTimersByTime(ROUNDS.breakMs);
    tick(r);
    expect(role(r, human)?.traitor).toBe(true);
  });

  it('the snapshot and the kill tell nobody who killed: only the victim hears, from «Desconocido»', () => {
    const { r, traitors, innocents } = start(['A', 'B', 'C', 'D']);
    const [t] = traitors as [Player];
    const [v] = innocents as [Player];
    r.channel.clear();
    kill(r, t, v, WEAPONS.knife);
    expect(r.channel.sent.some((s) => s.event === 'kill' && s.to !== v.id)).toBe(false);
    expect(r.channel.of('kill', v.id)[0]).toMatchObject({ killer: v.id, killerName: HIDDEN_KILLER, medals: [] });
    const s = snap(r);
    for (const p of s.players) expect(p).toMatchObject({ k: 0, st: 0, md: 0, tm: 0 });
    expect(JSON.stringify(s)).not.toMatch(/traitor/i);
    // The body lies where it fell
    expect(s.tt!.bd).toEqual([[v.id, v.x, v.y, v.z]]);
  });

  it("a traitor's knife kills with one hit; an innocent's does not", () => {
    const { r, traitors, innocents } = start(['A', 'B', 'C', 'D']);
    const [t] = traitors as [Player];
    const [a, b] = innocents as [Player, Player];
    applyDamage(r.room, a, b, WEAPONS.knife.damage, false, WEAPONS.knife, [0, 1, 0]);
    expect(b.alive).toBe(true);
    applyDamage(r.room, t, a, WEAPONS.knife.damage, false, WEAPONS.knife, [0, 1, 0]);
    expect(a.alive).toBe(false);
  });
});

describe('traidores: bodies and meetings', () => {
  it('F at a body: the examiner alone learns whose and the weapon, and a meeting starts (once per body)', () => {
    const { r, traitors, innocents } = start(['A', 'B', 'C', 'D']);
    const [t] = traitors as [Player];
    const [v, e] = innocents as [Player, Player];
    kill(r, t, v);
    r.place(e, v.x + 1, v.z);
    r.channel.clear();
    press(r, e);
    expect(r.channel.of('notice', e.id)).toContain(`Cuerpo de ${v.name}: lo mataron con ${WEAPONS.pistol.name}`);
    expect(r.channel.notices().some((n) => n.includes(`encontró el cuerpo de ${v.name}`))).toBe(true);
    expect(snap(r).tt!.mt).toMatchObject({ by: e.name, body: v.name, vd: [] });
    // Nobody moves nor hurts meanwhile
    expect(r.room.mode.speedFactor?.(e)).toBe(0);
    expect(snap(r).players.find((p) => p.id === e.id)!.sf).toBe(0);
    applyDamage(r.room, t, e, 999, false, WEAPONS.pistol, [0, 1, 0]);
    expect(e.alive).toBe(true);
  });

  it('the most voted is expelled and its role told; a tie or more skips expels nobody', () => {
    const { r, ps, traitors, innocents } = start(['A', 'B', 'C', 'D', 'E', 'F']);
    const [t] = traitors as [Player];
    const [a, b, c] = innocents as [Player, Player, Player];
    vi.advanceTimersByTime(TRAITOR.calmMs);
    press(r, a); // emergency meeting
    expect(snap(r).tt!.mt).toMatchObject({ by: a.name, body: '' });
    vote(r, a, b.id);
    vote(r, b, a.id);
    vote(r, a, t.id); // a second vote does not count
    vote(r, c, 'nobody'); // nobody alive by that id
    expect(snap(r).tt!.mt!.vd).toEqual([a.id, b.id]);
    // Time up with a tie: nobody
    vi.advanceTimersByTime(TRAITOR.meetingMs);
    tick(r);
    expect(snap(r).tt!.mt).toBeUndefined();
    expect(ps.every((p) => p.alive)).toBe(true);
    expect(r.channel.notices().at(-1)).toMatch(/^Nadie es expulsado/);
    // Another emergency meeting: everybody votes the traitor, it ends at once
    vi.advanceTimersByTime(TRAITOR.calmMs);
    press(r, b);
    for (const p of ps) vote(r, p, p === t ? a.id : t.id);
    tick(r);
    expect(t.alive).toBe(false);
    expect(r.channel.notices()).toContainEqual(expect.stringMatching(`${t.name} es expulsado .*: era TRAIDOR`));
    expect(r.channel.of('kill').at(-1)).toMatchObject({ victim: t.id, killerName: EXPELLED });
  });

  it('one emergency meeting per player and round, not right after the round starts', () => {
    const { r, innocents } = start(['A', 'B', 'C', 'D']);
    const [a] = innocents as [Player];
    press(r, a);
    expect(snap(r).tt!.mt).toBeUndefined();
    expect(r.channel.of('notice', a.id).at(-1)).toMatch(/disponible en \d+ s/);
    vi.advanceTimersByTime(TRAITOR.calmMs);
    press(r, a);
    expect(snap(r).tt!.mt).toBeDefined();
    vi.advanceTimersByTime(TRAITOR.meetingMs);
    tick(r);
    vi.advanceTimersByTime(TRAITOR.calmMs);
    press(r, a);
    expect(snap(r).tt!.mt).toBeUndefined();
    expect(r.channel.of('notice', a.id).at(-1)).toBe('Ya usaste tu reunión de emergencia en esta ronda');
  });
});

describe('traidores: winning', () => {
  it('innocents win when no traitor is left: each innocent scores, a team kill costs a point', () => {
    const { r, traitors, innocents } = start(['A', 'B', 'C', 'D', 'E']);
    const [t] = traitors as [Player];
    const [a, b, c] = innocents as [Player, Player, Player];
    kill(r, a, b); // a mistake
    expect(r.channel.of('notice', a.id).at(-1)).toMatch(/era inocente/);
    kill(r, c, t);
    expect(r.channel.of('notice', c.id).at(-1)).toBe(`¡${t.name} era traidor!`);
    expect(r.channel.notices().at(-1)).toMatch(/ganan los inocentes/);
    expect(snap(r).rd!.p).toBe(2);
    expect(c.caps).toBe(TRAITOR.innocentWin);
    expect(b.caps).toBe(TRAITOR.innocentWin); // dead innocents win too
    expect(a.caps).toBe(Math.max(0, TRAITOR.innocentWin - TRAITOR.teamKill));
    expect(t.caps).toBe(0);
  });

  it('traitors win once they are as many as the innocents standing', () => {
    const { r, traitors, innocents } = start(['A', 'B', 'C']);
    const [t] = traitors as [Player];
    kill(r, t, innocents[0]!);
    expect(r.channel.notices().at(-1)).toMatch(/ganan los traidores · El traidor era/);
    expect(t.caps).toBe(TRAITOR.traitorWin);
  });

  it('time up: the innocents win; the match ends at the limit', () => {
    const { r, innocents } = start(['A', 'B', 'C']);
    r.room.scoreLimit = 1;
    vi.advanceTimersByTime(TRAITOR.roundMs);
    tick(r);
    expect(innocents.every((p) => p.caps === 1)).toBe(true);
    expect(r.room.matchOver).toBe(true);
  });
});
