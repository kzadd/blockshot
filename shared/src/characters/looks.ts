// Cosmetic picks on top of the face skin: the uniform's camouflage and the weapons' finish.
// They only change the look, never the stats (the materials live in the client).

export type CamoId =
  'liso' | 'bosque' | 'desierto' | 'urbano' | 'artico' | 'digital' | 'tigre' | 'noche' | 'carbono' | 'neon';

/** `liso` is the plain uniform in the outfit colour; the rest print a pattern and keep the colour on the details. */
export const CAMOS: { id: CamoId; name: string }[] = [
  { id: 'liso', name: 'Liso' },
  { id: 'bosque', name: 'Bosque' },
  { id: 'desierto', name: 'Desierto' },
  { id: 'urbano', name: 'Urbano' },
  { id: 'artico', name: 'Ártico' },
  { id: 'digital', name: 'Digital' },
  { id: 'tigre', name: 'Tigre' },
  { id: 'noche', name: 'Noche' },
  { id: 'carbono', name: 'Carbono' },
  { id: 'neon', name: 'Neón' },
];
export const isCamoId = (v: unknown): v is CamoId => CAMOS.some((c) => c.id === v);

export type FinishId =
  'estandar' | 'acero' | 'arena' | 'carbono' | 'camuflaje' | 'damasco' | 'oro' | 'hielo' | 'lava' | 'neon';

/** `estandar` keeps each gun's own colours; `camuflaje` prints the uniform's camouflage on the gun. */
export const FINISHES: { id: FinishId; name: string }[] = [
  { id: 'estandar', name: 'Estándar' },
  { id: 'acero', name: 'Acero' },
  { id: 'arena', name: 'Arena' },
  { id: 'carbono', name: 'Carbono' },
  { id: 'camuflaje', name: 'Camuflaje' },
  { id: 'damasco', name: 'Damasco' },
  { id: 'oro', name: 'Oro' },
  { id: 'hielo', name: 'Hielo' },
  { id: 'lava', name: 'Lava' },
  { id: 'neon', name: 'Neón' },
];
export const isFinishId = (v: unknown): v is FinishId => FINISHES.some((f) => f.id === v);
