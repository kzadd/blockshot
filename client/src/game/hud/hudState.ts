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

/** A player as the HUD sees it: no positions (they change every tick and the HUD does not need them). */
export type HudPlayer = Pick<PlayerSnapshot, 'id' | 'n' | 'c' | 'k' | 'd' | 'tm' | 'pg' | 'st' | 'cp' | 'lv'>;

/** Everything the HUD shows, published by the engine a few times per second. */
export interface HudState {
  alive: boolean;
  everSpawned: boolean;
  locked: boolean;
  hp: number;
  maxHp: number;
  // TODO(review): posible código muerto: published since the original version, no screen reads it
  characterId: CharacterId | undefined;
  // TODO(review): posible código muerto: the v3 HUD no longer shows the character name
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
  // TODO(review): posible código muerto: published since the original version, no screen reads it (hitMark is what is used)
  hit: boolean;
  /** the hit marker is on screen */
  hitMark: boolean;
  // TODO(review): posible código muerto: published since the original version, no screen reads it
  hitHead: boolean;
  /** 1 → 0 after taking damage */
  damage: number;
  respawnIn: number;
  // TODO(review): posible código muerto: the death screen takes the killer from the kill event instead
  killerName: string;
  players: HudPlayer[];
  spread: number;
  aim: number;
  dmgDirs: DamageMark[];
  // TODO(review): posible código muerto: the HUD receives the mode as a prop
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
