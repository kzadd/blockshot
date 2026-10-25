// End of match: vote for the next map and mode, and balanced teams for the new match.
import {
  MAPS,
  MODES,
  MODE_BY_ID,
  VOTE_OPTIONS,
  canSwitchTeam,
  getColliders,
  getMap,
  isTeamMode,
  type VoteOption,
} from '@blockshot/shared';
import { createMode } from '../modes';
import type { Player } from '../players/player';
import { notice, roomInfo, type Room } from '../rooms/room';

const pick = <T>(list: T[]): T => list[Math.floor(Math.random() * list.length)]!;

/** VOTE_OPTIONS map + mode pairs on different maps, none of them the one just played. */
export function voteOptions(room: Room): VoteOption[] {
  const maps = MAPS.map((m) => m.id).sort(() => Math.random() - 0.5);
  return maps.slice(0, VOTE_OPTIONS).map((mapId) => ({
    mapId,
    mode: pick(MODES.map((m) => m.id).filter((mode) => mapId !== room.map.id || mode !== room.modeId)),
  }));
}

export function startVote(room: Room): VoteOption[] {
  const options = voteOptions(room);
  room.vote = { options, choice: new Map() };
  return options;
}

export function voteCounts(room: Room): number[] {
  const counts = (room.vote?.options ?? []).map(() => 0);
  for (const [id, i] of room.vote?.choice ?? []) if (room.players.has(id)) counts[i]!++;
  return counts;
}

export function castVote(room: Room, playerId: string, i: number): void {
  if (!room.vote?.options[i]) return;
  room.vote.choice.set(playerId, i);
  room.channel.broadcast('vote', [voteCounts(room)]);
}

/** The most voted option (a tie: one of them at random). Nobody voted: null, the room stays as it is. */
export function voteWinner(room: Room): VoteOption | null {
  if (!room.vote?.options.length) return null;
  const counts = voteCounts(room);
  const best = Math.max(...counts);
  if (best === 0) return null;
  return room.vote.options[pick(counts.flatMap((c, i) => (c === best ? [i] : [])))]!;
}

/** Moves the room to another map and mode (everybody is dead between matches). */
export function applyOption(room: Room, opt: VoteOption): void {
  room.map = getMap(opt.mapId, room.map.size);
  room.colliders = getColliders(room.map);
  room.modeId = opt.mode;
  room.mode = createMode(opt.mode, room);
  room.scoreLimit = MODE_BY_ID[opt.mode].def;
  for (const p of room.players.values()) p.team = room.mode.initialTeam(room);
  room.channel.broadcast('room:changed', [roomInfo(room)]);
  room.lobbyChanged();
  notice(room, `Siguiente partida: ${room.map.name} · ${MODE_BY_ID[opt.mode].name}`);
}

/** How well a player did last match (for balancing). */
export const rating = (p: Player): number => p.kills - p.deaths + p.caps * 3;

/**
 * Team modes: deals the players out by last match's rating, best first, in a snake (1 2 2 1 1 2 2 1…), so both
 * teams get strong and weak players. `ratings` must be read before the match stats are cleared.
 */
export function balanceTeams(room: Room, ratings: Map<string, number>): void {
  if (!isTeamMode(room.modeId) || !canSwitchTeam(room.modeId) || room.players.size < 2) return;
  const sorted = [...room.players.values()].sort((a, b) => (ratings.get(b.id) ?? 0) - (ratings.get(a.id) ?? 0));
  sorted.forEach((p, i) => {
    p.team = i % 4 === 0 || i % 4 === 3 ? 1 : 2;
  });
  notice(room, 'Equipos equilibrados según la última partida');
}
