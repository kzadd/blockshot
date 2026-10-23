import type {
  CharacterId,
  FlagSnapshot,
  InfectSnapshot,
  ModeId,
  PlayerSnapshot,
  SideTeam,
  Team,
} from '@blockshot/shared';

/** Screen angle (radians, 0 = ahead, positive = right) of something around the player. */
export interface ScreenMark {
  key: number;
  angle: number;
}
export interface DamageMark extends ScreenMark {
  /** 1 → 0 while it fades */
  life: number;
}
export interface SoundMark extends ScreenMark {
  color: string;
}

/** Everything the HUD shows, published by the engine a few times per second. */
export interface HudState {
  alive: boolean;
  everSpawned: boolean;
  locked: boolean;
  hp: number;
  maxHp: number;
  characterId: CharacterId | undefined;
  charName: string | undefined;
  /** 0..1, null when stamina is disabled */
  stamina: number | null;
  staminaLow: boolean;
  sprinting: boolean;
  armor: number;
  radar: boolean;
  infect: InfectSnapshot | null;
  weaponName: string | undefined;
  mag: number | undefined;
  magSize: number | undefined;
  reloading: boolean;
  reloadPct: number;
  slot: number;
  /** weapon names by slot */
  loadout: string[];
  melee: boolean;
  gunLevel: number;
  gunTotal: number;
  scoped: boolean;
  /** ms of spawn protection left */
  protect: number;
  hit: boolean;
  hitHead: boolean;
  /** 1 → 0 after taking damage */
  damage: number;
  respawnIn: number;
  killerName: string;
  players: PlayerSnapshot[];
  spread: number;
  aim: number;
  dmgDirs: DamageMark[];
  mode: ModeId;
  myTeam: Team;
  hitKey: number;
  hitRed: boolean;
  combo: number;
  comboKey: number;
  ticks: SoundMark[];
  shotKey: number;
  damageKey: number;
  deathKey: number;
  teamScore: Record<SideTeam, number> | null;
  flags: Record<SideTeam, FlagSnapshot> | null;
  ping: number;
}
