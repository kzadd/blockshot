import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AIRSTRIKE } from '@blockshot/shared';
import { makeRoom } from '../testing/fakeRoom';
import { callStrike, tickStrikes } from './strike';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('air strike', () => {
  it('marks a line where the player looks, then blasts it after the warning, credited to the player', () => {
    const r = makeRoom('ffa');
    const a = r.join('Ana', 0, 30);
    const b = r.join('Beto', 0, 22);
    a.ry = 0; // looking north (-z), down at the ground
    a.rx = -0.25;
    const now = Date.now();
    callStrike(r.room, a, now);
    const [mark] = r.channel.of('strike');
    expect(mark!.at).toHaveLength(AIRSTRIKE.blasts);
    expect(mark!.ms).toBe(AIRSTRIKE.delayMs);
    // Beto stands where it lands
    const mid = mark!.at[Math.floor(AIRSTRIKE.blasts / 2)]!;
    r.place(b, mid[0], mid[2]);
    tickStrikes(r.room, now + AIRSTRIKE.delayMs - 1);
    expect(b.alive).toBe(true);
    tickStrikes(r.room, now + AIRSTRIKE.delayMs);
    expect(b.alive).toBe(false);
    expect(a.kills).toBe(1);
    expect(r.room.strikes).toHaveLength(0);
  });
});
