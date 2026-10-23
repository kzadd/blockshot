import type { CharacterId, SkinId, Team, WeaponId } from '@blockshot/shared';

export interface AmmoState {
  mag: number;
  /** 0 = not reloading */
  reloadEnd: number;
}

export interface HistoryEntry {
  t: number;
  x: number;
  y: number;
  z: number;
  sl: number;
  cr: number;
}

export interface Player {
  id: string;
  name: string;
  characterId: CharacterId | null;
  skin: SkinId;
  team: Team;
  alive: boolean;
  hp: number;
  maxHp: number;
  armor: number;
  x: number;
  y: number;
  z: number;
  ry: number;
  rx: number;
  /** sliding */
  sl: number;
  /** crouching */
  cr: number;
  slot: number;
  loadout: WeaponId[];
  ammo: AmmoState[];
  lastShot: number[];
  // Timers (ms since epoch; 0 = never)
  lastDamage: number;
  deathTime: number;
  spawnTime: number;
  protUntil: number;
  lastState: number;
  teamAt: number;
  radarUntil: number;
  /** recent positions for lag compensation */
  hist: HistoryEntry[];
  ping: number;
  // Score and stats
  kills: number;
  deaths: number;
  streak: number;
  bestStreak: number;
  heads: number;
  shots: number;
  hits: number;
  /** flag captures or confirmed tags */
  caps: number;
  /** gun game level */
  level: number;
}

const DEFAULT_MAX_HP = 100;

export function createPlayer(id: string, name: string, team: Team): Player {
  return {
    id,
    name,
    characterId: null,
    skin: 'base',
    team,
    alive: false,
    hp: 0,
    maxHp: DEFAULT_MAX_HP,
    armor: 0,
    x: 0,
    y: 0,
    z: 0,
    ry: 0,
    rx: 0,
    sl: 0,
    cr: 0,
    slot: 0,
    loadout: [],
    ammo: [],
    lastShot: [0, 0],
    lastDamage: 0,
    deathTime: 0,
    spawnTime: 0,
    protUntil: 0,
    lastState: 0,
    teamAt: 0,
    radarUntil: 0,
    hist: [],
    ping: 0,
    kills: 0,
    deaths: 0,
    streak: 0,
    bestStreak: 0,
    heads: 0,
    shots: 0,
    hits: 0,
    caps: 0,
    level: 0,
  };
}

/** Stats cleared when a new match starts. */
export function resetMatchStats(p: Player): void {
  Object.assign(p, {
    kills: 0,
    deaths: 0,
    deathTime: 0,
    streak: 0,
    bestStreak: 0,
    heads: 0,
    shots: 0,
    hits: 0,
    caps: 0,
    level: 0,
    armor: 0,
    radarUntil: 0,
  });
}
