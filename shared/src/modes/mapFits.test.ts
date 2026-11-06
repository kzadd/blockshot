import { describe, expect, it } from 'vitest';
import { MAPS } from '../maps/maps';
import { MODES, fitMapMode, mapFits } from './modes';

describe('mapFits', () => {
  it('race only on its courses (Circuito, Verbena, Tarta), and they only host race; every other mode has maps', () => {
    for (const course of ['circuito', 'verbena', 'tarta'] as const) {
      expect(mapFits(course, 'race')).toBe(true);
      expect(mapFits(course, 'ffa')).toBe(false);
      expect(fitMapMode(course, 'race')).toEqual({ mapId: course, mode: 'race' });
      expect(fitMapMode(course, 'teams')).toEqual({ mapId: course, mode: 'race' });
    }
    expect(MAPS.filter((m) => mapFits(m.id, 'race')).map((m) => m.id)).toEqual(['circuito', 'verbena', 'tarta']);
    expect(mapFits('patio', 'race')).toBe(false);
    expect(mapFits('patio', 'infect')).toBe(true);
    // The two maps built for one mode host it and a couple of others only; the other maps keep hosting both
    expect(mapFits('sanatorio', 'infect')).toBe(true);
    expect(mapFits('sanatorio', 'ffa')).toBe(true);
    expect(mapFits('sanatorio', 'bomb')).toBe(false);
    expect(mapFits('aduana', 'bomb')).toBe(true);
    expect(mapFits('aduana', 'teams')).toBe(true);
    expect(mapFits('aduana', 'ctf')).toBe(false);
    expect(mapFits('aduana', 'infect')).toBe(false);
    expect(mapFits('nevada', 'bomb')).toBe(true);
    for (const m of MODES)
      expect(
        MAPS.some((map) => mapFits(map.id, m.id)),
        m.id,
      ).toBe(true);
  });

  it('fitMapMode makes any pair fit', () => {
    expect(fitMapMode('patio', 'race')).toEqual({ mapId: 'circuito', mode: 'race' });
    expect(fitMapMode('circuito', 'infect')).toEqual({ mapId: 'circuito', mode: 'race' });
    expect(fitMapMode('patio', 'bomb')).toEqual({ mapId: 'patio', mode: 'bomb' });
    // A mode another map does not host keeps the map and takes its first mode (it never jumps to Sanatorio/Aduana)
    expect(fitMapMode('sanatorio', 'ctf')).toEqual({ mapId: 'sanatorio', mode: 'infect' });
    expect(fitMapMode('aduana', 'race')).toEqual({ mapId: 'circuito', mode: 'race' });
    for (const map of MAPS)
      for (const m of MODES) {
        const f = fitMapMode(map.id, m.id);
        expect(mapFits(f.mapId, f.mode)).toBe(true);
      }
  });

  it('Traidores only on its sneaky maps, which keep hosting the other modes', () => {
    expect(MAPS.filter((m) => mapFits(m.id, 'traitor')).map((m) => m.id)).toEqual([
      'monasterio',
      'pueblo',
      'ciudad',
      'estacion',
      'sanatorio',
    ]);
    expect(mapFits('pueblo', 'ffa')).toBe(true);
    expect(fitMapMode('patio', 'traitor')).toEqual({ mapId: 'sanatorio', mode: 'traitor' });
  });
});
