# BLOCKSHOT

Shooter multijugador en primera persona, estilo arena de bloques, pensado para jugar en clase por red local.
Tu PC hace de servidor y todos se conectan desde el navegador.

**Stack:** monorepo pnpm con TypeScript estricto. Cliente: React 18 + Vite, three.js (3D), Zustand (HUD), Tailwind
(utilidades de UI), Howler (audio). Servidor autoritativo: Node + Express + Socket.IO (MessagePack), Valibot, Pino.
Sin assets externos: modelos hechos con cajas y sonidos sintetizados con WebAudio.

## Requisitos

- Node.js 18 o superior.
- pnpm (viene con Node: `corepack enable` una vez y ya está disponible).
- Todos en la misma red (wifi de clase o cable).

## Para jugar en clase

```bash
pnpm install
pnpm clase      # compila cliente y servidor y arranca en el puerto 3000
```

Comparte `http://blockshot.local:3000` con la clase: el servidor anuncia ese nombre en la red local (mDNS),
así no hace falta dictar la IP. Si en algún equipo no carga (redes que bloquean multicast), usa la IP de debajo.
Si hay dos servidores en la misma red, cambia el nombre: `NOMBRE=aula2 pnpm clase` (Windows PowerShell:
`$env:NOMBRE="aula2"; pnpm clase`). Para comprobar la conexión sin cargar el juego: `http://blockshot.local:3000/ping`. Tú también puedes jugar desde tu propio navegador.

**Si nadie consigue entrar:** casi siempre es el cortafuegos. En Windows, la primera vez que arranca Node aparece
un aviso: marca _Redes privadas_ y acepta. Si no salió, añade una regla de entrada para el puerto TCP 3000.
Algunas wifis de centros educativos aíslan a los clientes entre sí; en ese caso usa un punto de acceso propio
(un router o el móvil compartiendo red).

## Interfaz

La interfaz sigue el diseño de `../capturas-para-claude-design/` (Claude Design, «interfaz v2»): todas las pantallas se
dibujan sobre un lienzo de 1280×720 que se escala solo hasta ×1.5 en 1920×1080 (`--s`, calculado en `client/src/ui/ui.tsx`).
Incluye las 8 mejoras del diseño: cortinilla de bloques al entrar y reaparecer, vida que suelta trozos al perder cada
cuarto, contador de aciertos seguidos (×N), pastilla de líder en todos contra todos, «sonido visual» (marcas alrededor
de la mira hacia pasos y disparos de enemigos cercanos), tarjetas de «Mejor jugada» al acabar la partida, sacudida suave
al recibir daño (desactivable en Ajustes) y teclas que se hunden al pulsarlas en la pausa y el manual. Con
«reducir movimiento» activado en el sistema (`prefers-reduced-motion`) se quitan la cortinilla, la sacudida y los trozos.

## Para desarrollar

```bash
pnpm dev          # servidor con recarga (tsx, puerto 3000) + Vite con HMR en http://localhost:5173
pnpm lint         # ESLint
pnpm typecheck    # TypeScript en los tres paquetes
pnpm test         # todos los tests (unitarios + end-to-end con el servidor real)
pnpm test:unit    # solo los unitarios (rápido)
pnpm format       # Prettier
```

En desarrollo aparece un panel de FPS (stats.js) abajo a la derecha; en la versión compilada no existe. Los commits
pasan por Husky: lint-staged (ESLint + Prettier) y commitlint (conventional commits).

## Cómo se juega

1. Escribe tu nombre.
2. Crea una sala (nombre, contraseña opcional, mapa, tamaño y máximo de jugadores) o entra en una de la lista. Las salas con 🔒 piden contraseña.
3. Elige personaje y skin (se ven en 3D; arrastra para girarlos). Al morir reapareces solo a los 3 s con el mismo; pulsa **B** mientras estás muerto si quieres cambiarlo.
4. **Modos** (quien crea la sala elige a cuántos puntos se juega):
   - **Todos contra todos:** gana el primero en llegar a las bajas elegidas (20 por defecto).
   - **Por equipos** (Rojo contra Azul: al entrar se te pone en el equipo con menos gente y puedes cambiarte en la
     pantalla de personaje o con **T**): gana el primer equipo en llegar a las bajas elegidas, sin fuego amigo.
   - **Captura la bandera:** roba la bandera rival y llévala a tu base con la tuya en casa.
   - **Escalada de armas:** todos llevan la misma arma y cada baja da la siguiente; gana quien elimine con el cuchillo.
   - **Confirmar bajas** (Rojo contra Azul): cada baja suelta una placa; si la recoge el equipo del que mató suma un
     punto, si la recoge un compañero de la víctima la niega. Gana el primer equipo en llegar a las placas elegidas.
   - **Infectados:** con 2 jugadores empieza una cuenta atrás de 10 s y uno se convierte en infectado (solo cuchillo,
     +30 % de vida y +15 % de velocidad). Cada superviviente que cae se infecta. Ganan los infectados si no queda nadie;
     los supervivientes, si aguantan los minutos elegidos (2, 3 o 5).
   - **Dominio** (Rojo contra Azul): tres zonas, A, B y C. Quédate en una sin rivales dentro para capturarla; cada 2 s
     tu equipo suma un punto por zona. Gana el primero en llegar a los puntos elegidos (100, 150 o 250).
   - **Rondas** (Rojo contra Azul, vale para 1 contra 1): no se reaparece durante la ronda; gana la ronda el equipo que
     deje al otro sin nadie en pie (si se acaban los 2 min, el que tenga más gente viva). Gana quien gane 3, 5 o 7 rondas.

   Al terminar, durante 12 s se ve el resultado y se **vota** la siguiente partida entre tres mapas y modos (si nadie
   vota, se repite la misma). En los modos por equipos, los equipos se **equilibran** solos según la partida anterior.
   Todos los personajes llevan cuchillo (tecla **3**); por la espalda mata de un golpe, y una **granada** por vida.
   Al morir ves una **repetición** de tus últimos segundos desde los ojos de quien te eliminó. Las bajas especiales dan
   **medallas** (primera sangre, doble y triple baja, venganza, desde el aire, por la espalda y tiro lejano).

| Tecla             | Acción                                                                                             |
| ----------------- | -------------------------------------------------------------------------------------------------- |
| WASD              | Moverse                                                                                            |
| Espacio           | Saltar (mantén pulsado para encadenar saltos: bunny hop)                                           |
| C / Ctrl          | Agacharse (más preciso y más bajo). Corriendo: deslizarse (desliza + salta = mucha velocidad)      |
| Shift             | Esprintar hacia delante                                                                            |
| Clic izquierdo    | Disparar                                                                                           |
| Clic derecho      | Apuntar: más zoom y precisión, pero te mueves más despacio (mira telescópica con el francotirador) |
| R                 | Recargar                                                                                           |
| G                 | Lanzar la granada (una por vida; rebota, explota a los 2 s y las paredes cubren)                   |
| 1 / 2 / Q / rueda | Cambiar de arma                                                                                    |
| Tab               | Marcador                                                                                           |
| B                 | Cambiar de personaje (solo estando muerto)                                                         |
| T                 | Cambiar de equipo (por equipos; espera 5 s entre cambios y no vale en pleno combate)               |
| V y 1–8           | Chat rápido: frases fijas (las tácticas solo las ve tu equipo)                                     |
| O                 | Ajustes: mira (6 estilos, color, tamaño…), sensibilidad, campo de visión y volumen                 |
| H / F1            | Manual del juego (controles, personajes, armas y trucos)                                           |
| Esc               | Pausa (soltar el ratón); otro Esc vuelve al juego                                                  |

**Ctrl+W no cierra el juego:** al pulsar "Jugar" el juego pasa siempre a pantalla completa y bloquea los atajos
del navegador (Chrome y Edge). En Firefox, o si se sale de pantalla completa, el navegador pregunta antes de cerrar
la pestaña.

La vida se regenera tras 5 s sin recibir daño. Los disparos a la cabeza hacen más daño.

**Movimiento estilo Krunker:** no hay estamina (sprint y slide sin límite; se puede volver a activar con
`PLAYER.useStamina` en `shared/src/player/player.ts`). El slide dura más y frena menos, y encadenar **slide + salto + slide al
aterrizar** (slide-hop) gana un poco de velocidad cada vez. En el aire la velocidad se conserva; en el suelo, por encima
de un tope suave, se frena poco a poco. Todo se ajusta en `PLAYER` (`softCap`, `maxSpeed`, `slideTime`, `slideGain`…).

**Plataformas de salto:** las placas verdes del suelo lanzan a unos 5,5 m de altura conservando la velocidad. Hay en
todos los mapas (junto a la torre del Patio, ante las entreplantas del Almacén, al pie de las mesetas del Desfiladero, en
el medio de Polvo y en las calles de Ciudad). Para poner una en un mapa nuevo: `pad(B, x, z)`.

**Recompensas por racha:** con 5 bajas seguidas, **Radar** (12 s viendo a todos los enemigos en el minimapa, tú y tu
equipo); con 7, **Blindaje** (+50 que se gasta antes que la vida y no se regenera). Se configuran en `STREAK_REWARDS`.
No hay en Infectados.

**Armas:** las pesadas (francotirador, ametralladora) frenan al llevarlas en la mano; saca la secundaria para correr.
Apuntar tarda un momento (más con las pesadas) y la precisión llega al terminar de subir el arma. Casi todas pierden
daño con la distancia. El francotirador hace 120 al cuerpo y 240 a la cabeza: de un tiro al cuerpo mata a todos menos al Tanque (140 de vida), al que hay que darle en la cabeza; tras
cada disparo hay que volver a apuntar (cerrojo), y si te mueves o saltas con la mira puesta el tiro se desvía.

En pantalla: **minimapa** (aliados en verde; los enemigos solo aparecen en rojo 2 s después de disparar),
**números de daño** al acertar, **rachas** (3, 5, 7 y 10 bajas seguidas) en el killfeed, indicador de dirección
del daño y el **ping** arriba. En el marcador (Tab) se ven bajas, muertes, racha y ping de cada jugador.

## Personajes

Más vida = más lento. La velocidad (m/s) es con la principal / con la secundaria en la mano.

| Personaje | Vida | Velocidad | Principal       | Secundaria |
| --------- | ---- | --------- | --------------- | ---------- |
| Rayo      | 90   | 8.6 / 8.9 | Subfusil        | Pistola    |
| Cazador   | 90   | 7.2 / 7.8 | Francotirador   | Pistola    |
| Soldado   | 100  | 7.1 / 7.5 | Rifle de asalto | Pistola    |
| Bastión   | 120  | 6.6 / 7.3 | Ametralladora   | Revólver   |
| Tanque    | 140  | 6.5 / 6.8 | Escopeta        | Revólver   |

## Estructura

```
shared/src/             ← lo que comparten servidor y cliente (aquí se balancea el juego)
  player/               PLAYER (movimiento, vida…) y PAD (plataformas de salto)
  weapons/              WEAPONS y WEAPON_HANDLING (dispersión, retroceso…)
  characters/           CHARACTERS y SKINS
  modes/                MODES, escaleras de armas, CTF, placas, infectados, rachas
  maps/                 un archivo por mapa en builders/, getMap
  movement/             simulación de movimiento determinista (la usan servidor y cliente)
  physics/              raycast e hitboxes
  net/                  eventos tipados, esquemas Valibot, constantes de red
server/src/
  network/              entrada Socket.IO (validación y límite de mensajes), LAN y mDNS
  rooms/                salas: crear, unirse, salir
  players/              jugador, spawns, movimiento autoritativo, historial de lag comp
  combat/               disparos, daño, estrategias de arma (bala / cuchillo)
  modes/                una estrategia por modo de juego
  match/                fin de partida y «Mejor jugada»
  game/                 bucle de paso fijo y snapshots
server/test/e2e/        tests con el servidor real y bots que juegan
client/src/
  lobby/  characters/  manual/  settings/  ui/  network/
  game/
    engine/             motor (fuera de React): entrada, predicción, rivales, armas, cámara, efectos…
    hud/                HUD con Zustand, minimapa, marcador
    screens/            muerte, pausa, marcador y fin de partida, selección
    render/             mundo y modelos hechos con cajas
    audio/              sonidos sintetizados
```

`REFACTOR_LOG.md` explica cada decisión de la migración a esta arquitectura.

## Cómo funciona la red

- **Movimiento autoritativo:** el cliente manda sus entradas (teclas, mirada) a 60 pasos por segundo y predice su
  propio movimiento con la misma simulación que el servidor (`shared/src/movement`), así responde al instante. El
  servidor simula esas entradas a paso fijo y le confirma su posición real; si no coinciden, el cliente se corrige
  suavemente. Mandar más entradas no hace ir más rápido: cada jugador solo gasta el tiempo que de verdad pasó.
- El servidor manda un snapshot de todos los jugadores 20 veces por segundo; los rivales se dibujan 100 ms en el
  pasado, interpolados entre snapshots, para verse suaves.
- **Los disparos los decide el servidor**: el cliente envía origen y dirección, y el servidor comprueba cadencia,
  munición y recarga, lanza el rayo contra paredes y hitboxes, y aplica el daño. El cliente solo dibuja trazadoras.
- **Compensación de lag:** el servidor guarda el último segundo de posiciones de cada jugador y, al recibir un
  disparo, coloca a los rivales donde los veía el tirador (su ping / 2 + ~100 ms de suavizado, máximo 250 ms).
  Si en tu pantalla le diste, cuenta.
- Todo mensaje que llega al servidor se valida (Valibot) y se limita por socket; lo inválido se descarta y se
  registra (Pino). No es un anticheat de torneo, pero ya no se puede atravesar paredes ni correr más de la cuenta.
- Si se cae la conexión en plena partida, vuelves al lobby, se reconecta solo y te avisa.

## Ampliarlo

- **Arma nueva:** añádela en `WEAPONS` (`shared/src/weapons/weapons.ts`, con su peso, rapidez al apuntar y caída de
  daño) y dibújala en `GUNS` (`client/src/game/render/models.ts`) con piezas `box(...)` y `cyl(...)`.
- **Personaje nuevo:** añade una entrada en `CHARACTERS` (`shared/src/characters`). La selección y el manual se
  generan solos. Para un accesorio propio (casco, gorra…), añade una función en `EXTRAS` (`models.ts`).
- **Skin nueva:** su id en `SKINS` (`shared/src/characters`) y sus colores en `skinPalette` (`models.ts`).
- **Modo nuevo:** un archivo en `server/src/modes/` que implemente `GameMode` (equipo al entrar, qué pasa con cada
  baja, `tick`…), una línea en `server/src/modes/index.ts`, su entrada en `MODES` (`shared/src/modes`) y su
  presentación en `client/src/game/modeUi.ts`.
- **Ajustes y mira:** valores por defecto en `client/src/settings/settingsStore.ts`; se guardan en el navegador.
- **Mapas:** hay seis (Patio, Almacén, Desfiladero, Polvo, Ciudad y Obra) en tres tamaños (pequeño 52 m, mediano 80 m,
  grande 112 m). Cada mapa es una función en `shared/src/maps/builders/` que recibe `H` (mitad del lado) y coloca cajas
  con `B(x, y, z, ancho, alto, fondo, tipo)` (x/z = centro, y = base) y spawns con `S(x, z)`. Para añadir uno, escribe
  su función y regístrala en `MAP_DEFS` (`shared/src/maps/maps.ts`). Todo lo que sea caja tiene colisión y bloquea
  balas. Si cambias un mapa a propósito, actualiza su huella en `shared/src/maps/golden.test.ts`.
- **Partida más corta o larga:** las opciones de puntos de cada modo en `MODES` (`shared/src/modes/modes.ts`).
