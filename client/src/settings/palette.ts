import { getSettings, subscribe, type ColorblindMode, type Settings } from './settingsStore';

// Colourblind modes: ally, enemy, team and health bar colours.
// Red-green swaps green/red for blue/orange; blue-yellow uses turquoise/pink.
export const COLORBLIND: { id: ColorblindMode; name: string; help?: string }[] = [
  { id: 'off', name: 'Desactivado', help: 'Colores normales' },
  { id: 'rg', name: 'Rojo-verde', help: 'Protanopía y deuteranopía (lo más común)' },
  { id: 'by', name: 'Azul-amarillo', help: 'Tritanopía' },
];

interface Palette {
  ally: string;
  enemy: string;
  team: Record<1 | 2, string>;
  teamTxt: Record<1 | 2, string>;
  /** high, mid, low */
  hp: [string, string, string];
}

const PALETTES: Record<ColorblindMode, Palette> = {
  off: {
    ally: '#5ee07a',
    enemy: '#ff5a4d',
    team: { 1: '#ff5a4d', 2: '#4da3ff' },
    teamTxt: { 1: '#ff7b70', 2: '#6db5ff' },
    hp: ['#5ee07a', '#ffc93c', '#ff4d4d'],
  },
  rg: {
    ally: '#4da3ff',
    enemy: '#ff9f1c',
    team: { 1: '#ff9f1c', 2: '#4da3ff' },
    teamTxt: { 1: '#ffb84d', 2: '#6db5ff' },
    hp: ['#4da3ff', '#f7f9fc', '#ff9f1c'],
  },
  by: {
    ally: '#3fe0d0',
    enemy: '#ff4d8a',
    team: { 1: '#ff4d8a', 2: '#3fe0d0' },
    teamTxt: { 1: '#ff7aa8', 2: '#6ff0e3' },
    hp: ['#3fe0d0', '#f7f9fc', '#ff4d8a'],
  },
};

const HP_HIGH = 0.5;
const HP_LOW = 0.25;

export const palette = (st: Settings = getSettings()): Palette => PALETTES[st.colorblind] ?? PALETTES.off;
export function teamColor(t: number): string | undefined;
export function teamColor(t: number, fallback: string): string;
export function teamColor(t: number, fallback?: string): string | undefined {
  return palette().team[t as 1 | 2] ?? fallback;
}
export const hpColor = (f: number): string => {
  const [hi, mid, low] = palette().hp;
  return f > HP_HIGH ? hi : f > HP_LOW ? mid : low;
};

// CSS theme variables (used by the HUD, the scoreboard and the menus)
function applyCss(st: Settings): void {
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
