// Once 2 players are alive a countdown starts and the first infected (side 2, one per INFECT.perInfected players)
// are picked: the Paciente cero, bigger and tougher, who screams with key F. Infected only carry the knife, run
// faster or are tougher by their type (ZOMBIES: Corredor, Tanque, Saltador, picked on the death screen) and respawn
// sooner; every survivor who dies (killed, fallen or camping) joins them. Survivors board up gaps with barricades
// (key F) and every so often the lights go out (BLACKOUT). The infected win when nobody is left; survivors win if
// they last the match minutes. In the last INFECT.revealMs the infected see every survivor. No power weapons on the
// map; only the last survivor gets one, with extra health and armour, and everybody sees him (LAST_STAND).
import {
  BARRICADE,
  BLACKOUT,
  BODY,
  INFECT,
  LAST_STAND,
  PLAYER,
  POWER_WEAPONS,
  SCREAM,
  WEAPONS,
  ZOMBIES,
  ZOMBIE_TYPES,
  castShot,
  round2,
  type Vec3,
} from '@blockshot/shared';
import { placeWall } from '../combat/abilities';
import { endMatch } from '../match/match';
import { equip, givePower } from '../players/loadout';
import type { Player } from '../players/player';
import { notice, type Room } from '../rooms/room';
import type { GameMode } from './gameMode';

const MIN_PLAYERS = 2;
const MS_PER_MINUTE = 60000;
/** snapshot value while waiting for enough players */
const WAITING = -1;
/** Cooldowns go out rounded to this (the HUD counts whole seconds). */
const COOLDOWN_STEP_MS = 100;

interface InfectionState {
  started: boolean;
  pickAt: number;
  endAt: number;
  /** the last survivor was announced (and armed): who and when */
  last: boolean;
  lastId: string | null;
  lastAt: number;
  /** when the next blackout starts, and whether it has been warned */
  darkAt: number;
  warned: boolean;
}
const newState = (): InfectionState => ({
  started: false,
  pickAt: 0,
  endAt: 0,
  last: false,
  lastId: null,
  lastAt: 0,
  darkAt: 0,
  warned: false,
});

export function createInfected(room: Room): GameMode {
  let state = newState();

  const hpFactor = (p: Player): number =>
    p.team === 2 ? (p.zombie ? ZOMBIES[p.zombie].hp : INFECT.hp) : p.id === state.lastId ? LAST_STAND.hp : 1;
  const speedFactor = (p: Player, now: number): number =>
    p.team === 2 ? (p.zombie ? ZOMBIES[p.zombie].speed : INFECT.speed) : now < p.slowUntil ? SCREAM.slow : 1;

  /** The first infected, picked alive: each one is a Paciente cero for the whole match. */
  function infect(p: Player): void {
    p.team = 2;
    p.streak = 0;
    p.zombie = 'alpha';
    if (!p.alive || !p.cls) return;
    equip(room, p);
    p.maxHp = p.hp = Math.round(BODY.hp * hpFactor(p));
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
    const first = alive.sort(() => Math.random() - 0.5).slice(0, Math.ceil(alive.length / INFECT.perInfected));
    first.forEach(infect);
    Object.assign(state, {
      started: true,
      endAt: now + room.scoreLimit * MS_PER_MINUTE,
      darkAt: now + BLACKOUT.firstMs,
    });
    const names = first.map((p) => p.name).join(', ');
    notice(
      room,
      first.length > 1 ? `¡${names} son los pacientes cero! Corran` : `¡${names} es el paciente cero! Corran`,
    );
    room.channel.broadcast('flag', [{ type: 'capture' }]); // same sound cue as a flag capture
  }

  /** One survivor left against several infected: everybody is told and sees him; he gets a power weapon, more health
   * and armour. */
  function lastSurvivor(p: Player, now: number): void {
    Object.assign(state, { last: true, lastId: p.id, lastAt: now });
    notice(room, `¡${p.name} es el último superviviente!`);
    if (!p.alive || !p.cls) return;
    p.maxHp = p.hp = Math.round(BODY.hp * LAST_STAND.hp);
    p.armor = LAST_STAND.armor;
    const id = POWER_WEAPONS[Math.floor(Math.random() * POWER_WEAPONS.length)]!;
    givePower(p, id);
    room.channel.to(p.id, 'notice', [`Tienes la ${WEAPONS[id].name}, más vida y blindaje: ¡aguanta!`]);
    room.channel.to(p.id, 'pickup', ['power']);
  }

  /** Paciente cero's scream: survivors in sight within SCREAM.radius are slowed (and their screen shakes). */
  function scream(p: Player, now: number): void {
    const eye: Vec3 = [p.x, p.y + PLAYER.eye, p.z];
    const hit: string[] = [];
    for (const q of room.players.values()) {
      if (!q.alive || q.team !== 1) continue;
      const to: Vec3 = [q.x - eye[0], q.y + PLAYER.eye - eye[1], q.z - eye[2]];
      const dist = Math.hypot(...to);
      if (dist > SCREAM.radius) continue;
      if (dist > 0 && castShot(eye, [to[0] / dist, to[1] / dist, to[2] / dist], room.colliders, [], '', dist).hit)
        continue;
      q.slowUntil = now + SCREAM.slowMs;
      hit.push(q.id);
    }
    room.channel.broadcast('scream', [{ id: p.id, at: [round2(p.x), round2(p.y), round2(p.z)], hit }]);
  }

  /** Lights out every BLACKOUT.everyMs, warned BLACKOUT.warnMs before. */
  function blackouts(now: number): void {
    while (now >= state.darkAt + BLACKOUT.darkMs) {
      state.darkAt += BLACKOUT.everyMs;
      state.warned = false;
    }
    if (state.warned || now < state.darkAt - BLACKOUT.warnMs) return;
    state.warned = true;
    notice(room, `¡Apagón en ${BLACKOUT.warnMs / 1000} s!`);
  }

  /** A survivor who dies joins the infected. */
  const turn = (victim: Player) => {
    if (victim.team !== 1) return;
    victim.team = 2;
    notice(room, `${victim.name} ha sido infectado`);
  };

  return {
    streakRewards: false,
    powerWeapons: false,
    initialTeam: () => (state.started ? 2 : 1),
    hpFactor,
    speedFactor: (p) => speedFactor(p, Date.now()),
    // The infected respawn as the type they picked, or the next one in turn; a Paciente cero stays one
    onSpawn(_room, p) {
      p.slowUntil = 0;
      if (p.team !== 2) p.zombie = null;
      else if (p.zombie !== 'alpha') p.zombie = p.zombiePick ?? ZOMBIE_TYPES[p.deaths % ZOMBIE_TYPES.length]!;
    },
    // Key F: a survivor boards up what is in front; the Paciente cero screams
    action(_room, p, _o, d, now) {
      if (now < p.modeAt) return;
      if (p.team === 1) {
        if (!placeWall(room, p, d, now, 'plank')) {
          room.channel.to(p.id, 'notice', ['No hay sitio para la barricada aquí']);
          return;
        }
        p.modeAt = now + BARRICADE.cooldownMs;
      } else if (p.zombie === 'alpha') {
        scream(p, now);
        p.modeAt = now + SCREAM.cooldownMs;
      } else return;
      p.protUntil = 0; // like an ability, it ends spawn protection
    },
    playerSnapshot(p, now) {
      const sf = speedFactor(p, now);
      const keyF = p.team === 1 || p.zombie === 'alpha';
      return {
        ...(p.team === 2 && p.zombie && { zt: p.zombie }),
        ...(sf !== 1 && { sf }),
        ...(keyF && { fc: Math.max(0, Math.ceil((p.modeAt - now) / COOLDOWN_STEP_MS) * COOLDOWN_STEP_MS) }),
      };
    },
    onKill(_room, shooter, victim) {
      if (shooter.team === 2) turn(victim);
    },
    // Fallen into the void, camping or killed by the admin: infected all the same (once the infection started)
    onDeath(_room, victim) {
      if (state.started) turn(victim);
    },
    tick(_room, now) {
      if (!state.started) return waitForFirstInfected(now);
      const ps = [...room.players.values()];
      const left = ps.filter((p) => p.team === 1);
      const survivors = left.length;
      const infected = ps.filter((p) => p.team === 2).length;
      if (survivors === 1 && infected > 1 && !state.last) lastSurvivor(left[0]!, now);
      blackouts(now);
      if (!infected) {
        // The infected left the room: pick another one
        state = newState();
        notice(room, 'No quedan infectados: se elige otro');
      } else if (!survivors) endMatch(room, 'Los infectados', 2);
      else if (now >= state.endAt) endMatch(room, 'Los supervivientes', 1);
    },
    onMatchReset() {
      state = newState();
      for (const p of room.players.values()) Object.assign(p, { team: 1, zombie: null, modeAt: 0, slowUntil: 0 });
    },
    snapshot: (_room, now) => {
      const last = state.lastId && room.players.get(state.lastId)?.team === 1 ? state.lastId : null;
      const dark = state.started && now >= state.darkAt - BLACKOUT.warnMs && now < state.darkAt + BLACKOUT.darkMs;
      return {
        inf: {
          st: state.started ? 1 : 0,
          t: state.started ? state.endAt - now : state.pickAt ? state.pickAt - now : WAITING,
          ...(state.started && state.endAt - now <= INFECT.revealMs && { rv: 1 }),
          ...(last && { ls: last }),
          ...(last && now - state.lastAt < LAST_STAND.bannerMs && { la: 1 }),
          ...(dark && { bo: now < state.darkAt ? 1 : 2 }),
        },
      };
    },
  };
}
