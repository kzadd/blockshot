import type { PlayerClass } from '../characters/characters';
import type { WeaponId } from '../weapons/weapons';

export type ModeId =
  | 'ffa'
  | 'teams'
  | 'ctf'
  | 'gungame'
  | 'kc'
  | 'infect'
  | 'dom'
  | 'rounds'
  | 'race'
  | 'lms'
  | 'insta'
  | 'freeze'
  | 'bomb';
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
  { id: 'gungame', name: 'Escalada de armas', limits: [10, 15, 20], def: 15, unit: 'armas' },
  { id: 'kc', name: 'Confirmar bajas', limits: [15, 30, 50, 75], def: 30, unit: 'placas' },
  { id: 'infect', name: 'Infectados', limits: [2, 3, 5], def: 3, unit: 'min' },
  { id: 'dom', name: 'Dominio', limits: [100, 150, 250], def: 150, unit: 'puntos' },
  { id: 'rounds', name: 'Supervivencia', limits: [3, 5, 7], def: 3, unit: 'rondas' },
  { id: 'race', name: 'Carrera de saltos', limits: [1, 3, 5], def: 3, unit: 'carreras' },
  { id: 'lms', name: 'Último en pie', limits: [3, 5, 7], def: 3, unit: 'rondas' },
  { id: 'insta', name: 'Disparo único', limits: [15, 25, 40], def: 25, unit: 'bajas' },
  { id: 'freeze', name: 'Congelados', limits: [3, 5, 7], def: 3, unit: 'rondas' },
  { id: 'bomb', name: 'Bomba', limits: [3, 5, 7], def: 3, unit: 'rondas' },
];
export const MODE_BY_ID = Object.fromEntries(MODES.map((m) => [m.id, m])) as Record<ModeId, ModeInfo>;
export const isModeId = (v: unknown): v is ModeId => typeof v === 'string' && Object.hasOwn(MODE_BY_ID, v);

// Gun game: everybody starts with the first weapon and each kill gives the next one.
// The winner is whoever kills with the last one (the knife). A knife kill takes a weapon from the victim.
export const GUN_LADDERS: Record<number, WeaponId[]> = {
  // rifles → machine guns → SMGs → shotguns → marksman → pistols → the knife (no explosives nor power weapons)
  10: ['rifle', 'heavyrifle', 'smg', 'ump45', 'shotgun', 'dmr', 'sniper', 'heavypistol', 'pistol', 'knife'],
  15: [
    'rifle',
    'heavyrifle',
    'lightrifle',
    'carbine',
    'lmg',
    'smg',
    'pdw',
    'ump45',
    'shotgun',
    'benelli',
    'dmr',
    'sniper',
    'revolver',
    'pistol',
    'knife',
  ],
  20: [
    'rifle',
    'heavyrifle',
    'lightrifle',
    'carbine',
    'lightlmg',
    'lmg',
    'smg',
    'pdw',
    'ump45',
    'compact',
    'shotgun',
    'benelli',
    'sawedoff',
    'dmr',
    'frf1',
    'sniper',
    'heavypistol',
    'revolver',
    'colt',
    'knife',
  ],
};
const DEFAULT_LADDER = 15;
export const gunLadder = (limit: number): WeaponId[] => GUN_LADDERS[limit] ?? GUN_LADDERS[DEFAULT_LADDER]!;

/** Modes with two sides (no friendly fire). In Infected the side is decided by the game, not the player. */
const TEAM_MODES: ReadonlySet<ModeId> = new Set(['teams', 'ctf', 'kc', 'infect', 'dom', 'rounds', 'freeze', 'bomb']);
export const isTeamMode = (mode: ModeId): boolean => TEAM_MODES.has(mode);
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
/**
 * Freeze tag: a teammate within `radius` of a frozen player (statue) for `thawMs` thaws him; each extra
 * teammate speeds it up by `boostPerMate`, up to `maxBoost`.
 */
export const FREEZE = { radius: 2, thawMs: 3000, boostPerMate: 0.5, maxBoost: 2 };
/**
 * Bomb: the carrier plants by standing `plantMs` inside a site (`siteRadius`); the planted bomb explodes after
 * `fuseMs`; a defender standing within `defuseRadius` of it for `defuseMs` defuses it. `pickup`: walking over a
 * dropped bomb picks it up.
 */
export const BOMB = { siteRadius: 3, plantMs: 3000, fuseMs: 35000, defuseRadius: 1.8, defuseMs: 6000, pickup: 1.5 };
/** InstaGib: everybody carries the railgun with endless ammo, and it kills in one hit. */
export const unlimitedAmmo = (mode: ModeId): boolean => mode === 'insta';

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

export type StreakReward =
  | { id: 'radar'; name: string; ms: number }
  | { id: 'armor'; name: string; amount: number }
  | { id: 'strike'; name: string };
/**
 * Streak rewards: radar = every enemy on the minimap (you and your team);
 * armor = extra health spent before the normal one, never regenerates;
 * strike = an air strike where you are looking (AIRSTRIKE), marked on the ground before it lands.
 */
export const STREAK_REWARDS: Record<number, StreakReward> = {
  3: { id: 'radar', name: 'Radar', ms: 8000 },
  5: { id: 'armor', name: 'Blindaje', amount: 50 },
  7: { id: 'strike', name: 'Bombardeo aéreo' },
};
/** Air strike: how far ahead it can be called, the warning before it lands, its blasts in a line and their size. */
export const AIRSTRIKE = { range: 60, delayMs: 2500, blasts: 5, spacing: 4, radius: 5, maxDamage: 120, minDamage: 30 };

/** Results screen between matches (long enough to vote for the next map). */
export const MATCH_RESTART_MS = 12000;
/** Map/mode options voted at the end of a match. */
export const VOTE_OPTIONS = 3;
/** ms between team changes */
export const TEAM_SWITCH_COOLDOWN = 5000;
/** a player hit within this many ms is "in combat" and cannot switch teams */
export const COMBAT_LOCK_MS = 3000;

/**
 * Weapons a player carries, by key order (1, 2, 3): the class's (already validated, classOf). Gun game, Infected
 * and InstaGib hand out their own; race keeps only the sidearm.
 */
export function loadoutOf(
  mode: ModeId,
  cls: Pick<PlayerClass, 'primary' | 'secondary'>,
  level = 0,
  limit = DEFAULT_LADDER,
  team: Team = 0,
): WeaponId[] {
  if (mode === 'infect' && team === 2) return ['knife'];
  // Racing: only the sidearm and the knife (to knock rivals back to their checkpoint, no sniping from the start)
  if (mode === 'race') return [cls.secondary, 'knife'];
  if (mode === 'insta') return ['railgun', 'knife'];
  if (mode === 'gungame') {
    const ladder = gunLadder(limit);
    const w = ladder[Math.min(level, ladder.length - 1)]!;
    return w === 'knife' ? ['knife'] : [w, 'knife'];
  }
  return [cls.primary, cls.secondary, 'knife'];
}

/** Carrera is only played on Circuito, and Circuito only hosts Carrera. */
export const RACE_MAP = 'circuito';
/** The map and mode that go together: picking one of the race pair brings the other. */
export function fitMapMode<M extends string>(mapId: M, mode: ModeId): { mapId: M | typeof RACE_MAP; mode: ModeId } {
  if (mode === 'race') return { mapId: RACE_MAP, mode };
  if (mapId === RACE_MAP) return { mapId, mode: 'race' };
  return { mapId, mode };
}
/** A race checkpoint you fall below this height from goes back to (m). */
export const RACE_FALL_Y = 2;

/** Season points from a player's ranking totals: winning counts most, then kills, captures and medals. */
export const seasonPoints = (r: {
  wins: number;
  kills: number;
  deaths: number;
  heads: number;
  caps: number;
  medals: number;
}): number => Math.max(0, r.wins * 30 + r.kills * 2 + r.heads + r.caps * 5 + r.medals * 3 - r.deaths);

/** Season divisions, from the points they start at. */
export const DIVISIONS = [
  { name: 'Bronce', from: 0 },
  { name: 'Plata', from: 150 },
  { name: 'Oro', from: 400 },
  { name: 'Platino', from: 900 },
  { name: 'Diamante', from: 1800 },
  { name: 'Leyenda', from: 3500 },
] as const;
export const divisionOf = (points: number) => [...DIVISIONS].reverse().find((d) => points >= d.from)!;
