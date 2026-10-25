// Rounds: Red against Blue (1 v 1 works too) with no respawning during a round. The last team standing wins
// the round; when time runs out, the team with more players alive (then more health) wins it. First to the
// room's limit of rounds wins the match. While a team is empty the game waits and anyone may respawn.
import { CHAR_BY_ID, ROUNDS, TEAMS, type RoundSnapshot, type SideTeam } from '@blockshot/shared';
import { spawnPlayer } from '../players/spawn';
import { smallerTeam } from '../players/teams';
import { notice, type Room } from '../rooms/room';
import type { GameMode } from './gameMode';
import { scoreTeam, teamSideSpawns } from './scoring';

type Phase = 'wait' | 'play' | 'break';
const PHASE_CODE: Record<Phase, RoundSnapshot['p']> = { wait: 0, play: 1, break: 2 };

export function createRounds(room: Room): GameMode {
  let phase: Phase = 'wait';
  let round = 0;
  /** end of the round (play) or of the break before the next one */
  let until = 0;

  const members = (t: SideTeam) => [...room.players.values()].filter((p) => p.team === t);
  const alive = (t: SideTeam) => members(t).filter((p) => p.alive);

  function startRound(now: number): void {
    phase = 'play';
    round++;
    until = now + ROUNDS.roundMs;
    // Everybody back at their side with full health, at once
    for (const p of room.players.values()) {
      if (p.characterId) spawnPlayer(room, p, CHAR_BY_ID[p.characterId], p.skin, p.color);
    }
    notice(room, `Ronda ${round}: ¡a por ellos!`);
  }

  function endRound(winner: SideTeam | null, now: number): void {
    phase = 'break';
    until = now + ROUNDS.breakMs;
    if (!winner) {
      notice(room, `Ronda ${round}: empate`);
      return;
    }
    notice(room, `Equipo ${TEAMS[winner].name} gana la ronda ${round}`);
    room.channel.broadcast('flag', [{ type: 'capture', team: winner }]); // same cue as a flag capture
    scoreTeam(room, winner);
  }

  /** Time is up: more players alive wins, then more health left. */
  function timeUpWinner(): SideTeam | null {
    const score = (t: SideTeam) => alive(t).length * 1000 + alive(t).reduce((n, p) => n + p.hp, 0);
    const red = score(1);
    const blue = score(2);
    return red === blue ? null : red > blue ? 1 : 2;
  }

  return {
    streakRewards: false,
    initialTeam: smallerTeam,
    filterSpawns: teamSideSpawns,
    canSpawn: () => phase !== 'play',
    onKill(_room, _shooter, _victim) {
      if (phase !== 'play') return;
      const red = alive(1).length;
      const blue = alive(2).length;
      if (red && blue) return;
      endRound(red ? 1 : blue ? 2 : null, Date.now());
    },
    tick(_room, now) {
      const ready = members(1).length > 0 && members(2).length > 0;
      if (!ready) {
        if (phase !== 'wait') notice(room, 'Falta un rival: esperando a que entre alguien');
        phase = 'wait';
        return;
      }
      if (phase === 'wait') {
        phase = 'break';
        until = now + ROUNDS.breakMs;
      } else if (phase === 'break' && now >= until) startRound(now);
      else if (phase === 'play' && now >= until) endRound(timeUpWinner(), now);
    },
    onMatchReset() {
      phase = 'wait';
      round = 0;
      until = 0;
    },
    snapshot: (_room, now) => ({ rd: { p: PHASE_CODE[phase], n: round, t: Math.max(0, until - now) } }),
  };
}
