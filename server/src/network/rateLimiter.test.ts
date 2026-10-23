import { describe, expect, it } from 'vitest';
import { RateLimiter } from './rateLimiter';

describe('RateLimiter', () => {
  it('allows a burst, then refills at the configured rate', () => {
    let t = 0;
    const rl = new RateLimiter({ x: { rate: 2, burst: 3 } }, () => t);
    expect([rl.take('x'), rl.take('x'), rl.take('x'), rl.take('x')]).toEqual([true, true, true, false]);
    t = 499;
    expect(rl.take('x')).toBe(false);
    t = 500;
    expect(rl.take('x')).toBe(true);
  });

  it('keeps categories independent and never exceeds the burst', () => {
    let t = 0;
    const rl = new RateLimiter({ a: { rate: 1, burst: 1 }, b: { rate: 1, burst: 2 } }, () => t);
    expect(rl.take('a')).toBe(true);
    expect(rl.take('a')).toBe(false);
    expect(rl.take('b')).toBe(true);
    t = 60_000;
    expect([rl.take('b'), rl.take('b'), rl.take('b')]).toEqual([true, true, false]);
  });
});
