// How each mode is presented (texts, scoreboard column, top bar). The rules live on the server; this table
// is the client counterpart: adding a mode means adding one entry here.
import { MODE_BY_ID, gunLadder, type ModeId } from '@blockshot/shared';

/** Which top-of-screen widget the mode uses. */
export type TopBar = 'leader' | 'teams' | 'ladder' | 'infect';

export interface ModeUi {
  /** subtitle on the lobby button */
  sub: string;
  /** "to win" hint while creating the room */
  hint: (limit: number) => string;
  /** goal line of the scoreboard */
  goal: (limit: number) => string;
  /** title of the per-player points column (captures, tags), if any */
  points: string | null;
  top: TopBar;
}

const units = (id: ModeId, limit: number) => `${limit} ${MODE_BY_ID[id].unit}`;

export const MODE_UI: Record<ModeId, ModeUi> = {
  ffa: {
    sub: 'Cada uno por su cuenta',
    hint: (n) => units('ffa', n),
    goal: (n) => `gana quien llegue a ${n} bajas`,
    points: null,
    top: 'leader',
  },
  teams: {
    sub: 'Rojo contra Azul',
    hint: (n) => `${units('teams', n)} del equipo`,
    goal: (n) => `gana el primer equipo en llegar a ${n} bajas`,
    points: null,
    top: 'teams',
  },
  ctf: {
    sub: 'Roba la bandera rival',
    hint: (n) => units('ctf', n),
    goal: (n) => `gana el primer equipo en hacer ${n} capturas`,
    points: 'Capturas',
    top: 'teams',
  },
  gungame: {
    sub: 'Un arma nueva por baja',
    hint: (n) => units('gungame', n),
    goal: (n) => `gana quien elimine con el cuchillo (${gunLadder(n).length} armas)`,
    points: null,
    top: 'ladder',
  },
  kc: {
    sub: 'Recoge las placas',
    hint: (n) => `${units('kc', n)} del equipo`,
    goal: (n) => `gana el primer equipo en recoger ${n} placas`,
    points: 'Placas',
    top: 'teams',
  },
  infect: {
    sub: 'Huye de los del cuchillo',
    hint: (n) => `Aguantar ${n} min`,
    goal: (n) => `los supervivientes ganan si aguantan ${n} min`,
    points: null,
    top: 'infect',
  },
  dom: {
    sub: 'Controla las zonas',
    hint: (n) => `${units('dom', n)} del equipo`,
    goal: (n) => `gana el primer equipo en llegar a ${n} puntos (1 por zona cada 2 s)`,
    points: 'Capturas',
    top: 'teams',
  },
  rounds: {
    sub: 'El último en pie gana',
    hint: (n) => units('rounds', n),
    goal: (n) => `gana el primer equipo en ganar ${n} rondas`,
    points: null,
    top: 'teams',
  },
  race: {
    sub: 'Pista de obstáculos con armas',
    hint: (n) => units('race', n),
    goal: (n) => `gana quien gane ${n} carreras (si caes o te matan, vuelves a tu punto de control)`,
    points: 'Carreras',
    top: 'leader',
  },
  lms: {
    sub: 'Una vida, todos contra todos',
    hint: (n) => units('lms', n),
    goal: (n) => `gana quien gane ${n} rondas (una vida por ronda: gana la ronda el último en pie)`,
    points: 'Rondas',
    top: 'leader',
  },
  insta: {
    sub: 'Railgun: un disparo, una baja',
    hint: (n) => units('insta', n),
    goal: (n) => `gana quien llegue a ${n} bajas (la railgun mata de un disparo)`,
    points: null,
    top: 'leader',
  },
  freeze: {
    sub: 'Descongela a tu equipo',
    hint: (n) => units('freeze', n),
    goal: (n) => `gana el primer equipo en ganar ${n} rondas (congela a todo el equipo rival)`,
    points: 'Rescates',
    top: 'teams',
  },
  bomb: {
    sub: 'Planta la bomba o desactívala',
    hint: (n) => units('bomb', n),
    goal: (n) => `gana el primer equipo en ganar ${n} rondas (Rojo ataca, Azul defiende)`,
    points: 'Bombas',
    top: 'teams',
  },
};
