// Shared UI pieces: live keys, checkbox, slider, block curtain and HUD scale
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';

// ------------------------------------------------------------ Scale (--s)
// Every screen is drawn on a ~1280×720 design canvas scaled to the window. It is left a bit smaller than
// "fill the screen" (UI_FIT) to breathe, and may drop below 1 on laptops with the browser bar (~650 px tall).
const DESIGN_W = 1280;
const DESIGN_H = 720;
const UI_FIT = 0.9;
const MIN_SCALE = 0.7;
const MAX_SCALE = 1.25;
export function useUiScale(): void {
  useEffect(() => {
    const apply = () => {
      const fit = Math.min(window.innerWidth / DESIGN_W, window.innerHeight / DESIGN_H) * UI_FIT;
      const s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, fit));
      document.documentElement.style.setProperty('--s', String(Math.round(s * 1000) / 1000));
    };
    apply();
    window.addEventListener('resize', apply);
    return () => window.removeEventListener('resize', apply);
  }, []);
}

/** Current UI scale (the --s CSS variable). */
export const uiScale = (): number => Number(getComputedStyle(document.documentElement).getPropertyValue('--s')) || 1;

export const reducedMotion = (): boolean => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// ------------------------------------------------------------ Live keys
// <Kbd> keys sink when you really press that key (handy to test the school keyboards)
const pressed = new Set<string>();
const subs = new Set<() => void>();
let version = 0;
const WHEEL_FLASH_MS = 120;
const notify = () => {
  version++;
  for (const fn of subs) fn();
};
const setKey = (code: string, on: boolean) => {
  if (on === pressed.has(code)) return;
  if (on) pressed.add(code);
  else pressed.delete(code);
  notify();
};
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => setKey(e.code, true));
  window.addEventListener('keyup', (e) => setKey(e.code, false));
  window.addEventListener('mousedown', (e) => setKey('Mouse' + e.button, true));
  window.addEventListener('mouseup', (e) => setKey('Mouse' + e.button, false));
  window.addEventListener('blur', () => {
    pressed.clear();
    notify();
  });
  window.addEventListener(
    'wheel',
    () => {
      setKey('Wheel', true);
      setTimeout(() => setKey('Wheel', false), WHEEL_FLASH_MS);
    },
    { passive: true },
  );
}
const CODES: Record<string, string[]> = {
  Espacio: ['Space'],
  Shift: ['ShiftLeft', 'ShiftRight'],
  Ctrl: ['ControlLeft', 'ControlRight'],
  'Clic izq.': ['Mouse0'],
  'Clic der.': ['Mouse2'],
  Tab: ['Tab'],
  Esc: ['Escape'],
  Rueda: ['Wheel'],
  Enter: ['Enter'],
};
const codesOf = (label: string): string[] =>
  CODES[label] ??
  (/^\d$/.test(label) ? ['Digit' + label] : /^F\d+$/.test(label) ? [label] : ['Key' + label.toUpperCase()]);
const subscribeKeys = (fn: () => void) => {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
};
const usePressedVersion = () => useSyncExternalStore(subscribeKeys, () => version);

export function Kbd({ k }: { k: string }) {
  usePressedVersion();
  const down = codesOf(k).some((c) => pressed.has(c));
  return <kbd className={down ? 'down' : ''}>{k}</kbd>;
}
export const Keys = ({ keys }: { keys: string[] }) => (
  <span className="keys-row">
    {keys.map((k) => (
      <Kbd key={k} k={k} />
    ))}
  </span>
);

// ------------------------------------------------------------ Checkbox and slider
interface CheckProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
  help?: string;
}
export function Check({ checked, onChange, children, help }: CheckProps) {
  return (
    <label className="check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="box">
        <svg width="14" height="12" viewBox="0 0 14 12">
          <path
            d="M1.5 6.5l3.5 3.5 7.5-8"
            fill="none"
            stroke="#1b2a4a"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span>
        {children}
        {help && <small>{help}</small>}
      </span>
    </label>
  );
}

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  format?: (v: number) => ReactNode;
  onChange: (v: number) => void;
}
export function Slider({ label, value, min, max, step = 1, format = (v) => v, onChange }: SliderProps) {
  const p = ((value - min) / (max - min)) * 100;
  return (
    <label className="slider">
      <span className="slider-head">
        <span className="label">{label}</span>
        <b>{format(value)}</b>
      </span>
      <input
        className="range"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ '--p': `${p}%` }}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

// ------------------------------------------------------------ Block curtain
// A 16×9 grid of squares stacks up and clears diagonally. The screen changes after 240 ms.
const CURTAIN_COLS = 16;
const CURTAIN_ROWS = 9;
const CURTAIN_SWAP_MS = 240;
const CURTAIN_STAGGER_MS = 12;
const CURTAIN_ANIM_MS = 520;
const CURTAIN_TAIL_MS = 40;
let curtainListener: (() => void) | null = null;
export function playCurtain(cb?: () => void): void {
  if (!curtainListener || reducedMotion()) {
    cb?.();
    return;
  }
  curtainListener();
  if (cb) setTimeout(cb, CURTAIN_SWAP_MS);
}

export function Curtain() {
  const [run, setRun] = useState(0);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    curtainListener = () => {
      setRun((n) => n + 1);
      clearTimeout(timer);
      const diagonal = CURTAIN_COLS + CURTAIN_ROWS - 1;
      timer = setTimeout(() => setRun(0), CURTAIN_ANIM_MS + CURTAIN_STAGGER_MS * diagonal + CURTAIN_TAIL_MS);
    };
    return () => {
      curtainListener = null;
      clearTimeout(timer);
    };
  }, []);
  if (!run) return null;
  const cells = [];
  for (let r = 0; r < CURTAIN_ROWS; r++) {
    for (let c = 0; c < CURTAIN_COLS; c++) {
      cells.push(
        <i
          key={`${run}-${r}-${c}`}
          style={{
            background: (r + c) % 2 ? '#22355c' : '#1b2a4a',
            animationDelay: `${CURTAIN_STAGGER_MS * (r + c)}ms`,
          }}
        />,
      );
    }
  }
  return <div className="curtain">{cells}</div>;
}
