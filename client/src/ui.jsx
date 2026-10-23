// Piezas de interfaz compartidas: teclas vivas, casilla, deslizador, cortinilla y escala del HUD
import { useEffect, useState, useSyncExternalStore } from 'react';

// ------------------------------------------------------------ Escala (--s)
// 1 a 1280×720, hasta 1.5 a 1920×1080. Todas las pantallas se dibujan sobre ese lienzo.
export function useUiScale() {
  useEffect(() => {
    const apply = () => {
      const s = Math.min(1.5, Math.max(1, Math.min(window.innerWidth / 1280, window.innerHeight / 720)));
      document.documentElement.style.setProperty('--s', String(Math.round(s * 1000) / 1000));
    };
    apply();
    window.addEventListener('resize', apply);
    return () => window.removeEventListener('resize', apply);
  }, []);
}

export const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// ------------------------------------------------------------ Teclas vivas
// Las <Kbd> se hunden cuando pulsas esa tecla de verdad (sirve para probar el teclado del instituto)
const pressed = new Set();
const subs = new Set();
let version = 0;
const notify = () => {
  version++;
  for (const fn of subs) fn();
};
const setKey = (code, on) => {
  if (on === pressed.has(code)) return;
  on ? pressed.add(code) : pressed.delete(code);
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
  window.addEventListener('wheel', () => {
    setKey('Wheel', true);
    setTimeout(() => setKey('Wheel', false), 120);
  }, { passive: true });
}
const CODES = {
  Espacio: ['Space'], Shift: ['ShiftLeft', 'ShiftRight'], Ctrl: ['ControlLeft', 'ControlRight'],
  'Clic izq.': ['Mouse0'], 'Clic der.': ['Mouse2'], Tab: ['Tab'], Esc: ['Escape'], Rueda: ['Wheel'], Enter: ['Enter'],
};
const codesOf = (label) => CODES[label] || (/^\d$/.test(label) ? ['Digit' + label] : /^F\d+$/.test(label) ? [label] : ['Key' + label.toUpperCase()]);
const usePressedVersion = () => useSyncExternalStore((fn) => (subs.add(fn), () => subs.delete(fn)), () => version);

export function Kbd({ k }) {
  usePressedVersion();
  const down = codesOf(k).some((c) => pressed.has(c));
  return <kbd className={down ? 'down' : ''}>{k}</kbd>;
}
export const Keys = ({ keys }) => (
  <span className="keys-row">{keys.map((k) => <Kbd key={k} k={k} />)}</span>
);

// ------------------------------------------------------------ Casilla y deslizador
export function Check({ checked, onChange, children, help }) {
  return (
    <label className="check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="box">
        <svg width="14" height="12" viewBox="0 0 14 12"><path d="M1.5 6.5l3.5 3.5 7.5-8" fill="none" stroke="#1b2a4a" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </span>
      <span>{children}{help && <small>{help}</small>}</span>
    </label>
  );
}

export function Slider({ label, value, min, max, step = 1, format = (v) => v, onChange }) {
  const p = ((value - min) / (max - min)) * 100;
  return (
    <label className="slider">
      <span className="slider-head"><span className="label">{label}</span><b>{format(value)}</b></span>
      <input className="range" type="range" min={min} max={max} step={step} value={value} style={{ '--p': `${p}%` }} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

// ------------------------------------------------------------ Cortinilla de bloques
// Una rejilla de 16×9 cuadrados se apila y se retira en diagonal. La pantalla cambia a los 240 ms.
let curtainListener = null;
export function playCurtain(cb) {
  if (!curtainListener || reducedMotion()) {
    cb?.();
    return;
  }
  curtainListener();
  if (cb) setTimeout(cb, 240);
}

export function Curtain() {
  const [run, setRun] = useState(0);
  useEffect(() => {
    let timer = 0;
    curtainListener = () => {
      setRun((n) => n + 1);
      clearTimeout(timer);
      timer = setTimeout(() => setRun(0), 520 + 12 * 24 + 40);
    };
    return () => {
      curtainListener = null;
      clearTimeout(timer);
    };
  }, []);
  if (!run) return null;
  const cells = [];
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 16; c++) {
      cells.push(<i key={`${run}-${r}-${c}`} style={{ background: (r + c) % 2 ? '#22355c' : '#1b2a4a', animationDelay: `${12 * (r + c)}ms` }} />);
    }
  }
  return <div className="curtain">{cells}</div>;
}
