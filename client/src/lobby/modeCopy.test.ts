import { describe, expect, it } from 'vitest';
import { MODES } from '@blockshot/shared';
import { MODE_GROUPS } from './modeCopy';

describe('MODE_GROUPS', () => {
  it('lists every mode exactly once', () => {
    const listed = MODE_GROUPS.flatMap((g) => g.modes);
    expect([...listed].sort()).toEqual(MODES.map((m) => m.id).sort());
  });
});
