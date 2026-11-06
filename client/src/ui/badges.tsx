// Rank badges (eight tiers: hexagonal shield, more wings and gems the higher it goes) and medal icons, drawn in SVG.
// The markup is built from our own constants only, so it is set as HTML.
import { useId } from 'react';
import { MEDALS, RANK_TIERS, rankOf, type MedalId } from '@blockshot/shared';

const hex = (r: number) =>
  [0, 1, 2, 3, 4, 5]
    .map((k) => {
      const a = (Math.PI / 3) * k - Math.PI / 2;
      return `${(r * Math.cos(a)).toFixed(1)},${(r * Math.sin(a)).toFixed(1)}`;
    })
    .join(' ');

/** Metal (light, mid, dark), the gem inside (light, dark) and the emblem colour of each tier. */
const LOOK: { m: [string, string, string]; gem: [string, string]; ink: string }[] = [
  { m: ['#f2b98c', '#a8653a', '#4d2814'], gem: ['#3a2a22', '#1c130e'], ink: '#e8a879' },
  { m: ['#ffffff', '#a9b2bc', '#454c55'], gem: ['#3a4452', '#141920'], ink: '#dfe6ee' },
  { m: ['#fff4b8', '#d6a532', '#6b4a0c'], gem: ['#4a3c1c', '#1d170a'], ink: '#ffe08a' },
  { m: ['#effffb', '#86c9c1', '#2c5f5b'], gem: ['#24464a', '#0d1c1e'], ink: '#bff3ea' },
  { m: ['#f4ecff', '#a99cc4', '#4b4560'], gem: ['#7b3fe0', '#2a0f5e'], ink: '#d9b8ff' },
  { m: ['#fff4b8', '#d6a532', '#6b4a0c'], gem: ['#8a46f0', '#2a0f5e'], ink: '#e2c4ff' },
  { m: ['#fff4b8', '#d6a532', '#6b4a0c'], gem: ['#e2463a', '#5a0d0a'], ink: '#ffb3a8' },
  { m: ['#fffbe0', '#f0c040', '#7a4a00'], gem: ['#ff3b2f', '#4a0606'], ink: '#ffd0c8' },
];

/** The emblem colour of a tier (rank names in its colour). */
export const rankInk = (tier: number): string => LOOK[tier]?.ink ?? LOOK[0]!.ink;

function badgeSvg(t: number, g: string): string {
  const T = LOOK[t]!;
  const metal = `url(#${g}m)`;
  let s = `<defs>
    <linearGradient id="${g}m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${T.m[0]}"/><stop offset=".45" stop-color="${T.m[1]}"/><stop offset="1" stop-color="${T.m[2]}"/></linearGradient>
    <radialGradient id="${g}g" cx=".5" cy=".4" r=".7"><stop offset="0" stop-color="${T.gem[0]}"/><stop offset="1" stop-color="${T.gem[1]}"/></radialGradient>
    <linearGradient id="${g}r" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c8231b"/><stop offset="1" stop-color="#5e0905"/></linearGradient></defs>`;
  // Gran maestro and Leyenda: red drapes behind
  if (t >= 6)
    s += `<path d="M-62 -40 Q-70 10 -58 60 L-40 46 L-30 62 L-34 -34Z" fill="url(#${g}r)"/><path d="M62 -40 Q70 10 58 60 L40 46 L30 62 L34 -34Z" fill="url(#${g}r)"/><rect x="-66" y="-46" width="132" height="8" fill="${metal}"/>`;
  // Maestro and up: side pillars
  if (t >= 5) s += `<path d="M-58 -36 L-50 -44 L-50 40 L-58 32Z M58 -36 L50 -44 L50 40 L58 32Z" fill="${metal}"/>`;
  // Wings: more feathers the higher the tier (none for Bronce)
  const feathers = t === 0 ? 0 : Math.min(4, Math.ceil(t / 2) + 1);
  for (let i = 0; i < feathers; i++) {
    const y = -10 + i * 11;
    const w = 30 - i * 3;
    const o = 1 - i * 0.1;
    s += `<path d="M-38 ${y} L-${38 + w} ${y - 8} L-${38 + w - 6} ${y + 4} L-38 ${y + 8}Z" fill="${metal}" opacity="${o}"/>`;
    s += `<path d="M38 ${y} L${38 + w} ${y - 8} L${38 + w - 6} ${y + 4} L38 ${y + 8}Z" fill="${metal}" opacity="${o}"/>`;
  }
  if (t >= 6)
    s += `<path d="M0 44 L-46 40 L-30 52 L-50 54 L-20 62 L0 58 L20 62 L50 54 L30 52 L46 40Z" fill="${metal}"/>`;
  s += `<polygon points="${hex(46)}" fill="${metal}" stroke="#0b0e11" stroke-width="2"/>`;
  s += `<polygon points="${hex(38)}" fill="#0b0e11"/><polygon points="${hex(35)}" fill="url(#${g}g)"/>`;
  // Emblem: one to four chevrons
  const chevrons = Math.min(4, t + 1);
  for (let i = 0; i < chevrons; i++) {
    const y = -4 + (i - (chevrons - 1) / 2) * 11;
    s += `<path d="M-20 ${y - 6} L0 ${y + 4} L20 ${y - 6} L20 ${y} L0 ${y + 10} L-20 ${y}Z" fill="${T.ink}" stroke="#0b0e11" stroke-width=".8"/>`;
  }
  s +=
    t >= 4
      ? `<polygon points="0,40 -8,50 0,62 8,50" fill="${T.gem[0]}" stroke="${metal}" stroke-width="2.5"/>`
      : `<polygon points="0,44 -6,52 0,58 6,52" fill="${metal}" stroke="#0b0e11" stroke-width="1"/>`;
  if (t === 7)
    s += `<path d="M-14 -44 L-8 -60 L0 -50 L8 -60 L14 -44Z" fill="${metal}" stroke="#0b0e11" stroke-width="1"/>`;
  return s;
}

/** The badge of the rank for `points` rank points. */
export function RankBadge({ points, size = 24 }: { points: number; size?: number }) {
  const id = useId().replace(/:/g, '');
  const rank = rankOf(points);
  return (
    <svg
      className="rank-badge"
      viewBox="-80 -70 160 150"
      width={size}
      height={size}
      role="img"
      aria-label={`Rango ${rank.label}`}
      dangerouslySetInnerHTML={{ __html: `<title>${rank.label}</title>${badgeSvg(rank.tier, id)}` }}
    />
  );
}

export const tierName = (tier: number): string => RANK_TIERS[tier]?.name ?? '';

const MEDAL_LOOK: Record<MedalId, { c: string; body: string }> = {
  first: {
    c: '#e2463a',
    body: `<path d="M0 -20 C10 -6 16 2 16 10 A16 16 0 0 1 -16 10 C-16 2 -10 -6 0 -20Z" fill="#fff"/><path d="M-2 4 L2 1 V16" stroke="#c21d12" stroke-width="3" fill="none"/>`,
  },
  double: {
    c: '#f08a24',
    body: `<path d="M-18 -10 L-8 0 L-18 10 M-8 -10 L2 0 L-8 10" stroke="#fff" stroke-width="4" fill="none"/><path d="M8 -8 H18 L8 8 H18" stroke="#fff" stroke-width="3.5" fill="none"/>`,
  },
  triple: {
    c: '#e2463a',
    body: `<path d="M-20 -10 L-12 0 L-20 10 M-12 -10 L-4 0 L-12 10 M-4 -10 L4 0 L-4 10" stroke="#fff" stroke-width="3.5" fill="none"/><path d="M8 -8 H18 L12 -1 Q19 0 18 6 Q16 10 8 9" stroke="#fff" stroke-width="3" fill="none"/><path d="M-14 -20 L-8 -26 L0 -20 L8 -26 L14 -20Z" fill="#ffd23a"/>`,
  },
  revenge: {
    c: '#8a46f0',
    body: `<path d="M-14 -10 A14 14 0 1 1 -10 12" fill="none" stroke="#fff" stroke-width="5"/><path d="M-20 4 L-10 16 L-2 4Z" fill="#fff"/>`,
  },
  air: {
    c: '#3a9be0',
    body: `<path d="M0 -4 L-24 -14 L-18 -4 L-26 2 L-6 4Z M0 -4 L24 -14 L18 -4 L26 2 L6 4Z" fill="#fff"/><path d="M0 -16 L6 0 L0 16 L-6 0Z" fill="#fff"/>`,
  },
  backstab: {
    c: '#4a5560',
    body: `<path d="M-14 16 L10 -14 L16 -18 L14 -10 L-10 20Z" fill="#fff"/><path d="M-18 12 L-8 22" stroke="#ffd23a" stroke-width="5"/>`,
  },
  longshot: {
    c: '#2f8f6a',
    body: `<circle r="15" fill="none" stroke="#fff" stroke-width="3"/><path d="M0 -22 V-8 M0 8 V22 M-22 0 H-8 M8 0 H22" stroke="#fff" stroke-width="3"/><circle r="3" fill="#ffd23a"/>`,
  },
};

/** A medal as a hexagonal coin with its picture (the name shows on hover). */
export function MedalIcon({ id, size = 20 }: { id: MedalId; size?: number }) {
  const m = MEDAL_LOOK[id];
  return (
    <svg
      className="medal-icon"
      viewBox="-40 -40 80 80"
      width={size}
      height={size}
      role="img"
      aria-label={MEDALS[id]}
      dangerouslySetInnerHTML={{
        __html: `<title>${MEDALS[id]}</title><polygon points="${hex(36)}" fill="#0b0e11"/><polygon points="${hex(32)}" fill="${m.c}"/><polygon points="${hex(32)}" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="2"/>${m.body}`,
      }}
    />
  );
}
