import { getSettings, subscribe } from './settings.js';

// Modo daltónico: colores de aliados, enemigos, equipos y barras de vida.
// Rojo-verde cambia el verde/rojo por azul/naranja; azul-amarillo usa turquesa/rosa.
export const COLORBLIND = [
  { id: 'off', name: 'Desactivado' },
  { id: 'rg', name: 'Rojo-verde', help: 'Protanopía y deuteranopía (lo más común)' },
  { id: 'by', name: 'Azul-amarillo', help: 'Tritanopía' },
];

const PALETTES = {
  off: {
    ally: '#5ee07a', enemy: '#ff5a4d',
    team: { 1: '#ff5a4d', 2: '#4da3ff' }, teamTxt: { 1: '#ff7b70', 2: '#6db5ff' },
    hp: ['#5ee07a', '#ffc93c', '#ff4d4d'],
  },
  rg: {
    ally: '#4da3ff', enemy: '#ff9f1c',
    team: { 1: '#ff9f1c', 2: '#4da3ff' }, teamTxt: { 1: '#ffb84d', 2: '#6db5ff' },
    hp: ['#4da3ff', '#f7f9fc', '#ff9f1c'],
  },
  by: {
    ally: '#3fe0d0', enemy: '#ff4d8a',
    team: { 1: '#ff4d8a', 2: '#3fe0d0' }, teamTxt: { 1: '#ff7aa8', 2: '#6ff0e3' },
    hp: ['#3fe0d0', '#f7f9fc', '#ff4d8a'],
  },
};

export const palette = (st = getSettings()) => PALETTES[st.colorblind] || PALETTES.off;
export const teamColor = (t, fallback) => palette().team[t] || fallback;
export const hpColor = (f) => {
  const [hi, mid, low] = palette().hp;
  return f > 0.5 ? hi : f > 0.25 ? mid : low;
};

// Variables CSS del tema (las usan el HUD, el marcador y los menús)
function applyCss(st) {
  const p = palette(st);
  const s = document.documentElement.style;
  s.setProperty('--aliado', p.ally);
  s.setProperty('--enemigo', p.enemy);
  s.setProperty('--eq-rojo', p.team[1]);
  s.setProperty('--eq-rojo-txt', p.teamTxt[1]);
  s.setProperty('--eq-azul', p.team[2]);
  s.setProperty('--eq-azul-txt', p.teamTxt[2]);
}
applyCss(getSettings());
subscribe(applyCss);
