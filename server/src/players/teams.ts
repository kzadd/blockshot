import { isTeamMode, type SideTeam } from '@blockshot/shared';
import type { Room } from '../rooms/room';
import type { Player } from './player';

export const isTeamRoom = (room: Room): boolean => isTeamMode(room.modeId);
export const sameTeam = (room: Room, a: Player, b: Player): boolean => isTeamRoom(room) && a.team === b.team;

/** The team with fewer players (Red on a tie). */
export function smallerTeam(room: Room): SideTeam {
  let red = 0;
  let blue = 0;
  for (const p of room.players.values()) {
    if (p.team === 1) red++;
    else if (p.team === 2) blue++;
  }
  return red <= blue ? 1 : 2;
}
