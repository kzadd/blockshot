import type { SideTeam } from '@blockshot/shared';

/** CSS variables of each team (they follow the colourblind palette). */
export const TEAM_TXT: Record<SideTeam, string> = { 1: 'var(--eq-rojo-txt)', 2: 'var(--eq-azul-txt)' };
export const teamVar = (t: SideTeam): string => `var(--eq-${t === 1 ? 'rojo' : 'azul'})`;
export const SIDES: readonly SideTeam[] = [1, 2];
