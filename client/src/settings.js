import { useSyncExternalStore } from 'react';

// Ajustes del jugador: se guardan en este navegador y se aplican al momento
export const CROSSHAIRS = [
  { id: 'cross', name: 'Cruz' },
  { id: 'crossdot', name: 'Cruz y punto' },
  { id: 'dot', name: 'Punto' },
  { id: 'circle', name: 'Círculo' },
  { id: 't', name: 'T' },
  { id: 'x', name: 'Aspa' },
];
export const CROSSHAIR_COLORS = ['#ffffff', '#5ee07a', '#ffc93c', '#4ee6ff', '#ff4fd8', '#ff4d4d'];

export const DEFAULTS = {
  sens: 1, // multiplicador de sensibilidad del ratón
  fov: 80, // campo de visión en grados
  volume: 0.8,
  shake: true, // sacudida suave del HUD y la cámara al recibir daño
  colorblind: 'off', // modo daltónico: 'off' | 'rg' | 'by' (ver palette.js)
  crosshair: { style: 'cross', color: '#ffffff', size: 8, thickness: 2, gap: 5, outline: true, dynamic: true },
};

const KEY = 'blockshot:settings';
let state = load();
const listeners = new Set();

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY)) || {};
    return { ...DEFAULTS, ...s, crosshair: { ...DEFAULTS.crosshair, ...s.crosshair } };
  } catch {
    return DEFAULTS;
  }
}

export const getSettings = () => state;

export function setSettings(patch) {
  state = { ...state, ...patch, crosshair: { ...state.crosshair, ...patch.crosshair } };
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {}
  for (const fn of listeners) fn(state);
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const useSettings = () => useSyncExternalStore(subscribe, getSettings);
