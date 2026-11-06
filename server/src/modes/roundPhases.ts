// The phase machine shared by the round modes (Rondas, Último en pie, Congelados, Bomba): wait for players, a
// break, a round with a time limit, a break… Each mode decides who wins a round and when it ends early.
import { ROUNDS, TEAMS, type RoundSnapshot, type SideTeam } from '@blockshot/shared';
import { spawnPlayer } from '../players/spawn';
import { notice, type Room } from '../rooms/room';
import { scoreTeam } from './scoring';

type Phase = 'wait' | 'play' | 'break';
const PHASE_CODE: Record<Phase, RoundSnapshot['p']> = { wait: 0, play: 1, break: 2 };

export interface RoundHooks {
  /** whether there are enough players to play (otherwise the game waits and anyone may respawn) */
  ready(): boolean;
  /** the round's time ran out: decide it (usually by calling `end`) */
  timeUp(now: number): void;
  /** a round just started (everybody respawned) */
  started?(now: number): void;
  /** ms a round lasts (ROUNDS.roundMs by default) */
  roundMs?: number;
}

export function roundPhases(room: Room, hooks: RoundHooks) {
  let phase: Phase = 'wait';
  let round = 0;
  /** end of the round (play) or of the break before the next one */
  let until = 0;

  function start(now: number): void {
    phase = 'play';
    round++;
    until = now + (hooks.roundMs ?? ROUNDS.roundMs);
    // Everybody back with full health, at once
    for (const p of room.players.values()) {
      if (p.cls) spawnPlayer(room, p);
    }
    notice(room, `Ronda ${round}: ¡a por ellos!`);
    hooks.started?.(now);
  }

  return {
    playing: () => phase === 'play',
    round: () => round,
    /** ms left in the round (or the break) */
    left: (now: number) => Math.max(0, until - now),
    /** Gives the round (or the break) `ms` more: Traidores' meetings stop its clock. */
    extend(ms: number): void {
      until += ms;
    },
    /** The round is over: a break before the next one. */
    end(now: number): void {
      phase = 'break';
      until = now + ROUNDS.breakMs;
    },
    tick(now: number): void {
      if (!hooks.ready()) {
        if (phase !== 'wait') notice(room, 'Falta un rival: esperando a que entre alguien');
        phase = 'wait';
        return;
      }
      if (phase === 'wait') {
        phase = 'break';
        until = now + ROUNDS.breakMs;
      } else if (phase === 'break' && now >= until) start(now);
      else if (phase === 'play' && now >= until) hooks.timeUp(now);
    },
    reset(): void {
      phase = 'wait';
      round = 0;
      until = 0;
    },
    snapshot: (now: number): RoundSnapshot => ({ p: PHASE_CODE[phase], n: round, t: Math.max(0, until - now) }),
  };
}

export type RoundPhases = ReturnType<typeof roundPhases>;

/** Both teams have someone who can play (picked a class): a player on the character screen never spawns. */
export const teamsReady = (room: Room): boolean =>
  ([1, 2] as const).every((t) => [...room.players.values()].some((p) => p.team === t && p.cls));

/** A team round is over: the break starts, and the winner (if any) scores, which may end the match. */
export function endTeamRound(room: Room, phases: RoundPhases, winner: SideTeam | null, now: number): void {
  phases.end(now);
  const round = phases.round();
  if (!winner) {
    notice(room, `Ronda ${round}: empate`);
    return;
  }
  notice(room, `Equipo ${TEAMS[winner].name} gana la ronda ${round}`);
  room.channel.broadcast('flag', [{ type: 'capture', team: winner }]); // same cue as a flag capture
  scoreTeam(room, winner);
}
