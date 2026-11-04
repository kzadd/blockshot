// Último en pie (Last Man Standing): Rounds, but everyone for himself. No respawning during a round; the last
// one alive wins it (a point, shown in the scoreboard's own column). When time runs out, whoever has the most
// health left wins it (a tie: nobody). First to the room's limit of rounds wins the match.
import type { Player } from '../players/player';
import { endMatch } from '../match/match';
import { notice, type Room } from '../rooms/room';
import type { GameMode } from './gameMode';
import { roundPhases } from './roundPhases';

const MIN_PLAYERS = 2;

export function createLastManStanding(room: Room): GameMode {
  const alive = () => [...room.players.values()].filter((p) => p.alive);

  function endRound(winner: Player | null, now: number): void {
    phases.end(now);
    const round = phases.round();
    if (!winner) return notice(room, `Ronda ${round}: nadie en pie`);
    winner.caps++;
    room.channel.broadcast('flag', [{ type: 'capture' }]); // same cue as a flag capture
    if (winner.caps >= room.scoreLimit) return endMatch(room, winner.name);
    notice(room, `${winner.name} gana la ronda ${round} (${winner.caps} de ${room.scoreLimit})`);
  }

  /** Time is up: the most health left wins. */
  function timeUp(now: number): void {
    const [first, second] = alive().sort((a, b) => b.hp - a.hp);
    endRound(first && (!second || first.hp > second.hp) ? first : null, now);
  }

  // Only players who picked a class (out of the character screen) count: the others would never spawn
  const ready = () => [...room.players.values()].filter((p) => p.cls).length >= MIN_PLAYERS;
  const phases = roundPhases(room, { ready, timeUp });

  /** One left standing (the others killed, or gone): he wins the round. */
  function checkRound(now: number): void {
    if (!phases.playing()) return;
    const left = alive();
    if (left.length <= 1) endRound(left[0] ?? null, now);
  }

  return {
    streakRewards: false,
    initialTeam: () => 0,
    canSpawn: () => !phases.playing(),
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
