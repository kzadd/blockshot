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
};

export const MODE_SUB: Record<ModeId, string> = {
  ffa: 'Cada uno por su cuenta',
  teams: 'Rojo contra azul',
  ctf: 'Roba la bandera rival',
  gungame: 'Un arma nueva por baja',
  kc: 'Recoge las placas',
  infect: 'Huye de los del cuchillo',
  dom: 'Controla las zonas',
  rounds: 'El último en pie gana',
};

export const MODE_HOW: Record<ModeId, string> = {
  ffa: 'Gana quien llegue antes al límite de bajas.',
  teams: 'Las bajas suman para tu equipo. El reparto se equilibra solo.',
  ctf: 'Lleva la bandera rival a tu base con la tuya en casa.',
  gungame: 'Cada baja te da el arma siguiente; gana quien termine la escalera.',
  kc: 'Una baja solo cuenta al recoger su placa.',
  infect: 'Los infectados solo llevan cuchillo y contagian al matar.',
  dom: 'Cada zona que controlas suma puntos cada segundo.',
  rounds: 'Una vida por ronda: gana el equipo que quede en pie.',
};
