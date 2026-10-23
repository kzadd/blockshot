import type { FlagSnapshot, InfectSnapshot, SideTeam, Spawn, TagSnapshot, Team, Weapon } from '@blockshot/shared';
import type { Player } from '../players/player';
import type { Room } from '../rooms/room';

/** Mode-specific parts of a state snapshot. */
export interface ModeSnapshot {
  fl: Record<SideTeam, FlagSnapshot> | null;
  tg: TagSnapshot[] | null;
  inf: InfectSnapshot | null;
}

/**
 * Strategy for the rules of a game mode. One instance per room: it may keep its own state
 * (flags, tags, infection). Every hook is optional except the kill rule and the team for newcomers.
 */
export interface GameMode {
  /** team of a player joining the room (0 = none) */
  initialTeam(room: Room): Team;
  /** score and win checks after a kill (the kill event has already been broadcast) */
  onKill(room: Room, shooter: Player, victim: Player, weapon: Weapon): void;
  /** whether kill streaks give rewards (radar, armor) */
  readonly streakRewards: boolean;
  /** called every server tick while the match is running */
  tick?(room: Room, now: number): void;
  /** restrict where a player may spawn */
  filterSpawns?(room: Room, player: Player, spawns: Spawn[]): Spawn[];
  /** walking speed multiplier for a player (infected are faster) */
  speedFactor?(player: Player): number;
  /** max hp multiplier for a player (infected are tougher) */
  hpFactor?(player: Player): number;
  /** reset mode state and teams when a new match starts */
  onMatchReset?(room: Room): void;
  /** extra data for the snapshot */
  snapshot?(room: Room, now: number): Partial<ModeSnapshot>;
}
