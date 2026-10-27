// League tournament in one room (any player starts it): every match is a round of free for all, places give
// points (TOUR_POINTS, 1 just for playing) and after the last round the one with most points is the champion.
import { TOUR_POINTS, type TournamentResult } from '@blockshot/shared';
import { isBot } from '../players/bot';
import { notice, roomInfo, type Room } from '../rooms/room';

export interface Tournament {
  rounds: number;
  /** the round being played (1-based) */
  round: number;
  /** points and round wins by player name */
  table: Map<string, { pts: number; wins: number }>;
  /** id of the player who started it (they and the admin can stop it) */
  by: string;
}

/** Starts a league of `rounds` rounds; the caller moves the room to free for all and restarts the match. */
export function startTournament(room: Room, rounds: number, by = ''): void {
  room.tournament = { rounds, round: 1, table: new Map(), by };
  room.channel.broadcast('room:changed', [roomInfo(room)]);
  const who = room.players.get(by)?.name;
  notice(
    room,
    `¡Empieza el torneo${who ? ` de ${who}` : ''}! ${rounds} rondas de todos contra todos: cada puesto suma puntos`,
  );
}

export function stopTournament(room: Room): void {
  if (!room.tournament) return;
  room.tournament = null;
  room.channel.broadcast('room:changed', [roomInfo(room)]);
  notice(room, 'Se terminó el torneo');
}

/**
 * The match that just ended was a round: points by place (most kills first, fewer deaths on a tie). Returns the
 * standings for the results screen; after the last round it names the champion and the league ends.
 */
export function scoreRound(room: Room): TournamentResult | undefined {
  const t = room.tournament;
  if (!t) return undefined;
  const players = [...room.players.values()]
    .filter((p) => !isBot(p) && Object.keys(p.picks).length > 0)
    .sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
  const gained = new Map<string, number>();
  players.forEach((p, i) => {
    const pts = TOUR_POINTS[i] ?? 1;
    const row = t.table.get(p.name) ?? { pts: 0, wins: 0 };
    row.pts += pts;
    if (i === 0) row.wins++;
    t.table.set(p.name, row);
    gained.set(p.name, pts);
  });
  const rows = [...t.table]
    .map(([name, r]) => ({ name, pts: r.pts, wins: r.wins, gained: gained.get(name) ?? 0 }))
    .sort((a, b) => b.pts - a.pts || b.wins - a.wins);
  const final = t.round >= t.rounds;
  const result: TournamentResult = { round: t.round, rounds: t.rounds, final, rows };
  if (final) {
    room.tournament = null;
    if (rows[0]) notice(room, `🏆 ${rows[0].name} gana el torneo con ${rows[0].pts} puntos`);
  } else t.round++;
  room.channel.broadcast('room:changed', [roomInfo(room)]);
  return result;
}
