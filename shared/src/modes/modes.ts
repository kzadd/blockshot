import type { Character } from '../characters/characters';
import type { WeaponId } from '../weapons/weapons';

export type ModeId = 'ffa' | 'teams' | 'ctf' | 'gungame' | 'kc' | 'infect' | 'dom' | 'rounds';
/** 0 = no team (free for all) · 1 = Red / Survivors · 2 = Blue / Infected */
export type Team = 0 | 1 | 2;
export type SideTeam = 1 | 2;

export interface ModeInfo {
  id: ModeId;
  name: string;
  /** score options offered when creating a room */
  limits: number[];
  /** the option selected by default */
  def: number;
  unit: string;
}

export const MODES: ModeInfo[] = [
  { id: 'ffa', name: 'Todos contra todos', limits: [10, 20, 30, 50], def: 20, unit: 'bajas' },
  { id: 'teams', name: 'Por equipos', limits: [20, 40, 60, 100], def: 40, unit: 'bajas' },
  { id: 'ctf', name: 'Captura la bandera', limits: [1, 3, 5, 7], def: 3, unit: 'capturas' },
  { id: 'gungame', name: 'Escalada de armas', limits: [5, 8], def: 8, unit: 'armas' },
  { id: 'kc', name: 'Confirmar bajas', limits: [15, 30, 50, 75], def: 30, unit: 'placas' },
  { id: 'infect', name: 'Infectados', limits: [2, 3, 5], def: 3, unit: 'min' },
  { id: 'dom', name: 'Dominio', limits: [100, 150, 250], def: 150, unit: 'puntos' },
  { id: 'rounds', name: 'Rondas', limits: [3, 5, 7], def: 3, unit: 'rondas' },
];
export const MODE_BY_ID = Object.fromEntries(MODES.map((m) => [m.id, m])) as Record<ModeId, ModeInfo>;
export const isModeId = (v: unknown): v is ModeId => typeof v === 'string' && Object.hasOwn(MODE_BY_ID, v);

// Gun game: everybody starts with the first weapon and each kill gives the next one.
// The winner is whoever kills with the last one (the knife). A knife kill takes a weapon from the victim.
export const GUN_LADDERS: Record<number, WeaponId[]> = {
  5: ['smg', 'shotgun', 'sniper', 'pistol', 'knife'],
  8: ['rifle', 'smg', 'shotgun', 'lmg', 'sniper', 'revolver', 'pistol', 'knife'],
};
const DEFAULT_LADDER = 8;
export const gunLadder = (limit: number): WeaponId[] => GUN_LADDERS[limit] ?? GUN_LADDERS[DEFAULT_LADDER]!;

/** Modes with two sides (no friendly fire). In Infected the side is decided by the game, not the player. */
export const isTeamMode = (mode: ModeId): boolean =>
  mode === 'teams' || mode === 'ctf' || mode === 'kc' || mode === 'infect' || mode === 'dom' || mode === 'rounds';
export const canSwitchTeam = (mode: ModeId): boolean => isTeamMode(mode) && mode !== 'infect';

/** Capture the flag: radius to take / return / capture and time until a dropped flag returns. */
export const FLAG = { radius: 1.6, returnMs: 20000 };
/** Kill confirmed: radius to pick a tag up and its lifetime. */
export const TAG = { radius: 1.5, lifeMs: 30000 };
/** Pick-up zones (flags, tags) ignore anything further than this vertically (m). */
export const PICKUP_MAX_DY = 2.5;
/**
 * Infected: the first infected is picked once 2 players are alive; infected only carry the knife and are
 * faster and tougher. If survivors remain when time runs out (minutes chosen at room creation), they win.
 */
export const INFECT = { pickDelay: 10000, speed: 1.15, hp: 1.3 };
/** Rounds: time limit of a round and the break before the next one (ms). */
export const ROUNDS = { roundMs: 120000, breakMs: 4000 };

// TODO(review): posible código muerto: `color` is never read (team colours come from the client palette, which follows the colourblind mode)
export const TEAMS: Record<SideTeam, { name: string; color: string }> = {
  1: { name: 'Rojo', color: '#ff5a4d' },
  2: { name: 'Azul', color: '#4da3ff' },
};
const INFECT_TEAMS: Record<SideTeam, string> = { 1: 'Supervivientes', 2: 'Infectados' };
export const teamName = (mode: ModeId, t: number): string =>
  (mode === 'infect' ? INFECT_TEAMS[t as SideTeam] : TEAMS[t as SideTeam]?.name) ?? '';

/** Streak notices (kills in a row without dying). */
export const STREAKS: Record<number, string> = { 3: 'En racha', 5: 'Imparable', 7: 'Dominando', 10: 'Leyenda' };

export type StreakReward = { id: 'radar'; name: string; ms: number } | { id: 'armor'; name: string; amount: number };
/**
 * Streak rewards: radar = every enemy on the minimap (you and your team);
 * armor = extra health spent before the normal one, never regenerates.
 */
export const STREAK_REWARDS: Record<number, StreakReward> = {
  5: { id: 'radar', name: 'Radar', ms: 12000 },
  7: { id: 'armor', name: 'Blindaje', amount: 50 },
};

/** Results screen between matches (long enough to vote for the next map). */
export const MATCH_RESTART_MS = 12000;
/** Map/mode options voted at the end of a match. */
export const VOTE_OPTIONS = 3;
/** ms between team changes */
export const TEAM_SWITCH_COOLDOWN = 5000;
/** a player hit within this many ms is "in combat" and cannot switch teams */
export const COMBAT_LOCK_MS = 3000;

/** Weapons a player carries, by key order (1, 2, 3). */
export function loadoutOf(mode: ModeId, ch: Character, level = 0, limit = DEFAULT_LADDER, team: Team = 0): WeaponId[] {
  if (mode === 'infect' && team === 2) return ['knife'];
  if (mode === 'gungame') {
    const ladder = gunLadder(limit);
    const w = ladder[Math.min(level, ladder.length - 1)]!;
    return w === 'knife' ? ['knife'] : [w, 'knife'];
  }
  return [ch.primary, ch.secondary, 'knife'];
}
