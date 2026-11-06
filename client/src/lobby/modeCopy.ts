// The approved proposal's copy for each mode (.impeccable/mocks/propuesta/proto.js): the subtitle on the mode
// button, the "how to win" line under the map preview and the 24×24 stroke icon (SVG children).
import type { ModeId } from '@blockshot/shared';

export const MODE_ICON: Record<ModeId, string> = {
  ffa: '<circle cx="12" cy="12" r="7"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/>',
  teams:
    '<circle cx="8" cy="8" r="3"/><circle cx="16" cy="8" r="3"/><path d="M2 20c0-3.5 2.7-6 6-6s6 2.5 6 6M10 20c0-3.5 2.7-6 6-6s6 2.5 6 6"/>',
  ctf: '<path d="M5 22V3M5 4h13l-3 4.5L18 13H5"/>',
  gungame: '<path d="M4 20h4v-4h4v-4h4V8h4V4"/>',
  kc: '<rect x="6" y="3" width="12" height="16" rx="2"/><path d="M9 8h6M9 12h6M12 19v3"/>',
  infect: '<circle cx="12" cy="11" r="7"/><path d="M9 10h.01M15 10h.01M9 15c2-1.5 4-1.5 6 0M8 21l1-3M16 21l-1-3"/>',
  dom: '<path d="M12 3l9 5v8l-9 5-9-5V8z"/><circle cx="12" cy="12" r="3"/>',
  rounds: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/>',
  race: '<path d="M5 21V4m0 0h11l-2 4 2 4H5"/>',
  lms: '<circle cx="12" cy="5" r="3"/><path d="M12 8v7M8 11h8M9 21l3-6 3 6M4 21h16"/>',
  insta: '<circle cx="12" cy="12" r="9"/><path d="M13 6l-4 7h4l-2 5"/>',
  freeze: '<path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7M9 4l3 2 3-2M9 20l3-2 3 2"/>',
  bomb: '<circle cx="11" cy="14" r="7"/><path d="M15 9l3-3M18 3v2M21 6h-2M20 4l-1 1"/>',
  traitor: '<path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z"/><circle cx="12" cy="12" r="2.5"/>',
};

export const MODE_SUB: Record<ModeId, string> = {
  ffa: 'Cada uno por su cuenta',
  teams: 'Rojo contra azul',
  ctf: 'Roba la bandera rival',
  gungame: 'Un arma nueva por baja',
  kc: 'Recoge las placas',
  infect: 'Huye de los del cuchillo',
  dom: 'Captura y mantén las zonas',
  rounds: 'Por equipos, sin reaparecer',
  race: 'Recorrido hasta la meta',
  lms: 'Una vida, sin equipos',
  insta: 'Railgun: un disparo, una baja',
  freeze: 'Descongela a tu equipo',
  bomb: 'Planta o desactiva',
  traitor: 'Hay traidores entre ustedes',
};

/** The create form lists the modes in three families, in this order. */
export const MODE_GROUPS: { name: string; modes: ModeId[] }[] = [
  { name: 'Clásicos', modes: ['ffa', 'teams', 'rounds', 'lms'] },
  { name: 'Objetivo', modes: ['ctf', 'dom', 'bomb', 'kc'] },
  { name: 'Especiales', modes: ['gungame', 'insta', 'infect', 'freeze', 'race', 'traitor'] },
];

export const MODE_HOW: Record<ModeId, string> = {
  ffa: 'Todos contra todos; gana el jugador con más eliminaciones y los jugadores reaparecen al morir.',
  teams:
    'Combate por equipos con reaparición; gana el equipo que acumule más bajas. Cada poco la zona se cierra hacia el centro y luego se vuelve a abrir.',
  ctf: 'Captura la bandera del equipo enemigo y llévala hasta tu base, con la tuya en casa.',
  gungame: 'Progresión de armas: cada baja te otorga un arma diferente; gana quien mate con el cuchillo.',
  kc: 'Por equipos: cada baja suelta una placa y solo cuenta al recogerla; tu equipo puede negarla.',
  infect: 'Los infectados solo llevan cuchillo y contagian al matar; los supervivientes ganan si aguantan.',
  dom: 'Controla y mantén los puntos repartidos por el mapa para sumar puntos con el tiempo.',
  rounds:
    'Por equipos y sin reaparición durante la ronda: aniquila a todos los miembros del equipo rival. A los 45 s la zona empieza a cerrarse hacia el centro.',
  race: 'Acrobacias y saltos: llega del punto de inicio al final del recorrido antes que nadie. Derriba a los rivales para mandarlos a su punto de control.',
  lms: 'Todos contra todos, individual y sin reapariciones: la ronda es para el último superviviente. A los 45 s la zona empieza a cerrarse hacia el centro.',
  insta: 'Todos contra todos donde cualquier impacto mata: railgun con munición infinita y cuchillo.',
  freeze:
    'Al eliminar a un rival queda congelado en el sitio hasta que un compañero lo descongele (3 s a su lado). Gana la ronda quien congele a todo el equipo rival.',
  bomb: 'Rojo debe plantar la bomba en A o B; Azul defiende o la desactiva. Una vida por ronda.',
  traitor:
    'Todos parecen del mismo bando, pero hay traidores ocultos. Examinen los cuerpos (F), llamen a reunión y voten a quién expulsar. Una vida por ronda.',
};
