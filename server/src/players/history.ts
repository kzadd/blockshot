// Lag compensation: each player's recent positions, to put targets where the shooter saw them.
import { LAG_HISTORY_MS } from '@blockshot/shared';
import type { HistoryEntry, Player } from './player';

export function recordPosition(p: Player, now: number): void {
  p.hist.push({ t: now, x: p.x, y: p.y, z: p.z, sl: p.sl, cr: p.cr });
  while (p.hist.length && now - p.hist[0]!.t > LAG_HISTORY_MS) p.hist.shift();
}

type Pose = Pick<HistoryEntry, 'x' | 'y' | 'z' | 'sl' | 'cr'>;

/** Position of a player at a past instant (interpolating its history). */
export function poseAt(p: Player, t: number): Pose {
  const h = p.hist;
  const last = h[h.length - 1];
  if (!last || t >= last.t) return p;
  for (let i = h.length - 1; i > 0; i--) {
    const a = h[i - 1]!;
    const b = h[i]!;
    if (a.t <= t) {
      const k = (t - a.t) / Math.max(1, b.t - a.t);
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k, sl: b.sl, cr: b.cr };
    }
  }
  return h[0]!;
}
