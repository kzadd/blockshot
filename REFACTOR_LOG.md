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
