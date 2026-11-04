// Rounds: Red against Blue (1 v 1 works too) with no respawning during a round. The last team standing wins
// the round; when time runs out, the team with more players alive (then more health) wins it. First to the
// room's limit of rounds wins the match. While a team is empty the game waits and anyone may respawn.
import type { SideTeam } from '@blockshot/shared';
import { smallerTeam } from '../players/teams';
import type { Room } from '../rooms/room';
import type { GameMode } from './gameMode';
import { endTeamRound, roundPhases, teamsReady } from './roundPhases';
import { teamSideSpawns } from './scoring';

export function createRounds(room: Room): GameMode {
  const members = (t: SideTeam) => [...room.players.values()].filter((p) => p.team === t);
  const alive = (t: SideTeam) => members(t).filter((p) => p.alive);

  /** Time is up: more players alive wins, then more health left. */
  function timeUpWinner(): SideTeam | null {
    const score = (t: SideTeam) => alive(t).length * 1000 + alive(t).reduce((n, p) => n + p.hp, 0);
    const red = score(1);
    const blue = score(2);
    return red === blue ? null : red > blue ? 1 : 2;
  }

  const phases = roundPhases(room, {
    ready: () => teamsReady(room),
    timeUp: (now) => endTeamRound(room, phases, timeUpWinner(), now),
  });

  /** A team with nobody alive (killed, or its last one left) loses the round. */
  function checkRound(now: number): void {
    if (!phases.playing()) return;
    const red = alive(1).length;
    const blue = alive(2).length;
    if (red && blue) return;
    endTeamRound(room, phases, red ? 1 : blue ? 2 : null, now);
  }

  return {
    streakRewards: false,
    initialTeam: smallerTeam,
    filterSpawns: teamSideSpawns,
    canSpawn: () => !phases.playing(),
    teamsLocked: () => phases.playing(),
    onKill: () => checkRound(Date.now()),
    onDeath: () => checkRound(Date.now()),
    tick(_room, now) {
      phases.tick(now);
      checkRound(now);
    },
    onMatchReset: () => phases.reset(),
    snapshot: (_room, now) => ({ rd: phases.snapshot(now) }),
  };
}
