import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import Controls from '../manual/Manual';
import Crosshair from './Crosshair';
import { COLORBLIND, palette } from './palette';
import {
  CROSSHAIRS,
  CROSSHAIR_COLORS,
  DEFAULTS,
  setSettings,
  useSettings,
  type CrosshairConfig,
} from './settingsStore';
import '../styles/proposal.css';
import '../styles/pz-extra.css';

// The proposal's Ajustes screen (.impeccable/mocks/propuesta/proto.js, #v-ajustes): same markup, classes and texts.

function Range(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  const { label, value, min, max, step = 1, format, onChange, style, children } = props;
  return (
    <div className="set" style={style}>
      <span>{label}</span>
      <b className="val">{format(value)}</b>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {children}
    </div>
  );
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="set">
      <span>{label}</span>
      <button
        className={`toggle ${on ? 'on' : ''}`}
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={() => onChange(!on)}
      />
    </div>
  );
}

/** Spread shown while the preview is held down (the gun's spread when moving and shooting, radians). */
const PREVIEW_SPREAD = 0.03;

/** The crosshair preview: the game's own Crosshair (same SVG as in a match) over the Patio picture. */
function XhPreview({ cfg }: { cfg: CrosshairConfig }) {
  const [held, setHeld] = useState(false);
  const release = () => setHeld(false);
  return (
    <div
      className={`xh-box ${cfg.dynamic ? '' : 'static'}`}
      onPointerDown={() => cfg.dynamic && setHeld(true)}
      onPointerUp={release}
      onPointerLeave={release}
    >
      <Crosshair cfg={cfg} spread={held ? PREVIEW_SPREAD : 0} />
      <small className="xh-hint">Mantén pulsado para verla abrirse</small>
    </div>
  );
}

const fixed2 = (v: number) => v.toFixed(2);

/** The three settings panels: the lobby's Ajustes page and the in-game window show the same thing. */
export function SettingsPanels() {
  const st = useSettings();
  const ch = st.crosshair;
  const setCh = (patch: Partial<CrosshairConfig>) => setSettings({ crosshair: patch });
  const [keys, setKeys] = useState(false);

  return (
    <>
      <section className="panel">
        <h2 className="sec">Mira</h2>
        <XhPreview cfg={ch} />
        <div className="set">
          <span>Estilo</span>
          <div className="seg sm">
            {CROSSHAIRS.map((c) => (
              <button key={c.id} className={ch.style === c.id ? 'on' : ''} onClick={() => setCh({ style: c.id })}>
                {c.name}
              </button>
            ))}
          </div>
        </div>
        <div className="set">
          <span>Color</span>
          <div className="swatches">
            {CROSSHAIR_COLORS.map((c) => (
              <button
                key={c}
                className={ch.color === c ? 'on' : ''}
                style={{ background: c }}
                aria-label={`Color ${c}`}
                onClick={() => setCh({ color: c })}
              />
            ))}
            <label
              className={`custom ${CROSSHAIR_COLORS.includes(ch.color) ? '' : 'on'}`}
              title="Otro color"
              aria-label="Otro color"
            >
              <input type="color" value={ch.color} onChange={(e) => setCh({ color: e.target.value })} />
            </label>
          </div>
        </div>
        <Range label="Tamaño" value={ch.size} min={2} max={20} format={String} onChange={(v) => setCh({ size: v })} />
        <Range
          label="Grosor"
          value={ch.thickness}
          min={1}
          max={5}
          format={String}
          onChange={(v) => setCh({ thickness: v })}
        />
        <Range label="Separación" value={ch.gap} min={0} max={14} format={String} onChange={(v) => setCh({ gap: v })} />
        <Toggle label="Contorno negro" on={ch.outline} onChange={(v) => setCh({ outline: v })} />
        <Toggle label="Se abre al moverte y disparar" on={ch.dynamic} onChange={(v) => setCh({ dynamic: v })} />
      </section>

      <section className="panel">
        <h2 className="sec">Ratón y vista</h2>
        <Range
          label="Sensibilidad"
          value={st.sens}
          min={0.1}
          max={3}
          step={0.05}
          format={fixed2}
          onChange={(v) => setSettings({ sens: v })}
        />
        <Range
          label="Sensibilidad al apuntar"
          value={st.adsSens}
          min={0.3}
          max={1.5}
          step={0.05}
          format={fixed2}
          onChange={(v) => setSettings({ adsSens: v })}
          style={{ paddingBottom: '0.4rem', border: 0 }}
        >
          <p className="tip">
            Se aplica solo mientras apuntas (clic derecho) y ya compensa el zoom de cada arma. 1,00 = igual que sin
            apuntar; por debajo, más lenta y precisa (útil con francotirador); por encima, más rápida.
          </p>
        </Range>
        <Range
          label="Campo de visión"
          value={st.fov}
          min={60}
          max={110}
          format={(v) => `${v}°`}
          onChange={(v) => setSettings({ fov: v })}
        />
        <Toggle label="Sacudida al recibir daño" on={st.shake} onChange={(v) => setSettings({ shake: v })} />
        <div className="set">
          <span>Teclas y controles</span>
          <button className="btn" onClick={() => setKeys(true)}>
            Ver controles
          </button>
        </div>
      </section>

      <section className="panel">
        <h2 className="sec">Sonido, accesibilidad y gráficos</h2>
        <Range
          label="Volumen"
          value={Math.round(st.volume * 100)}
          min={0}
          max={100}
          format={(v) => `${v} %`}
          onChange={(v) => setSettings({ volume: v / 100 })}
        />
        <div className="set">
          <span>Daltonismo</span>
          <div className="cb">
            {COLORBLIND.map((m) => {
              const p = palette({ ...st, colorblind: m.id });
              const sw: [string, string][] = [
                [p.ally, 'Aliado'],
                [p.enemy, 'Enemigo'],
                [p.team[1], 'Equipo 1'],
                [p.team[2], 'Equipo 2'],
              ];
              return (
                <button
                  key={m.id}
                  className={st.colorblind === m.id ? 'on' : ''}
                  title={m.help}
                  aria-pressed={st.colorblind === m.id}
                  onClick={() => setSettings({ colorblind: m.id })}
                >
                  {m.name}
                  {sw.map(([c, n]) => (
                    <i key={n} style={{ background: c }}>
                      {n}
                    </i>
                  ))}
                </button>
              );
            })}
          </div>
        </div>
        <div className="set">
          <span>
            Calidad gráfica<span className="new">Nuevo</span>
          </span>
          <div className="seg sm">
            {(
              [
                ['baja', 'Baja'],
                ['alta', 'Alta'],
              ] as const
            ).map(([id, name]) => (
              <button key={id} className={st.quality === id ? 'on' : ''} onClick={() => setSettings({ quality: id })}>
                {name}
              </button>
            ))}
          </div>
          <small>Baja: pensada para gráfica integrada. Alta: sombras suaves, antialias y oclusión ambiental.</small>
        </div>
        <div className="set reset">
          <span>Valores de fábrica</span>
          <button className="btn" onClick={() => setSettings(DEFAULTS)}>
            Restablecer todo
          </button>
        </div>
      </section>
      {keys && <Controls onClose={() => setKeys(false)} />}
    </>
  );
}

/** In game (O and the pause menu) the same screen opens over the game, in its own `.pz` root. */
export default function Settings({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    // Esc closes it (the controls window, when open, is a native dialog that takes Esc itself)
    const down = (e: KeyboardEvent) => e.code === 'Escape' && !document.querySelector('dialog[open]') && onClose();
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [onClose]);
  return (
    <div className="pz pz-layer dim" role="dialog" aria-modal="true" aria-labelledby="st-title">
      <div className="app">
        <div className="headrow">
          <h1 className="title" id="st-title">
            Ajustes
          </h1>
          <button className="btn primary" onClick={onClose}>
            Listo
          </button>
        </div>
        <main className="screen ajustes">
          <SettingsPanels />
        </main>
      </div>
    </div>
  );
}
