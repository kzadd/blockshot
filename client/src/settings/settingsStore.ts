import { useSyncExternalStore } from 'react';

// Player settings: saved in this browser and applied immediately
export type CrosshairStyle = 'cross' | 'crossdot' | 'dot' | 'circle' | 't' | 'x';
export type ColorblindMode = 'off' | 'rg' | 'by';
/** Graphics quality: baja for integrated graphics (default), alta adds antialias, soft shadows and full resolution. */
export type Quality = 'baja' | 'alta';

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
  quality: Quality;
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
  quality: 'baja',
  // Valorant-like: thin, short and steady, so it never hides a far target
  crosshair: { style: 'cross', color: '#ffffff', size: 4, thickness: 1, gap: 3, outline: true, dynamic: false },
};

const KEY = 'blockshot:settings';
const OLD_DEFAULT_CROSSHAIR = JSON.stringify({
  style: 'cross',
  color: '#ffffff',
  size: 6,
  thickness: 2,
  gap: 4,
  outline: true,
  dynamic: true,
});
let state: Settings = load();
const listeners = new Set<(s: Settings) => void>();

function load(): Settings {
  try {
    const s = (JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Settings> | null) ?? {};
    // A crosshair saved as the old default (never customised) takes the new one
    if (JSON.stringify(s.crosshair) === OLD_DEFAULT_CROSSHAIR) delete s.crosshair;
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
