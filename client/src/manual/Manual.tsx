import {
  ABILITIES,
  ABILITY_IDS,
  ACCESSORIES,
  ACCESSORY_IDS,
  BODY,
  HELMET,
  INFECT,
  KEVLAR,
  LIMB_MULT,
  MODE_BY_ID,
  PLAYER,
  TRAITOR,
  WEAPONS,
  WEAPON_HANDLING,
  staminaMult,
} from '@blockshot/shared';
import Modal from '../ui/Modal';

export const CONTROLS: [string[], string][] = [
  [['W', 'A', 'S', 'D'], 'Moverse'],
  [['Espacio'], 'Saltar. Mantenlo pulsado para encadenar saltos (bunny hop)'],
  [['C', 'Ctrl'], 'Agacharse: más bajo y más preciso. Si vas corriendo, te deslizas'],
  [['Shift'], PLAYER.useStamina ? 'Esprintar (gasta estamina; se recupera sola al soltar)' : 'Esprintar hacia delante'],
  [['Clic izq.'], 'Disparar'],
  [['Clic der.'], 'Apuntar (mira telescópica con el francotirador)'],
  [['R'], 'Recargar'],
  [['V'], 'Empujar a quien tengas justo delante (sin daño, también a tu equipo)'],
  [['G'], 'Granada (una por vida): mantén G para ver la trayectoria y dónde cae, suéltala para lanzar'],
  [
    ['E'],
    `Habilidad de tu clase (con recarga): ${ABILITY_IDS.map((id) => ABILITIES[id].name.toLowerCase()).join(', ')}`,
  ],
  [['F'], 'Acción del modo: barricada o grito (Infectados); examinar un cuerpo o llamar a reunión (Traidores)'],
  [
    ['1', '2', '3', '4', 'Q', 'Rueda'],
    'Cambiar de arma (3: cuchillo, por la espalda mata de un golpe; 4: arma de poder)',
  ],
  [['Tab'], 'Ver el marcador (mantener)'],
  [['B'], 'Cambiar de clase o de equipo (solo estando muerto)'],
  [['L'], 'Equipo: cambia armas, habilidad y accesorio en plena partida (se aplica al reaparecer; Esc lo cierra)'],
  [['T'], 'Cambiar de equipo (por equipos; no en pleno combate)'],
  [['O'], 'Ajustes: mira, sensibilidad, campo de visión, volumen'],
  [['H', 'F1'], 'Abrir los controles'],
  [['Esc'], 'Soltar el ratón / pausa'],
];

export const STEPS: [string, string][] = [
  ['Escribe tu nombre', 'Así te verán los demás en el marcador y en el killfeed.'],
  ['Crea una sala o entra en una', 'Si tiene candado, pide la contraseña a quien la creó.'],
  [
    'Monta tu clase',
    `Todos tenéis ${BODY.hp} de vida: elige arma principal, secundaria, habilidad y accesorio, y vístete a tu gusto. Cuanto más pesa el arma en la mano, más despacio vas. En partida, L cambia el equipo para la próxima vez que aparezcas.`,
  ],
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
    'Progresión de armas: todos empiezan con la misma arma y cada baja da la siguiente. Gana quien elimine con el cuchillo.',
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
    `Uno de cada ${INFECT.perInfected} empieza como paciente cero: más grande y duro, con un grito (F) que frena a los supervivientes cercanos. Los infectados solo llevan cuchillo y reaparecen en ${INFECT.respawnMs / 1000} s; al morir eligen tipo (1, 2, 3): Corredor (muy rápido, poca vida), Tanque (lento, mucha vida) o Saltador (salta muy alto). Cada superviviente que cae se infecta. Los supervivientes levantan barricadas de tablas (F) que los infectados rompen a cuchillazos, y a veces se va la luz unos segundos. En los últimos ${INFECT.revealMs / 1000} s los infectados ven a todos en el minimapa; el último superviviente recibe un arma de poder, más vida y blindaje, y todos lo ven. Los supervivientes ganan si aguantan hasta el final.`,
  ],
  [
    'Dominio',
    'Controla y mantén los puntos del mapa: quédate en una zona (A, B o C) sin rivales dentro para capturarla. Cada 2 s tu equipo suma un punto por zona.',
  ],
  [
    'Supervivencia',
    'Por equipos y sin reaparición: no se reaparece durante la ronda: gana el equipo que deje al otro sin nadie en pie. Vale para 1 contra 1.',
  ],
  [
    'Último en pie',
    'Como Supervivencia, pero cada uno por su cuenta: gana la ronda quien quede vivo. Si se acaba el tiempo, quien tenga más vida.',
  ],
  ['Disparo único', 'Todos llevan solo la railgun, con munición infinita, y el cuchillo: cualquier impacto mata.'],
  [
    'Congelados',
    'Quien cae se queda congelado donde estaba. Quédate 3 s a su lado (más rápido si sois varios) para descongelarlo. Gana la ronda el equipo que congele a todos los rivales.',
  ],
  [
    'Bomba',
    'Rojo lleva la bomba y la planta quedándose 3 s en la zona A o B; explota a los 35 s. Azul la desactiva quedándose 6 s a su lado, o gana si se acaba el tiempo sin bomba plantada.',
  ],
  [
    'Traidores',
    `Todos parecen del mismo bando, pero en cada ronda hay traidores ocultos (uno por cada ${TRAITOR.perTraitor} jugadores): solo ellos lo saben y se ven entre sí. Todos llevan la secundaria y el cuchillo, y el cuchillo de un traidor mata de un golpe. Hay fuego amigo y nadie ve quién mató a quién. Junto a un cuerpo, F lo examina (de quién es y con qué lo mataron) y llama a una reunión; lejos de los cuerpos, F convoca tu reunión de emergencia (una por ronda). En la reunión nadie se mueve: voten a quién expulsar, o salten, en ${TRAITOR.meetingMs / 1000} s; el más votado queda fuera y se dice qué era. Ganan los inocentes si no queda ningún traidor o se acaba el tiempo; los traidores, si llegan a ser tantos como los inocentes. Matar a un inocente siendo inocente te quita ${TRAITOR.teamKill} punto.`,
  ],
  [
    'Si te eliminan',
    `Ves la repetición desde los ojos de quien te eliminó y reapareces a los ${PLAYER.respawnDelay / 1000} s. B cambia de clase; L, solo el equipo.`,
  ],
  ['Cuidado con el vacío', 'Caerte fuera del mapa te elimina (en la Carrera vuelves a tu punto de control).'],
  [
    'Nada de campear',
    `Si pasas ${PLAYER.campWarnMs / 1000} s sin salir de una zona de ${PLAYER.campRadius} m te avisamos; a los ${PLAYER.campMs / 1000} s los rivales te ven en el minimapa y pierdes ${PLAYER.campDrain} de vida por segundo hasta que salgas de ella.`,
  ],
  [
    'Carrera de saltos',
    'Las balas y el cuchillo no hacen daño: empujan. Tira a los rivales de las plataformas a la lava.',
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
  [
    'Armas pesadas',
    `El ${WEAPONS.sniper.name} y la ${WEAPONS.lmg.name} te frenan. Saca la secundaria para moverte más rápido.`,
  ],
  [
    'Apunta a la cabeza',
    `Multiplica el daño. El ${WEAPONS.sniper.name} tumba de un tiro al cuerpo; el resto, mejor a la cabeza.`,
  ],
  ['Francotirador quieto', 'Tarda en apuntar y, si te mueves o saltas con la mira puesta, el tiro se desvía.'],
  ['Agáchate al disparar', 'Con C la mira se abre menos y aciertas más ráfagas.'],
  [
    'Precisión y postura',
    `Entre ráfagas la mira se cierra antes agachado y quieto (×${WEAPON_HANDLING.bloom.posture.crouchStill}), normal de pie, despacio corriendo (×${WEAPON_HANDLING.bloom.posture.run}) y casi nada en el aire (×${WEAPON_HANDLING.bloom.posture.air}).`,
  ],
  [
    'Cabeza, torso y piernas',
    `La cabeza multiplica el daño; las piernas reciben el ${Math.round(LIMB_MULT * 100)} % del daño del torso. El ${WEAPONS.sniper.name} sigue tumbando de un tiro al torso.`,
  ],
  [
    'Peso y estamina',
    `Con un arma pesada en la mano el esprint y los saltos cansan más (la ${WEAPONS.lmg.name}, ×${staminaMult(WEAPONS.lmg.weight).toFixed(2)}). Con la pistola o el cuchillo, lo normal.`,
  ],
  [
    'Accesorios',
    `Uno por clase: ${ACCESSORY_IDS.filter((id) => id !== 'none')
      .map((id) => ACCESSORIES[id].name)
      .join(
        ', ',
      )}. El Kevlar quita un ${Math.round((1 - KEVLAR.torso) * 100)} % en el torso pero te frena; el casco, un ${Math.round((1 - HELMET.head) * 100)} % en la cabeza; el láser se ve.`,
  ],
  [
    'Recarga a cubierto',
    `La ${WEAPONS.lmg.name} tarda ${WEAPONS.lmg.reload / 1000} s en recargar. Hazlo detrás de una caja.`,
  ],
  ['Mira el minimapa', 'Los enemigos que disparan aparecen un momento en rojo (los que llevan silenciador, no).'],
  ['Ráfagas cortas', 'Cada disparo sube la mira; al soltar el gatillo vuelve sola a su sitio.'],
  ['Rachas', 'Encadena 3, 5, 7 o 10 bajas sin morir y toda la sala lo verá en el killfeed.'],
  [
    'Recompensas',
    'Con 3 bajas seguidas ganas Radar (ves a todos los enemigos en el minimapa un rato); con 5, Blindaje (+50 que se gasta antes que la vida); con 7, Bombardeo aéreo donde estés mirando (se marca en rojo en el suelo antes de caer).',
  ],
  ['Disparos justos', 'El servidor compensa el retraso de la red: si en tu pantalla le diste, cuenta.'],
  ['Granadas', 'Sácalos de una esquina: la explosión no atraviesa paredes y no daña a tu equipo ni a ti.'],
  ['Botiquín y chaleco', 'Están en el suelo y en el minimapa: +40 de vida o +50 de blindaje. Vuelven a los 30 s.'],
  [
    'Barriles rojos',
    'Dispárales y explotan: daño de granada alrededor, y la baja es tuya. Las cajas de madera se rompen.',
  ],
  [
    'Escaleras y tirolinas',
    'Camina hacia una escalera para subir (mira abajo para bajar). Salta al cable de una tirolina para agarrarte: va hacia donde mires; salta otra vez para soltarte.',
  ],
  [
    'Saltos de pared y bordes',
    'En el aire, pegado a un muro, salta otra vez para rebotar en él (hasta 3 seguidos). Salta hacia un borde alto y mantén Espacio para subirte.',
  ],
  [
    'Armas de poder',
    `Cada minuto aparece una (${WEAPONS.railgun.name}, ${WEAPONS.minigun.name} o ${WEAPONS.autoshotgun.name}): se anuncia y sale en el minimapa con una luz naranja. Un solo cargador; tecla 4.`,
  ],
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
