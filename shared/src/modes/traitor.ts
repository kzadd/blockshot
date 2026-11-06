// Traidores: the numbers of the hidden-traitor rounds. The rules live in server/src/modes/traitor.ts.

/**
 * `perTraitor`: one traitor per that many players (at least one); `minPlayers` to start a round; `roundMs` per round
 * (meetings pause it). `bodyRadius`: how close (m) to a body key F examines it. Bodies stay `bodyMs`. A meeting lasts
 * `meetingMs` at most; an emergency one (one per player and round) waits `calmMs` from the round start or the last
 * meeting. Points at the end of a round: `innocentWin` to every innocent when they win, `traitorWin` to every traitor
 * (fewer, harder); an innocent loses `teamKill` per innocent he killed that round.
 */
export const TRAITOR = {
  perTraitor: 5,
  minPlayers: 3,
  roundMs: 180000,
  bodyRadius: 2.5,
  bodyMs: 90000,
  meetingMs: 30000,
  calmMs: 20000,
  innocentWin: 1,
  traitorWin: 2,
  teamKill: 1,
};

/** Traitors in a round of `players`. */
export const traitorCount = (players: number): number => Math.max(1, Math.floor(players / TRAITOR.perTraitor));

/** Kill feed / death screen cause of a hidden kill: the victim does not learn who it was. */
export const HIDDEN_KILLER = 'Desconocido';
/** Kill feed cause of an expulsion by vote. */
export const EXPELLED = 'Expulsado';
