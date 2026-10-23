import { useEffect, useState } from 'react';
import { CROSSHAIRS, CROSSHAIR_COLORS, DEFAULTS, setSettings, useSettings } from '../settings.js';
import { Check, Slider } from '../ui.jsx';
import Crosshair from './Crosshair.jsx';
import { COLORBLIND } from '../palette.js';

export default function Settings({ onClose }) {
  const st = useSettings();
  const ch = st.crosshair;
  const setCh = (patch) => setSettings({ crosshair: patch });
  const [demo, setDemo] = useState(0); // mantener pulsado la vista previa abre la mira
  const custom = !CROSSHAIR_COLORS.includes(ch.color);

  useEffect(() => {
    const esc = (e) => e.code === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal settings" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Ajustes</h2>
          <span className="esc">Esc para cerrar</span>
          <button className="btn ghost icon" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        <div className="kicker" style={{ marginBottom: 12 }}>Mira</div>
        <div className="xh-layout">
          <div>
            <div
              className="xh-preview"
              onMouseDown={() => setDemo(0.02)}
              onMouseUp={() => setDemo(0)}
              onMouseLeave={() => setDemo(0)}
            >
              <Crosshair cfg={ch} spread={demo} className="crosshair static" />
              <small>Mantén pulsado para ver cómo se abre</small>
            </div>
            <div className="xh-styles">
              {CROSSHAIRS.map((c) => (
                <button key={c.id} className={ch.style === c.id ? 'on' : ''} onClick={() => setCh({ style: c.id })}>
                  <Crosshair
                    cfg={{ ...ch, style: c.id, size: 5, gap: 2, thickness: 2, dynamic: false, outline: false, color: ch.style === c.id ? '#1b2a4a' : '#f7f9fc' }}
                    className="crosshair mini"
                    half={10}
                  />
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          <div className="xh-controls">
            <div className="colors">
              <span className="label">Color</span>
              {CROSSHAIR_COLORS.map((c) => (
                <button key={c} aria-label={c} className={ch.color === c ? 'on' : ''} style={{ background: c }} onClick={() => setCh({ color: c })} />
              ))}
              <label className="free" style={custom ? { boxShadow: '0 0 0 3px #1f3052, 0 0 0 6px #ffc93c' } : undefined}>
                <input type="color" value={ch.color} onChange={(e) => setCh({ color: e.target.value })} />
                Libre
              </label>
            </div>
            <Slider label="Tamaño" value={ch.size} min={2} max={20} format={(v) => `${v} px`} onChange={(v) => setCh({ size: v })} />
            <Slider label="Grosor" value={ch.thickness} min={1} max={6} format={(v) => `${v} px`} onChange={(v) => setCh({ thickness: v })} />
            <Slider label="Separación" value={ch.gap} min={0} max={16} format={(v) => `${v} px`} onChange={(v) => setCh({ gap: v })} />
            <div className="toggles">
              <Check checked={ch.outline} onChange={(v) => setCh({ outline: v })}>Contorno negro</Check>
              <Check checked={ch.dynamic} onChange={(v) => setCh({ dynamic: v })}>Se abre al moverte y disparar</Check>
            </div>
          </div>
        </div>

        <div className="sep" />
        <div className="kicker" style={{ marginBottom: 12 }}>Ratón, vista y sonido</div>
        <div className="grid-2">
          <Slider label="Sensibilidad" value={st.sens} min={0.2} max={3} step={0.05} format={(v) => v.toFixed(2)} onChange={(v) => setSettings({ sens: v })} />
          <Slider label="Campo de visión" value={st.fov} min={65} max={110} format={(v) => `${v}°`} onChange={(v) => setSettings({ fov: v })} />
          <Slider label="Volumen" value={Math.round(st.volume * 100)} min={0} max={100} format={(v) => `${v} %`} onChange={(v) => setSettings({ volume: v / 100 })} />
          <div style={{ display: 'grid', gap: 12 }}>
            <Check checked={st.shake} onChange={(v) => setSettings({ shake: v })} help="La cámara y el HUD tiemblan un instante al recibir daño.">
              Sacudida al recibir daño
            </Check>
          </div>
        </div>

        <div className="sep" />
        <div className="kicker" style={{ marginBottom: 12 }}>Modo daltónico</div>
        <div className="seg" role="radiogroup" aria-label="Modo daltónico">
          {COLORBLIND.map((c) => (
            <button key={c.id} role="radio" aria-checked={st.colorblind === c.id} className={st.colorblind === c.id ? 'on' : ''} onClick={() => setSettings({ colorblind: c.id })}>
              <b>{c.name}</b>
              {c.help && <small>{c.help}</small>}
            </button>
          ))}
        </div>
        <div className="cb-swatches">
          <span><i style={{ background: 'var(--aliado)' }} />Aliado</span>
          <span><i style={{ background: 'var(--enemigo)' }} />Enemigo</span>
          <span><i style={{ background: 'var(--eq-rojo)' }} />Equipo Rojo</span>
          <span><i style={{ background: 'var(--eq-azul)' }} />Equipo Azul</span>
        </div>

        <div className="modal-foot">
          <button className="btn ghost md" onClick={() => setSettings(DEFAULTS)}>Restablecer</button>
          <button className="btn primary md" onClick={onClose}>Listo</button>
        </div>
      </div>
    </div>
  );
}
