import { useEffect, useState } from 'react';
import { CHARACTERS, WEAPONS, MODE_BY_ID, PLAYER, weightName, damageAt, speedWith } from '@blockshot/shared';
import { Icon } from '../ui/icons';
import { Keys } from '../ui/ui';

export const CONTROLS: [string[], string][] = [
  [['W', 'A', 'S', 'D'], 'Moverse'],
  [['Espacio'], 'Saltar. Mantenlo pulsado para encadenar saltos (bunny hop)'],
  [['C', 'Ctrl'], 'Agacharse: más bajo y más preciso. Si vas corriendo, te deslizas'],
  [['Shift'], PLAYER.useStamina ? 'Esprintar (gasta estamina; se recupera sola al soltar)' : 'Esprintar hacia delante'],
  [['Clic izq.'], 'Disparar'],
  [['Clic der.'], 'Apuntar (mira telescópica con el francotirador)'],
  [['R'], 'Recargar'],
  [['G'], 'Granada (una por vida): mantén G para ver la trayectoria y dónde cae, suéltala para lanzar'],
  [['E'], 'Habilidad del personaje: humo, mina, escudo, impulso o muro (con recarga)'],
  [['1', '2', '3', 'Q', 'Rueda'], 'Cambiar de arma (3: cuchillo, por la espalda mata de un golpe)'],
  [['Tab'], 'Ver el marcador (mantener)'],
  [['B'], 'Cambiar de personaje (solo estando muerto)'],
  [['T'], 'Cambiar de equipo (por equipos; no en pleno combate)'],
  [['V', '1–8'], 'Chat rápido: abre las frases y elige una con su número'],
  [['O'], 'Ajustes: mira, sensibilidad, campo de visión, volumen'],
  [['H', 'F1'], 'Abrir este manual'],
  [['Esc'], 'Soltar el ratón / pausa'],
];

const STEPS: [string, string][] = [
  ['Escribe tu nombre', 'Así te verán los demás en el marcador y en el killfeed.'],
  ['Crea una sala o entra en una', 'Si tiene candado, pide la contraseña a quien la creó.'],
  ['Elige personaje y skin', 'Cada uno tiene vida, velocidad y armas distintas.'],
  [
    'Haz clic para jugar',
    'El ratón queda capturado. Esc lo suelta y abre la pausa; otro Esc (o un clic) vuelve al juego.',
  ],
  [
    'Gana la partida',
    `Quien crea la sala elige los puntos. Por defecto: ${MODE_BY_ID.ffa.def} bajas (todos contra todos), ${MODE_BY_ID.teams.def} bajas del equipo (por equipos) o ${MODE_BY_ID.ctf.def} capturas.`,
  ],
  [
    'Escalada de armas',
    'Todos empiezan con la misma arma y cada baja da la siguiente. Gana quien elimine con el cuchillo.',
  ],
  [
    'Captura la bandera',
    'Coge la bandera rival pasando por encima y llévala a tu base con la tuya en casa. Si cae, tócala para devolverla.',
  ],
  [
    'Confirmar bajas',
    'Cada baja suelta una placa. Si la recoge tu equipo, suma un punto; si la recoge el equipo de la víctima, la niega.',
  ],
  [
    'Infectados',
    'Uno empieza infectado: solo lleva cuchillo, pero corre más y aguanta más. Cada superviviente que cae se infecta. Los supervivientes ganan si aguantan hasta el final.',
  ],
  [
    'Dominio',
    'Quédate en una zona (A, B o C) sin rivales dentro para capturarla. Cada 2 s tu equipo suma un punto por zona.',
  ],
  [
    'Rondas',
    'No se reaparece durante la ronda: gana el equipo que deje al otro sin nadie en pie. Vale para 1 contra 1.',
  ],
  [
    'Si te eliminan',
    `Ves la repetición desde los ojos de quien te eliminó y reapareces a los ${PLAYER.respawnDelay / 1000} s. B cambia de personaje.`,
  ],
];

const TRICKS: [string, string][] = [
  ['Bunny hop', 'Mantén Espacio al aterrizar: cada salto encadenado conserva la velocidad.'],
  ['Deslízate', 'Corre y pulsa C para entrar en una esquina más rápido y más bajo.'],
  [
    'Slide-hop',
    'Desliza, salta y vuelve a pulsar C justo al aterrizar: cada slide encadenado gana velocidad. En el aire no se frena.',
  ],
  [
    'Plataformas de salto',
    'Las placas verdes del suelo te lanzan hacia arriba: úsalas para subir a torres, contenedores y azoteas.',
  ],
  ['Armas pesadas', 'El francotirador y la ametralladora te frenan. Saca la secundaria para moverte más rápido.'],
  ['Apunta a la cabeza', 'Multiplica el daño. Al Tanque, el francotirador solo lo tumba de un tiro a la cabeza.'],
  ['Francotirador quieto', 'Tarda en apuntar y, si te mueves o saltas con la mira puesta, el tiro se desvía.'],
  ['Agáchate al disparar', 'Con C la mira se abre menos y aciertas más ráfagas.'],
  [
    'Recarga a cubierto',
    `La ametralladora del Bastión tarda ${WEAPONS.lmg.reload / 1000} s. Hazlo detrás de una caja.`,
  ],
  ['Mira el minimapa', 'Los enemigos que disparan aparecen un momento en rojo.'],
  ['Ráfagas cortas', 'Cada disparo sube la mira; al soltar el gatillo vuelve sola a su sitio.'],
  ['Rachas', 'Encadena 3, 5, 7 o 10 bajas sin morir y toda la sala lo verá en el killfeed.'],
  [
    'Recompensas',
    'Con 5 bajas seguidas ganas Radar (ves a todos los enemigos en el minimapa un rato); con 7, Blindaje (+50 que se gasta antes que la vida).',
  ],
  ['Disparos justos', 'El servidor compensa el retraso de la red: si en tu pantalla le diste, cuenta.'],
  ['Granadas', 'Sácalos de una esquina: la explosión no atraviesa paredes y no daña a tu equipo ni a ti.'],
  [
    'Medallas',
    'Primera sangre, doble baja, venganza, desde el aire, por la espalda o tiro lejano: suman en el marcador.',
  ],
];

const TABS = ['Controles', 'Cómo jugar', 'Personajes', 'Armas', 'Trucos'];
const CARD_COLS = 4;
/** Cards of an incomplete last row widen to fill it, so the grid stays symmetric (when they divide it evenly). */
const lastRowSpan = (count: number, i: number): string | undefined => {
  const rest = count % CARD_COLS;
  return rest && CARD_COLS % rest === 0 && i >= count - rest ? `span ${CARD_COLS / rest}` : undefined;
};

export default function Manual({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState(0);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.code === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal manual" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Manual de BLOCKSHOT</h2>
          <button className="btn icon" onClick={onClose} aria-label="Cerrar">
            <Icon name="x" size={18} />
          </button>
        </div>
        <nav className="seg tabs">
          {TABS.map((t, i) => (
            <button key={t} className={tab === i ? 'on' : ''} onClick={() => setTab(i)}>
              {t}
            </button>
          ))}
        </nav>

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
                <div className="step" key={t} style={{ gridColumn: lastRowSpan(STEPS.length, i) }}>
                  <span className="n">{i + 1}</span>
                  <div>
                    <b>{t}</b>
                    <p>{d}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 2 && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Personaje</th>
                  <th>Vida</th>
                  <th>Velocidad (1 / 2)</th>
                  <th>Principal</th>
                  <th>Secundaria</th>
                  <th>Estilo</th>
                </tr>
              </thead>
              <tbody>
                {CHARACTERS.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <span className="chip-char" style={{ '--c': c.color }}>
                        {c.name}
                      </span>
                    </td>
                    <td className="b">{c.hp}</td>
                    <td className="b">
                      {speedWith(c, c.primary)} / {speedWith(c, c.secondary)}
                    </td>
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
                <tr>
                  <th>Arma</th>
                  <th>Daño (cerca → lejos)</th>
                  <th>Cabeza</th>
                  <th>Disparos/s</th>
                  <th>Cargador</th>
                  <th>Recarga</th>
                  <th>Peso</th>
                  <th>Modo</th>
                </tr>
              </thead>
              <tbody>
                {Object.values(WEAPONS).map((w) => (
                  <tr key={w.name}>
                    <td className="b">{w.name}</td>
                    <td className="n">
                      {w.pellets > 1 ? `${w.damage}×${w.pellets}` : w.damage}
                      {w.falloff && ` → ${Math.round(damageAt(w, w.falloff[1]))}`}
                    </td>
                    <td className="head">×{w.headMult}</td>
                    <td className="n">{(1000 / w.fireRate).toFixed(1)}</td>
                    <td className="n">{w.melee ? '—' : w.mag}</td>
                    <td className="n">{w.melee ? '—' : `${(w.reload / 1000).toFixed(1)} s`}</td>
                    <td>{weightName(w)}</td>
                    <td>
                      {w.melee ? `Cuerpo a cuerpo · espalda ${w.backstab}` : w.auto ? 'Automática' : 'Semiautomática'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === 4 && (
            <div className="tricks">
              {TRICKS.map(([t, d], i) => (
                <div className="trick" key={t} style={{ gridColumn: lastRowSpan(TRICKS.length, i) }}>
                  <b>{t}</b>
                  <p>{d}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
