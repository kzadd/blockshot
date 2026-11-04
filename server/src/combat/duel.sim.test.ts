// Balance simulation (run by hand from server/: BALANCE=1 DUELS=40 npx vitest run src/combat/duel.sim.test.ts;
// ONLY=frf1,ump45 limits it to those primaries):
// duels between classes through the real server shooting, grenade and ability code. Both aim at the other's chest
// with the same human-like error. Modelled like the client: time to raise the sights (adsSpeed), bloom, more spread
// while moving, and a strafing target is harder to track the faster it moves. Snipers stand still (moving ruins the
// scope); everybody else strafes at their aiming speed. Launcher rounds fly through the real grenade code (a lobbed
// round is aimed up along its arc). Abilities, used the way a player would in a duel on open ground:
//   shield  raised as the duel starts (and again when ready), facing the rival
//   medkit  used when health drops to MEDKIT_AT or below
//   dash    one dash at the start towards the range the class's weapon wants (in for short guns, out from them)
//   wall    raised in front when the magazine runs dry, and left (peeked) once the reload is done
// The rest (smoke, mine, radar) are about vision and position, which a duel in the open does not have: they count
// as no ability. Not modelled: cover, recoil, reaction time.
// 2026-11-04: bullets land on head, torso or legs (the aim error spreads them round the chest), the bloom recovers
// by posture (bloomRecovery: strafing is "running"), and a table measures the accessories (ACC= limits it): Kevlar
// (damage taken and its slower strafe), laser (hip fire), silencer (damage) and extra ammo (magazine). Goggles only
// matter in smoke, which a duel in the open does not have.
import { afterEach, beforeEach, describe, it, vi } from 'vitest';
import {
  ABILITIES,
  ACCESSORIES,
  DASH,
  GL_ROUND,
  PLAYER,
  PRIMARIES,
  SIDEARMS,
  WEAPONS,
  WEAPON_HANDLING as H,
  bloomRecovery,
  gearedWeapon,
  silencerBlock,
  speedWith,
  type AbilityId,
  type AccessoryId,
  type PlayerClass,
  type Vec3,
  type Weapon,
  type WeaponId,
} from '@blockshot/shared';
import { recordPosition } from '../players/history';
import { weaponOf } from '../players/loadout';
import type { Player } from '../players/player';
import type { Room } from '../rooms/room';
import { makeRoom } from '../testing/fakeRoom';
import { useAbility, wallBox } from './abilities';
import { tickGrenades } from './grenades';
import { handleReload, handleShoot } from './shooting';

const STEP_MS = 1000 / 60;
const DUELS = Number(process.env.DUELS) || 40;
const AIM_SIGMA = Number(process.env.AIM) || 0.012; // radians, gaussian aim error per shot
const MAX_MS = 20000;
const CHEST = 1.1;
/** Human tracking lag (s): a strafing target is this far ahead of where you aimed (× its speed). */
const TRACK_LAG = Number(process.env.TRACK) || 0.06;
const SHOTGUN_SWITCH = 15;
const HIP_RANGE = 8;
const DISTS = [5, 12, 25, 45, 80];
const ONLY = process.env.ONLY?.split(',');
/** The primaries measured (all, or the ONLY ones). */
const MEASURED = PRIMARIES.filter((w) => !ONLY || ONLY.includes(w));
/** The medkit goes in at this much health or less. */
const MEDKIT_AT = 60;
/** How far a dash takes you (m). */
const DASH_M = DASH.speed * DASH.timeS;
/** Open ground under the duel, so rockets and lobbed rounds have a floor and walls something to stand on. */
const FLOOR = { c: 'ground', min: [-200, -1, -200] as Vec3, max: [200, 0, 200] as Vec3 };
/** Abilities that change a duel in the open (the others count as none). */
const COMBAT_ABILITIES: AbilityId[] = ['smoke', 'shield', 'dash', 'wall', 'medkit'];
/** The rivals every class is measured against: one of each family, with no combat ability. */
const FOES: WeaponId[] = ['rifle', 'heavyrifle', 'sniper', 'dmr', 'smg', 'shotgun', 'lmg', 'launcher'];
/** The accessories measured (goggles only change what you see in smoke). */
const MEASURED_ACC = (['none', 'kevlar', 'helmet', 'laser', 'silencer', 'ammo'] as AccessoryId[]).filter(
  (a) => !process.env.ACC || process.env.ACC.split(',').includes(a),
);

interface Fighter {
  p: Player;
  hip: boolean;
  /** strafing speed while aiming (m/s); 0 = stands still */
  move: number;
  readyAt: number;
  bloom: number;
  lastShot: number;
}

/** Where a weapon still does (nearly) full damage. */
const reach = (w: Weapon): number => (w.pellets > 1 ? 8 : w.projectile ? 30 : (w.falloff?.[0] ?? w.range));

function fighter(p: Player, start: number, dist: number): Fighter {
  const w = weaponOf(p)!;
  // Up close everybody but the sniper fires from the hip at once, moving at full speed
  const hip = dist <= HIP_RANGE && !w.scope;
  // Sights up to scopeReady: aimLerp follows 1 - e^(-adsSpeed·t)
  const ready = hip ? 0 : (Math.log(1 / (1 - H.scopeReady)) / (w.adsSpeed ?? H.defaultAdsSpeed)) * 1000;
  const speed = speedWith(p.loadout[p.slot]!, p.cls?.accessory) * (hip ? 1 : (w.adsMove ?? 1));
  return { p, hip, move: w.scope ? 0 : speed, readyAt: start + ready, bloom: 0, lastShot: 0 };
}

/** Spread like the client: hip or aimed (half the bloom), opened by the shooter's own movement. */
function spreadOf(f: Fighter): number {
  const w = weaponOf(f.p)!;
  const base = f.hip ? w.spread + f.bloom : w.adsSpread + f.bloom * (1 - H.bloom.adsCut);
  const moveSpread = f.hip ? H.spread.move : (w.moveSpread ?? H.spread.move);
  return base * (1 + Math.min(f.move / H.spread.moveFullSpeed, 1) * moveSpread);
}

const gauss = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());

function dirTo(a: Player, b: Player, aim: { yaw: number; pitch: number }, spread: number): Vec3 {
  const dx = b.x - a.x;
  const dy = b.y + CHEST - (a.y + PLAYER.eye);
  const dz = b.z - a.z;
  const yaw = Math.atan2(-dx, -dz) + aim.yaw;
  const pitch = Math.atan2(dy, Math.hypot(dx, dz)) + aim.pitch;
  const r = spread * Math.sqrt(Math.random());
  const t = Math.random() * 2 * Math.PI;
  const y2 = yaw + Math.cos(t) * r;
  const p2 = pitch + Math.sin(t) * r;
  return [-Math.sin(y2) * Math.cos(p2), Math.sin(p2), -Math.cos(y2) * Math.cos(p2)];
}

/**
 * A lobbed round is aimed above the chest so its arc (speed, the launcher's lift, gravity) comes down on it: the
 * flattest pitch over the straight line that lands within 5 cm, found by stepping through the angles.
 */
function lobArc(d: number): number {
  const dy = CHEST - PLAYER.eye;
  const { speed: v, lift, gravity: g } = GL_ROUND;
  const flat = Math.atan2(dy, d);
  for (let a = -0.4; a < 1.2; a += 0.002) {
    const t = d / (v * Math.cos(a));
    const y = (v * Math.sin(a) + lift) * t - (g * t * t) / 2;
    if (Math.abs(y - dy) < 0.05) return a - flat;
  }
  return Math.PI / 4 - flat; // out of reach: as far as it goes
}

const toward = (a: Player, b: Player): Vec3 => {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len = Math.hypot(dx, dz) || 1;
  return [dx / len, 0, dz / len];
};
const facing = (a: Player, b: Player) => Math.atan2(-(b.x - a.x), -(b.z - a.z));
/** Walls stand on the open ground (rebuildColliders would bring the map back). */
const openGround = (room: Room) => {
  room.colliders = [FLOOR, ...room.deployables.filter((d) => d.kind === 'wall').map(wallBox)];
};

/** Abilities before the first shot: the dash closes in or backs off, the shield goes up. */
function opening(me: Player, foe: Player, now: number): void {
  if (me.cls?.ability !== 'dash') return;
  const dist = Math.abs(me.z - foe.z);
  const mine = reach(weaponOf(me)!);
  const theirs = reach(weaponOf(foe)!);
  const dir = Math.sign(foe.z - me.z);
  // In when my gun wants it closer; out when theirs is the short one and I can leave its reach
  const step = mine < dist ? Math.min(DASH_M, dist - 3) : theirs < mine && dist < theirs + DASH_M ? -DASH_M : 0;
  me.z += dir * step;
  me.move.z = me.z;
  recordPosition(me, now);
}

function useInDuel(room: Room, me: Player, foe: Player, now: number): void {
  const ability = me.cls?.ability;
  if (!ability || now < me.abilityAt) return;
  const o: Vec3 = [me.x, me.y + PLAYER.eye, me.z];
  if (ability === 'shield') useAbility(room, me, o, toward(me, foe), now);
  else if (ability === 'medkit' && me.hp <= MEDKIT_AT) useAbility(room, me, o, toward(me, foe), now);
  else if (ability === 'wall') {
    const ammo = me.ammo[me.slot]!;
    if (ammo.reloadEnd && useAbility(room, me, o, toward(me, foe), now)) openGround(room);
  }
}

/** Once the reload is done the wall user steps out to shoot again (its wall stays behind). */
function peek(room: Room, me: Player): void {
  if (me.cls?.ability !== 'wall' || me.ammo[me.slot]!.reloadEnd) return;
  const before = room.deployables.length;
  room.deployables = room.deployables.filter((d) => !(d.kind === 'wall' && d.owner === me.id));
  if (room.deployables.length !== before) openGround(room);
}

/** A sidearm measured as the only gun: it goes into slot 1 too (pistols are no primary in a real class). */
function forcePrimary(p: Player, id: WeaponId): void {
  if (p.loadout[0] === id) return;
  p.loadout[0] = id;
  p.ammo[0] = { mag: gearedWeapon(id, p.cls?.accessory).mag, reloadEnd: 0 };
}

function duel(ca: PlayerClass, cb: PlayerClass, dist: number): 0 | 1 | 2 {
  const f = makeRoom('ffa');
  f.room.map = { ...f.room.map, boxes: [] };
  openGround(f.room);
  const a = f.join('A', 0, 0, ca);
  const b = f.join('B', 0, -dist, cb);
  forcePrimary(a, ca.primary);
  forcePrimary(b, cb.primary);
  a.ry = facing(a, b);
  b.ry = facing(b, a);
  const now0 = Date.now();
  opening(a, b, now0);
  opening(b, a, now0);
  const d = Math.abs(a.z - b.z);
  // Out of shotgun range a player takes out the secondary
  for (const p of [a, b]) if (weaponOf(p)!.pellets > 1 && d > SHOTGUN_SWITCH) p.slot = 1;
  const fa = fighter(a, now0, d);
  const fb = fighter(b, now0, d);
  for (let t = 0; t < MAX_MS; t += STEP_MS) {
    vi.advanceTimersByTime(STEP_MS);
    const now = Date.now();
    tickGrenades(f.room, STEP_MS / 1000, now);
    const order: [Fighter, Fighter][] =
      Math.random() < 0.5
        ? [
            [fa, fb],
            [fb, fa],
          ]
        : [
            [fb, fa],
            [fa, fb],
          ];
    for (const [me, foe] of order) {
      const w = weaponOf(me.p)!;
      // Strafing counts as running for the bloom recovery; standing still (snipers) as standing
      const posture = { vx: me.move, vz: 0, grounded: true, crouching: false, sliding: false };
      if (now - me.lastShot > H.bloom.recoverDelayMs)
        me.bloom *= Math.exp((-H.bloom.recoverRate * bloomRecovery(posture) * STEP_MS) / 1000);
      if (!me.p.alive || !foe.p.alive) continue;
      useInDuel(f.room, me.p, foe.p, now);
      peek(f.room, me.p);
      if (now < me.readyAt) continue;
      const ammo = me.p.ammo[me.p.slot]!;
      if (ammo.mag <= 0 && !ammo.reloadEnd) {
        handleReload(me.p);
        useInDuel(f.room, me.p, foe.p, now);
        continue;
      }
      const shots = me.p.shots;
      // One aim error per trigger pull (pellets share it): hand error + leading a strafing target
      const track = (foe.move * TRACK_LAG) / d;
      const arc = w.lob ? lobArc(d) : 0;
      const aim = { yaw: gauss() * Math.hypot(AIM_SIGMA, track), pitch: arc + gauss() * AIM_SIGMA };
      const spread = spreadOf(me);
      const dirs = Array.from({ length: w.pellets }, () => dirTo(me.p, foe.p, aim, spread));
      handleShoot(f.room, me.p, { o: [me.p.x, me.p.y + PLAYER.eye, me.p.z], d: dirs, lag: 0 });
      if (me.p.shots > shots) {
        me.lastShot = now;
        me.bloom = Math.min(w.bloomMax ?? 0, me.bloom + (w.bloom ?? 0));
        // Bolt action: the scope drops after every shot and has to come up again
        if (w.bolt) me.readyAt = now + (w.boltTime ?? 0) + (Math.log(1 / (1 - H.scopeReady)) / w.adsSpeed) * 1000;
      }
    }
    if (!a.alive || !b.alive) return a.alive ? 1 : b.alive ? 2 : 0;
  }
  return 0;
}

const cls = (
  primary: WeaponId,
  ability: AbilityId = 'smoke',
  secondary: WeaponId = 'pistol',
  accessory: AccessoryId = 'none',
): PlayerClass => ({
  primary,
  secondary,
  ability,
  accessory,
});
/** Share of duels won (draws count half) against every foe, at one distance. */
function winRate(me: PlayerClass, dist: number): number {
  let wins = 0;
  for (const foe of FOES)
    for (let i = 0; i < DUELS; i++) {
      const r = duel(me, cls(foe), dist);
      wins += r === 1 ? 1 : r === 0 ? 0.5 : 0;
    }
  return wins / (DUELS * FOES.length);
}
const pct = (v: number) => `${Math.round(v * 100)}%`;
const name = (w: WeaponId) => `${WEAPONS[w].name} (${w})`;

describe.skipIf(!process.env.BALANCE)('balance simulation', () => {
  beforeEach(() => vi.useFakeTimers({ now: 1_000_000 }));
  afterEach(() => vi.useRealTimers());

  it('prints win rates of every primary (no combat ability) by distance', () => {
    const lines = [`\nPrincipales · ${DUELS} duelos contra cada rival (${FOES.join(', ')}) · % de victorias`];
    lines.push(`${''.padEnd(28)}${DISTS.map((d) => `${d} m`.padStart(7)).join('')}  media`);
    for (const w of MEASURED) {
      const rates = DISTS.map((d) => winRate(cls(w), d));
      const mean = rates.reduce((x, y) => x + y, 0) / rates.length;
      lines.push(`${name(w).padEnd(28)}${rates.map((r) => pct(r).padStart(7)).join('')}  ${pct(mean).padStart(5)}`);
    }
    console.log(lines.join('\n'));
  });

  it('prints win rates of every primary × combat ability (mean over the distances)', () => {
    const lines = [`\nPrincipal × habilidad · ${DUELS} duelos por rival y distancia · % medio (máx. por distancia)`];
    lines.push(`${''.padEnd(28)}${COMBAT_ABILITIES.map((a) => ABILITIES[a].name.padStart(15)).join('')}`);
    for (const w of MEASURED) {
      if (SIDEARMS.includes(w)) continue;
      const cells = COMBAT_ABILITIES.map((ab) => {
        const rates = DISTS.map((d) => winRate(cls(w, ab), d));
        const mean = rates.reduce((x, y) => x + y, 0) / rates.length;
        return `${pct(mean)} (${pct(Math.max(...rates))})`.padStart(15);
      });
      lines.push(`${name(w).padEnd(28)}${cells.join('')}`);
    }
    console.log(lines.join('\n'));
  });

  it('prints win rates of every primary × accessory (mean over the distances)', () => {
    const lines = [`\nPrincipal × accesorio · ${DUELS} duelos por rival y distancia · % medio (máx. por distancia)`];
    lines.push(`${''.padEnd(28)}${MEASURED_ACC.map((a) => ACCESSORIES[a].name.padStart(16)).join('')}`);
    for (const w of MEASURED) {
      const cells = MEASURED_ACC.map((acc) => {
        // A silencer the weapon does not take: not measured
        if (acc === 'silencer' && silencerBlock(w)) return '—'.padStart(16);
        const rates = DISTS.map((d) => winRate(cls(w, 'smoke', 'pistol', acc), d));
        const mean = rates.reduce((x, y) => x + y, 0) / rates.length;
        return `${pct(mean)} (${pct(Math.max(...rates))})`.padStart(16);
      });
      lines.push(`${name(w).padEnd(28)}${cells.join('')}`);
    }
    console.log(lines.join('\n'));
  });

  it('prints win rates of every sidearm as the only gun', () => {
    const lines = [`\nSecundarias como única arma · % de victorias`];
    lines.push(`${''.padEnd(28)}${DISTS.map((d) => `${d} m`.padStart(7)).join('')}`);
    for (const w of SIDEARMS)
      lines.push(`${name(w).padEnd(28)}${DISTS.map((d) => pct(winRate(cls(w, 'smoke', w), d)).padStart(7)).join('')}`);
    console.log(lines.join('\n'));
  });
});
