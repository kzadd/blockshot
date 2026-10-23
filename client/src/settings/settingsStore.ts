import { useSyncExternalStore } from 'react';

// Player settings: saved in this browser and applied immediately
export type CrosshairStyle = 'cross' | 'crossdot' | 'dot' | 'circle' | 't' | 'x';
export type ColorblindMode = 'off' | 'rg' | 'by';

export const CROSSHAIRS: { id: CrosshairStyle; name: string }[] = [
  { id: 'cross', name: 'Cruz' },
  { id: 'crossdot', name: 'Cruz y punto' },
  { id: 'dot', name: 'Punto' },
  { id: 'circle', name: 'Círculo' },
  { id: 't', name: 'T' },
  { id: 'x', name: 'Aspa' },
];
export const CROSSHAIR_COLORS = ['#ffffff', '#5ee07a', '#ffc93c', '#4ee6ff', '#ff4fd8', '#ff4d4d'];

export interface CrosshairConfig {
  style: CrosshairStyle;
  color: string;
  size: number;
  thickness: number;
  gap: number;
  outline: boolean;
  dynamic: boolean;
}

export interface Settings {
  /** mouse sensitivity multiplier */
  sens: number;
  /** while aiming: 1 = feels the same as hip fire; lower = slower */
  adsSens: number;
  /** field of view in degrees */
  fov: number;
  volume: number;
  /** soft HUD and camera shake when taking damage */
  shake: boolean;
  colorblind: ColorblindMode;
  crosshair: CrosshairConfig;
}

export type SettingsPatch = Partial<Omit<Settings, 'crosshair'>> & { crosshair?: Partial<CrosshairConfig> };

export const DEFAULTS: Settings = {
  sens: 1,
  adsSens: 0.9,
  fov: 80,
  volume: 0.8,
  shake: true,
  colorblind: 'off',
  crosshair: { style: 'cross', color: '#ffffff', size: 8, thickness: 2, gap: 5, outline: true, dynamic: true },
};

const KEY = 'blockshot:settings';
let state: Settings = load();
const listeners = new Set<(s: Settings) => void>();

function load(): Settings {
  try {
    const s = (JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Settings> | null) ?? {};
    return { ...DEFAULTS, ...s, crosshair: { ...DEFAULTS.crosshair, ...s.crosshair } };
  } catch {
    return DEFAULTS;
  }
}

export const getSettings = (): Settings => state;

export function setSettings(patch: SettingsPatch): void {
  state = { ...state, ...patch, crosshair: { ...state.crosshair, ...patch.crosshair } };
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {}
  for (const fn of listeners) fn(state);
}

export function subscribe(fn: (s: Settings) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const useSettings = (): Settings => useSyncExternalStore(subscribe, getSettings);
