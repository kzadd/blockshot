// Ranks: from the season points of the ranking (`seasonPoints`: wins count most), eight tiers of three steps each
// (I, II, III). The same rank shows in the ranking, the scoreboard and the class screen.
import { seasonPoints } from './modes';

export const RANK_TIERS = [
  { name: 'Bronce', from: 0 },
  { name: 'Plata', from: 150 },
  { name: 'Oro', from: 400 },
  { name: 'Platino', from: 900 },
  { name: 'Diamante', from: 1800 },
  { name: 'Maestro', from: 2800 },
  { name: 'Gran maestro', from: 4000 },
  { name: 'Leyenda', from: 5500 },
] as const;
const STEPS = ['I', 'II', 'III'] as const;

/** Rank points are the season points. */
export const rankPoints = seasonPoints;

export interface Rank {
  tier: number;
  step: number;
  /** «Diamante II» (Leyenda has no steps) */
  label: string;
  /** points where the next step starts (null at the top) */
  next: number | null;
  /** 0…1 of the way to the next step */
  progress: number;
}

export function rankOf(points: number): Rank {
  let tier = 0;
  while (tier < RANK_TIERS.length - 1 && points >= RANK_TIERS[tier + 1]!.from) tier++;
  const { name, from } = RANK_TIERS[tier]!;
  const to = RANK_TIERS[tier + 1]?.from;
  if (to === undefined) return { tier, step: 0, label: name, next: null, progress: 1 };
  const size = (to - from) / STEPS.length;
  const step = Math.min(STEPS.length - 1, Math.floor((points - from) / size));
  const start = from + step * size;
  const next = Math.round(start + size);
  return { tier, step, label: `${name} ${STEPS[step]}`, next, progress: (points - start) / size };
}
