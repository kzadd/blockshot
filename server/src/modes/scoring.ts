import { TEAMS, type SideTeam } from '@blockshot/shared';
import { endMatch } from '../match/match';
import type { Room } from '../rooms/room';

/** Adds a point to a team and ends the match if it reached the limit. */
export function scoreTeam(room: Room, team: SideTeam): void {
  room.teamScore[team]++;
  if (room.teamScore[team] >= room.scoreLimit) endMatch(room, `Equipo ${TEAMS[team].name}`, team);
}

export const asSide = (team: number): SideTeam | null => (team === 1 || team === 2 ? team : null);
