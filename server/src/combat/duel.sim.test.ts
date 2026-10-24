// Balance simulation (run by hand: BALANCE=1 pnpm --filter ./server exec vitest run duel.sim): duels between
// every pair of characters through the real server shooting code. Both aim at the other's chest with the same
// human-like error. Modelled like the client: time to raise the sights (adsSpeed), bloom, more spread while
// moving, and a strafing target is harder to track the faster it moves. Snipers stand still (moving ruins
// the scope); everybody else strafes at their aiming speed. Not modelled: cover, recoil, reaction time.
import { afterEach, beforeEach, describe, it, vi } from 'vitest';
import { CHARACTERS, PLAYER, WEAPONS, WEAPON_HANDLING as H, type CharacterId, type Vec3 } from '@blockshot/shared';
import { weaponOf } from '../players/loadout';
import type { Player } from '../players/player';
import { makeRoom } from '../testing/fakeRoom';
import { handleReload, handleShoot } from './shooting';

const STEP_MS = 1000 / 60;
const DUELS = Number(process.env.DUELS) || 150;
const AIM_SIGMA = Number(process.env.AIM) || 0.012; // radians, gaussian aim error per shot
const MAX_MS = 20000;
const CHEST = 1.1;
/** Human tracking lag (s): a strafing target is this far ahead of where you aimed (× its speed). */
const TRACK_LAG = Number(process.env.TRACK) || 0.06;
const SHOTGUN_SWITCH = 15;
const HIP_RANGE = 8;

interface Fighter {
  p: Player;
  hip: boolean;
  /** strafing speed while aiming (m/s); 0 = stands still */
  move: number;
  readyAt: number;
  bloom: number;
  lastShot: number;
}

function fighter(p: Player, start: number, dist: number): Fighter {
  const w = weaponOf(p)!;
  // Up close everybody but the sniper fires from the hip at once, moving at full speed
  const hip = dist <= HIP_RANGE && !w.scope;
  // Sights up to scopeReady: aimLerp follows 1 - e^(-adsSpeed·t)
  const ready = hip ? 0 : (Math.log(1 / (1 - H.scopeReady)) / (w.adsSpeed ?? H.defaultAdsSpeed)) * 1000;
  const speed = CHAR_SPEED(p) * (hip ? 1 : (w.adsMove ?? 1));
  return { p, hip, move: w.scope ? 0 : speed, readyAt: start + ready, bloom: 0, lastShot: 0 };
}
const CHAR_SPEED = (p: Player) => CHARACTERS.find((c) => c.id === p.characterId)!.speed * weaponOf(p)!.weight;

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

function duel(ca: CharacterId, cb: CharacterId, dist: number): 0 | 1 | 2 {
  const f = makeRoom('ffa');
  f.room.colliders = []; // open ground: only the weapons matter
  const a = f.join('A', 0, 0, ca);
  const b = f.join('B', 0, -dist, cb);
  // Out of shotgun range a player takes out the secondary
  for (const p of [a, b]) if (weaponOf(p)!.pellets > 1 && dist > SHOTGUN_SWITCH) p.slot = 1;
  const fa = fighter(a, Date.now(), dist);
  const fb = fighter(b, Date.now(), dist);
  for (let t = 0; t < MAX_MS; t += STEP_MS) {
    vi.advanceTimersByTime(STEP_MS);
    const now = Date.now();
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
      if (now - me.lastShot > H.bloom.recoverDelayMs) me.bloom *= Math.exp((-H.bloom.recoverRate * STEP_MS) / 1000);
      if (!me.p.alive || !foe.p.alive || now < me.readyAt) continue;
      const ammo = me.p.ammo[me.p.slot]!;
      if (ammo.mag <= 0 && !ammo.reloadEnd) {
        handleReload(me.p);
        continue;
      }
      const shots = me.p.shots;
      // One aim error per trigger pull (pellets share it): hand error + leading a strafing target
      const track = (foe.move * TRACK_LAG) / dist;
      const aim = { yaw: gauss() * Math.hypot(AIM_SIGMA, track), pitch: gauss() * AIM_SIGMA };
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

describe.skipIf(!process.env.BALANCE)('balance simulation', () => {
  beforeEach(() => vi.useFakeTimers({ now: 1_000_000 }));
  afterEach(() => vi.useRealTimers());

  it('prints win rates', () => {
    const ids = CHARACTERS.map((c) => c.id);
    for (const dist of [5, 12, 25, 45, 80]) {
      const lines = [`\n${dist} m · ${DUELS} duelos por pareja · % de victorias de la fila`];
      const totals: Record<string, number> = {};
      lines.push(`${''.padEnd(9)}${ids.map((i) => i.padStart(9)).join('')}`);
      for (const x of ids) {
        const row: string[] = [];
        let sum = 0;
        for (const y of ids) {
          let wins = 0;
          for (let i = 0; i < DUELS; i++) {
            const r = duel(x, y, dist);
            wins += r === 1 ? 1 : r === 0 ? 0.5 : 0;
          }
          const pct = Math.round((wins / DUELS) * 100);
          if (x !== y) sum += pct;
          row.push(`${pct}%`.padStart(9));
        }
        totals[x] = Math.round(sum / (ids.length - 1));
        lines.push(`${x.padEnd(9)}${row.join('')}   media ${totals[x]}%`);
      }
      console.log(lines.join('\n'));
    }
    console.log(`aim sigma ${AIM_SIGMA} rad; armas: ${Object.keys(WEAPONS).length}`);
  });
});
