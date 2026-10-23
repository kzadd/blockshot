import { describe, expect, it } from 'vitest';
import { MODES } from '@blockshot/shared';
import { MODE_UI } from './modeUi';

describe('mode presentation', () => {
  it('has an entry for every mode', () => {
    for (const m of MODES) expect(MODE_UI[m.id], m.id).toBeDefined();
  });

  it('keeps the original texts', () => {
    expect(MODE_UI.teams.hint(40)).toBe('40 bajas del equipo');
    expect(MODE_UI.infect.hint(3)).toBe('Aguantar 3 min');
    expect(MODE_UI.gungame.goal(5)).toBe('gana quien elimine con el cuchillo (5 armas)');
    expect(MODE_UI.kc.points).toBe('Placas');
  });
});
