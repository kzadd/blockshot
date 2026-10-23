// Once 2 players are alive a countdown starts and the first infected (side 2) is picked. Infected only
// carry the knife, have more health and run faster; every survivor they kill joins them. They win when
// nobody is left; survivors win if they last the match minutes.
import { CHAR_BY_ID, INFECT } from '@blockshot/shared';
import { endMatch } from '../match/match';
import { equip } from '../players/loadout';
import type { Player } from '../players/player';
import { notice, type Room } from '../rooms/room';
import type { GameMode } from './gameMode';

const MIN_PLAYERS = 2;
const MS_PER_MINUTE = 60000;
/** snapshot value while waiting for enough players */
const WAITING = -1;

interface InfectionState {
  started: boolean;
  pickAt: number;
  endAt: number;
}
const newState = (): InfectionState => ({ started: false, pickAt: 0, endAt: 0 });

export function createInfected(room: Room): GameMode {
  let state = newState();

  function infect(p: Player): void {
    p.team = 2;
    p.streak = 0;
    if (!p.alive || !p.characterId) return;
    equip(room, p);
    p.maxHp = p.hp = Math.round(CHAR_BY_ID[p.characterId].hp * INFECT.hp);
    room.channel.to(p.id, 'loadout', [{ level: p.level, team: p.team }]);
  }

  function waitForFirstInfected(now: number): void {
    const alive = [...room.players.values()].filter((p) => p.alive);
    if (alive.length < MIN_PLAYERS) {
      state.pickAt = 0;
      return;
    }
    if (!state.pickAt) {
      state.pickAt = now + INFECT.pickDelay;
      notice(room, `La infección empieza en ${INFECT.pickDelay / 1000} s`);
    }
    if (now < state.pickAt) return;
    const first = alive[Math.floor(Math.random() * alive.length)]!;
    infect(first);
    Object.assign(state, { started: true, endAt: now + room.scoreLimit * MS_PER_MINUTE });
    notice(room, `¡${first.name} es el primer infectado! Corred`);
    room.channel.broadcast('flag', [{ type: 'capture' }]); // same sound cue as a flag capture
  }

  return {
    streakRewards: false,
    initialTeam: () => (state.started ? 2 : 1),
    hpFactor: (p) => (p.team === 2 ? INFECT.hp : 1),
    onKill(_room, shooter, victim) {
      if (victim.team !== 1 || shooter.team !== 2) return;
      victim.team = 2;
      notice(room, `${victim.name} ha sido infectado`);
    },
    tick(_room, now) {
      if (!state.started) return waitForFirstInfected(now);
      const ps = [...room.players.values()];
      const survivors = ps.filter((p) => p.team === 1).length;
      const infected = ps.filter((p) => p.team === 2).length;
      if (!infected) {
        // The infected left the room: pick another one
        state = newState();
        notice(room, 'No quedan infectados: se elige otro');
      } else if (!survivors) endMatch(room, 'Los infectados', 2);
      else if (now >= state.endAt) endMatch(room, 'Los supervivientes', 1);
    },
    onMatchReset() {
      state = newState();
      for (const p of room.players.values()) p.team = 1;
    },
    snapshot: (_room, now) => ({
      inf: {
        st: state.started ? 1 : 0,
        t: state.started ? state.endAt - now : state.pickAt ? state.pickAt - now : WAITING,
      },
    }),
  };
}
