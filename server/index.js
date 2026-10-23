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
  CHAR_BY_ID, WEAPONS, PLAYER, MAPS, damageAt, TEAM_SWITCH_COOLDOWN, MAP_SIZES, SKINS, SCORE_LIMIT, TEAM_SCORE_LIMIT, LAG_COMP_MAX_MS, MODES, TEAMS, STREAKS, SERVER_TICK_MS, MATCH_RESTART_MS, getColliders, getMap,
} from '../shared/config.js';
import { castShot } from '../shared/physics.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const DIST = path.resolve(__dirname, '../dist');

// ---------------------------------------------------------------- HTTP
const app = express();
// Prueba de conexión desde otro PC: http://<ip>:3000/ping
app.get('/ping', (req, res) => res.type('text/plain').send('ok'));
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST));
  app.use((req, res) => res.sendFile(path.join(DIST, 'index.html')));
} else {
  app.get('/', (req, res) =>
    res.send('<h2>Cliente sin compilar</h2><p>Ejecuta <code>npm run clase</code>, o usa <code>npm run dev</code> y entra por el puerto 5173.</p>'),
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
  id: r.id, name: r.name, players: r.players.size, max: r.max, locked: !!r.passHash, host: r.hostName,
  map: r.map.name, size: r.map.sizeName, mode: MODES.find((m) => m.id === r.mode).name,
  mapId: r.map.id, sizeId: r.map.size, modeId: r.mode,
});
const isTeams = (room) => room.mode === 'teams';
const sameTeam = (room, a, b) => isTeams(room) && a.team === b.team;
const roomList = () => [...rooms.values()].map(summary);
const broadcastRooms = () => io.to('lobby').emit('rooms', roomList());

function ctx(socket) {
  const room = rooms.get(socket.data.roomId);
  const p = room?.players.get(socket.id);
  return room && p ? { room, p } : null;
}

function weaponIdOf(p, slot = p.slot) {
  const c = CHAR_BY_ID[p.characterId];
  if (!c) return null;
  return slot === 0 ? c.primary : c.secondary;
}

function pickSpawn(room, me) {
  const others = [...room.players.values()].filter((p) => p.alive && p.id !== me.id);
  const enemies = others.filter((p) => !sameTeam(room, p, me));
  const mates = others.filter((p) => sameTeam(room, p, me));
  const near = (list, s) => Math.min(...list.map((e) => Math.hypot(e.x - s[0], e.z - s[2])));
  const scored = room.map.spawns.map((s) => ({
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
  for (const p of room.players.values()) p.team === 1 ? red++ : p.team === 2 && blue++;
  return red <= blue ? 1 : 2;
}

// Coloca al jugador en un punto de aparición con vida y munición llenas
function spawnPlayer(socket, room, p, ch, skin) {
  const now = Date.now();
  const [x, y, z, ry] = pickSpawn(room, p);
  Object.assign(p, {
    characterId: ch.id, skin: SKINS.some((k) => k.id === skin) ? skin : 'base', alive: true, hp: ch.hp, maxHp: ch.hp, x, y, z,
    ry, rx: 0, slot: 0, sl: 0, cr: 0,
    ammo: [{ mag: WEAPONS[ch.primary].mag, reloadEnd: 0 }, { mag: WEAPONS[ch.secondary].mag, reloadEnd: 0 }],
    lastShot: [0, 0], spawnTime: now, protUntil: now + PLAYER.spawnProtection, lastState: now, lastDamage: 0, hist: [],
  });
  record(p, now);
  socket.emit('player:spawned', { x, y, z, ry: p.ry, characterId: ch.id, skin: p.skin, hp: ch.hp });
}

function joinRoom(socket, room, nickname, cb) {
  const p = {
    id: socket.id, name: nickname, characterId: null, alive: false, hp: 0, maxHp: 100,
    x: 0, y: 0, z: 0, ry: 0, rx: 0, slot: 0, sl: 0, cr: 0, skin: 'base', kills: 0, deaths: 0,
    ammo: [], lastShot: [0, 0], lastDamage: 0, deathTime: 0, spawnTime: 0, protUntil: 0, lastState: 0,
    team: isTeams(room) ? smallerTeam(room) : 0, streak: 0, ping: 0, hist: [],
    bestStreak: 0, heads: 0, shots: 0, hits: 0,
  };
  room.players.set(socket.id, p);
  socket.leave('lobby');
  socket.join(room.id);
  socket.data.roomId = room.id;
  cb({
    ok: true, you: socket.id,
    room: { id: room.id, name: room.name, scoreLimit: room.scoreLimit, mapId: room.map.id, size: room.map.size, mode: room.mode, max: room.max },
  });
  const team = p.team ? ` · ${TEAMS[p.team].name}` : '';
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
    out.push({ t: 'Precisión', v: `${Math.round((ac.hits / ac.shots) * 100)} %`, n: `${ac.name} · ${ac.hits} de ${ac.shots}` });
  }
  return out;
}

function endMatch(room, winnerName, winnerTeam = 0) {
  room.matchOver = true;
  for (const p of room.players.values()) p.alive = false;
  const scores = [...room.players.values()]
    .map((p) => ({ name: p.name, kills: p.kills, deaths: p.deaths, team: p.team }))
    .sort((a, b) => b.kills - a.kills);
  io.to(room.id).emit('match:end', { winner: winnerName, team: winnerTeam, scores, best: bestPlays(room), restartIn: MATCH_RESTART_MS });
  room.restartTimer = setTimeout(() => {
    room.teamScore = { 1: 0, 2: 0 };
    for (const p of room.players.values()) {
      p.kills = 0;
      p.deaths = 0;
      p.deathTime = 0;
      p.streak = 0;
      Object.assign(p, { bestStreak: 0, heads: 0, shots: 0, hits: 0 });
    }
    room.matchOver = false;
    io.to(room.id).emit('match:start');
  }, MATCH_RESTART_MS);
}

function applyDamage(room, shooter, victim, dmg, head, weaponName, socket, at3) {
  const now = Date.now();
  // Recién reaparecido: invulnerable unos segundos (hasta que dispare)
  if (!victim.alive || now < victim.protUntil) return;
  victim.hp -= dmg;
  victim.lastDamage = now;
  io.to(victim.id).emit('damaged', { hp: Math.max(0, Math.ceil(victim.hp)), from: [r2(shooter.x), r2(shooter.z)] });

  const at = [r2(at3[0]), r2(at3[1]), r2(at3[2])];
  if (victim.hp > 0) {
    socket.emit('hitmarker', { head, kill: false, dmg: Math.round(dmg), at });
    return;
  }
  victim.alive = false;
  victim.hp = 0;
  victim.deaths++;
  victim.deathTime = now;
  const ended = victim.streak >= 3 ? victim.streak : 0;
  victim.streak = 0;
  shooter.kills++;
  shooter.streak++;
  shooter.bestStreak = Math.max(shooter.bestStreak, shooter.streak);
  socket.emit('hitmarker', { head, kill: true, dmg: Math.round(dmg), at });
  io.to(room.id).emit('kill', {
    killer: shooter.id, killerName: shooter.name, killerTeam: shooter.team,
    killerChar: shooter.characterId, killerHp: Math.ceil(shooter.hp),
    victim: victim.id, victimName: victim.name, victimTeam: victim.team,
    weapon: weaponName, head, streak: shooter.streak, ended,
  });
  if (isTeams(room)) {
    room.teamScore[shooter.team]++;
    if (room.teamScore[shooter.team] >= room.scoreLimit) endMatch(room, `Equipo ${TEAMS[shooter.team].name}`, shooter.team);
  } else if (shooter.kills >= room.scoreLimit) endMatch(room, shooter.name);
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
    const mode = data.mode === 'teams' ? 'teams' : 'ffa';
    const room = {
      mode,
      scoreLimit: mode === 'teams' ? TEAM_SCORE_LIMIT : SCORE_LIMIT,
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
    if (!c || !isTeams(c.room)) return;
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
    io.to(room.id).emit('notice', `${p.name} se cambió al equipo ${TEAMS[team].name}`);
    if (p.alive) spawnPlayer(socket, room, p, CHAR_BY_ID[p.characterId], p.skin);
  });

  socket.on('player:state', (d) => {
    const c = ctx(socket);
    if (!c || !c.p.alive || !d || !finite(d.x, d.y, d.z, d.ry, d.rx)) return;
    const { p } = c;
    const now = Date.now();
    const elapsed = Math.min(1, (now - p.lastState) / 1000);
    const dist = Math.hypot(d.x - p.x, d.y - p.y, d.z - p.z);
    // Anti-teleport muy básico (el juego es para clase, no para un torneo)
    if (dist > 4 + 22 * elapsed) {
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
    if (!c || !c.p.alive || (d.slot !== 0 && d.slot !== 1)) return;
    c.p.ammo[c.p.slot].reloadEnd = 0; // cambiar de arma cancela la recarga
    c.p.slot = d.slot;
  });

  socket.on('player:reload', () => {
    const c = ctx(socket);
    if (!c || !c.p.alive) return;
    const { p } = c;
    const w = WEAPONS[weaponIdOf(p)];
    const a = p.ammo[p.slot];
    if (!a.reloadEnd && a.mag < w.mag) a.reloadEnd = Date.now() + w.reload;
  });

  socket.on('player:shoot', (data = {}) => {
    const c = ctx(socket);
    if (!c || !c.p.alive || c.room.matchOver) return;
    const { room, p } = c;
    const w = WEAPONS[weaponIdOf(p)];
    const a = p.ammo[p.slot];
    const now = Date.now();

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

    a.mag--;
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
      const { t, hit } = castShot(o, d, room.colliders, targets, p.id, w.range);
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
      if (victim) applyDamage(room, p, victim, dmg, head, w.name, socket, at);
    }
  });

  socket.on('disconnect', () => leaveRoom(socket));
});

// ---------------------------------------------------------------- Tick
setInterval(() => {
  const now = Date.now();
  const dt = SERVER_TICK_MS / 1000;
  for (const room of rooms.values()) {
    const players = [];
    for (const p of room.players.values()) {
      if (p.alive && p.hp < p.maxHp && now - p.lastDamage > PLAYER.regenDelay) {
        p.hp = Math.min(p.maxHp, p.hp + PLAYER.regenRate * dt);
      }
      players.push({
        id: p.id, n: p.name, c: p.characterId, sk: p.skin, x: r2(p.x), y: r2(p.y), z: r2(p.z),
        ry: r2(p.ry), rx: r2(p.rx), s: p.slot, sl: p.sl, cr: p.cr, a: p.alive ? 1 : 0,
        h: Math.ceil(p.hp), pr: p.alive && now < p.protUntil ? 1 : 0, k: p.kills, d: p.deaths, tm: p.team, pg: p.ping, st: p.streak,
      });
    }
    io.to(room.id).volatile.emit('state', { players, ts: isTeams(room) ? room.teamScore : null });
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
