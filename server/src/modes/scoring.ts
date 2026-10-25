import { TEAMS, type SideTeam, type Spawn } from '@blockshot/shared';
import type { Player } from '../players/player';
import { endMatch } from '../match/match';
import type { Room } from '../rooms/room';

/** Adds a point to a team and ends the match if it reached the limit. */
export function scoreTeam(room: Room, team: SideTeam): void {
  room.teamScore[team]++;
  if (room.teamScore[team] >= room.scoreLimit) endMatch(room, `Equipo ${TEAMS[team].name}`, team);
}

/** Each team spawns in its own half (Red west, Blue east). */
export function teamSideSpawns(_room: Room, p: Player, spawns: Spawn[]): Spawn[] {
  if (!p.team) return spawns;
  const mine = spawns.filter((s) => (p.team === 1 ? s[0] < -1 : s[0] > 1));
  return mine.length ? mine : spawns;
}

export const asSide = (team: number): SideTeam | null => (team === 1 || team === 2 ? team : null);
