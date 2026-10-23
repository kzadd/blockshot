export type Vec3 = [number, number, number];

/** Round to 2 decimals: keeps maps and network payloads compact and identical on every machine. */
export const round2 = (n: number): number => Math.round(n * 100) / 100;

export const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, v));

/** Seeded PRNG (mulberry32): server and clients generate exactly the same maps and scenery. */
export function rng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a hash of a string, used as an rng seed. */
export const seedOf = (s: string): number =>
  [...s].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 16777619), 2166136261);
