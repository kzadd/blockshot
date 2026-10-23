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

- [ ] Patio: torre central con escaleras, muros con hueco, habitaciones en las esquinas, 4 plataformas de salto
- [ ] Almacén: contenedores en columnas (aleatorio con semilla), entreplantas con barandilla, 4 plataformas
- [ ] Desfiladero: cañón, dos mesetas, 3 puentes, casetas, rocas, 2 plataformas
- [ ] Polvo: casas, túnel, zonas A/B, puertas con dintel, 2 plataformas
- [ ] Ciudad: manzanas generadas, callejones, plazas, azoteas con escalera, coches, plataformas en calles
- [ ] Decoración (barriles, árboles, farolas, cactus, sacos, palés, coches) que se descarta si choca o tapa un spawn
- [ ] Paisaje exterior por tema (pueblo, industrial, desierto, ciudad), cielo con degradado, nubes, sol, niebla
- [ ] Spawns con orientación hacia la dirección más despejada; bases de CTF (spawn más al oeste/este)

**Armas** (8): rifle, francotirador, escopeta (10 perdigones), subfusil, ametralladora, pistola, revólver, cuchillo.

- [ ] Daño con caída por distancia (`falloff`), multiplicador a la cabeza, cadencia, cargador, recarga
- [ ] Dispersión: cadera/apuntando, movimiento, aire, agachado, sprint, _bloom_ por ráfaga
- [ ] Retroceso que se recupera solo; cerrojo del francotirador (sale de la mira), mira telescópica
- [ ] Peso del arma (velocidad), velocidad al apuntar (`adsSpeed`, `adsMove`)
- [ ] Cuchillo: golpe con asistencia (cono de 0.8), puñalada por la espalda = 200

**Personajes** (5): Soldado, Cazador, Tanque, Rayo, Bastión. **Skins** (5): Clásico, Camuflaje, Nocturno, Ártico, Dorado.

**Modos** (6):

- [ ] Todos contra todos (10/20/30/50 bajas)
- [ ] Por equipos (20/40/60/100), sin fuego amigo, equipo con menos gente al entrar, cambio con T (espera 5 s, no en combate)
- [ ] Captura la bandera (1/3/5/7): coger, soltar al morir, devolver tocándola, vuelve sola a los 20 s, spawns por mitad
- [ ] Escalada de armas (5 u 8 armas), baja a cuchillo baja un nivel a la víctima
- [ ] Confirmar bajas (15/30/50/75): placas que caen, confirmar/negar, duran 30 s
- [ ] Infectados (2/3/5 min): cuenta atrás de 10 s, primer infectado aleatorio, cuchillo + 30 % vida + 15 % velocidad, contagio, victoria por tiempo o exterminio, re-elección si el infectado se va

**Movimiento:** WASD, salto con _coyote time_ y _buffer_, bunny hop, agacharse, slide con slide-hop, sprint, aceleración en el aire estilo Quake, tope suave/duro de velocidad, subir escalones (0.55 m), plataformas de salto, estamina desactivada (activable).

**Sistemas:** protección de reaparición (4 s o hasta disparar), regeneración tras 5 s, reaparición a los 3 s, compensación de lag (historial de 1 s, máx. 250 ms), anti-teletransporte, rachas (3/5/7/10) con recompensas (Radar 5, Blindaje 7), «Mejor jugada» al final, reinicio a los 8 s, salas con contraseña (SHA-256), máximo de jugadores, ping, mDNS `blockshot.local`, `/ping`.

**Pantallas:**

- [ ] Lobby: nombre, crear sala (nombre, contraseña, mapa con miniatura, modo, puntos, tamaño, máx. jugadores), lista de salas, modal de contraseña, aviso sin conexión con «Reintentar», toast de error
- [ ] Selección de personaje: lista 1–5, vista 3D girable, skins, ficha con armas, selector de equipo, «Seguir con…», Enter para jugar
- [ ] HUD: info de sala + ping, minimapa (aliados, enemigos al disparar, radar, banderas, placas), marcador superior por modo, killfeed, vida a trozos + blindaje + estamina, munición y ranuras, mira configurable dinámica, hitmarker, números de daño 3D, indicador de dirección del daño, «sonido visual», combo ×N, banner de baja, mira telescópica, aviso de bandera, protección, viñeta
- [ ] Muerte (quién te mató, cuenta atrás, cambiar personaje con B), pausa (Esc), marcador (Tab), fin de partida con «Mejor jugada»
- [ ] Ajustes (mira 6 estilos/color/tamaño/grosor/separación/contorno/dinámica; sensibilidad, sensibilidad al apuntar, FOV, volumen; daltonismo 3 modos, sacudida)
- [ ] Manual (5 pestañas), cortinilla de bloques, teclas que se hunden, escala de UI (`--s`), `prefers-reduced-motion`
- [ ] Pantalla completa + bloqueo de teclado (Ctrl+W), aviso `beforeunload`
- [ ] Persistencia local: nombre, personaje, skin por personaje, ajustes

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
