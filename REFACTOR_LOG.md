# REFACTOR_LOG — BLOCKSHOT

Registro de la migración a monorepo TypeScript con servidor autoritativo. Objetivo: **mismo gameplay**, mejor código.

Rama: `refactor/arquitectura` (sale de `mecanicas-krunker`, commit `9971280`).

---

## 0. Diagnóstico inicial

### Stack actual

| Capa               | Tecnología                                                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Gestor de paquetes | npm, un solo `package.json` en la raíz                                                                                                |
| Cliente            | React 18 + Vite 5, **JavaScript** (sin tipos), three.js 0.169 imperativo (sin R3F)                                                    |
| Estado de UI       | `useState` en `Game.jsx`; el motor llama a `setHud(obj)` 15 veces/s con un objeto nuevo → se re-renderiza todo el árbol de la partida |
| Estilos            | Un único `styles.css` de 948 líneas con variables CSS (diseño «Claude Design v2»)                                                     |
| Audio              | Sonidos sintetizados con WebAudio a mano (`sound.js`), sin archivos                                                                   |
| Red                | Socket.IO 4 con parser JSON por defecto, nombres de eventos como strings sueltos                                                      |
| Servidor           | Node + Express + Socket.IO, **un solo archivo** `server/index.js` (~750 líneas)                                                       |
| Compartido         | `shared/config.js` (constantes + mapas) y `shared/physics.js` (raycast AABB/esfera)                                                   |
| Calidad            | Nada: sin linter, sin formateador, sin tests, sin hooks                                                                               |

### Inventario de funcionalidades (checklist para la verificación final)

**Mapas** (5 × 3 tamaños: pequeño 52 m, mediano 80 m, grande 112 m):

- [x] Patio: torre central con escaleras, muros con hueco, habitaciones en las esquinas, 4 plataformas de salto
- [x] Almacén: contenedores en columnas (aleatorio con semilla), entreplantas con barandilla, 4 plataformas
- [x] Desfiladero: cañón, dos mesetas, 3 puentes, casetas, rocas, 2 plataformas
- [x] Polvo: casas, túnel, zonas A/B, puertas con dintel, 2 plataformas
- [x] Ciudad: manzanas generadas, callejones, plazas, azoteas con escalera, coches, plataformas en calles
- [x] Decoración (barriles, árboles, farolas, cactus, sacos, palés, coches) que se descarta si choca o tapa un spawn
- [x] Paisaje exterior por tema (pueblo, industrial, desierto, ciudad), cielo con degradado, nubes, sol, niebla
- [x] Spawns con orientación hacia la dirección más despejada; bases de CTF (spawn más al oeste/este)

**Armas** (8): rifle, francotirador, escopeta (10 perdigones), subfusil, ametralladora, pistola, revólver, cuchillo.

- [x] Daño con caída por distancia (`falloff`), multiplicador a la cabeza, cadencia, cargador, recarga
- [x] Dispersión: cadera/apuntando, movimiento, aire, agachado, sprint, _bloom_ por ráfaga
- [x] Retroceso que se recupera solo; cerrojo del francotirador (sale de la mira), mira telescópica
- [x] Peso del arma (velocidad), velocidad al apuntar (`adsSpeed`, `adsMove`)
- [x] Cuchillo: golpe con asistencia (cono de 0.8), puñalada por la espalda = 200

**Personajes** (5): Soldado, Cazador, Tanque, Rayo, Bastión. **Skins** (5): Clásico, Camuflaje, Nocturno, Ártico, Dorado.

**Modos** (6):

- [x] Todos contra todos (10/20/30/50 bajas)
- [x] Por equipos (20/40/60/100), sin fuego amigo, equipo con menos gente al entrar, cambio con T (espera 5 s, no en combate)
- [x] Captura la bandera (1/3/5/7): coger, soltar al morir, devolver tocándola, vuelve sola a los 20 s, spawns por mitad
- [x] Escalada de armas (5 u 8 armas), baja a cuchillo baja un nivel a la víctima
- [x] Confirmar bajas (15/30/50/75): placas que caen, confirmar/negar, duran 30 s
- [x] Infectados (2/3/5 min): cuenta atrás de 10 s, primer infectado aleatorio, cuchillo + 30 % vida + 15 % velocidad, contagio, victoria por tiempo o exterminio, re-elección si el infectado se va

**Movimiento:** WASD, salto con _coyote time_ y _buffer_, bunny hop, agacharse, slide con slide-hop, sprint, aceleración en el aire estilo Quake, tope suave/duro de velocidad, subir escalones (0.55 m), plataformas de salto, estamina desactivada (activable).

**Sistemas:** protección de reaparición (4 s o hasta disparar), regeneración tras 5 s, reaparición a los 3 s, compensación de lag (historial de 1 s, máx. 250 ms), anti-teletransporte, rachas (3/5/7/10) con recompensas (Radar 5, Blindaje 7), «Mejor jugada» al final, reinicio a los 8 s, salas con contraseña (SHA-256), máximo de jugadores, ping, mDNS `blockshot.local`, `/ping`.

**Pantallas:**

- [x] Lobby: nombre, crear sala (nombre, contraseña, mapa con miniatura, modo, puntos, tamaño, máx. jugadores), lista de salas, modal de contraseña, aviso sin conexión con «Reintentar», toast de error
- [x] Selección de personaje: lista 1–5, vista 3D girable, skins, ficha con armas, selector de equipo, «Seguir con…», Enter para jugar
- [x] HUD: info de sala + ping, minimapa (aliados, enemigos al disparar, radar, banderas, placas), marcador superior por modo, killfeed, vida a trozos + blindaje + estamina, munición y ranuras, mira configurable dinámica, hitmarker, números de daño 3D, indicador de dirección del daño, «sonido visual», combo ×N, banner de baja, mira telescópica, aviso de bandera, protección, viñeta
- [x] Muerte (quién te mató, cuenta atrás, cambiar personaje con B), pausa (Esc), marcador (Tab), fin de partida con «Mejor jugada»
- [x] Ajustes (mira 6 estilos/color/tamaño/grosor/separación/contorno/dinámica; sensibilidad, sensibilidad al apuntar, FOV, volumen; daltonismo 3 modos, sacudida)
- [x] Manual (5 pestañas), cortinilla de bloques, teclas que se hunden, escala de UI (`--s`), `prefers-reduced-motion`
- [x] Pantalla completa + bloqueo de teclado (Ctrl+W), aviso `beforeunload`
- [x] Persistencia local: nombre, personaje, skin por personaje, ajustes

**Eventos de red actuales** — cliente→servidor: `rooms:list`, `room:create`, `room:join`, `room:leave`, `net:ping`, `player:spawn`, `team:set`, `player:state`, `player:switch`, `player:reload`, `player:shoot`. Servidor→cliente: `rooms`, `notice`, `state`, `player:spawned`, `player:correct`, `damaged`, `hitmarker`, `kill`, `shot`, `loadout`, `flag`, `tag`, `match:end`, `match:start`.

### Problemas encontrados

1. **Movimiento autoritativo del cliente.** El cliente manda su posición y el servidor solo aplica un anti-teletransporte muy permisivo: se puede volar o atravesar paredes.
2. **Validación a mano e incompleta** de mensajes, sin registro de mensajes inválidos ni límite de mensajes por socket.
3. **Archivos-dios.** `Engine.js` (~1350 líneas) mezcla entrada, red, física, armas, efectos, cámara y HUD; `server/index.js` mezcla HTTP, salas, modos, combate, red y mDNS.
4. **Reglas de modo dispersas** en `if (room.mode === …)` por todo el servidor: añadir un modo obliga a tocar 6 sitios.
5. **Re-render de React a 15 Hz** de toda la partida (un objeto HUD nuevo en cada tick).
6. **Asignaciones por disparo:** cada trazadora, impacto y número de daño crea malla + material nuevos.
7. **Números mágicos** fuera de `config.js`: `VIEW_DELAY_MS`, `HUD_MS`, 3000 ms de «en combate», 1000 ms de historial, 400 ms de bloqueo de sprint, 2.5 m de tolerancia vertical de banderas/placas, rangos de _clamp_…
8. **Duplicación:** `rng()` en `config.js` y `world.js`; `TEAM_TXT` en HUD y marcador; `floorBelow` y `groundAt` casi iguales.
9. **Sin tipos ni tests**: cualquier cambio en `config.js` puede romper cliente o servidor sin aviso.

---

## 1. Monorepo pnpm + tooling de calidad

**Qué:** `pnpm-workspace.yaml` con tres paquetes (`@blockshot/client`, `@blockshot/server`, `@blockshot/shared`),
scripts raíz (`dev`, `build`, `start`, `clase`, `lint`, `typecheck`, `test`, `format`), ESLint flat config
(`@eslint/js` + `typescript-eslint` + `react-hooks` + `eslint-config-prettier`), Prettier, EditorConfig, Browserslist
(en `client/package.json`), Husky (`pre-commit` → lint-staged, `commit-msg` → commitlint convencional) y
`tsconfig.base.json` estricto (`strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`).

**Archivos:** `package.json`, `pnpm-workspace.yaml`, `eslint.config.js`, `.prettierrc.json`, `.editorconfig`,
`.gitattributes`, `commitlint.config.js`, `.husky/*`, `*/package.json`, `*/tsconfig.json`; `vite.config.js` pasa a
`client/` (el build sale en `client/dist`, que es lo que sirve el servidor).

**Decisiones:**

- Versiones mayores conocidas y estables (ESLint 9, TypeScript 5.6, Vitest 2, Vite 5) en vez de las últimas: la
  migración ya cambia bastante; no se mezcla con saltos de versión mayor.
- `allowJs` sin `checkJs` mientras dure la migración: el typecheck pasa desde el primer paso y cada archivo se vuelve
  estricto al pasarlo a `.ts`.
- `no-empty` con `allowEmptyCatch`: los `catch {}` de `localStorage` son intencionados (modo privado).
- Finales de línea LF en el repo (`.gitattributes`), formato con Prettier en un commit aparte (`style:`) para que la
  historia de cambios reales siga siendo legible.
- Errores de lint corregidos sin cambiar comportamiento: ternarios usados como sentencia → `if/else`; import sin usar
  (`STREAKS` en el servidor); dependencias de `useEffect` que faltaban (`room.mode`, `room.scoreLimit`, que no cambian
  durante una partida porque `Game` se monta con `key={room.id}`).

## 2. Paquete /shared: tipos, constantes y eventos tipados

**Qué:** `shared/config.js` y `shared/physics.js` pasan a TypeScript estricto en `shared/src`, organizado por dominio:

```
shared/src/
  core/math.ts          Vec3, round2, clamp, rng y seedOf (antes duplicado en config.js y world.js)
  physics/raycast.ts    rayAABB, raySphere, hitboxes, castShot (+ medidas de hitbox con nombre)
  player/player.ts      PLAYER, PAD
  weapons/weapons.ts    WEAPONS (Record<WeaponId, Weapon>), damageAt, weightName, constantes de cuchillo
  characters/…          CHARACTERS, CHAR_BY_ID, SKINS, speedWith
  modes/modes.ts        MODES, ladders, FLAG, TAG, INFECT, TEAMS, teamName, rachas, loadoutOf…
  maps/                 types, props, builders/ (un archivo por mapa), maps.ts (getMap, getColliders, groundAt, floorBelow)
  net/constants.ts      ticks, lag comp, tolerancias de validación, límites de nombres y salas
  net/events.ts         ClientToServerEvents / ServerToClientEvents y todos los payloads
```

**Archivos:** `shared/src/**`, `shared/package.json` (`exports` → `src/index.ts`, sin paso de build), imports de
cliente y servidor cambiados a `@blockshot/shared`; `world.js` usa el `rng` compartido.

**Decisiones:**

- **Red de seguridad: test «golden».** Antes de borrar el JS se calculó un SHA-256 de los 15 mapas (5 × 3 tamaños) y
  de todas las tablas de gameplay (armas, personajes, modos, jugador…). `shared/src/maps/golden.test.ts` exige que la
  versión TS produzca exactamente lo mismo, incluido el orden de claves. Pasa al 100 %: los mapas son idénticos bit a bit.
- Los números mágicos de `getMap` (margen de los muros, rayos y sesgo de la orientación del spawn, distancia de los
  objetos a los spawns) y los de validación de red pasan a constantes con nombre.
- El paquete compartido se consume como código fuente TS (Vite y tsx lo transpilan): sin build intermedio (KISS).
- El servidor (aún JS) se ejecuta con `tsx` para poder importar TS; se convierte a TS en el paso 3.

## 3. Servidor en TypeScript: validación (Valibot), logs (Pino), rate limit y modos con Strategy

**Orden ajustado:** el plan separaba validación (3), carpetas por feature (4) y Strategy de modos (7). En el servidor
se hicieron juntos para convertir `server/index.js` **una sola vez** a su forma final en vez de reescribirlo tres
veces. El cliente sigue su propio orden (pasos 4 y 6).

**Red de seguridad primero:** `server/test/e2e/` arranca el servidor real en un proceso hijo (puerto libre) y lo
maneja con bots Socket.IO que solo usan el protocolo público. Se escribieron **contra el servidor JS original**
(47 tests en verde) y después se reescribió el servidor sin tocarlos: lobby (valores por defecto, saneado, contraseña,
sala llena, borrado de salas vacías), combate (protección de reaparición, daño cuerpo/cabeza, bajas, regeneración,
puñalada por la espalda, sin fuego amigo, espera entre cambios de equipo) y todos los modos (Confirmar bajas,
Infectados, recompensas de racha, CTF, Escalada).

**Estructura:**

```
server/src/
  index.ts              arranque: HTTP + Socket.IO + tick fijo + anuncio LAN
  config.ts, logger.ts  entorno (PORT, NOMBRE, LOG_LEVEL) y Pino (bonito en terminal, JSON en tuberías)
  http/app.ts           Express: /ping y cliente compilado
  network/              gateway.ts (validación + rate limit + despacho), rateLimiter.ts, lan.ts (IP, mDNS, banner)
  rooms/                room.ts (Room + RoomChannel), registry.ts (crear/unirse/salir/lista)
  players/              player.ts, history.ts (lag comp), loadout.ts, spawn.ts, teams.ts, movement.ts
  combat/               shooting.ts, damage.ts, weaponBehavior.ts (Strategy: hitscan / cuerpo a cuerpo)
  modes/                gameMode.ts (interfaz Strategy) + un archivo por modo + index.ts (registro)
  match/match.ts        fin de partida, «Mejor jugada», reinicio
  game/tick.ts          regeneración y snapshot por sala
```

**Decisiones:**

- **`RoomChannel`**: la lógica de juego emite a través de una interfaz (`broadcast`, `broadcastVolatile`, `to`) y no
  conoce Socket.IO. Permite tests unitarios de modos con un canal falso (paso 10).
- **Strategy de modos (`GameMode`)**: `initialTeam`, `onKill`, `tick`, `filterSpawns`, `hpFactor`, `onMatchReset`,
  `snapshot`, `streakRewards`. Cada modo guarda su propio estado (banderas, placas, infección). Añadir un modo = un
  archivo + una línea en `modes/index.ts`. Desaparecen los `if (room.mode === …)` repartidos por el servidor.
- **Strategy de armas (`WeaponBehavior`)**: `hitscan` y `melee` (asistencia de cuchillo y puñalada). `usesAmmo`
  sustituye a los `!w.melee` dispersos.
- **Valibot** en `shared/src/net/schemas.ts`: valida forma y tipos de cada mensaje; las reglas (cadencia, munición,
  distancias) siguen en la lógica. Un mensaje inválido se descarta y se registra (`message dropped`, con motivo).
  Cambio menor y deliberado: antes un cliente que mandaba tipos erróneos (p. ej. un número como nombre) recibía un
  valor por defecto; ahora el mensaje se descarta. El cliente real siempre manda tipos correctos.
- **Rate limit**: _token bucket_ por socket y categoría (movimiento 60/s, combate 40/s, lobby 5/s con ráfaga de 10,
  resto 10/s). El juego normal queda muy por debajo. Los avisos de descarte se limitan a uno por segundo y socket.
- **Build del servidor** con tsup (un único `dist/index.js` con `@blockshot/shared` incluido); `tsx watch` en desarrollo.
- `floorBelow` del servidor y de CTF pasa a `/shared` (antes duplicado con `groundAt`).

## 4. Cliente: carpetas por feature y TypeScript estricto

**Qué:** el cliente pasa de `components/` + `game/` a carpetas por dominio y todo (salvo el motor) a TS estricto:

```
client/src/
  main.tsx, env.d.ts      arranque y tipos globales (variables CSS en `style`)
  app/App.tsx             sesión y cortinilla entre lobby y partida
  ui/ui.tsx               teclas vivas, Check, Slider, cortinilla, escala --s (uiScale)
  network/socket.ts       socket tipado con los eventos de /shared
  settings/               settingsStore.ts, palette.ts (daltonismo), SettingsDialog.tsx, Crosshair.tsx
  lobby/                  Lobby.tsx, MapPreview.tsx
  characters/             CharacterSelect.tsx, CharacterPreview.tsx
  manual/Manual.tsx
  game/
    Game.tsx, roomView.ts
    hud/                  HUD.tsx, Minimap.tsx, Scoreboard.tsx, hudState.ts, teamStyle.ts
    render/               world.ts (mapa y paisaje), models.ts (personajes y armas)
    audio/sound.ts
    engine/Engine.js      (se convierte en el paso 5, junto con el movimiento autoritativo)
  styles/styles.css
```

**Decisiones:**

- `Engine.js` se deja en JS en este paso: el paso 5 cambia su movimiento por la simulación compartida y se divide en
  módulos; convertirlo dos veces no aporta nada.
- **Minimapa desacoplado:** antes leía `remotes`, `tags`, `flags`, `pos`… del motor. Ahora el motor expone
  `minimap(now): MinimapView` (interfaz `MinimapSource`) y el componente solo pinta.
- **DRY:** `TEAM_TXT` / `var(--eq-…)` estaban repetidos en HUD, marcador, fin de partida y selector de equipo →
  `hud/teamStyle.ts`.
- `settings.ts` y `Settings.tsx` chocaban en Windows (sistema de archivos sin mayúsculas) → `settingsStore.ts` y
  `SettingsDialog.tsx`.
- Comentarios del código traducidos al inglés en los archivos convertidos (regla 6); los textos de la interfaz siguen
  en español.
- `buildArms` pierde un parámetro que no usaba (`gunId`).
- Números mágicos con nombre: escalas de barras de la ficha, tiempos del killfeed y del banner, umbrales de vida y
  munición baja, cortinilla, vista previa 3D, minimapa.

**Verificado:** lint, typecheck, build y 50 tests en verde; prueba en navegador (Chrome sin ventana) del lobby,
Infectados en Almacén, plataformas de salto (5,6 m) y velocidad (9,2 m/s corriendo, 10,7 m/s con slide-hop), sin
errores de consola.

## 5. Servidor autoritativo + tick fijo + snapshots + predicción e interpolación

**Antes:** el cliente movía a su jugador y mandaba su posición; el servidor solo aplicaba un anti-teletransporte
permisivo (4 m + 40 m/s): se podía atravesar paredes o volar.

**Ahora:**

1. **Simulación compartida** (`shared/src/movement/movement.ts`): port fiel de `updateMovement`/`moveAxis` como
   función pura `stepMovement(state, input, dt, ctx)`. Los tiempos absolutos del original (`now - slideEndAt`,
   `jumpPressedAt`, `sprintBlockUntil`, `staminaAt`) pasan a contadores en segundos dentro del estado, que así es
   determinista y serializable. Paso fijo `FIXED_DT = 1/60`.
2. **Command pattern:** el cliente manda `player:input` con lotes de `MoveInput` (uno por paso: ejes, yaw/pitch,
   botones en bits, arma en la mano) cada 50 ms. Disparar marca `BTN_SHOT`, que bloquea el sprint 0,4 s igual que antes.
3. **Servidor:** bucle de paso fijo (`game/loop.ts`, acumulador sobre `performance.now`). Cada paso de 1/60 s simula
   las órdenes en cola de cada jugador y guarda el historial de lag comp (ahora a 60 Hz, antes 20 Hz). Cada 3 pasos
   (50 ms, como antes) reglas del modo, regeneración, snapshot y un `player:ack` por jugador con su estado autoritativo.
   **Anti speed-hack:** cada jugador solo gasta el tiempo de simulación que de verdad pasó (más 0,25 s de margen para
   el jitter); mandar órdenes más rápido no te hace ir más rápido (test e2e).
4. **Predicción y reconciliación** (`client/.../localPlayer.ts`): el cliente simula cada orden al instante; al llegar
   un ack vuelve al estado del servidor y re-simula las órdenes no confirmadas. Las diferencias se suavizan (offset que
   decae), y las grandes (>4 m) saltan. Un contador de «vidas» descarta acks de antes de reaparecer.
5. **Interpolación de remotos** (`remotePlayers.ts`): buffer de snapshots por jugador, dibujado `VIEW_DELAY_MS`
   (100 ms) en el pasado entre dos snapshots. Es exactamente el retraso que la compensación de lag ya suponía.

**Motor del cliente en TypeScript, dividido por responsabilidad** (`client/src/game/engine/`): `Engine.ts`
(orquesta y bucle fuera de React), `input.ts`, `localPlayer.ts`, `remotePlayers.ts`, `weapons.ts`, `viewModel.ts`,
`cameraRig.ts`, `objectives.ts` (banderas y placas), `effects.ts` + `pool.ts`, `netClient.ts`, `events.ts` (bus de
eventos) y `audio/audioEvents.ts`.

**Verificación de que el movimiento es el mismo:**

- **Equivalencia exacta con el original:** se ejecutó el `updateMovement` original (extraído de git) a la vez que la
  simulación nueva, con las mismas entradas en el mapa Patio real: 117 m de recorrido (andar, sprint, slide-hop,
  strafe con bunny hop, agacharse, plataforma de salto hasta 5,7 m, choques). **Diferencia máxima: 0,000000 m.**
- 14 tests unitarios de la simulación (velocidad, sprint, bloqueo por disparo, salto y _buffer_, paredes, escalones,
  plataformas, slide, bunny hop, tope de velocidad, determinismo, caída fuera del mapa).
- En el navegador: 101 acks del servidor con **corrección 0** (la predicción coincide paso a paso); dos navegadores
  a la vez ven moverse al otro (14 m en 2 s) sin errores de consola.
- Los 47 tests e2e siguen en verde con bots que ahora **andan de verdad** (A* sobre la rejilla del mapa en
  `test/e2e/pathfinding.ts`), más 2 nuevos: plataformas aplicadas por el servidor y anti speed-hack.

**Decisiones y cambios de comportamiento (mínimos):**

- `player:state` y `player:correct` desaparecen del protocolo (ya no hay posición informada por el cliente que
  corregir). La comprobación del origen del disparo pasa de 3 m fijos a 3 m + velocidad × 0,25 s, porque el cliente va
  un poco por delante del servidor; antes de cada disparo se envían las órdenes pendientes.
- El ack es fiable (no volátil): sale justo después del snapshot volátil y Socket.IO descarta un mensaje volátil
  mientras el transporte está ocupado, así que como volátil no llegaba nunca.
- El movimiento local ahora va a paso fijo de 60 Hz con interpolación de render, en vez de un paso por frame. En
  pantallas de 60 Hz es idéntico; en otras evita que la física dependa de los FPS.
- Los remotos se ven 100 ms en el pasado y suaves (antes perseguían el último snapshot con un `lerp`).
- Test e2e de protección de reaparición: andar hasta el punto de tiro tarda más que los 4 s de protección, así que el
  e2e comprueba el lado del protocolo (`pr` y que disparar la quita) y el bloqueo de daño pasa a test unitario (paso 10).
- `Infinity` en los temporizadores se cambia por 1e6: JSON lo convierte en `null` y rompía el ack.

## 6. Game loop fuera de React + HUD con Zustand

**Game loop:** desde el paso 5 vive en `Engine.ts` (`requestAnimationFrame` propio, simulación a paso fijo); React no
participa en el frame.

**Antes:** el motor llamaba a `setHud(objeto nuevo)` 15 veces por segundo y se re-renderizaba **todo** el árbol de la
partida (HUD, minimapa, marcador…).

**Ahora:**

- `game/hud/hudStore.ts` (Zustand): `publishHud()` fusiona el estado nuevo conservando la referencia anterior de cada
  campo cuyo contenido no cambió (y el objeto entero si no cambió nada). Si nada cambió, no notifica.
- `useHud(selector)` (con `useShallow`): cada pieza del HUD se suscribe solo a sus campos. `HUD.tsx` se divide en
  `Health`, `Ammo`, `TopCenter`, `Vignette`, `AimCrosshair`, `CenterMarks`, `CarryingFlag`, `SpawnProtection`, `RoomInfo`.
- `Game.tsx` solo selecciona lo que decide qué pantalla se ve (vivo, en pausa, equipo…). Las pantallas pasan a
  `game/screens/`: `DeathScreen`, `PauseMenu`, `ScoresLayer` (marcador y fin de partida), `CharacterScreen`.
- El HUD recibe `HudPlayer` (sin posiciones, que cambian cada tick y no le interesan).
- El killfeed solo cambia de estado cuando una línea empieza a desvanecerse o desaparece (antes cada 300 ms).
- `hitMark` explícito: antes el marcador de impacto desaparecía porque todo se re-renderizaba 15 veces por segundo.

**Medido en el navegador** (commits de React por segundo, con un hook falso de DevTools):

|                          | Quieto | Corriendo |
| ------------------------ | ------ | --------- |
| Antes (commit `8feff6a`) | 11     | 12        |
| Ahora                    | 0,7    | 8,3       |

Y cada commit de ahora toca solo el componente afectado (por ejemplo la mira, cuya dispersión cambia al correr), no
toda la pantalla. 3 tests unitarios del store.

## 7. Patrones: Strategy, Command, Object Pool, Observer

La mayor parte se aplicó donde tocaba al reescribir cada pieza; aquí se resume y se completa:

| Patrón                       | Dónde                                                                                                 | Qué problema resuelve                                                                                                         |
| ---------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Strategy (modos)**         | `server/src/modes/` (`GameMode`, una fábrica por modo)                                                | las reglas de cada modo estaban en `if (room.mode === …)` repartidos por el servidor                                          |
| **Strategy (armas)**         | `server/src/combat/weaponBehavior.ts` (`hitscan`, `melee`)                                            | cuchillo: asistencia de golpe y puñalada sin ramas en el código de disparo                                                    |
| **Strategy de presentación** | `client/src/game/modeUi.ts` (tabla por modo)                                                          | textos del lobby, objetivo del marcador, columna de puntos y barra superior; antes eran cadenas de ternarios en 3 componentes |
| **Command**                  | `MoveInput` (`shared/movement`), `InputController.command()`                                          | el cliente manda intenciones por paso, no posiciones; el servidor las reproduce                                               |
| **Object Pool**              | `client/.../engine/pool.ts` + `effects.ts`                                                            | cada disparo creaba malla + material (y un canvas por número de daño)                                                         |
| **Observer**                 | `client/.../engine/events.ts` (`EventBus`) + `audio/audioEvents.ts`; `hudStore` (Zustand) para el HUD | el motor ya no llama a `sfx.*` ni a `setHud`; audio y HUD se suscriben                                                        |
| **Game Loop**                | `server/src/game/loop.ts` (paso fijo) y `Engine.loop` (paso fijo + render interpolado)                | movimiento independiente de los FPS y del temporizador de Node                                                                |

**No aplicado (a propósito):**

- Strategy de armas en el cliente: solo hay una rama (`melee` → tajo, si no → disparo) y la lógica autoritativa ya
  usa la estrategia del servidor. Una jerarquía más no aporta nada (YAGNI).
- ECS: la partida tiene pocos tipos de entidades (jugador local, remotos, banderas, placas, efectos) y cada uno ya
  tiene su módulo; un ECS no resuelve ningún problema concreto de este código.

Tests: 2 nuevos de `modeUi` (cada modo tiene presentación y se mantienen los textos originales).

## 8. Físicas con Rapier (no aplicado) y audio con Howler

**Rapier: decisión de no migrar** (regla 4). Motivos concretos de este proyecto:

- Los mapas son **solo cajas alineadas a los ejes** y la colisión jugador-mundo es una cápsula aproximada como caja
  contra AABB. La simulación compartida hace eso en unas 60 líneas puras y deterministas.
- El movimiento es la seña del juego (bunny hop, slide-hop, subir escalones de 0,55 m, _coyote time_, plataformas).
  Rapier obligaría a reimplementarlo sobre su _character controller_, con otra resolución de contactos: el tacto
  **cambiaría** (contra las reglas 1 y 5). Con la simulación actual se ha demostrado equivalencia exacta con el original.
- El servidor autoritativo ejecuta la misma función que el cliente sin WASM ni inicialización asíncrona; con Rapier
  habría que cargar ~2 MB de WASM en cada navegador y en el servidor solo para cajas.
- Los disparos ya usan raycast AABB/esfera compartido y probado.

Si algún día hay rampas u objetos dinámicos, la interfaz `stepMovement(state, input, dt, ctx)` permite cambiar la
implementación por debajo sin tocar red ni cliente.

**Howler: aplicado con criterio.** Los sonidos siguen sintetizados (no hay archivos de audio), pero el
`AudioContext` lo gestiona Howler: creación, desbloqueo con el primer gesto en todos los navegadores (incluido iOS) y
volumen global (`Howler.volume`). Las voces sintéticas se conectan a `Howler.masterGain` mediante un nodo propio.
Dos detalles que hubo que resolver:

- Howler puede **recrear el contexto** al desbloquear (si la frecuencia de muestreo no es 44,1 kHz, lo normal en PC a
  48 kHz): el sintetizador detecta el cambio y rehace sus nodos.
- `Howler.autoSuspend` duerme el contexto a los 30 s sin _Howls_ sonando, y los sonidos sintéticos no cuentan:
  se desactiva.

Verificado en el navegador: contexto en `running`, volumen de los ajustes aplicado, y 1 s de ráfaga de rifle genera
20 voces (10 disparos × ruido + golpe grave), igual que antes.

## 9. msgpack y rendimiento

**msgpack** (`socket.io-msgpack-parser` en servidor, cliente y bots de test). Medido con un snapshot realista de
12 jugadores y un ack:

| Mensaje                       | JSON   | MessagePack | Ahorro |
| ----------------------------- | ------ | ----------- | ------ |
| Snapshot (12 jugadores, 20/s) | 2816 B | 2049 B      | −27 %  |
| Ack (por jugador, 20/s)       | 369 B  | 270 B       | −27 %  |

Los números siguen viajando en float64, así que el estado del ack es **idéntico** al del servidor (la predicción sigue
con corrección 0 tras el cambio).

**Carga inicial del cliente:** el juego (three.js + motor) se carga con `React.lazy` solo al entrar en una sala, y las
librerías van en _chunks_ propios (`three`, `react`, `net`) que el navegador mantiene en caché entre versiones.

|                         | JS que descarga el lobby                                                   |
| ----------------------- | -------------------------------------------------------------------------- |
| Antes (un único bundle) | 859 KB                                                                     |
| Ahora                   | 281 KB (index + react + net); three + juego (579 KB) al entrar en una sala |

**Otras mejoras de rendimiento hechas en pasos anteriores (resumen):** HUD con suscripción por campo (11 → 0,7 commits
de React por segundo en reposo), efectos con _pool_, historial de lag comp a 60 Hz sin coste extra (se graba en el
mismo bucle), y el motor solo publica el HUD 15 veces por segundo.

## 10. Tests con Vitest

**Unitarios de la lógica del servidor** con un `RecordingChannel` falso (`server/src/testing/fakeRoom.ts`): salas y
jugadores reales, sin Socket.IO. Posible gracias a `RoomChannel` (paso 3).

| Archivo                                                                               | Qué cubre                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `combat/damage.test.ts`                                                               | protección de reaparición, blindaje antes que la vida, estadísticas de baja, fin de racha, Radar a 5 y Blindaje a 7, sin recompensas en Infectados                                                                                                                                                                                                         |
| `combat/shooting.test.ts`                                                             | multiplicador a la cabeza, cadencia, cargador, recarga, cambio de arma que cancela la recarga, origen lejano / perdigones de más / dirección inválida, caída por distancia, **compensación de lag** (sin rebobinar falla, rebobinando acierta), sin fuego amigo, asistencia y puñalada del cuchillo, cuchillo de frente                                    |
| `modes/modes.test.ts`                                                                 | los 6 modos: fin por límite y reinicio limpio, equipo con menos gente y puntuación, CTF (spawns por mitad, coger, soltar, devolver, capturar, vuelta sola), escalada (subir, bajar por cuchillazo, ganar), Confirmar bajas (confirmar, negar, caducar), Infectados (primer infectado, contagio, victoria por exterminio y por tiempo, reelección si se va) |
| `players/players.test.ts`                                                             | cola de órdenes (repetidas, tope), presupuesto de simulación, movimiento + historial, muertos no se mueven, spawn lejos del enemigo, «Mejor jugada»                                                                                                                                                                                                        |
| `rooms/registry.test.ts`                                                              | saneado de textos, puntuación por defecto, contraseña, sala llena, borrado de salas vacías                                                                                                                                                                                                                                                                 |
| `network/rateLimiter.test.ts`                                                         | ráfaga, recarga y categorías independientes                                                                                                                                                                                                                                                                                                                |
| `shared/.../raycast.test.ts`, `movement.test.ts`, `schemas.test.ts`, `golden.test.ts` | raycast y hitboxes, simulación de movimiento, esquemas Valibot, datos de gameplay                                                                                                                                                                                                                                                                          |
| `client/.../hudStore.test.ts`, `modeUi.test.ts`                                       | store del HUD y presentación por modo                                                                                                                                                                                                                                                                                                                      |

**End-to-end** (`server/test/e2e/`, servidor real en otro proceso, bots que andan con A*): lobby, combate, los 6
modos, recompensas, movimiento autoritativo (plataformas, anti speed-hack), mensajes inválidos y _flood_.

**Totales:** 91 tests unitarios + 20 e2e (9 archivos + 4 suites e2e, todos en verde). Cobertura de la lógica de
servidor y `/shared` solo con unitarios (`pnpm test:coverage`): **86 %** de líneas (modos 95 %, combate 91 %,
jugadores 97 %, mapas y físicas 100 %). Gateway, bucle y red los cubren los e2e, que no cuentan para la cobertura
porque corren en otro proceso.

Scripts: `pnpm test` (todo), `pnpm test:unit` (rápido, sin e2e), `pnpm test:coverage`.

## Completar el stack (después del paso 10)

Al repasar el stack objetivo quedaban piezas sin hacer; se completaron antes de la verificación:

- **TailwindCSS (solo UI).** Tailwind 4 con tema y utilidades pero **sin preflight** (el sistema de diseño a mano
  mantiene su base), los tokens del diseño expuestos como colores y fuentes de Tailwind (`text-sol`, `bg-tinta`,
  `font-display`…) y el CSS del diseño en la capa `components`, para que las utilidades puedan sobrescribirlo. Los
  estilos en línea simples pasan a utilidades. **No se reescribieron los 948 líneas de CSS a utilidades**: es un
  diseño ajustado a mano y convertirlo cambiaría píxeles (reglas 1 y 5) sin aportar nada. Verificación: 5 pantallas
  (lobby, ajustes, manual, lista de salas, modal de contraseña) **idénticas píxel a píxel** antes y después.
- **stats.js solo en desarrollo:** panel de FPS con `pnpm dev`; el build de producción no lo incluye
  (`import.meta.env.DEV` + import dinámico).
- **Conexión explícita** (`client/src/network/connection.ts`): estado conectando / conectado / reconectando con
  intentos; reconexión manual cuando el servidor cierra el socket (Socket.IO no reintenta ese caso solo); la lista de
  salas se pide en cada reconexión; si se pierde la partida, el lobby lo explica. Probado matando y arrancando el
  servidor con un jugador en partida: vuelve al lobby, se reconecta solo y muestra el aviso.
- **Constantes de gameplay en /shared:** el tiempo de cambio de arma estaba repetido en 3 archivos del cliente, y la
  dispersión, el retroceso y el _bloom_ eran reglas solo del cliente → `shared/src/weapons/handling.ts`
  (`WEAPON_HANDLING`, mismos valores).
- **README** actualizado (pnpm, estructura, red autoritativa, cómo ampliar cada cosa).

### Posible código muerto (marcado con `// TODO(review): posible código muerto`, no borrado)

| Dónde                             | Qué                                                                                                                | Desde cuándo                                                                   |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `client/src/game/hud/hudState.ts` | campos `characterId`, `hit`, `hitHead`, `killerName`, `mode` del HUD: se publican pero ninguna pantalla los lee    | ya en el original (`emitHud` los mandaba y `HUD.jsx`/`Game.jsx` no los usaban) |
| `server/src/players/player.ts`    | `spawnTime`: se asigna en cada spawn y nunca se lee                                                                | ya en el original                                                              |
| `shared/src/modes/modes.ts`       | `TEAMS[t].color`: nunca se lee (los colores de equipo salen de la paleta del cliente, que sigue el modo daltónico) | ya en el original                                                              |

(Se eliminaron dos ayudas que añadí yo durante la migración y no llegaron a usarse: `WEAPON_IDS` e `isWeaponId`.)

---

## 11. Verificación final

### Inventario inicial → evidencia

| Funcionalidad                                                                                      | Estado | Cómo se comprobó                                                                                                                                                                                    |
| -------------------------------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5 mapas × 3 tamaños, decoración, spawns, bases CTF                                                 | ✅     | test _golden_: los 15 mapas son idénticos bit a bit al JS original; los 5 renderizados en el navegador sin errores                                                                                  |
| Plataformas de salto                                                                               | ✅     | tests de simulación + e2e (el servidor lanza a > 4 m) + navegador                                                                                                                                   |
| 8 armas (daño, cabeza, caída, cadencia, cargador, recarga, perdigones)                             | ✅     | test unitario que dispara las 8 armas de los 5 personajes con todos sus perdigones; cadencia, recarga y caída por separado; en el navegador, una partida de escalada con las 5 armas de la escalera |
| Dispersión, _bloom_, retroceso, cerrojo, mira telescópica                                          | ✅     | mismo código, constantes movidas a `WEAPON_HANDLING` con los mismos valores                                                                                                                         |
| Cuchillo: asistencia y puñalada por la espalda                                                     | ✅     | unitarios (de espaldas mata, de frente 55) + e2e                                                                                                                                                    |
| 5 personajes, 5 skins                                                                              | ✅     | tablas en el test _golden_; selección 3D en el navegador                                                                                                                                            |
| 6 modos                                                                                            | ✅     | unitarios de las reglas de cada modo + e2e de cada uno + navegador (CTF, Confirmar bajas, Infectados, Escalada)                                                                                     |
| Movimiento (bhop, slide-hop, escalones, coyote, buffer, plataformas)                               | ✅     | **equivalencia exacta** con el código original (0,000000 m en 117 m de recorrido) + 14 tests + predicción con corrección 0 en el navegador                                                          |
| Protección de reaparición, regeneración, reaparición a 3 s                                         | ✅     | unitarios + e2e                                                                                                                                                                                     |
| Compensación de lag                                                                                | ✅     | unitario: sin rebobinar falla, rebobinando acierta                                                                                                                                                  |
| Rachas y recompensas (Radar, Blindaje), «Mejor jugada»                                             | ✅     | unitarios + e2e de 7 bajas seguidas + pantalla de fin en el navegador                                                                                                                               |
| Salas con contraseña, sala llena, borrado, máximo de jugadores                                     | ✅     | unitarios + e2e                                                                                                                                                                                     |
| mDNS, `/ping`, banner de la consola                                                                | ✅     | `/ping` en e2e; banner visto al arrancar                                                                                                                                                            |
| Lobby, selección, HUD completo, muerte, pausa, marcador, fin de partida                            | ✅     | capturas en el navegador de cada pantalla; lobby/ajustes/manual/modales idénticos píxel a píxel tras Tailwind                                                                                       |
| Ajustes (mira, sensibilidad, FOV, volumen, daltonismo, sacudida), manual, cortinilla, teclas vivas | ✅     | mismos componentes tipados; capturas idénticas                                                                                                                                                      |
| Pantalla completa + bloqueo de teclado, aviso al cerrar                                            | ✅     | mismo código (`input.ts`, `Game.tsx`)                                                                                                                                                               |
| Persistencia local (nombre, personaje, skin, ajustes)                                              | ✅     | mismas claves de `localStorage`                                                                                                                                                                     |

### Cambios de comportamiento (todos deliberados y pequeños)

1. **Movimiento autoritativo:** el servidor decide dónde estás; el cliente predice y se corrige. Desaparecen
   `player:state` y `player:correct`. Atravesar paredes o moverse más rápido ya no es posible.
2. **Física a 60 Hz fija** con render interpolado (antes un paso por frame): idéntico a 60 FPS, independiente de los
   FPS en el resto.
3. **Rivales 100 ms en el pasado**, interpolados entre snapshots (antes perseguían el último con un `lerp`).
4. **Mensajes inválidos se descartan** (antes algunos tipos erróneos se convertían en un valor por defecto).
5. **Origen del disparo:** tolerancia de 3 m + velocidad × 0,25 s (el cliente va un poco por delante del servidor).
6. **Aviso al perder la conexión** en plena partida (antes se volvía al lobby sin explicación).

### Observaciones (sin tocar, por la regla 5)

- En la Escalada de armas, al ganar el marcador muestra «6/5» en la columna de arma del ganador: el nivel sube antes
  de comprobar el fin de la partida. Ya pasaba en el original.

### Cifras

|                                                            | Antes                | Después                            |
| ---------------------------------------------------------- | -------------------- | ---------------------------------- |
| Tests                                                      | 0                    | 119 (99 unitarios + 20 end-to-end) |
| Cobertura de la lógica de servidor y `/shared` (unitarios) | —                    | 86 % de líneas                     |
| Commits de React por segundo con el jugador quieto         | 11                   | 0,7                                |
| Tamaño de snapshot de 12 jugadores                         | 2816 B (JSON)        | 2049 B (MessagePack)               |
| JavaScript que descarga el lobby                           | 859 KB               | 281 KB                             |
| Correcciones de la predicción en partida real              | (no había autoridad) | 0 en 103 acks                      |

### Estructura final

```
blockshot/
  package.json, pnpm-workspace.yaml, tsconfig.base.json, eslint.config.js, vitest.config.ts
  .prettierrc.json, .editorconfig, .gitattributes, commitlint.config.js, .husky/
  REFACTOR_LOG.md, README.md
  shared/src/
    core/math.ts                 Vec3, round2, clamp, rng, seedOf
    player/player.ts             PLAYER, PAD
    weapons/weapons.ts           WEAPONS, damageAt, weightName
    weapons/handling.ts          WEAPON_HANDLING (cambio de arma, dispersión, retroceso, bloom)
    characters/characters.ts     CHARACTERS, SKINS
    modes/modes.ts               MODES, escaleras, FLAG, TAG, INFECT, TEAMS, rachas, loadoutOf
    maps/                        types, props, builders/{patio,almacen,desfiladero,polvo,ciudad}.ts, maps.ts
    movement/movement.ts         simulación determinista (servidor y cliente)
    physics/raycast.ts           raycast AABB/esfera, hitboxes, castShot
    net/                         constants.ts, events.ts (tipados), schemas.ts (Valibot)
  server/src/
    index.ts, config.ts, logger.ts
    http/app.ts
    network/                     gateway.ts, rateLimiter.ts, lan.ts
    rooms/                       room.ts (RoomChannel), registry.ts
    players/                     player.ts, movement.ts, history.ts, spawn.ts, loadout.ts, teams.ts
    combat/                      shooting.ts, damage.ts, weaponBehavior.ts
    modes/                       gameMode.ts, freeForAll, teamDeathmatch, captureTheFlag, gunGame, killConfirmed, infected, scoring, index
    match/match.ts
    game/                        loop.ts (paso fijo), tick.ts (snapshot)
    testing/fakeRoom.ts
  server/test/e2e/               harness.ts, pathfinding.ts, lobby/combat/modes/movement.test.ts
  client/src/
    main.tsx, env.d.ts
    app/App.tsx                  sesión, carga diferida del juego
    ui/ui.tsx                    teclas vivas, Check, Slider, cortinilla, escala
    network/                     socket.ts (tipado, MessagePack), connection.ts
    settings/                    settingsStore.ts, palette.ts, SettingsDialog.tsx, Crosshair.tsx
    lobby/                       Lobby.tsx, MapPreview.tsx
    characters/                  CharacterSelect.tsx, CharacterPreview.tsx
    manual/Manual.tsx
    styles/                      tailwind.css, styles.css
    game/
      Game.tsx, modeUi.ts, roomView.ts
      engine/                    Engine.ts, input.ts, localPlayer.ts, remotePlayers.ts, weapons.ts, viewModel.ts,
                                 cameraRig.ts, objectives.ts, effects.ts, pool.ts, netClient.ts, events.ts, util.ts, devStats.ts
      hud/                       HUD.tsx, Minimap.tsx, Scoreboard.tsx, hudStore.ts, hudState.ts, teamStyle.ts
      screens/                   DeathScreen.tsx, PauseMenu.tsx, ScoresLayer.tsx, CharacterScreen.tsx
      render/                    world.ts, models.ts
      audio/                     sound.ts, audioEvents.ts
```

### Cómo probarlo a mano

Arranque: `pnpm install` y `pnpm clase`; abre `http://localhost:3000` en dos navegadores (o dos PCs de la red).
Para ver los FPS, `pnpm dev` y entra por `http://localhost:5173`.

**Cada mapa** (crea una sala por mapa, mejor en tamaño Mediano; repite alguno en Pequeño y Grande):

- **Patio:** sube a la torre por las escaleras y por las plataformas verdes junto a ellas; entra en una habitación de esquina.
- **Almacén:** usa la plataforma del centro para subir a los contenedores y las de los extremos para las entreplantas.
- **Desfiladero:** cruza los tres puentes; baja al cañón y sube a la meseta con la plataforma (o por las escaleras).
- **Polvo:** recorre túnel, medio y pasillo largo hasta las zonas A y B; salta en las plataformas del medio.
- **Ciudad:** busca un edificio con escalera a la azotea y una plataforma en mitad de una calle.
- En todos: el minimapa coincide con el mapa, no se atraviesan paredes y las balas no las cruzan.

**Cada arma** (elige cada personaje; la tecla 3 es el cuchillo para todos):

- **Soldado:** rifle (automático, ráfagas cortas, la mira vuelve sola) y pistola (semiautomática).
- **Cazador:** francotirador (mira telescópica con clic derecho, cerrojo tras cada tiro, de un tiro al cuerpo tumba a
  todos menos al Tanque; si te mueves o saltas con la mira puesta el tiro se desvía).
- **Tanque:** escopeta (10 perdigones, letal de cerca) y revólver.
- **Rayo:** subfusil (el más rápido).
- **Bastión:** ametralladora (80 balas, recarga larga, te frena) y revólver.
- **Cuchillo:** de frente quita 55; por la espalda mata de un golpe.
- Comprueba: números de daño, marca de acierto (roja en la cabeza o en la baja), recarga con R o automática,
  cambio con 1/2/3/Q/rueda.

**Cada modo** (dos jugadores como mínimo):

- **Todos contra todos:** a 10 bajas termina; aparecen las tarjetas de «Mejor jugada» y a los 8 s empieza otra.
- **Por equipos:** cada uno en un color, sin fuego amigo; T cambia de equipo (no en pleno combate, espera 5 s).
- **Captura la bandera:** coge la bandera rival, muere con ella (cae), devuélvela tocándola, captúrala con la tuya en casa.
- **Escalada de armas (5):** cada baja da la siguiente arma; un cuchillazo baja un nivel a la víctima; se gana con el cuchillo.
- **Confirmar bajas:** al matar cae una placa; recógela tú (punto) o que la recoja un compañero de la víctima (niega).
- **Infectados (2 min):** a los 10 s de haber 2 vivos uno se infecta (verde, solo cuchillo, más rápido); quien muere
  se infecta; ganan los supervivientes si llega el tiempo a 0.
- **Rachas:** 5 bajas seguidas → «RADAR» en el minimapa; 7 → barra plateada de blindaje bajo la vida.

**Red:** con dos PCs, muévete y comprueba que el otro te ve fluido; dispara a alguien que corre (si en tu pantalla le
diste, cuenta); cierra el servidor con alguien en partida y vuelve a abrirlo: el jugador vuelve al lobby, se reconecta
solo y ve el aviso.

### Resumen

El juego es el mismo (mapas idénticos bit a bit, movimiento equivalente al original al milímetro, mismas armas, modos,
controles y pantallas) sobre una base nueva: monorepo pnpm en TypeScript estricto, servidor autoritativo a paso fijo
con predicción y reconciliación en el cliente, mensajes validados y limitados, modos y armas como estrategias, motor
del cliente fuera de React y dividido por responsabilidades, HUD con Zustand, MessagePack, carga diferida y 119 tests.
Lo único que no se aplicó del stack es **Rapier** (justificado en el paso 8). El código marcado como posible código
muerto queda listado arriba para revisarlo.
