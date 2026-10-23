import express from 'express';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import multicastDns from 'multicast-dns';
import {
  CHAR_BY_ID,
  WEAPONS,
  PLAYER,
  MAPS,
  damageAt,
  TEAM_SWITCH_COOLDOWN,
  MAP_SIZES,
  SKINS,
  LAG_COMP_MAX_MS,
  MODES,
  MODE_BY_ID,
  isTeamMode,
  FLAG,
  loadoutOf,
  gunLadder,
  TEAMS,
  SERVER_TICK_MS,
  MATCH_RESTART_MS,
  getColliders,
  getMap,
  TAG,
  INFECT,
  STREAK_REWARDS,
  canSwitchTeam,
  teamName,
} from '@blockshot/shared';
import { castShot, rayAABB } from '@blockshot/shared';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const DIST = path.resolve(__dirname, '../client/dist');

// ---------------------------------------------------------------- HTTP
const app = express();
// Prueba de conexión desde otro PC: http://<ip>:3000/ping
app.get('/ping', (req, res) => res.type('text/plain').send('ok'));
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST));
  app.use((req, res) => res.sendFile(path.join(DIST, 'index.html')));
} else {
  app.get('/', (req, res) =>
    res.send(
      '<h2>Cliente sin compilar</h2><p>Ejecuta <code>npm run clase</code>, o usa <code>npm run dev</code> y entra por el puerto 5173.</p>',
    ),
  );
}

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// ---------------------------------------------------------------- Estado
const rooms = new Map(); // id -> room

const clean = (s, n, def) => (typeof s === 'string' ? s.trim().replace(/\s+/g, ' ').slice(0, n) : '') || def;
const hash = (s) => crypto.createHash('sha256').update(s).digest('hex');
const finite = (...v) => v.every(Number.isFinite);
const isVec3 = (a) => Array.isArray(a) && a.length === 3 && finite(...a);
const r2 = (n) => Math.round(n * 100) / 100;

const summary = (r) => ({
  id: r.id,
  name: r.name,
  players: r.players.size,
  max: r.max,
  locked: !!r.passHash,
  host: r.hostName,
  map: r.map.name,
  size: r.map.sizeName,
  mode: MODES.find((m) => m.id === r.mode).name,
  mapId: r.map.id,
  sizeId: r.map.size,
  modeId: r.mode,
  limit: r.scoreLimit,
});
const isTeams = (room) => isTeamMode(room.mode);
const sameTeam = (room, a, b) => isTeams(room) && a.team === b.team;
const roomList = () => [...rooms.values()].map(summary);
const broadcastRooms = () => io.to('lobby').emit('rooms', roomList());

function ctx(socket) {
  const room = rooms.get(socket.data.roomId);
  const p = room?.players.get(socket.id);
  return room && p ? { room, p } : null;
}

function weaponIdOf(p, slot = p.slot) {
  return p.loadout?.[slot] ?? null;
}

// Armas del jugador según el modo (en Escalada de armas, según su nivel), con cargadores llenos
function equip(room, p) {
  p.loadout = loadoutOf(room.mode, CHAR_BY_ID[p.characterId], p.level, room.scoreLimit, p.team);
  p.ammo = p.loadout.map((id) => ({ mag: WEAPONS[id].mag, reloadEnd: 0 }));
  p.lastShot = p.loadout.map(() => 0);
  p.slot = 0;
}

function pickSpawn(room, me) {
  const others = [...room.players.values()].filter((p) => p.alive && p.id !== me.id);
  const enemies = others.filter((p) => !sameTeam(room, p, me));
  const mates = others.filter((p) => sameTeam(room, p, me));
  const near = (list, s) => Math.min(...list.map((e) => Math.hypot(e.x - s[0], e.z - s[2])));
  // Captura la bandera: cada equipo aparece en su mitad (Rojo al oeste, Azul al este)
  let spawns = room.map.spawns;
  if (room.mode === 'ctf' && me.team) {
    const mine = spawns.filter((s) => (me.team === 1 ? s[0] < -1 : s[0] > 1));
    if (mine.length) spawns = mine;
  }
  const scored = spawns.map((s) => ({
    s,
    d: (enemies.length ? near(enemies, s) : Math.random() * 100) - (mates.length ? near(mates, s) * 0.3 : 0),
  }));
  scored.sort((a, b) => b.d - a.d);
  return scored[Math.floor(Math.random() * Math.min(3, scored.length))].s;
}

// Posición de un jugador en un instante pasado (interpolando su historial)
function posAt(p, t) {
  const h = p.hist;
  if (!h.length || t >= h[h.length - 1].t) return p;
  for (let i = h.length - 1; i > 0; i--) {
    const a = h[i - 1];
    const b = h[i];
    if (a.t <= t) {
      const k = (t - a.t) / Math.max(1, b.t - a.t);
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k, sl: b.sl, cr: b.cr };
    }
  }
  return h[0];
}
function record(p, now) {
  p.hist.push({ t: now, x: p.x, y: p.y, z: p.z, sl: p.sl, cr: p.cr });
  while (p.hist.length && now - p.hist[0].t > 1000) p.hist.shift();
}

function smallerTeam(room) {
  let red = 0;
  let blue = 0;
  for (const p of room.players.values()) {
    if (p.team === 1) red++;
    else if (p.team === 2) blue++;
  }
  return red <= blue ? 1 : 2;
}

// Coloca al jugador en un punto de aparición con vida y munición llenas
function spawnPlayer(socket, room, p, ch, skin) {
  const now = Date.now();
  const [x, y, z, ry] = pickSpawn(room, p);
  const hp = Math.round(ch.hp * (isInfected(room, p) ? INFECT.hp : 1));
  Object.assign(p, {
    characterId: ch.id,
    skin: SKINS.some((k) => k.id === skin) ? skin : 'base',
    alive: true,
    hp,
    maxHp: hp,
    armor: 0,
    x,
    y,
    z,
    ry,
    rx: 0,
    sl: 0,
    cr: 0,
    spawnTime: now,
    protUntil: now + PLAYER.spawnProtection,
    lastState: now,
    lastDamage: 0,
    hist: [],
  });
  equip(room, p);
  record(p, now);
  socket.emit('player:spawned', {
    x,
    y,
    z,
    ry: p.ry,
    characterId: ch.id,
    skin: p.skin,
    hp,
    level: p.level,
    team: p.team,
  });
}

function joinRoom(socket, room, nickname, cb) {
  const p = {
    id: socket.id,
    name: nickname,
    characterId: null,
    alive: false,
    hp: 0,
    maxHp: 100,
    x: 0,
    y: 0,
    z: 0,
    ry: 0,
    rx: 0,
    slot: 0,
    sl: 0,
    cr: 0,
    skin: 'base',
    kills: 0,
    deaths: 0,
    ammo: [],
    lastShot: [0, 0],
    lastDamage: 0,
    deathTime: 0,
    spawnTime: 0,
    protUntil: 0,
    lastState: 0,
    team: room.mode === 'infect' ? (room.infect.started ? 2 : 1) : isTeams(room) ? smallerTeam(room) : 0,
    streak: 0,
    ping: 0,
    hist: [],
    bestStreak: 0,
    heads: 0,
    shots: 0,
    hits: 0,
    caps: 0,
    level: 0,
    loadout: [],
    armor: 0,
    radarUntil: 0,
  };
  room.players.set(socket.id, p);
  socket.leave('lobby');
  socket.join(room.id);
  socket.data.roomId = room.id;
  cb({
    ok: true,
    you: socket.id,
    room: {
      id: room.id,
      name: room.name,
      scoreLimit: room.scoreLimit,
      mapId: room.map.id,
      size: room.map.size,
      mode: room.mode,
      max: room.max,
    },
  });
  const team = p.team ? ` · ${teamName(room.mode, p.team)}` : '';
  socket.to(room.id).emit('notice', `${nickname} entró en la sala${team}`);
  broadcastRooms();
}

function leaveRoom(socket) {
  const c = ctx(socket);
  socket.data.roomId = null;
  if (!c) return;
  const { room, p } = c;
  room.players.delete(socket.id);
  socket.leave(room.id);
  socket.join('lobby');
  io.to(room.id).emit('notice', `${p.name} salió de la sala`);
  if (room.players.size === 0) {
    clearTimeout(room.restartTimer);
    rooms.delete(room.id);
  }
  broadcastRooms();
}

// Tres tarjetas de «Mejor jugada»: racha más larga, más tiros a la cabeza y mejor precisión (mínimo 10 disparos)
function bestPlays(room) {
  const ps = [...room.players.values()];
  const top = (f) => ps.reduce((a, b) => (f(b) > f(a) ? b : a), ps[0]);
  const out = [];
  const st = top((p) => p.bestStreak);
  if (st?.bestStreak > 0) out.push({ t: 'Más bajas seguidas', v: String(st.bestStreak), n: st.name });
  const hd = top((p) => p.heads);
  if (hd?.heads > 0) out.push({ t: 'Tiros a la cabeza', v: String(hd.heads), n: hd.name });
  const shooters = ps.filter((p) => p.shots >= 10);
  if (shooters.length) {
    const ac = shooters.reduce((a, b) => (b.hits / b.shots > a.hits / a.shots ? b : a));
    out.push({
      t: 'Precisión',
      v: `${Math.round((ac.hits / ac.shots) * 100)} %`,
      n: `${ac.name} · ${ac.hits} de ${ac.shots}`,
    });
  }
  return out;
}

// ---------------------------------------------------------------- Captura la bandera
// Cada equipo tiene una bandera en su base. Se coge la del rival pasando por encima,
// se captura llevándola a tu base con la tuya en casa. Si muere quien la lleva cae al
// suelo: un compañero del dueño la devuelve tocándola, o vuelve sola a los 20 s.
const homeFlag = ([x, y, z]) => ({ home: [x, y, z], x, y, z, carrier: null, atHome: true, droppedAt: 0 });
function resetFlags(room) {
  room.flags = room.mode === 'ctf' ? { 1: homeFlag(room.map.bases[1]), 2: homeFlag(room.map.bases[2]) } : null;
}
const nearFlag = (p, x, y, z) => Math.hypot(p.x - x, p.z - z) < FLAG.radius && Math.abs(p.y - y) < 2.5;
// Suelo justo debajo de un punto (no el tejado de encima si estaba bajo un puente)
function floorBelow(room, x, y, z) {
  let best = 0;
  for (const b of room.map.boxes) {
    const top = b.y + b.h;
    if (Math.abs(x - b.x) <= b.w / 2 && Math.abs(z - b.z) <= b.d / 2 && top <= y + 0.2) best = Math.max(best, top);
  }
  return best;
}
const flagEvent = (room, type, team, name) => io.to(room.id).emit('flag', { type, team, name });

function updateFlags(room, now) {
  for (const t of [1, 2]) {
    const f = room.flags[t];
    if (f.carrier) {
      const c = room.players.get(f.carrier);
      if (c && c.alive && c.team !== t) {
        Object.assign(f, { x: c.x, y: c.y, z: c.z });
        continue;
      }
      // Quien la llevaba murió, se fue o se cambió de equipo: cae donde estaba
      Object.assign(f, { carrier: null, y: floorBelow(room, f.x, f.y, f.z), droppedAt: now });
      const name = c?.name ?? f.carrierName;
      io.to(room.id).emit('notice', `${name} soltó la bandera ${TEAMS[t].name}`);
      flagEvent(room, 'drop', t, name);
    } else if (!f.atHome && now - f.droppedAt > FLAG.returnMs) {
      Object.assign(room.flags, { [t]: homeFlag(f.home) });
      io.to(room.id).emit('notice', `La bandera ${TEAMS[t].name} volvió a su base`);
      flagEvent(room, 'return', t);
    }
  }
  for (const p of room.players.values()) {
    if (!p.alive || !p.team) continue;
    const own = room.flags[p.team];
    const enemy = room.flags[3 - p.team];
    if (!enemy.carrier && nearFlag(p, enemy.x, enemy.y, enemy.z)) {
      Object.assign(enemy, { carrier: p.id, carrierName: p.name, atHome: false });
      p.protUntil = 0;
      io.to(room.id).emit('notice', `${p.name} cogió la bandera ${TEAMS[3 - p.team].name}`);
      flagEvent(room, 'take', 3 - p.team, p.name);
    }
    if (!own.carrier && !own.atHome && nearFlag(p, own.x, own.y, own.z)) {
      room.flags[p.team] = homeFlag(own.home);
      io.to(room.id).emit('notice', `${p.name} devolvió la bandera ${TEAMS[p.team].name}`);
      flagEvent(room, 'return', p.team, p.name);
    }
    const home = room.flags[p.team];
    if (enemy.carrier === p.id && home.atHome && nearFlag(p, ...home.home)) {
      room.flags[3 - p.team] = homeFlag(enemy.home);
      room.teamScore[p.team]++;
      p.caps++;
      io.to(room.id).emit('notice', `¡${p.name} capturó la bandera ${TEAMS[3 - p.team].name}!`);
      flagEvent(room, 'capture', 3 - p.team, p.name);
      if (room.teamScore[p.team] >= room.scoreLimit) return endMatch(room, `Equipo ${TEAMS[p.team].name}`, p.team);
    }
  }
}
const flagState = (f) => ({ x: r2(f.x), y: r2(f.y), z: r2(f.z), c: f.carrier, h: f.atHome ? 1 : 0 });

function endMatch(room, winnerName, winnerTeam = 0) {
  room.matchOver = true;
  for (const p of room.players.values()) p.alive = false;
  const scores = [...room.players.values()]
    .map((p) => ({ name: p.name, kills: p.kills, deaths: p.deaths, team: p.team }))
    .sort((a, b) => b.kills - a.kills);
  io.to(room.id).emit('match:end', {
    winner: winnerName,
    team: winnerTeam,
    scores,
    best: bestPlays(room),
    restartIn: MATCH_RESTART_MS,
  });
  room.restartTimer = setTimeout(() => {
    room.teamScore = { 1: 0, 2: 0 };
    resetFlags(room);
    room.tags = [];
    room.infect = newInfect();
    for (const p of room.players.values()) {
      if (room.mode === 'infect') p.team = 1;
      p.kills = 0;
      p.deaths = 0;
      p.deathTime = 0;
      p.streak = 0;
      Object.assign(p, { bestStreak: 0, heads: 0, shots: 0, hits: 0, caps: 0, level: 0, armor: 0, radarUntil: 0 });
    }
    room.matchOver = false;
    io.to(room.id).emit('match:start');
  }, MATCH_RESTART_MS);
}

function applyDamage(room, shooter, victim, dmg, head, w, socket, at3) {
  const now = Date.now();
  // Recién reaparecido: invulnerable unos segundos (hasta que dispare)
  if (!victim.alive || now < victim.protUntil) return;
  // El blindaje (recompensa de racha) se gasta antes que la vida
  const absorbed = Math.min(victim.armor || 0, dmg);
  victim.armor -= absorbed;
  victim.hp -= dmg - absorbed;
  victim.lastDamage = now;
  io.to(victim.id).emit('damaged', { hp: Math.max(0, Math.ceil(victim.hp)), from: [r2(shooter.x), r2(shooter.z)] });

  const at = [r2(at3[0]), r2(at3[1]), r2(at3[2])];
  if (victim.hp > 0) {
    socket.emit('hitmarker', { head, kill: false, dmg: Math.round(dmg), at });
    return;
  }
  victim.alive = false;
  victim.hp = 0;
  victim.armor = 0;
  victim.deaths++;
  victim.deathTime = now;
  const ended = victim.streak >= 3 ? victim.streak : 0;
  victim.streak = 0;
  shooter.kills++;
  shooter.streak++;
  shooter.bestStreak = Math.max(shooter.bestStreak, shooter.streak);
  const reward = room.mode === 'infect' ? null : STREAK_REWARDS[shooter.streak];
  if (reward?.id === 'radar') shooter.radarUntil = now + reward.ms;
  if (reward?.id === 'armor') shooter.armor = reward.amount;
  socket.emit('hitmarker', { head, kill: true, dmg: Math.round(dmg), at });
  io.to(room.id).emit('kill', {
    killer: shooter.id,
    killerName: shooter.name,
    killerTeam: shooter.team,
    killerChar: shooter.characterId,
    killerHp: Math.ceil(shooter.hp),
    victim: victim.id,
    victimName: victim.name,
    victimTeam: victim.team,
    weapon: w.name,
    head,
    streak: shooter.streak,
    ended,
    reward: reward?.name,
  });
  if (reward) io.to(room.id).emit('notice', `${shooter.name} consiguió ${reward.name} por su racha`);
  if (room.mode === 'gungame') return gunGameKill(room, shooter, victim, w);
  if (room.mode === 'kc') return dropTag(room, victim);
  if (room.mode === 'infect') return infectKill(room, shooter, victim);
  // En Captura la bandera las bajas no suman: solo las capturas
  if (room.mode === 'teams') {
    room.teamScore[shooter.team]++;
    if (room.teamScore[shooter.team] >= room.scoreLimit)
      endMatch(room, `Equipo ${TEAMS[shooter.team].name}`, shooter.team);
  } else if (room.mode === 'ffa' && shooter.kills >= room.scoreLimit) endMatch(room, shooter.name);
}

// Escalada de armas: la baja te da la siguiente arma; con la última (cuchillo) ganas.
// Una baja a cuchillo además le quita un arma a la víctima.
function gunGameKill(room, shooter, victim, w) {
  const ladder = gunLadder(room.scoreLimit);
  if (w.melee && victim.level > 0) {
    victim.level--;
    equip(room, victim);
    io.to(victim.id).emit('loadout', { level: victim.level });
    io.to(room.id).emit('notice', `${victim.name} baja al arma ${victim.level + 1} por un cuchillazo`);
  }
  shooter.level++;
  if (shooter.level >= ladder.length) return endMatch(room, shooter.name);
  equip(room, shooter);
  io.to(shooter.id).emit('loadout', { level: shooter.level });
  if (shooter.level === ladder.length - 1) io.to(room.id).emit('notice', `¡${shooter.name} llegó al cuchillo!`);
}

// ---------------------------------------------------------------- Confirmar bajas
// Cada baja suelta una placa del color de la víctima. Si la coge un rival suma un punto a su
// equipo; si la coge un compañero de la víctima la niega. A los 30 s desaparece.
function dropTag(room, victim) {
  room.tagSeq = (room.tagSeq || 0) + 1;
  const y = floorBelow(room, victim.x, victim.y + 0.5, victim.z);
  room.tags.push({ id: room.tagSeq, x: victim.x, y, z: victim.z, team: victim.team, t: Date.now() });
}
function updateTags(room, now) {
  room.tags = room.tags.filter((g) => now - g.t < TAG.lifeMs);
  for (const p of room.players.values()) {
    if (!p.alive || !p.team) continue;
    const i = room.tags.findIndex((g) => Math.hypot(p.x - g.x, p.z - g.z) < TAG.radius && Math.abs(p.y - g.y) < 2.5);
    if (i < 0) continue;
    const [g] = room.tags.splice(i, 1);
    if (g.team === p.team) {
      io.to(p.id).emit('tag', { type: 'deny' });
      continue;
    }
    room.teamScore[p.team]++;
    p.caps++;
    io.to(p.id).emit('tag', { type: 'confirm' });
    if (room.teamScore[p.team] >= room.scoreLimit) return endMatch(room, `Equipo ${TEAMS[p.team].name}`, p.team);
  }
}

// ---------------------------------------------------------------- Infectados
// Con 2 jugadores vivos empieza una cuenta atrás y se elige al primer infectado (bando 2). Los
// infectados solo llevan cuchillo, más vida y corren más; cada superviviente que matan se une a
// ellos. Ganan si no queda nadie; los supervivientes, si aguantan los minutos de la partida.
const newInfect = () => ({ started: false, pickAt: 0, endAt: 0 });
const isInfected = (room, p) => room.mode === 'infect' && p.team === 2;
function infect(room, p) {
  p.team = 2;
  p.streak = 0;
  if (!p.alive) return;
  equip(room, p);
  p.maxHp = p.hp = Math.round(CHAR_BY_ID[p.characterId].hp * INFECT.hp);
  io.to(p.id).emit('loadout', { level: p.level, team: p.team });
}
function infectKill(room, shooter, victim) {
  if (victim.team !== 1 || shooter.team !== 2) return;
  victim.team = 2;
  io.to(room.id).emit('notice', `${victim.name} ha sido infectado`);
}
function updateInfect(room, now) {
  const inf = room.infect;
  const ps = [...room.players.values()];
  if (!inf.started) {
    const alive = ps.filter((p) => p.alive);
    if (alive.length < 2) {
      inf.pickAt = 0;
      return;
    }
    if (!inf.pickAt) {
      inf.pickAt = now + INFECT.pickDelay;
      io.to(room.id).emit('notice', `La infección empieza en ${INFECT.pickDelay / 1000} s`);
    }
    if (now < inf.pickAt) return;
    const first = alive[Math.floor(Math.random() * alive.length)];
    infect(room, first);
    Object.assign(inf, { started: true, endAt: now + room.scoreLimit * 60000 });
    io.to(room.id).emit('notice', `¡${first.name} es el primer infectado! Corred`);
    io.to(room.id).emit('flag', { type: 'capture' }); // mismo aviso sonoro que una captura
    return;
  }
  const survivors = ps.filter((p) => p.team === 1).length;
  const infected = ps.filter((p) => p.team === 2).length;
  if (!infected) {
    // El infectado se fue de la sala: se vuelve a elegir
    Object.assign(inf, newInfect());
    io.to(room.id).emit('notice', 'No quedan infectados: se elige otro');
  } else if (!survivors) endMatch(room, 'Los infectados', 2);
  else if (now >= inf.endAt) endMatch(room, 'Los supervivientes', 1);
}

// Cuchillo: además del rayo, acierta a quien esté muy cerca y delante (no hace falta apuntar al píxel)
function meleeTarget(room, o, d, targets, range) {
  let best = null;
  for (const t of targets) {
    const c = [t.x, t.y + 1, t.z];
    const v = [c[0] - o[0], c[1] - o[1], c[2] - o[2]];
    const dist = Math.hypot(...v);
    if (dist > range || (best && dist > best.t)) continue;
    if ((v[0] * d[0] + v[1] * d[1] + v[2] * d[2]) / dist < 0.8) continue;
    const dir = v.map((x) => x / dist);
    if (room.colliders.some((b) => rayAABB(o, dir, b.min, b.max) < dist)) continue;
    best = { t: dist, hit: { type: 'player', id: t.id, head: false } };
  }
  return best;
}

// ---------------------------------------------------------------- Sockets
io.on('connection', (socket) => {
  socket.join('lobby');
  socket.data.roomId = null;
  socket.emit('rooms', roomList());

  socket.on('rooms:list', (cb) => typeof cb === 'function' && cb(roomList()));

  socket.on('room:create', (data = {}, cb = () => {}) => {
    if (typeof cb !== 'function') return;
    leaveRoom(socket);
    const nickname = clean(data.nickname, 16, 'Jugador');
    const password = typeof data.password === 'string' ? data.password.slice(0, 32) : '';
    const mapId = MAPS.some((m) => m.id === data.mapId) ? data.mapId : 'patio';
    const size = MAP_SIZES[data.size] ? data.size : 'm';
    const max = Math.min(24, Math.max(2, Number(data.max) || MAP_SIZES[size].players));
    const map = getMap(mapId, size);
    const mode = MODE_BY_ID[data.mode] ? data.mode : 'ffa';
    const limit = Number(data.scoreLimit);
    const room = {
      mode,
      scoreLimit: MODE_BY_ID[mode].limits.includes(limit) ? limit : MODE_BY_ID[mode].def,
      teamScore: { 1: 0, 2: 0 },
      id: crypto.randomBytes(3).toString('hex'),
      name: clean(data.name, 24, `Sala de ${nickname}`),
      passHash: password ? hash(password) : null,
      hostName: nickname,
      max,
      map,
      colliders: getColliders(map),
      players: new Map(),
      matchOver: false,
      restartTimer: null,
    };
    resetFlags(room);
    room.tags = [];
    room.infect = newInfect();
    rooms.set(room.id, room);
    joinRoom(socket, room, nickname, cb);
  });

  socket.on('room:join', (data = {}, cb = () => {}) => {
    if (typeof cb !== 'function') return;
    const room = rooms.get(data.roomId);
    if (!room) return cb({ ok: false, error: 'La sala ya no existe.' });
    if (room.players.size >= room.max) return cb({ ok: false, error: 'La sala está llena.' });
    if (room.passHash && hash(String(data.password ?? '')) !== room.passHash) {
      return cb({ ok: false, error: 'Contraseña incorrecta.' });
    }
    leaveRoom(socket);
    joinRoom(socket, room, clean(data.nickname, 16, 'Jugador'), cb);
  });

  socket.on('room:leave', () => leaveRoom(socket));

  socket.on('net:ping', (d, cb) => {
    const c = ctx(socket);
    if (c && Number.isFinite(d?.rtt)) c.p.ping = Math.max(0, Math.min(999, Math.round(d.rtt)));
    if (typeof cb === 'function') cb();
  });

  socket.on('player:spawn', (data = {}) => {
    const c = ctx(socket);
    if (!c || c.room.matchOver) return;
    const { room, p } = c;
    const ch = CHAR_BY_ID[data.characterId];
    const now = Date.now();
    if (!ch || p.alive) return;
    if (p.deathTime && now - p.deathTime < PLAYER.respawnDelay - 300) return;

    spawnPlayer(socket, room, p, ch, data.skin);
  });

  // Por equipos: elegir o cambiar de equipo. Si estás vivo reapareces en el lado de tu nuevo equipo
  socket.on('team:set', (d = {}) => {
    const c = ctx(socket);
    if (!c || !canSwitchTeam(c.room.mode)) return;
    const { room, p } = c;
    const team = d.team === 1 || d.team === 2 ? d.team : 0;
    if (!team || team === p.team) return;
    const now = Date.now();
    if (now - (p.teamAt || 0) < TEAM_SWITCH_COOLDOWN) {
      socket.emit('notice', 'Espera unos segundos para volver a cambiar de equipo.');
      return;
    }
    if (p.alive && now - p.lastDamage < 3000) {
      socket.emit('notice', 'No puedes cambiar de equipo en pleno combate.');
      return;
    }
    p.team = team;
    p.teamAt = now;
    p.streak = 0;
    io.to(room.id).emit('notice', `${p.name} se cambió al equipo ${teamName(room.mode, team)}`);
    if (p.alive) spawnPlayer(socket, room, p, CHAR_BY_ID[p.characterId], p.skin);
  });

  socket.on('player:state', (d) => {
    const c = ctx(socket);
    if (!c || !c.p.alive || !d || !finite(d.x, d.y, d.z, d.ry, d.rx)) return;
    const { p } = c;
    const now = Date.now();
    const elapsed = Math.min(1, (now - p.lastState) / 1000);
    const dist = Math.hypot(d.x - p.x, d.y - p.y, d.z - p.z);
    // Anti-teleport muy básico (el juego es para clase, no para un torneo). Holgado para el
    // slide encadenado, el bunny hop y las plataformas de salto
    if (dist > 4 + 40 * elapsed) {
      socket.emit('player:correct', { x: p.x, y: p.y, z: p.z });
      return;
    }
    const b = c.room.map.bounds;
    p.x = Math.max(-b, Math.min(b, d.x));
    p.y = Math.max(-5, Math.min(50, d.y));
    p.z = Math.max(-b, Math.min(b, d.z));
    p.ry = d.ry;
    p.rx = Math.max(-1.6, Math.min(1.6, d.rx));
    p.sl = d.sl ? 1 : 0;
    p.cr = d.cr ? 1 : 0;
    p.lastState = now;
    record(p, now);
  });

  socket.on('player:switch', (d = {}) => {
    const c = ctx(socket);
    if (!c || !c.p.alive || !Number.isInteger(d.slot) || d.slot < 0 || d.slot >= c.p.loadout.length) return;
    c.p.ammo[c.p.slot].reloadEnd = 0; // cambiar de arma cancela la recarga
    c.p.slot = d.slot;
  });

  socket.on('player:reload', () => {
    const c = ctx(socket);
    if (!c || !c.p.alive) return;
    const { p } = c;
    const w = WEAPONS[weaponIdOf(p)];
    const a = p.ammo[p.slot];
    if (w && !w.melee && !a.reloadEnd && a.mag < w.mag) a.reloadEnd = Date.now() + w.reload;
  });

  socket.on('player:shoot', (data = {}) => {
    const c = ctx(socket);
    if (!c || !c.p.alive || c.room.matchOver) return;
    const { room, p } = c;
    const w = WEAPONS[weaponIdOf(p)];
    const a = p.ammo[p.slot];
    const now = Date.now();
    if (!w || !a) return;

    if (a.reloadEnd) {
      if (now >= a.reloadEnd - 150) {
        a.mag = w.mag;
        a.reloadEnd = 0;
      } else return;
    }
    if (a.mag <= 0 || now - p.lastShot[p.slot] < w.fireRate * 0.8) return;

    const o = data.o;
    if (!isVec3(o) || Math.hypot(o[0] - p.x, o[1] - (p.y + PLAYER.eye), o[2] - p.z) > 3) return;
    if (!Array.isArray(data.d) || data.d.length < 1 || data.d.length > w.pellets) return;
    const dirs = [];
    for (const d of data.d) {
      if (!isVec3(d)) return;
      const len = Math.hypot(d[0], d[1], d[2]);
      if (len < 0.9 || len > 1.1) return;
      dirs.push([d[0] / len, d[1] / len, d[2] / len]);
    }

    if (!w.melee) a.mag--;
    p.lastShot[p.slot] = now;
    p.protUntil = 0; // disparar quita la protección de reaparición

    // Compensación de lag: los rivales se colocan donde los veía el tirador al disparar
    const rewind = Math.max(0, Math.min(LAG_COMP_MAX_MS, Number(data.lag) || 0));
    const past = now - rewind;
    const targets = [...room.players.values()]
      .filter((t) => t.alive && t.id !== p.id && !sameTeam(room, t, p))
      .map((t) => ({ ...posAt(t, past), id: t.id, alive: true }));
    const ends = [];
    const damage = new Map(); // id -> { dmg, head }
    for (const d of dirs) {
      let { t, hit } = castShot(o, d, room.colliders, targets, p.id, w.range);
      if (w.melee && hit?.type !== 'player') ({ t, hit } = meleeTarget(room, o, d, targets, w.range) || { t, hit });
      ends.push([r2(o[0] + d[0] * t), r2(o[1] + d[1] * t), r2(o[2] + d[2] * t)]);
      if (hit?.type === 'player') {
        const e = damage.get(hit.id) || { dmg: 0, head: false, at: null };
        e.dmg += damageAt(w, t) * (hit.head ? w.headMult : 1);
        e.head ||= hit.head;
        e.at ||= [o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t];
        damage.set(hit.id, e);
      }
    }
    p.shots++;
    if (damage.size) p.hits++;
    for (const { head } of damage.values()) if (head) p.heads++;
    socket.to(room.id).emit('shot', { id: p.id, w: weaponIdOf(p), e: ends });
    for (const [id, { dmg, head, at }] of damage) {
      const victim = room.players.get(id);
      if (!victim) continue;
      // Cuchillo por la espalda: el atacante está detrás de hacia donde mira la víctima
      let hurt = dmg;
      if (w.backstab) {
        const rx = p.x - victim.x;
        const rz = p.z - victim.z;
        const len = Math.hypot(rx, rz) || 1;
        if ((-Math.sin(victim.ry) * rx - Math.cos(victim.ry) * rz) / len < -0.35) hurt = w.backstab;
      }
      applyDamage(room, p, victim, hurt, head, w, socket, at);
    }
  });

  socket.on('disconnect', () => leaveRoom(socket));
});

// ---------------------------------------------------------------- Tick
setInterval(() => {
  const now = Date.now();
  const dt = SERVER_TICK_MS / 1000;
  for (const room of rooms.values()) {
    if (room.flags && !room.matchOver) updateFlags(room, now);
    if (room.mode === 'kc' && !room.matchOver) updateTags(room, now);
    if (room.mode === 'infect' && !room.matchOver) updateInfect(room, now);
    const players = [];
    for (const p of room.players.values()) {
      if (p.alive && p.hp < p.maxHp && now - p.lastDamage > PLAYER.regenDelay) {
        p.hp = Math.min(p.maxHp, p.hp + PLAYER.regenRate * dt);
      }
      players.push({
        id: p.id,
        n: p.name,
        c: p.characterId,
        sk: p.skin,
        x: r2(p.x),
        y: r2(p.y),
        z: r2(p.z),
        ry: r2(p.ry),
        rx: r2(p.rx),
        s: p.slot,
        sl: p.sl,
        cr: p.cr,
        a: p.alive ? 1 : 0,
        h: Math.ceil(p.hp),
        pr: p.alive && now < p.protUntil ? 1 : 0,
        k: p.kills,
        d: p.deaths,
        tm: p.team,
        pg: p.ping,
        st: p.streak,
        cp: p.caps,
        lv: p.level,
        mh: p.maxHp,
        ar: Math.ceil(p.armor || 0),
        rd: now < p.radarUntil ? 1 : 0,
      });
    }
    const fl = room.flags ? { 1: flagState(room.flags[1]), 2: flagState(room.flags[2]) } : null;
    const tg = room.mode === 'kc' ? room.tags.map((g) => [g.id, r2(g.x), r2(g.y), r2(g.z), g.team]) : null;
    // Infectados: st = ya hay infectado · t = ms que quedan (de partida, o hasta elegir al primero; -1 = esperando jugadores)
    const inf =
      room.mode === 'infect'
        ? {
            st: room.infect.started ? 1 : 0,
            t: room.infect.started ? room.infect.endAt - now : room.infect.pickAt ? room.infect.pickAt - now : -1,
          }
        : null;
    io.to(room.id).volatile.emit('state', { players, ts: isTeams(room) ? room.teamScore : null, fl, tg, inf });
  }
}, SERVER_TICK_MS);

// Adaptadores que nunca llegan a los PCs de la clase. VirtualBox en Windows se llama
// "Ethernet 2" o similar, por eso también se descarta su rango típico 192.168.56.x.
const VIRTUAL_NAME = /virtualbox|vbox|vmware|vethernet|wsl|docker|hyper-v|loopback|tailscale|zerotier/i;
const virtualReason = (name, ip) => {
  if (VIRTUAL_NAME.test(name)) return 'adaptador virtual';
  if (ip.startsWith('192.168.56.')) return 'red de VirtualBox';
  if (ip.startsWith('169.254.')) return 'sin DHCP, no tiene red';
  return null;
};

// Nombre en la red local (mDNS): la clase entra por http://blockshot.local:3000 en vez de por la IP.
// Se puede cambiar con la variable de entorno NOMBRE si hay dos servidores en la misma red.
const HOST = `${(process.env.NOMBRE || 'blockshot').toLowerCase()}.local`;

function announce(ip) {
  try {
    const mdns = multicastDns();
    mdns.on('query', (q) => {
      if (q.questions.some((x) => x.name.toLowerCase() === HOST && (x.type === 'A' || x.type === 'ANY'))) {
        mdns.respond({ answers: [{ name: HOST, type: 'A', ttl: 120, data: ip }] });
      }
    });
    mdns.on('error', () => {}); // si falla, queda la IP como alternativa
  } catch {}
}

server.listen(PORT, '0.0.0.0', () => {
  const nets = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    for (const i of addrs || []) {
      if (i.family === 'IPv4' && !i.internal) nets.push({ name, ip: i.address, bad: virtualReason(name, i.address) });
    }
  }
  const ip = nets.find((n) => !n.bad)?.ip;

  console.log('\n  BLOCKSHOT en marcha\n');
  console.log(`  Tú:         http://localhost:${PORT}`);
  if (ip) {
    announce(ip);
    console.log(`  La clase:   http://${HOST}:${PORT}`);
    console.log(`              (si no carga: http://${ip}:${PORT})`);
  } else {
    console.log('\n  No se encontró ninguna red. ¿Estás conectado al wifi o al cable de la clase?');
  }
  console.log('');
});
