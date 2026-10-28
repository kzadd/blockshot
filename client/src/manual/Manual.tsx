import { MODE_BY_ID, PLAYER, WEAPONS } from '@blockshot/shared';
import Modal from '../ui/Modal';

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
  [['O'], 'Ajustes: mira, sensibilidad, campo de visión, volumen'],
  [['H', 'F1'], 'Abrir los controles'],
  [['Esc'], 'Soltar el ratón / pausa'],
];

export const STEPS: [string, string][] = [
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

export const TRICKS: [string, string][] = [
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

/** The keys window (H / F1 in game, pause menu, «Ver controles» in Settings): the proposal's #keysModal. */
export default function Controls({ onClose }: { onClose: () => void }) {
  return (
    <Modal className="wide" labelledBy="keysTitle" onClose={onClose}>
      <h2 id="keysTitle">Controles</h2>
      <div className="keys">
        {CONTROLS.map(([keys, what]) => (
          <div className="key" key={what}>
            <span>
              {keys.map((k) => (
                <kbd className="k" key={k}>
                  {k}
                </kbd>
              ))}
            </span>
            {what}
          </div>
        ))}
      </div>
      <div className="modal-actions">
        <button className="btn primary" value="ok">
          Cerrar
        </button>
      </div>
    </Modal>
  );
}
