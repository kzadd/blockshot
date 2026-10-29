import { PAD } from '../player/player';
import type { BoxFn, BoxKind, PropKind, PropPart } from './types';

// Decoration props: lists of parts. Their 3D look lives in the client (world rendering).
export const BARREL: PropPart[] = [[0, 0, 0, 0.85, 1.1, 0.85, 'barrel']];
export const TREE: PropPart[] = [
  [0, 0, 0, 1.6, 0.7, 1.6, 'planter'],
  [0, 0.7, 0, 0.35, 2.6, 0.35, 'trunk'],
];
export const LAMP: PropPart[] = [[0, 0, 0, 0.25, 4.2, 0.25, 'lamp']];
export const CACTUS: PropPart[] = [[0, 0, 0, 0.45, 2.3, 0.45, 'cactus']];
/** A pine: only its trunk blocks (the branches are decoration). */
export const PINE: PropPart[] = [[0, 0, 0, 0.6, 6, 0.6, 'pine']];
export const LOGS: PropPart[] = [[0, 0, 0, 3, 1.4, 1.6, 'logs']];
export const sandbags = (w: number, d: number): PropPart[] => [[0, 0, 0, w, 0.95, d, 'sandbag']];
export const PALLET: PropPart[] = [
  [0, 0, 0, 1.2, 0.15, 1.2, 'pallet'],
  [0, 0.15, 0, 1, 1, 1, 'crate'],
];
export const car = (alongX: boolean): PropPart[] =>
  alongX
    ? [
        [0, 0, 0, 4.2, 1, 1.9, 'car'],
        [0.3, 1, 0, 2.2, 0.75, 1.7, 'carTop'],
      ]
    : [
        [0, 0, 0, 1.9, 1, 4.2, 'car'],
        [0, 1, 0.3, 1.7, 0.75, 2.2, 'carTop'],
      ];

/** Prop colours (minimap and preview; the 3D view uses them as tint). Key order is part of the map data. */
export const PROP_COLORS: Partial<Record<PropKind | 'pad', string>> = {
  barrel: '#3d6e9e',
  planter: '#9a8f80',
  trunk: '#6b4a2b',
  lamp: '#3a3f47',
  sandbag: '#b8a57a',
  pad: '#3ee08a',
  pallet: '#a8834f',
  cactus: '#4f8a45',
  car: '#c0503e',
  carTop: '#2b3a4a',
};

/** Staircase of `steps` 0.5 m steps climbing towards `dir` (±1 on axis x or z) and ending at (x, z). */
export function stairs(
  B: BoxFn,
  x: number,
  z: number,
  axis: 'x' | 'z',
  dir: number,
  steps: number,
  width: number,
  c: BoxKind = 'step',
): void {
  for (let i = 1; i <= steps; i++) {
    const len = steps + 1 - i;
    const off = (-dir * len) / 2;
    if (axis === 'x') B(x + off, 0, z, len, i * 0.5, width, c);
    else B(x, 0, z + off, width, i * 0.5, len, c);
  }
}

/** Jump pad centred at (x, z), resting on the floor (or on y). */
export const pad = (B: BoxFn, x: number, z: number, y = 0): void => B(x, y, z, PAD.size, PAD.h, PAD.size, 'pad');
