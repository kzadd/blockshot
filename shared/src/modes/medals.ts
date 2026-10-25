// Medals: small rewards on top of a kill, shown in the killfeed and counted on the scoreboard.
export type MedalId = 'first' | 'double' | 'triple' | 'revenge' | 'air' | 'backstab' | 'longshot';

export const MEDALS: Record<MedalId, string> = {
  first: 'Primera sangre',
  double: 'Doble baja',
  triple: 'Triple baja',
  revenge: 'Venganza',
  air: 'Desde el aire',
  backstab: 'Por la espalda',
  longshot: 'Tiro lejano',
};

/** Kills closer together than this (ms) count as a double / triple kill. */
export const MULTI_KILL_MS = 3000;
/** A headshot kill from at least this far (m) is a long shot. */
export const LONGSHOT_M = 50;
