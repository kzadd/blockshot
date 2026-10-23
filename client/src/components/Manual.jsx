import { useEffect, useState } from 'react';
import { CHARACTERS, WEAPONS, MODE_BY_ID, PLAYER, weightName, damageAt, speedWith } from '../../../shared/config.js';
import { Keys } from '../ui.jsx';

export const CONTROLS = [
  [['W', 'A', 'S', 'D'], 'Moverse'],
  [['Espacio'], 'Saltar. Mantenlo pulsado para encadenar saltos (bunny hop)'],
  [['C', 'Ctrl'], 'Agacharse: más bajo y más preciso. Si vas corriendo, te deslizas'],
  [['Shift'], 'Esprintar (gasta estamina; se recupera sola al soltar)'],
  [['Clic izq.'], 'Disparar'],
  [['Clic der.'], 'Apuntar (mira telescópica con el francotirador)'],
  [['R'], 'Recargar'],
  [['1', '2', '3', 'Q', 'Rueda'], 'Cambiar de arma (3: cuchillo, por la espalda mata de un golpe)'],
  [['Tab'], 'Ver el marcador (mantener)'],
  [['B'], 'Cambiar de personaje (solo estando muerto)'],
  [['T'], 'Cambiar de equipo (por equipos; no en pleno combate)'],
  [['O'], 'Ajustes: mira, sensibilidad, campo de visión, volumen'],
  [['H', 'F1'], 'Abrir este manual'],
  [['Esc'], 'Soltar el ratón / pausa'],
];

const STEPS = [
  ['Escribe tu nombre', 'Así te verán los demás en el marcador y en el killfeed.'],
  ['Crea una sala o entra en una', 'Si tiene candado, pide la contraseña a quien la creó.'],
  ['Elige personaje y skin', 'Cada uno tiene vida, velocidad y armas distintas.'],
  ['Haz clic para jugar', 'El ratón queda capturado. Esc lo suelta y abre la pausa; otro Esc (o un clic) vuelve al juego.'],
  ['Gana la partida', `Quien crea la sala elige los puntos. Por defecto: ${MODE_BY_ID.ffa.def} bajas (todos contra todos), ${MODE_BY_ID.teams.def} bajas del equipo (por equipos) o ${MODE_BY_ID.ctf.def} capturas.`],
  ['Escalada de armas', 'Todos empiezan con la misma arma y cada baja da la siguiente. Gana quien elimine con el cuchillo.'],
  ['Captura la bandera', 'Coge la bandera rival pasando por encima y llévala a tu base con la tuya en casa. Si cae, tócala para devolverla.'],
  ['Si te eliminan', `Reapareces a los ${PLAYER.respawnDelay / 1000} s. Pulsa B para cambiar de personaje antes.`],
];

const TRICKS = [
  ['Bunny hop', 'Mantén Espacio al aterrizar: cada salto encadenado conserva la velocidad.'],
  ['Deslízate', 'Corre y pulsa C para entrar en una esquina más rápido y más bajo. Gasta un poco de estamina.'],
  ['Guarda estamina', 'Esprinta para cruzar zonas abiertas, no todo el rato: si la agotas tardas en poder volver a correr.'],
  ['Armas pesadas', 'El francotirador y la ametralladora te frenan. Saca la secundaria para moverte más rápido.'],
  ['Apunta a la cabeza', 'Multiplica el daño: el francotirador solo mata de un tiro a la cabeza.'],
  ['Francotirador quieto', 'Tarda en apuntar y, si te mueves o saltas con la mira puesta, el tiro se desvía.'],
  ['Agáchate al disparar', 'Con C la mira se abre menos y aciertas más ráfagas.'],
  ['Recarga a cubierto', `La ametralladora del Bastión tarda ${WEAPONS.lmg.reload / 1000} s. Hazlo detrás de una caja.`],
  ['Mira el minimapa', 'Los enemigos que disparan aparecen un momento en rojo.'],
  ['Ráfagas cortas', 'Cada disparo sube la mira; al soltar el gatillo vuelve sola a su sitio.'],
  ['Rachas', 'Encadena 3, 5, 7 o 10 bajas sin morir y toda la sala lo verá en el killfeed.'],
  ['Disparos justos', 'El servidor compensa el retraso de la red: si en tu pantalla le diste, cuenta.'],
];

const TABS = ['Controles', 'Cómo jugar', 'Personajes', 'Armas', 'Trucos'];

export default function Manual({ onClose }) {
  const [tab, setTab] = useState(0);

  useEffect(() => {
    const esc = (e) => e.code === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal manual" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head" style={{ marginBottom: 0 }}>
          <h2>Manual de BLOCKSHOT</h2>
          <button className="btn ghost icon" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        <div><nav className="seg tabs">
          {TABS.map((t, i) => (
            <button key={t} className={tab === i ? 'on' : ''} onClick={() => setTab(i)}>{t}</button>
          ))}
        </nav></div>

        <div className="manual-body">
          {tab === 0 && (
            <div className="controls-grid">
              {CONTROLS.map(([keys, what]) => (
                <div className="key-row" key={what}>
                  <Keys keys={keys} />
                  <span>{what}</span>
                </div>
              ))}
            </div>
          )}

          {tab === 1 && (
            <div className="steps">
              {STEPS.map(([t, d], i) => (
                <div className="step" key={t}>
                  <span className="n">{i + 1}</span>
                  <div><b>{t}</b><p>{d}</p></div>
                </div>
              ))}
            </div>
          )}

          {tab === 2 && (
            <table className="data-table">
              <thead>
                <tr><th>Personaje</th><th>Vida</th><th>Velocidad (1 / 2)</th><th>Principal</th><th>Secundaria</th><th>Estilo</th></tr>
              </thead>
              <tbody>
                {CHARACTERS.map((c) => (
                  <tr key={c.id}>
                    <td><span className="chip-char" style={{ '--c': c.color }}>{c.name}</span></td>
                    <td className="b">{c.hp}</td>
                    <td className="b">{speedWith(c, c.primary)} / {speedWith(c, c.secondary)}</td>
                    <td>{WEAPONS[c.primary].name}</td>
                    <td>{WEAPONS[c.secondary].name}</td>
                    <td className="desc">{c.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === 3 && (
            <table className="data-table">
              <thead>
                <tr><th>Arma</th><th>Daño (cerca → lejos)</th><th>Cabeza</th><th>Disparos/s</th><th>Cargador</th><th>Recarga</th><th>Peso</th><th>Modo</th></tr>
              </thead>
              <tbody>
                {Object.values(WEAPONS).map((w) => (
                  <tr key={w.name}>
                    <td className="b">{w.name}</td>
                    <td>{w.pellets > 1 ? `${w.damage}×${w.pellets}` : w.damage}{w.falloff && ` → ${Math.round(damageAt(w, w.falloff[1]))}`}</td>
                    <td className="head">×{w.headMult}</td>
                    <td>{(1000 / w.fireRate).toFixed(1)}</td>
                    <td>{w.melee ? '—' : w.mag}</td>
                    <td>{w.melee ? '—' : `${(w.reload / 1000).toFixed(1)} s`}</td>
                    <td>{weightName(w)}</td>
                    <td>{w.melee ? `Cuerpo a cuerpo · espalda ${w.backstab}` : w.auto ? 'Automática' : 'Semiautomática'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === 4 && (
            <div className="tricks">
              {TRICKS.map(([t, d]) => (
                <div className="trick" key={t}><b>{t}</b><p>{d}</p></div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
