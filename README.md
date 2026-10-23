# BLOCKSHOT

Shooter multijugador en primera persona, estilo arena de bloques, pensado para jugar en clase por red local.
Tu PC hace de servidor y todos se conectan desde el navegador.

**Stack:** React 18 (lobby y HUD) · three.js (3D) · Node + Express + Socket.IO (servidor autoritativo).
Sin assets externos: modelos hechos con cajas y sonidos sintetizados con WebAudio.

## Requisitos

- Node.js 18 o superior.
- Todos en la misma red (wifi de clase o cable).

## Para jugar en clase

```bash
npm install
npm run clase      # compila el cliente y arranca el servidor en el puerto 3000
```

La consola muestra algo así:

```
  Tú:         http://localhost:3000
  La clase:   http://blockshot.local:3000
              (si no carga: http://192.168.1.35:3000)
```

Comparte `http://blockshot.local:3000` con la clase: el servidor anuncia ese nombre en la red local (mDNS),
así no hace falta dictar la IP. Si en algún equipo no carga (redes que bloquean multicast), usa la IP de debajo.
Si hay dos servidores en la misma red, cambia el nombre: `NOMBRE=aula2 npm run clase` (Windows PowerShell:
`$env:NOMBRE="aula2"; npm run clase`). Para comprobar la conexión sin cargar el juego: `http://blockshot.local:3000/ping`. Tú también puedes jugar desde tu propio navegador.

**Si nadie consigue entrar:** casi siempre es el cortafuegos. En Windows, la primera vez que arranca Node aparece
un aviso: marca _Redes privadas_ y acepta. Si no salió, añade una regla de entrada para el puerto TCP 3000.
Algunas wifis de centros educativos aíslan a los clientes entre sí; en ese caso usa un punto de acceso propio
(un router o el móvil compartiendo red).

## Interfaz

La interfaz sigue el diseño de `../capturas-para-claude-design/` (Claude Design, «interfaz v2»): todas las pantallas se
dibujan sobre un lienzo de 1280×720 que se escala solo hasta ×1.5 en 1920×1080 (`--s`, calculado en `client/src/ui.jsx`).
Incluye las 8 mejoras del diseño: cortinilla de bloques al entrar y reaparecer, vida que suelta trozos al perder cada
cuarto, contador de aciertos seguidos (×N), pastilla de líder en todos contra todos, «sonido visual» (marcas alrededor
de la mira hacia pasos y disparos de enemigos cercanos), tarjetas de «Mejor jugada» al acabar la partida, sacudida suave
al recibir daño (desactivable en Ajustes) y teclas que se hunden al pulsarlas en la pausa y el manual. Con
«reducir movimiento» activado en el sistema (`prefers-reduced-motion`) se quitan la cortinilla, la sacudida y los trozos.

## Para desarrollar

```bash
npm run dev
```

Arranca el servidor con recarga automática (puerto 3000) y Vite con HMR en http://localhost:5173 (también accesible
desde la red en el puerto 5173).

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
     La partida se reinicia sola a los 8 s. Todos los personajes llevan cuchillo (tecla **3**); por la espalda mata de un golpe.

| Tecla             | Acción                                                                                             |
| ----------------- | -------------------------------------------------------------------------------------------------- |
| WASD              | Moverse                                                                                            |
| Espacio           | Saltar (mantén pulsado para encadenar saltos: bunny hop)                                           |
| C / Ctrl          | Agacharse (más preciso y más bajo). Corriendo: deslizarse (desliza + salta = mucha velocidad)      |
| Shift             | Esprintar hacia delante                                                                            |
| Clic izquierdo    | Disparar                                                                                           |
| Clic derecho      | Apuntar: más zoom y precisión, pero te mueves más despacio (mira telescópica con el francotirador) |
| R                 | Recargar                                                                                           |
| 1 / 2 / Q / rueda | Cambiar de arma                                                                                    |
| Tab               | Marcador                                                                                           |
| B                 | Cambiar de personaje (solo estando muerto)                                                         |
| T                 | Cambiar de equipo (por equipos; espera 5 s entre cambios y no vale en pleno combate)               |
| O                 | Ajustes: mira (6 estilos, color, tamaño…), sensibilidad, campo de visión y volumen                 |
| H / F1            | Manual del juego (controles, personajes, armas y trucos)                                           |
| Esc               | Pausa (soltar el ratón); otro Esc vuelve al juego                                                  |

**Ctrl+W no cierra el juego:** al pulsar "Jugar" el juego pasa siempre a pantalla completa y bloquea los atajos
del navegador (Chrome y Edge). En Firefox, o si se sale de pantalla completa, el navegador pregunta antes de cerrar
la pestaña.

La vida se regenera tras 5 s sin recibir daño. Los disparos a la cabeza hacen más daño.

**Movimiento estilo Krunker:** no hay estamina (sprint y slide sin límite; se puede volver a activar con
`PLAYER.useStamina` en `shared/config.js`). El slide dura más y frena menos, y encadenar **slide + salto + slide al
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
daño con la distancia. El francotirador hace 120 al cuerpo y 240 a la cabeza: de un tiro al cuerpo mata a todos menos al Tanque (150 de vida), al que hay que darle en la cabeza; tras
cada disparo hay que volver a apuntar (cerrojo), y si te mueves o saltas con la mira puesta el tiro se desvía.

En pantalla: **minimapa** (aliados en verde; los enemigos solo aparecen en rojo 2 s después de disparar),
**números de daño** al acertar, **rachas** (3, 5, 7 y 10 bajas seguidas) en el killfeed, indicador de dirección
del daño y el **ping** arriba. En el marcador (Tab) se ven bajas, muertes, racha y ping de cada jugador.

## Personajes

Más vida = más lento. La velocidad (m/s) es con la principal / con la secundaria en la mano.

| Personaje | Vida | Velocidad   | Principal       | Secundaria |
| --------- | ---- | ----------- | --------------- | ---------- |
| Rayo      | 85   | 10.4 / 10.7 | Subfusil        | Pistola    |
| Cazador   | 90   | 7.2 / 7.8   | Francotirador   | Pistola    |
| Soldado   | 100  | 7.1 / 7.5   | Rifle de asalto | Pistola    |
| Bastión   | 120  | 6.6 / 7.3   | Ametralladora   | Revólver   |
| Tanque    | 150  | 6.5 / 6.8   | Escopeta        | Revólver   |

## Estructura

```
shared/
  config.js     ← personajes, armas, mapa y constantes (aquí se balancea todo)
  physics.js    ← raycast e hitboxes, los usan servidor y cliente
server/
  index.js      ← salas, contraseñas, vida, munición, impactos, puntuación
client/src/
  components/   ← Lobby, selección de personaje, HUD, marcador
  game/
    Engine.js   ← bucle, física del jugador, cámara, disparos, interpolación de rivales
    world.js    ← construye el mapa a partir de config.js
    models.js   ← personajes y armas hechos con cajas
    sound.js    ← sonidos sintetizados
```

## Cómo funciona la red

- El cliente mueve a su jugador localmente (respuesta inmediata) y envía su posición 20 veces por segundo.
- El servidor manda un snapshot de todos los jugadores 20 veces por segundo; los rivales se interpolan para verse suaves.
- **Los disparos los decide el servidor**: el cliente envía origen y dirección, y el servidor comprueba cadencia,
  munición y recarga, lanza el rayo contra paredes y hitboxes, y aplica el daño. El cliente solo dibuja trazadoras.
- **Compensación de lag:** el servidor guarda el último segundo de posiciones de cada jugador y, al recibir un
  disparo, coloca a los rivales donde los veía el tirador (su ping / 2 + ~100 ms de suavizado, máximo 250 ms).
  Si en tu pantalla le diste, cuenta.
- Hay un anti-teletransporte básico. No es un anticheat serio: es un juego de clase.

## Ampliarlo

- **Arma nueva:** añádela en `WEAPONS` (`shared/config.js`, con su peso, rapidez al apuntar y caída de daño) y
  dibújala en `GUNS` (`client/src/game/models.js`) con piezas `box(...)` y `cyl(...)`.
- **Personaje nuevo:** añade una entrada en `CHARACTERS`. La pantalla de selección y el manual se generan solos.
  Para darle un accesorio propio (casco, gorra…), añade una función en `EXTRAS` (`client/src/game/models.js`).
- **Skin nueva:** añade su id en `SKINS` (`shared/config.js`) y sus colores en `skinPalette` (`models.js`).
- **Ajustes y mira:** valores por defecto en `client/src/settings.js`; se guardan en el navegador de cada jugador.
- **Mapas:** hay cinco (Patio, Almacén, Desfiladero, Polvo y Ciudad) en tres tamaños (pequeño 52 m, mediano 80 m, grande 112 m).
  Cada mapa es una función `build*` en `shared/config.js` que recibe `H` (mitad del lado) y coloca cajas con
  `B(x, y, z, ancho, alto, fondo, color)` (x/z = centro, y = base) y spawns con `S(x, z)`. Para añadir uno nuevo,
  escribe su función y regístralo en `MAP_DEFS`. Todo lo que sea caja ya tiene colisión y bloquea balas.
- **Partida más corta o larga:** `SCORE_LIMIT` en `shared/config.js`.
