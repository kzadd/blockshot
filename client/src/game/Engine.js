import * as THREE from 'three';
import { PLAYER, WEAPONS, CHAR_BY_ID, CLIENT_SEND_MS, FLAG, PAD, INFECT, getColliders, isTeamMode, loadoutOf, gunLadder } from '../../../shared/config.js';
import { castShot } from '../../../shared/physics.js';
import { buildWorld } from './world.js';
import { buildCharacter, buildGun, buildArms, makeNameTag } from './models.js';
import { getSettings, subscribe } from '../settings.js';
import { sfx } from './sound.js';
import { palette, teamColor } from '../palette.js';

const HUD_MS = 1000 / 15;
// Retraso con el que se ven los rivales (snapshot cada 50 ms + suavizado): se suma al ping para rebobinar
const VIEW_DELAY_MS = 100;
// Teclas que el juego se queda en pantalla completa (Chrome/Edge): así Ctrl+W, Ctrl+T, Ctrl+N… no cierran nada.
// Esc también: así la pausa la abre el juego (suelta él el ratón) y otro Esc puede volver a capturarlo
// sin clic. Para salir de pantalla completa hay que mantener Esc pulsado.
const LOCK_KEYS = [
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((c) => 'Key' + c),
  ...'0123456789'.split('').map((d) => 'Digit' + d),
  'Tab', 'Space', 'ControlLeft', 'ControlRight', 'F1', 'Escape',
];
const tmp = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const tracerGeo = new THREE.BoxGeometry(1, 1, 1);
const impactGeo = new THREE.SphereGeometry(0.08, 6, 6);
// Burbuja de los que acaban de reaparecer (invulnerables)
const bubbleGeo = new THREE.SphereGeometry(1, 18, 12);
const bubbleMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, depthWrite: false });
// Placas de Confirmar bajas
const tagGeo = new THREE.OctahedronGeometry(0.32, 0);
const INFECTED_COLOR = '#6fcf3a';

const damp = (k, dt) => 1 - Math.exp(-k * dt);

// Icono de bandera que se ve a través de las paredes
function flagMarker(color) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = color;
  g.strokeStyle = '#1b2a4a';
  g.lineWidth = 6;
  g.beginPath();
  g.arc(32, 32, 26, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.fillStyle = '#ffffff';
  g.fillRect(22, 16, 4, 32);
  g.beginPath();
  g.moveTo(26, 16);
  g.lineTo(44, 23);
  g.lineTo(26, 31);
  g.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, sizeAttenuation: false }));
  s.scale.set(0.045, 0.045, 1);
  s.position.y = 3;
  s.renderOrder = 6;
  return s;
}
function dampAngle(a, b, k) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}
function spreadDir(base, s) {
  if (s <= 0) return base.clone();
  const r = s * Math.sqrt(Math.random());
  const a = Math.random() * Math.PI * 2;
  const right = new THREE.Vector3().crossVectors(base, UP).normalize();
  const up = new THREE.Vector3().crossVectors(right, base).normalize();
  return base.clone().addScaledVector(right, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r).normalize();
}

export class Engine {
  constructor(container, socket, myId, onHud, map, mode = 'ffa', limit = 0) {
    this.container = container;
    this.socket = socket;
    this.myId = myId;
    this.onHud = onHud;
    this.map = map;
    this.mode = mode;
    this.limit = limit; // puntos para ganar (en Escalada de armas, cuántas armas tiene la escalera)
    this.level = 0; // Escalada de armas: arma por la que vas
    this.loadout = []; // armas por tecla (1, 2, 3)
    this.prevSlot = 1;
    this.swingAt = 0; // último golpe de cuchillo (animación)
    this.myTeam = 0;
    this.teamScore = null;
    this.infect = null; // Infectados: { st, t } del servidor
    this.tags = new Map(); // Confirmar bajas: id -> malla de la placa
    this.radar = false; // recompensa de racha: enemigos en el minimapa
    this.armor = 0;
    this.rtt = 0;
    this.colliders = getColliders(map);
    this.applySettings(getSettings());
    this.unsubSettings = subscribe((st) => this.applySettings(st));

    // --- Render
    const r = (this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }));
    r.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    r.setSize(container.clientWidth, container.clientHeight);
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.autoClear = false;
    container.appendChild(r.domElement);

    this.scene = new THREE.Scene();
    buildWorld(this.scene, map);
    this.flags = null; // Captura la bandera: estado que manda el servidor
    this.buildFlags();
    const aspect = container.clientWidth / container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(this.baseFov, aspect, 0.05, map.half * 10);
    this.camera.rotation.order = 'YXZ';

    // Escena aparte para el arma en primera persona (nunca atraviesa paredes)
    this.vmScene = new THREE.Scene();
    this.vmCamera = new THREE.PerspectiveCamera(60, aspect, 0.01, 10);
    this.vmScene.add(new THREE.HemisphereLight(0xffffff, 0x777777, 2));
    const vl = new THREE.DirectionalLight(0xffffff, 1.4);
    vl.position.set(1, 2, 1);
    this.vmScene.add(vl);
    this.gunHolder = new THREE.Group();
    this.gunHolder.scale.setScalar(0.85);
    this.vmScene.add(this.gunHolder);

    // --- Jugador local
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.grounded = false;
    this.alive = false;
    this.everSpawned = false;
    this.character = null;
    this.slot = 0;
    this.ammo = [];
    this.lastShot = [0, 0, 0];
    this.swapUntil = 0;
    this.mouseDown = false;
    this.triggerReleased = true;
    this.aiming = false;
    this.aimLerp = 0;
    this.sliding = false;
    this.slideTime = 0;
    this.crouchHeld = false;
    this.crouching = false;
    this.height = PLAYER.height;
    this.stamina = PLAYER.stamina;
    this.staminaAt = 0; // último momento en que se gastó estamina
    this.staminaLock = false; // agotada: hay que recuperar un mínimo para volver a esprintar
    this.slideEndAt = 0; // fin del último slide (espera entre slides)
    this.sprinting = false;
    this.sprintLerp = 0;
    this.sprintBlockUntil = 0; // disparar corta el sprint un momento
    this.coyote = 0;
    this.jumpPressedAt = -1e9;
    this.landDip = 0;
    this.stepDist = 0;
    this.autoChar = null; // { id, skin } con el que se reaparece solo
    this.spawnReqAt = 0;
    this.eye = PLAYER.eye;
    this.kick = 0;
    this.recoil = 0; // retroceso acumulado que se recupera solo
    this.bloom = 0; // dispersión extra por disparar seguido (se recupera sola)
    this.bobT = 0;
    this.fov = this.baseFov;
    this.damageDirs = [];
    this.skin = 'base';
    this.protUntil = 0; // invulnerable al reaparecer hasta este instante (o hasta disparar)
    this.hitRed = false; // la última marca de impacto fue a la cabeza o una baja
    this.combo = 0; // aciertos seguidos (contador ×N)
    this.comboAt = 0;
    this.pendingShots = []; // disparos propios esperando confirmación de impacto
    this.ticks = []; // «sonido visual»: marcas hacia pasos y disparos cercanos
    this.flashTime = 0;
    this.hp = 0;
    this.maxHp = 100;
    this.hitTime = 0;
    this.hitHead = false;
    this.damageTime = 0;
    this.deathAt = 0;
    this.deathPos = null;
    this.killerId = null;
    this.killerName = '';
    this.locked = false;
    this.keys = new Set();

    this.remotes = new Map();
    this.effects = [];
    this.players = [];
    this.sendAcc = 0;
    this.hudAcc = 0;

    this.bindInput();
    this.bindNet();
    // Ping: mide ida y vuelta cada 2 s (se usa para la compensación de lag y el marcador)
    const ping = () => {
      const t0 = performance.now();
      this.socket.emit('net:ping', { rtt: this.rtt }, () => {
        const rtt = performance.now() - t0;
        this.rtt = this.rtt ? this.rtt * 0.7 + rtt * 0.3 : rtt;
      });
    };
    ping();
    this.pingTimer = setInterval(ping, 2000);
    this.clock = new THREE.Clock();
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  applySettings(st) {
    this.sens = st.sens;
    this.adsSens = st.adsSens ?? 0.9;
    this.baseFov = st.fov;
    sfx.setVolume(st.volume);
    // Modo daltónico: se vuelven a pintar los rivales, los nombres y el arma
    if (this.colorblind !== undefined && this.colorblind !== st.colorblind) this.refreshColors();
    this.colorblind = st.colorblind;
  }

  refreshColors() {
    for (const r of this.remotes.values()) r.team = -1;
    if (this.alive) this.setGun();
    this.buildFlags();
  }

  // Banderas y bases de Captura la bandera, del color de cada equipo
  buildFlags() {
    for (const o of this.flagObjs || []) this.scene.remove(o.group, o.pad);
    this.flagObjs = null;
    if (this.mode !== 'ctf' || !this.map.bases) return;
    this.flagObjs = [1, 2].map((t) => {
      const color = teamColor(t);
      const group = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.4, 0.08), new THREE.MeshLambertMaterial({ color: 0xdddddd }));
      pole.position.y = 1.2;
      const cloth = new THREE.Mesh(new THREE.BoxGeometry(1, 0.65, 0.05), new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.35 }));
      cloth.geometry.translate(0.52, 0, 0);
      cloth.position.y = 2;
      group.add(pole, cloth, flagMarker(color));
      const [x, y, z] = this.map.bases[t];
      const pad = new THREE.Mesh(
        new THREE.CylinderGeometry(FLAG.radius, FLAG.radius, 0.08, 28),
        new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.25, transparent: true, opacity: 0.6 }),
      );
      pad.position.set(x, y + 0.04, z);
      group.position.set(x, y, z);
      this.scene.add(group, pad);
      return { t, group, cloth, pad };
    });
  }

  updateFlags(dt, now) {
    if (!this.flagObjs || !this.flags) return;
    for (const o of this.flagObjs) {
      const f = this.flags[o.t];
      const g = o.group;
      // La que llevas tú no se dibuja (la tendrías delante de la cara); el HUD lo avisa
      g.visible = f.c !== this.myId;
      const r = f.c && this.remotes.get(f.c);
      if (r?.model) {
        g.position.copy(r.model.group.position);
        g.position.y += 0.4;
        g.rotation.y = r.model.group.rotation.y;
      } else {
        const to = tmp.set(f.x, f.y, f.z);
        if (g.position.distanceTo(to) > 4) g.position.copy(to);
        else g.position.lerp(to, damp(12, dt));
      }
      o.cloth.rotation.y = Math.sin(now * 0.004 + o.t) * 0.3;
    }
  }

  // Por equipos todos visten el color de su equipo; en todos contra todos, el del personaje y su skin
  outfit(charId, skin, team) {
    const ch = CHAR_BY_ID[charId];
    if (this.mode === 'infect' && team === 2) return { color: INFECTED_COLOR, skin: 'base' };
    if (isTeamMode(this.mode) && team) return { color: teamColor(team, ch.color), skin: 'base' };
    return { color: ch.color, skin };
  }

  // ============================================================ Input
  bindInput() {
    const el = this.renderer.domElement;
    this.h = {
      keydown: (e) => {
        if (e.code === 'Tab' || e.code === 'Space') e.preventDefault();
        // Jugando, Ctrl + letra no debe hacer nada en el navegador (Ctrl+S, Ctrl+D, Ctrl+F…)
        if (this.locked && (e.ctrlKey || e.metaKey) && e.code !== 'Escape') e.preventDefault();
        this.keys.add(e.code);
        // Esc con el ratón capturado: pausa (reanudar con Esc lo hace Game.jsx, que sabe si hay un menú abierto)
        if (e.code === 'Escape' && this.locked && !e.repeat) document.exitPointerLock?.();
        if (!this.alive || !this.locked || e.repeat) return;
        if (e.code === 'Space') this.jumpPressedAt = performance.now();
        if (e.code === 'Digit1') this.switchSlot(0);
        if (e.code === 'Digit2') this.switchSlot(1);
        if (e.code === 'Digit3') this.switchSlot(2);
        if (e.code === 'KeyQ') this.switchSlot(this.prevSlot);
        if (e.code === 'KeyR') this.startReload();
      },
      keyup: (e) => this.keys.delete(e.code),
      mousemove: (e) => {
        if (!this.locked || !this.alive) return;
        // Apuntando, la mira se siente igual que sin apuntar (se compensa el zoom) y un poco más
        // lenta según «Sensibilidad al apuntar» en Ajustes
        const s = 0.0022 * this.sens * this.aimSensMult();
        this.yaw -= e.movementX * s;
        this.pitch = Math.max(-1.55, Math.min(1.55, this.pitch - e.movementY * s));
        // si bajas tú la mira para compensar el retroceso, ya no hace falta recuperarlo
        if (e.movementY > 0) this.recoil = Math.max(0, this.recoil - e.movementY * s);
      },
      mousedown: (e) => {
        if (!this.locked) return;
        if (e.button === 0) this.mouseDown = this.clicked = true; // clicked: que un clic más corto que un frame no se pierda
        if (e.button === 2) this.aiming = true;
      },
      mouseup: (e) => {
        if (e.button === 0) {
          this.mouseDown = false;
          this.triggerReleased = true;
        }
        if (e.button === 2) this.aiming = false;
      },
      wheel: (e) => this.locked && this.alive && this.switchSlot((this.slot + (e.deltaY < 0 ? this.loadout.length - 1 : 1)) % this.loadout.length),
      contextmenu: (e) => e.preventDefault(),
      lockchange: () => {
        this.locked = document.pointerLockElement === el;
        if (!this.locked) {
          this.mouseDown = false;
          this.aiming = false;
          this.keys.clear();
        }
      },
      resize: () => this.resize(),
      blur: () => this.keys.clear(),
      click: () => this.alive && this.requestLock(),
    };
    window.addEventListener('keydown', this.h.keydown);
    window.addEventListener('keyup', this.h.keyup);
    window.addEventListener('mousemove', this.h.mousemove);
    window.addEventListener('mousedown', this.h.mousedown);
    window.addEventListener('mouseup', this.h.mouseup);
    window.addEventListener('wheel', this.h.wheel, { passive: true });
    window.addEventListener('contextmenu', this.h.contextmenu);
    window.addEventListener('resize', this.h.resize);
    window.addEventListener('blur', this.h.blur);
    document.addEventListener('pointerlockchange', this.h.lockchange);
    el.addEventListener('click', this.h.click);
  }

  requestLock() {
    sfx.unlock();
    const el = this.renderer.domElement;
    // Siempre a pantalla completa: así el navegador deja bloquear Ctrl+W y los demás atajos
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      document.documentElement
        .requestFullscreen({ navigationUI: 'hide' })
        .then(() => navigator.keyboard?.lock?.(LOCK_KEYS))
        .catch(() => {});
    }
    try {
      const p = el.requestPointerLock({ unadjustedMovement: true });
      if (p?.catch) p.catch(() => el.requestPointerLock());
    } catch {
      el.requestPointerLock();
    }
  }

  // ============================================================ Red
  bindNet() {
    this.netHandlers = [];
    const on = (ev, fn) => {
      this.socket.on(ev, fn);
      this.netHandlers.push([ev, fn]);
    };
    on('state', (s) => this.onState(s));
    on('player:spawned', (d) => this.onSpawned(d));
    on('shot', (d) => this.onRemoteShot(d));
    on('damaged', (d) => {
      this.hp = d.hp;
      this.damageTime = performance.now();
      if (Array.isArray(d.from)) this.damageDirs.push({ x: d.from[0], z: d.from[1], t: this.damageTime });
      sfx.hurt();
    });
    on('hitmarker', (d) => {
      this.hitTime = performance.now();
      this.hitHead = d.head;
      this.hitRed = d.head || d.kill;
      if (this.pendingShots.length) {
        this.pendingShots.shift();
        this.combo++;
        this.comboAt = this.hitTime;
      }
      sfx.hit(d.head, d.kill);
      if (Array.isArray(d.at)) this.addDamageNumber(d.at, d.dmg, d.head, d.kill);
    });
    on('kill', (d) => {
      if (d.victim === this.myId) this.die(d);
    });
    on('loadout', (d) => {
      // Escalada de armas: nueva arma (por subir o por un cuchillazo)
      const up = d.level > this.level || (d.team && d.team !== this.myTeam);
      this.level = d.level;
      if (d.team) this.myTeam = d.team;
      if (this.alive) {
        this.equip();
        this.swapUntil = performance.now() + 250;
      }
      if (up) sfx.streak();
    });
    on('tag', (d) => {
      if (d.type === 'confirm') sfx.blip(988, 0.1, 'triangle', 0.22);
      else sfx.blip(440, 0.12, 'triangle', 0.18);
    });
    on('flag', (d) => {
      if (d.type === 'capture') sfx.streak();
      else if (d.type === 'take' || d.type === 'return') sfx.blip(d.type === 'take' ? 880 : 520, 0.12, 'triangle', 0.2);
    });
    on('player:correct', (d) => {
      this.pos.set(d.x, d.y, d.z);
      this.vel.set(0, 0, 0);
    });
    on('match:end', () => {
      this.alive = false;
      this.deathPos = null;
      this.deathAt = 0;
      document.exitPointerLock?.();
    });
    on('match:start', () => {
      // Reaparecer enseguida con el mismo personaje
      this.killerName = '';
      this.deathAt = performance.now() - PLAYER.respawnDelay + 800;
    });
  }

  // Aparecer ya (primera vez o tras elegir personaje con la cuenta atrás terminada)
  spawn(characterId, skin) {
    this.autoChar = { id: characterId, skin };
    const now = performance.now();
    if (this.alive || (this.deathAt && now - this.deathAt < PLAYER.respawnDelay)) return;
    this.spawnReqAt = now;
    this.socket.emit('player:spawn', { characterId, skin });
  }

  onState({ players, ts, fl, tg, inf }) {
    this.players = players;
    this.teamScore = ts;
    this.flags = fl || null;
    this.infect = inf || null;
    this.syncTags(tg);
    const me = players.find((p) => p.id === this.myId);
    // Radar: lo tienes tú o (por equipos) un compañero
    this.radar = players.some((p) => p.rd && (p.id === this.myId || (isTeamMode(this.mode) && p.tm === this.myTeam)));
    if (me && me.tm !== this.myTeam) {
      this.myTeam = me.tm;
      // Cambié de equipo: aliados y enemigos cambian de color
      for (const r of this.remotes.values()) r.team = -1;
      if (this.alive) this.setGun(); // el uniforme de los brazos también
    }
    const seen = new Set();
    for (const p of players) {
      if (p.id === this.myId) {
        if (this.alive) {
          this.hp = p.h;
          if (p.mh) this.maxHp = p.mh;
          this.armor = p.ar || 0;
        }
        continue;
      }
      seen.add(p.id);
      let r = this.remotes.get(p.id);
      if (!r) {
        r = { id: p.id, model: null, charId: null, weaponId: null, target: new THREE.Vector3(), walk: 0, wasAlive: false };
        this.remotes.set(p.id, r);
      }
      if (p.c && (r.charId !== p.c || r.skin !== p.sk || r.team !== p.tm)) this.buildRemote(r, p);
      r.target.set(p.x, p.y, p.z);
      r.ry = p.ry;
      r.rx = p.rx;
      r.sl = p.sl;
      r.cr = p.cr;
      r.alive = !!p.a;
      r.prot = !!p.pr;
      r.name = p.n;
      if (!r.model) continue;
      const ch = CHAR_BY_ID[r.charId];
      r.tag.userData.setHp(Math.min(1, p.h / (p.mh || ch.hp)));
      const wid = loadoutOf(this.mode, ch, p.lv, this.limit, p.tm)[p.s] ?? ch.primary;
      if (wid !== r.weaponId) this.setRemoteGun(r, wid);
      if (r.alive && !r.wasAlive) {
        r.model.group.position.copy(r.target);
        r.model.group.rotation.y = r.ry;
      }
      r.wasAlive = r.alive;
      r.model.group.visible = r.alive;
    }
    for (const id of [...this.remotes.keys()]) if (!seen.has(id)) this.removeRemote(id);
  }

  // Confirmar bajas: placas que giran en el suelo, del color del equipo de la víctima
  syncTags(list) {
    const seen = new Set();
    for (const [id, x, y, z, team] of list || []) {
      seen.add(id);
      if (this.tags.has(id)) continue;
      const color = teamColor(team);
      const mesh = new THREE.Mesh(tagGeo, new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.5 }));
      mesh.position.set(x, y + 0.6, z);
      mesh.userData = { y: y + 0.6, team };
      this.scene.add(mesh);
      this.tags.set(id, mesh);
    }
    for (const [id, mesh] of this.tags) {
      if (seen.has(id)) continue;
      this.scene.remove(mesh);
      mesh.material.dispose();
      this.tags.delete(id);
    }
  }

  updateTags(now) {
    for (const m of this.tags.values()) {
      m.rotation.y = now * 0.004;
      m.position.y = m.userData.y + Math.sin(now * 0.005 + m.id) * 0.12;
    }
  }

  buildRemote(r, p) {
    if (r.model) this.scene.remove(r.model.group);
    const { color, skin } = this.outfit(p.c, p.sk, p.tm);
    r.model = buildCharacter(p.c, skin, color);
    r.color = color;
    // Por equipos: nombre del color de su equipo (los aliados se ven a través de las paredes); si no, color de enemigo
    const teams = isTeamMode(this.mode);
    const mate = teams && p.tm === this.myTeam;
    const tag = makeNameTag(p.n, teams ? teamColor(p.tm, palette().enemy) : palette().enemy, mate);
    tag.position.y = 2.3;
    r.model.group.add(tag);
    r.tag = tag;
    r.bubble = new THREE.Mesh(bubbleGeo, bubbleMat);
    r.bubble.scale.set(0.7, 1.1, 0.7);
    r.bubble.position.y = 0.95;
    r.bubble.visible = false;
    r.model.group.add(r.bubble);
    r.model.group.position.set(p.x, p.y, p.z);
    this.scene.add(r.model.group);
    r.charId = p.c;
    r.skin = p.sk;
    r.team = p.tm;
    r.weaponId = null;
  }

  setRemoteGun(r, wid) {
    r.model.hand.clear();
    const g = buildGun(wid, false, r.color);
    g.scale.setScalar(1.3);
    r.model.hand.add(g);
    r.weaponId = wid;
  }

  removeRemote(id) {
    const r = this.remotes.get(id);
    if (r?.model) this.scene.remove(r.model.group);
    this.remotes.delete(id);
  }

  onSpawned(d) {
    this.character = CHAR_BY_ID[d.characterId];
    this.skin = d.skin || 'base';
    this.damageDirs = [];
    this.pos.set(d.x, d.y, d.z);
    this.vel.set(0, 0, 0);
    this.yaw = d.ry;
    this.pitch = 0;
    if (d.team) this.myTeam = d.team;
    this.hp = this.maxHp = d.hp ?? this.character.hp;
    this.armor = 0;
    this.alive = true;
    this.protUntil = performance.now() + PLAYER.spawnProtection;
    this.everSpawned = true;
    this.deathPos = null;
    this.recoil = 0;
    this.level = d.level ?? 0;
    this.sliding = false;
    this.crouching = false;
    this.height = PLAYER.height;
    this.stamina = PLAYER.stamina;
    this.staminaLock = false;
    this.sprinting = false;
    this.landDip = 0;
    this.eye = PLAYER.eye;
    this.aimLerp = 0;
    this.equip();
  }

  die(d) {
    this.alive = false;
    this.deathAt = performance.now();
    this.deathPos = this.camera.position.clone();
    this.killerId = d.killer;
    this.killerName = d.killerName;
    this.mouseDown = false;
    this.aiming = false;
    // El ratón sigue capturado: se reaparece solo y se sigue jugando sin hacer clic
  }

  onRemoteShot({ id, w, e }) {
    const r = this.remotes.get(id);
    if (!r?.model) return;
    r.lastShot = performance.now();
    const g = r.model.group.position;
    if (!this.isMate(r) && this.alive && g.distanceTo(this.pos) < 45) this.addTick(g.x, g.z, '#ffc93c');
    const from = new THREE.Vector3(g.x, g.y + (r.sl ? 0.85 : 1.35), g.z);
    for (const end of WEAPONS[w]?.melee ? [] : e) {
      const to = new THREE.Vector3(...end);
      this.addTracer(from, to);
      this.addImpact(to, false);
    }
    const dist = from.distanceTo(this.camera.position);
    sfx.shot(WEAPONS[w]?.sound, Math.max(0, 1 - dist / 70) * 0.8);
  }

  // ============================================================ Armas
  weaponId(slot = this.slot) {
    return this.loadout[slot] ?? this.loadout[0];
  }

  // Armas según el modo y el nivel, con cargadores llenos
  equip() {
    this.loadout = loadoutOf(this.mode, this.character, this.level, this.limit);
    this.ammo = this.loadout.map((id) => ({ mag: WEAPONS[id].mag, reloadEnd: 0 }));
    this.lastShot = this.loadout.map(() => 0);
    this.slot = 0;
    this.prevSlot = 1;
    this.bloom = 0;
    this.setGun();
  }

  // Multiplicador de sensibilidad: 1 sin apuntar; apuntando, compensa el zoom × adsSens
  aimSensMult() {
    if (!this.alive) return 1;
    const w = this.weapon();
    const t = w.scope ? (this.scoped() ? 1 : 0) : this.aimLerp;
    const zoom = 1 + (w.zoom - 1) * t;
    return 1 + (this.adsSens / zoom - 1) * t;
  }
  weapon() {
    return WEAPONS[this.weaponId()];
  }

  setGun() {
    this.gunHolder.clear();
    const { color, skin } = this.outfit(this.character.id, this.skin, this.myTeam);
    this.gun = buildGun(this.weaponId(), true, color);
    buildArms(this.gun, this.weaponId(), skin, color);
    this.gunHolder.add(this.gun);
  }

  switchSlot(s) {
    if (!this.alive || s === this.slot || s >= this.loadout.length) return;
    this.ammo[this.slot].reloadEnd = 0;
    this.prevSlot = this.slot;
    this.slot = s;
    this.swapUntil = performance.now() + 250;
    this.bloom = 0;
    this.aiming = false;
    this.setGun();
    this.socket.emit('player:switch', { slot: s });
  }

  startReload() {
    const w = this.weapon();
    const a = this.ammo[this.slot];
    if (w.melee || a.reloadEnd || a.mag === w.mag) return;
    a.reloadEnd = performance.now() + w.reload;
    this.socket.emit('player:reload');
    sfx.reload();
  }

  scoped() {
    if (!this.alive) return false;
    const w = this.weapon();
    return !!w.scope && this.aimLerp > 0.85 && !this.ammo[this.slot].reloadEnd;
  }

  // Al dejar de disparar la mira vuelve sola a donde estaba (si no la has movido tú)
  recoverRecoil(dt, now) {
    if (this.recoil <= 0 || now - this.lastShot[this.slot] < 90) return;
    const back = Math.min(this.recoil, dt * (0.25 + this.recoil * 6));
    this.pitch -= back;
    this.recoil -= back;
  }

  updateWeapon(now) {
    const w = this.weapon();
    const a = this.ammo[this.slot];
    if (a.reloadEnd && now >= a.reloadEnd) {
      a.mag = w.mag;
      a.reloadEnd = 0;
    }
    if (a.mag === 0 && !a.reloadEnd && !w.melee) this.startReload();
    if ((this.mouseDown || this.clicked) && this.locked) this.tryShoot(now, w, a);
    this.clicked = false;
  }

  // Dispersión actual: moverse, esprintar y saltar la abren; apuntar y agacharse la cierran.
  // Apuntar no es instantáneo: la precisión llega al terminar de subir el arma (adsSpeed)
  spread(w) {
    const hs = Math.hypot(this.vel.x, this.vel.z);
    // Con la mira telescópica ya en pantalla, el tiro va a donde ves (sin esperar a que termine de subir)
    const t = this.scoped() ? 1 : this.aimLerp * this.aimLerp * (3 - 2 * this.aimLerp);
    // Base (cadera → apuntando) + lo que se ha abierto por disparar seguido (apuntando se abre la mitad)
    let sp = w.spread + (w.adsSpread - w.spread) * t + this.bloom * (1 - 0.5 * t);
    const move = 0.6 + ((w.moveSpread ?? 0.6) - 0.6) * t;
    const air = 1.8 + ((w.airSpread ?? 1.8) - 1.8) * t;
    sp *= 1 + Math.min(hs / 8, 1) * move;
    if (!this.grounded) sp *= air;
    else if (this.crouching && !this.sliding) sp *= 0.7;
    if (this.sprinting) sp *= 1.5;
    return sp;
  }

  tryShoot(now, w, a) {
    if (a.reloadEnd || a.mag <= 0 || now < this.swapUntil) return;
    if (now - this.lastShot[this.slot] < w.fireRate) return;
    if (!w.auto && !this.triggerReleased) return;
    this.triggerReleased = false;
    this.lastShot[this.slot] = now;
    this.protUntil = 0; // disparar quita la protección de reaparición
    this.sprintBlockUntil = now + 400;
    if (w.melee) return this.swing(now, w);
    a.mag--;

    const cam = this.camera;
    const base = cam.getWorldDirection(new THREE.Vector3());
    const sp = this.spread(w);

    const o = [cam.position.x, cam.position.y, cam.position.z];
    const targets = [];
    for (const r of this.remotes.values()) {
      // Donde se ve al rival en pantalla (el servidor lo rebobina a ese mismo instante)
      const g = r.model?.group.position;
      if (r.alive && g && !this.isMate(r)) targets.push({ id: r.id, x: g.x, y: g.y, z: g.z, sl: r.sl, cr: r.cr, alive: true });
    }
    const muzzle = tmp.set(this.aimLerp > 0.5 ? 0 : 0.22, -0.16, -0.7).applyQuaternion(cam.quaternion).add(cam.position).clone();
    const dirs = [];
    for (let i = 0; i < w.pellets; i++) {
      const d = spreadDir(base, sp);
      dirs.push([+d.x.toFixed(4), +d.y.toFixed(4), +d.z.toFixed(4)]);
      const { t, hit } = castShot(o, [d.x, d.y, d.z], this.colliders, targets, this.myId, w.range);
      const end = cam.position.clone().addScaledVector(d, t);
      this.addTracer(muzzle, end);
      if (hit) this.addImpact(end, hit.type === 'player');
    }
    this.socket.emit('player:shoot', { o, d: dirs, lag: Math.round(this.rtt / 2 + VIEW_DELAY_MS) });
    this.bloom = Math.min(w.bloomMax ?? 0, this.bloom + (w.bloom ?? 0));
    this.pendingShots.push(now);

    // Apuntando el retroceso es menor
    const kickUp = w.recoil * (0.8 + Math.random() * 0.4) * (1 - 0.35 * this.aimLerp);
    this.pitch = Math.min(1.55, this.pitch + kickUp);
    this.recoil += kickUp;
    this.yaw += (Math.random() - 0.5) * w.recoil * 0.3;
    this.kick = 1;
    this.flashTime = now;
    sfx.shot(w.sound, 1);
  }

  // Cuchillazo: sin trazadora ni retroceso; el servidor perdona un poco la puntería a esta distancia
  swing(now, w) {
    const cam = this.camera;
    const d = cam.getWorldDirection(new THREE.Vector3());
    const o = [cam.position.x, cam.position.y, cam.position.z];
    this.socket.emit('player:shoot', { o, d: [[+d.x.toFixed(4), +d.y.toFixed(4), +d.z.toFixed(4)]], lag: Math.round(this.rtt / 2 + VIEW_DELAY_MS) });
    this.pendingShots.push(now);
    this.swingAt = now;
    sfx.shot(w.sound, 1);
  }

  screenAngle(x, z) {
    return -(Math.atan2(-(x - this.pos.x), -(z - this.pos.z)) - this.yaw);
  }

  addTick(x, z, color) {
    this.ticks.push({ key: performance.now() + Math.random(), x, z, color, t: performance.now() });
  }

  isMate(r) {
    return isTeamMode(this.mode) && r.team === this.myTeam;
  }

  // ============================================================ Efectos
  addDamageNumber(at, dmg, head, kill) {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 64;
    const g = c.getContext('2d');
    const px = (kill ? 32 : head ? 28 : 22) * 1.6;
    g.font = `${px}px Bungee, 'Arial Black', sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    g.lineWidth = 9;
    g.strokeStyle = '#1b2a4a';
    g.strokeText(dmg, 64, 34);
    g.fillStyle = kill ? '#ff4d4d' : head ? '#ffc93c' : '#ffffff';
    g.fillText(dmg, 64, 34);
    const tex = new THREE.CanvasTexture(c);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, sizeAttenuation: false });
    const mesh = new THREE.Sprite(mat);
    mesh.scale.set(0.1, 0.05, 1);
    mesh.position.set(at[0] + (Math.random() - 0.5) * 0.4, at[1] + 0.2, at[2] + (Math.random() - 0.5) * 0.4);
    mesh.renderOrder = 10;
    this.scene.add(mesh);
    this.effects.push({ mesh, life: 0.7, max: 0.7, rise: 0.9, pop: { x: 0.1, y: 0.05 } });
  }

  addTracer(from, to) {
    const len = from.distanceTo(to);
    if (len < 0.5) return;
    const mesh = new THREE.Mesh(
      tracerGeo,
      new THREE.MeshBasicMaterial({ color: 0xfff1a8, transparent: true, opacity: 0.85 }),
    );
    mesh.scale.set(0.025, 0.025, len);
    mesh.position.copy(from).lerp(to, 0.5);
    mesh.lookAt(to);
    this.scene.add(mesh);
    this.effects.push({ mesh, life: 0.08, max: 0.08 });
  }

  addImpact(at, onPlayer) {
    const mesh = new THREE.Mesh(
      impactGeo,
      new THREE.MeshBasicMaterial({ color: onPlayer ? 0xff4d4d : 0x3a3a3a, transparent: true }),
    );
    mesh.position.copy(at);
    this.scene.add(mesh);
    this.effects.push({ mesh, life: 0.3, max: 0.3 });
  }

  updateEffects(dt) {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.life -= dt;
      e.mesh.material.opacity = Math.max(0, e.life / e.max);
      if (e.rise) e.mesh.position.y += e.rise * dt;
      if (e.pop) {
        // escala 1.3 → 1 en el primer 18 % de la vida
        const k = 1 + 0.3 * Math.max(0, 1 - (e.max - e.life) / (e.max * 0.18));
        e.mesh.scale.set(e.pop.x * k, e.pop.y * k, 1);
      }
      if (e.life <= 0) {
        this.scene.remove(e.mesh);
        e.mesh.material.map?.dispose();
        e.mesh.material.dispose();
        this.effects.splice(i, 1);
      }
    }
  }

  // ============================================================ Física
  overlaps(x, y, z, H = this.height) {
    const R = PLAYER.radius;
    for (const b of this.colliders) {
      if (x - R < b.max[0] && x + R > b.min[0] && y < b.max[1] && y + H > b.min[1] && z - R < b.max[2] && z + R > b.min[2]) return true;
    }
    return false;
  }

  moveAxis(i, d, wasGrounded) {
    if (d === 0) return;
    const ax = 'xyz'[i];
    const p = this.pos;
    const R = PLAYER.radius;
    const H = this.height;
    p[ax] += d;
    for (const b of this.colliders) {
      if (!(p.x - R < b.max[0] && p.x + R > b.min[0] && p.y < b.max[1] && p.y + H > b.min[1] && p.z - R < b.max[2] && p.z + R > b.min[2])) continue;
      if (i === 1) {
        if (d < 0) {
          p.y = b.max[1];
          this.grounded = true;
          if (b.c === 'pad') this.onPad = true;
        } else p.y = b.min[1] - H;
        this.vel.y = 0;
      } else {
        // Subir escalones automáticamente
        const step = b.max[1] - p.y;
        if (wasGrounded && step > 0 && step <= PLAYER.stepUp && !this.overlaps(p.x, b.max[1] + 0.001, p.z)) {
          p.y = b.max[1] + 0.001;
          continue;
        }
        p[ax] = d > 0 ? b.min[i] - R - 1e-4 : b.max[i] + R + 1e-4;
        this.vel[ax] = 0;
      }
    }
  }

  updateMovement(dt, now) {
    const k = this.keys;
    const v = this.vel;
    const input = this.locked;
    const f = input ? (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0) : 0;
    const s = input ? (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0) : 0;
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    let wx = -sin * f + cos * s;
    let wz = -cos * f - sin * s;
    const wl = Math.hypot(wx, wz);
    if (wl > 0) {
      wx /= wl;
      wz /= wl;
    }
    const hs = Math.hypot(v.x, v.z);
    const crouchKey = input && (k.has('KeyC') || k.has('ControlLeft') || k.has('ControlRight'));
    const slideKey = crouchKey;
    const sprintKey = input && (k.has('ShiftLeft') || k.has('ShiftRight'));
    const wantJump = input && (k.has('Space') || now - this.jumpPressedAt < PLAYER.jumpBuffer * 1000);

    // Agacharse (C). Para ponerse de pie hace falta sitio encima de la cabeza
    if (crouchKey) this.crouching = true;
    else if (this.crouching && !this.overlaps(this.pos.x, this.pos.y + 0.001, this.pos.z, PLAYER.height)) this.crouching = false;

    // Sprint (Shift): solo hacia delante, sin apuntar ni disparar. Con useStamina gasta estamina
    const w = this.weapon();
    if (!PLAYER.useStamina) this.stamina = PLAYER.stamina;
    if (this.staminaLock && this.stamina >= PLAYER.staminaMin) this.staminaLock = false;
    const canSprint = sprintKey && f > 0 && !this.aiming && !this.mouseDown && !this.crouching && !this.sliding && now >= this.sprintBlockUntil;
    this.sprinting = canSprint && !this.staminaLock && this.stamina > 0 && (this.grounded || this.sprinting);
    if (this.sprinting && hs > 1 && PLAYER.useStamina) {
      this.stamina = Math.max(0, this.stamina - PLAYER.staminaDrain * dt);
      this.staminaAt = now;
      if (this.stamina <= 0) {
        this.staminaLock = true;
        this.sprinting = false;
      }
    } else if (now - this.staminaAt > PLAYER.staminaDelay) {
      this.stamina = Math.min(PLAYER.stamina, this.stamina + PLAYER.staminaRegen * dt);
    }

    // Las armas pesadas frenan; apuntando se va más despacio (adsMove de cada arma). Los infectados corren más
    const walk = this.character.speed * (w.weight ?? 1) * (this.mode === 'infect' && this.myTeam === 2 ? INFECT.speed : 1);
    const base = walk * (this.aiming ? w.adsMove ?? 0.65 : this.sprinting ? PLAYER.sprint : 1);
    const speed = base * (this.crouching && !this.sliding ? PLAYER.crouchSpeed : 1);

    if (this.grounded) {
      this.coyote = PLAYER.coyote;
      // Deslizamiento: C o Ctrl corriendo (también al aterrizar con la tecla pulsada: slide-hop).
      // Encadenando salto + slide cada deslizamiento gana un poco de velocidad (slideGain)
      const slideReady = now - this.slideEndAt > PLAYER.slideCooldown * 1000 && (!PLAYER.useStamina || this.stamina >= PLAYER.slideCost);
      if (slideKey && (!this.crouchHeld || this.justLanded) && hs > walk * 0.6 && !this.sliding && slideReady) {
        this.sliding = true;
        this.slideTime = PLAYER.slideTime;
        if (PLAYER.useStamina) {
          this.stamina -= PLAYER.slideCost;
          this.staminaAt = now;
        }
        this.sprinting = false;
        const boost = Math.max(hs * (this.justLanded ? PLAYER.slideGain : 1), walk * PLAYER.slideBoost);
        const dx = wl > 0 ? wx : v.x / hs;
        const dz = wl > 0 ? wz : v.z / hs;
        v.x = dx * boost;
        v.z = dz * boost;
        sfx.slide();
      }
      if (this.sliding) {
        // Por encima del tope suave el slide frena más (overFriction)
        const fr = Math.exp(-(hs > walk * PLAYER.softCap ? PLAYER.overFriction : PLAYER.slideFriction) * dt);
        v.x *= fr;
        v.z *= fr;
        this.slideTime -= dt;
        if (this.slideTime <= 0 || !slideKey) {
          this.sliding = false;
          this.slideEndAt = now;
        }
      } else if (!(wantJump && hs > speed)) {
        // Al encadenar saltos no se frena: así funciona el bunny hop
        const a = damp(14, dt);
        v.x += (wx * speed - v.x) * a;
        v.z += (wz * speed - v.z) * a;
      }
      // Pasos
      if (!this.sliding && hs > 2) {
        this.stepDist += hs * dt;
        if (this.stepDist > (this.crouching ? 2.6 : 2.2)) {
          this.stepDist = 0;
          sfx.step(this.crouching ? 0.35 : 1);
        }
      }
    } else {
      this.coyote -= dt;
      // Control en el aire estilo Quake: girando con A/D se gana algo de velocidad
      if (wl > 0) {
        const add = speed * PLAYER.airCap - (v.x * wx + v.z * wz);
        if (add > 0) {
          const acc = Math.min(PLAYER.airAccel * speed * dt, add);
          v.x += wx * acc;
          v.z += wz * acc;
        }
      }
    }
    const nh = Math.hypot(v.x, v.z);
    // Tope absoluto (el tope suave solo frena en el suelo; en el aire se conserva la velocidad)
    const max = walk * PLAYER.maxSpeed;
    if (nh > max) {
      v.x *= max / nh;
      v.z *= max / nh;
    }

    // Salto (con margen al salir de un borde y memoria de la tecla)
    if (wantJump && this.coyote > 0 && v.y <= 0.01) {
      v.y = PLAYER.jump; // conserva el impulso: slide + salto = muy rápido
      this.grounded = false;
      this.coyote = 0;
      this.jumpPressedAt = -1e9;
      if (this.sliding) this.slideEndAt = now;
      this.sliding = false;
      sfx.jump();
    }
    this.crouchHeld = slideKey;
    this.height = this.crouching || this.sliding ? PLAYER.crouchHeight : PLAYER.height;

    v.y = Math.max(-50, v.y - PLAYER.gravity * dt);
    const fall = v.y;
    const wasGrounded = this.grounded;
    this.grounded = false;
    this.moveAxis(0, v.x * dt, wasGrounded);
    this.moveAxis(2, v.z * dt, wasGrounded);
    this.onPad = false;
    this.moveAxis(1, v.y * dt, wasGrounded);
    // Plataforma de salto: impulso hacia arriba conservando la velocidad horizontal
    if (this.onPad) {
      v.y = PAD.power;
      this.grounded = false;
      this.coyote = 0;
      this.sliding = false;
      sfx.pad();
    }
    this.justLanded = this.grounded && !wasGrounded;
    if (this.justLanded && fall < -7) {
      this.landDip = Math.min(0.3, -fall * 0.014);
      sfx.land(Math.min(1, -fall / 20));
    }
    // Si al terminar el slide no cabes de pie, sigues agachado
    if (!this.sliding && !this.crouching && this.height < PLAYER.height) {
      if (this.overlaps(this.pos.x, this.pos.y + 0.001, this.pos.z, PLAYER.height)) this.crouching = true;
      else this.height = PLAYER.height;
    }
    if (this.pos.y < -20) this.pos.set(...this.map.spawns[0]);
  }

  // ============================================================ Cámara y arma en mano
  updateCamera(dt, now) {
    const cam = this.camera;
    if (this.alive) {
      const low = this.sliding || this.crouching;
      this.eye += ((low ? PLAYER.slideEye : PLAYER.eye) - this.eye) * damp(12, dt);
      this.landDip *= Math.exp(-9 * dt); // pequeño golpe de cámara al aterrizar
      cam.position.set(this.pos.x, this.pos.y + this.eye - this.landDip, this.pos.z);
      cam.rotation.set(this.pitch, this.yaw, 0);
      const w = this.weapon();
      // Cerrojo (francotirador): tras disparar se sale de la mira hasta poder volver a disparar
      const bolt = w.bolt && now - this.lastShot[this.slot] < (w.boltTime ?? w.fireRate * 0.85);
      const busy = this.ammo[this.slot].reloadEnd || now < this.swapUntil || bolt;
      this.aimLerp += ((this.aiming && !busy && !w.melee ? 1 : 0) - this.aimLerp) * damp(w.adsSpeed ?? 16, dt);
      const running = this.sprinting && Math.hypot(this.vel.x, this.vel.z) > 1;
      this.sprintLerp += ((running ? 1 : 0) - this.sprintLerp) * damp(10, dt);
      const fovT = this.baseFov / (1 + (w.zoom - 1) * (w.scope ? (this.scoped() ? 1 : 0) : this.aimLerp)) + (this.sliding ? 6 : 0) + this.sprintLerp * 5;
      this.fov += (fovT - this.fov) * damp(18, dt);
    } else if (this.deathPos) {
      // Cámara de muerte: sube y mira a quien te eliminó
      const killer = this.remotes.get(this.killerId);
      cam.position.lerp(tmp.copy(this.deathPos).add(new THREE.Vector3(0, 3, 0)), damp(3, dt));
      if (killer?.model) cam.lookAt(killer.model.group.position.clone().add(new THREE.Vector3(0, 1.4, 0)));
      this.fov += (this.baseFov - this.fov) * damp(8, dt);
    } else {
      const t = now * 0.00006;
      const R = this.map.half * 1.15;
      cam.position.set(Math.sin(t) * R, this.map.half * 0.65, Math.cos(t) * R);
      cam.lookAt(0, 2, 0);
      this.fov = this.baseFov;
    }
    cam.fov = this.fov;
    cam.updateProjectionMatrix();
  }

  updateViewmodel(dt, now) {
    this.gunHolder.visible = this.alive && !this.scoped();
    if (!this.alive || !this.gun) return;
    const w = this.weapon();
    const a = this.ammo[this.slot];
    const hs = Math.hypot(this.vel.x, this.vel.z);
    if (this.grounded && !this.sliding) this.bobT += dt * hs * 1.3;
    const sp = this.sprintLerp;
    const amt = Math.min(hs / 7, 1) * (1 - this.aimLerp * 0.85) * (1 + sp * 1.2);
    this.kick = Math.max(0, this.kick - dt * 9);

    const t = this.aimLerp;
    let x = 0.22 * (1 - t) + Math.sin(this.bobT) * 0.014 * amt;
    const sightY = (this.gun.userData.sightY ?? 0.12) * this.gunHolder.scale.y;
    let y = -0.2 * (1 - t) - sightY * t - Math.abs(Math.cos(this.bobT)) * 0.012 * amt;
    // Al apuntar el arma queda algo más lejos: la mira de punto rojo tapa menos al rival
    let z = -0.42 * (1 - t) + -0.46 * t + this.kick * 0.07;
    let rx = this.kick * 0.12 * (w.recoil > 0.03 ? 2 : 1);

    if (a.reloadEnd) {
      const p = 1 - (a.reloadEnd - now) / w.reload;
      const dip = Math.sin(Math.max(0, Math.min(1, p)) * Math.PI);
      y -= dip * 0.16;
      rx -= dip * 0.7;
    }
    if (now < this.swapUntil) y -= ((this.swapUntil - now) / 250) * 0.25;
    if (this.sliding) rx += 0.08;
    // Esprintando el arma se baja y se ladea
    x -= sp * 0.04;
    y -= sp * 0.05;
    rx -= sp * 0.3;

    // Cuchillo: tajo de derecha a izquierda
    let ry = sp * 0.7;
    let rz = (this.sliding ? 0.25 : 0) + sp * 0.3;
    const sw = (now - this.swingAt) / 280;
    if (w.melee && sw < 1) {
      const k = Math.sin(sw * Math.PI);
      x -= k * 0.18;
      z -= k * 0.12;
      ry += k * 0.9;
      rz -= k * 0.6;
      rx -= k * 0.3;
    }
    this.gunHolder.position.set(x, y, z);
    this.gunHolder.rotation.set(rx, ry, rz);
    if (this.gun.userData.flash) this.gun.userData.flash.visible = now - this.flashTime < 45;
  }

  updateRemotes(dt) {
    const k = damp(14, dt);
    bubbleMat.opacity = 0.14 + 0.08 * Math.sin(performance.now() * 0.008);
    for (const r of this.remotes.values()) {
      if (!r.model || !r.alive) continue;
      r.bubble.visible = r.prot;
      const g = r.model.group;
      const bx = g.position.x;
      const bz = g.position.z;
      g.position.lerp(r.target, k);
      g.rotation.y = dampAngle(g.rotation.y, r.ry, k);
      r.model.aim.rotation.x += (r.rx - r.model.aim.rotation.x) * k;
      const speed = Math.hypot(g.position.x - bx, g.position.z - bz) / Math.max(dt, 1e-4);
      r.walk += speed * dt * 2.2;
      // Pasos: un enemigo que corre cerca (no agachado ni en el aire) deja una marca blanca
      if (this.alive && !this.isMate(r) && !r.cr && speed > 3 && Math.abs(g.position.y - r.target.y) < 0.3) {
        r.stepAcc = (r.stepAcc || 0) + speed * dt;
        if (r.stepAcc > 4.5 && g.position.distanceTo(this.pos) < 20) {
          r.stepAcc = 0;
          this.addTick(g.position.x, g.position.z, '#f7f9fc');
        }
      }
      // Andando balancea las piernas; deslizando las estira; agachado, rodilla al suelo
      const swing = r.sl ? 0 : Math.sin(r.walk) * Math.min(speed / 7, 1) * (r.cr ? 0.35 : 0.7);
      const low = r.sl || r.cr;
      r.model.legL.rotation.x = r.sl ? 1.2 : r.cr ? 1.1 + swing : swing;
      r.model.legR.rotation.x = r.sl ? 1.2 : r.cr ? -0.35 - swing : -swing;
      r.model.legL.position.y = r.model.legR.position.y += ((low ? 0.5 : 0.8) - r.model.legR.position.y) * k;
      r.model.upper.position.y += ((low ? -0.5 : 0) - r.model.upper.position.y) * k;
    }
  }

  // ============================================================ Bucle
  loop() {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 1 / 30);
    const now = performance.now();

    if (this.alive) this.updateMovement(dt, now);
    else if (this.autoChar && this.deathAt && now - this.deathAt >= PLAYER.respawnDelay && now - this.spawnReqAt > 1000) {
      // Reaparición automática con el personaje elegido
      this.spawnReqAt = now;
      this.socket.emit('player:spawn', { characterId: this.autoChar.id, skin: this.autoChar.skin });
    }
    this.updateCamera(dt, now);
    if (this.alive) {
      this.updateWeapon(now);
      this.recoverRecoil(dt, now);
    }
    while (this.pendingShots.length && now - this.pendingShots[0] > 400) {
      this.pendingShots.shift();
      this.combo = 0;
    }
    if (this.combo && now - this.comboAt > 1500) this.combo = 0;
    this.updateViewmodel(dt, now);
    this.updateRemotes(dt);
    this.updateEffects(dt);
    this.updateFlags(dt, now);
    this.updateTags(now);
    // La dispersión por ráfaga baja en cuanto dejas de disparar
    if (this.alive && now - this.lastShot[this.slot] > 140) this.bloom *= Math.exp(-7 * dt);

    this.sendAcc += dt * 1000;
    if (this.sendAcc >= CLIENT_SEND_MS) {
      this.sendAcc = 0;
      if (this.alive) {
        this.socket.volatile.emit('player:state', {
          x: +this.pos.x.toFixed(3), y: +this.pos.y.toFixed(3), z: +this.pos.z.toFixed(3),
          ry: +this.yaw.toFixed(3), rx: +this.pitch.toFixed(3), sl: this.sliding ? 1 : 0, cr: this.crouching && !this.sliding ? 1 : 0,
        });
      }
    }

    this.hudAcc += dt * 1000;
    if (this.hudAcc >= HUD_MS) {
      this.hudAcc = 0;
      this.emitHud(now);
    }

    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    if (this.gunHolder.visible) {
      this.renderer.clearDepth();
      this.renderer.render(this.vmScene, this.vmCamera);
    }
  }

  emitHud(now) {
    const w = this.alive ? this.weapon() : null;
    const a = this.alive ? this.ammo[this.slot] : null;
    this.onHud({
      alive: this.alive,
      everSpawned: this.everSpawned,
      locked: this.locked,
      hp: Math.max(0, Math.ceil(this.hp)),
      maxHp: this.maxHp,
      characterId: this.character?.id,
      charName: this.character?.name,
      stamina: PLAYER.useStamina ? this.stamina / PLAYER.stamina : null,
      armor: this.alive ? this.armor : 0,
      radar: this.radar,
      infect: this.infect,
      staminaLow: this.staminaLock,
      sprinting: this.sprinting,
      weaponName: w?.name,
      mag: a?.mag,
      magSize: w?.mag,
      reloading: !!a?.reloadEnd,
      reloadPct: a?.reloadEnd ? Math.min(1, 1 - (a.reloadEnd - now) / w.reload) : 0,
      slot: this.slot,
      loadout: this.loadout.map((id) => WEAPONS[id].name),
      melee: !!w?.melee,
      gunLevel: this.mode === 'gungame' ? this.level + 1 : 0,
      gunTotal: this.mode === 'gungame' ? gunLadder(this.limit).length : 0,
      scoped: this.scoped(),
      protect: this.alive ? Math.max(0, this.protUntil - now) : 0,
      hit: now - this.hitTime < 220,
      hitHead: this.hitHead,
      damage: Math.max(0, 1 - (now - this.damageTime) / 600),
      respawnIn: this.alive || !this.deathAt ? 0 : Math.max(0, PLAYER.respawnDelay - (now - this.deathAt)),
      killerName: this.killerName,
      players: this.players,
      spread: w ? this.spread(w) + this.kick * 0.02 : 0,
      aim: this.aimLerp,
      dmgDirs: this.damageDirections(now),
      mode: this.mode,
      myTeam: this.myTeam,
      hitKey: this.hitTime,
      hitRed: this.hitRed,
      combo: this.combo,
      comboKey: this.comboAt,
      ticks: this.soundTicks(now),
      shotKey: this.flashTime,
      damageKey: this.damageTime,
      deathKey: this.deathAt,
      teamScore: this.teamScore,
      flags: this.flags,
      ping: Math.round(this.rtt),
    });
  }

  // Ángulo en pantalla (0 = delante, positivo = a la derecha) de quien te disparó hace poco
  damageDirections(now) {
    this.damageDirs = this.damageDirs.filter((d) => now - d.t < 1200);
    return this.damageDirs.map((d) => {
      const a = Math.atan2(-(d.x - this.pos.x), -(d.z - this.pos.z));
      return { key: d.t, angle: -(a - this.yaw), life: 1 - (now - d.t) / 1200 };
    });
  }

  soundTicks(now) {
    this.ticks = this.ticks.filter((t) => now - t.t < 1000);
    return this.ticks.map((t) => {
      return { key: t.key, color: t.color, angle: this.screenAngle(t.x, t.z) };
    });
  }

  resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.renderer.setSize(w, h);
    for (const c of [this.camera, this.vmCamera]) {
      c.aspect = w / h;
      c.updateProjectionMatrix();
    }
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    clearInterval(this.pingTimer);
    navigator.keyboard?.unlock?.();
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    this.unsubSettings();
    window.removeEventListener('keydown', this.h.keydown);
    window.removeEventListener('keyup', this.h.keyup);
    window.removeEventListener('mousemove', this.h.mousemove);
    window.removeEventListener('mousedown', this.h.mousedown);
    window.removeEventListener('mouseup', this.h.mouseup);
    window.removeEventListener('wheel', this.h.wheel);
    window.removeEventListener('contextmenu', this.h.contextmenu);
    window.removeEventListener('resize', this.h.resize);
    window.removeEventListener('blur', this.h.blur);
    document.removeEventListener('pointerlockchange', this.h.lockchange);
    for (const [ev, fn] of this.netHandlers) this.socket.off(ev, fn);
    if (document.pointerLockElement) document.exitPointerLock();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
