// Token bucket per socket and message category: absorbs short bursts, drops floods.

export interface BucketSpec {
  /** tokens refilled per second */
  rate: number;
  /** bucket size (maximum burst) */
  burst: number;
}

interface Bucket {
  tokens: number;
  at: number;
}

const MS_PER_S = 1000;

export class RateLimiter<K extends string> {
  private readonly buckets = new Map<K, Bucket>();

  constructor(
    private readonly specs: Record<K, BucketSpec>,
    private readonly now: () => number = Date.now,
  ) {}

  /** Takes one token for `key`; false when the socket is over its limit. */
  take(key: K): boolean {
    const spec = this.specs[key];
    const t = this.now();
    const b = this.buckets.get(key) ?? { tokens: spec.burst, at: t };
    b.tokens = Math.min(spec.burst, b.tokens + ((t - b.at) / MS_PER_S) * spec.rate);
    b.at = t;
    const ok = b.tokens >= 1;
    if (ok) b.tokens -= 1;
    this.buckets.set(key, b);
    return ok;
  }
}

/**
 * Limits per category. Normal play is far below them: 20 state messages/s, up to ~15 shots/s
 * (submachine gun), a ping every 2 s and a few lobby actions.
 */
export const MESSAGE_LIMITS = {
  movement: { rate: 60, burst: 60 },
  combat: { rate: 40, burst: 40 },
  lobby: { rate: 5, burst: 10 },
  misc: { rate: 10, burst: 20 },
} satisfies Record<string, BucketSpec>;

export type MessageCategory = keyof typeof MESSAGE_LIMITS;
