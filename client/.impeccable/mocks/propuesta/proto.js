// Phase 1 proposal, served by the client's Vite dev server so it uses the game's real data (shared/), real
// character models (render/models.ts) and the real manual texts. "Mejorado" is a preview layer only.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { ABILITIES, CAMOS, CHARACTERS, FINISHES, MAPS, MODES, OUTFIT_COLORS, SKINS, WEAPONS } from '@blockshot/shared';
import { CROSSHAIRS, CROSSHAIR_COLORS } from '/src/settings/settingsStore.ts';
import { COLORBLIND, palette } from '/src/settings/palette.ts';
import { CONTROLS } from '/src/manual/Manual.tsx';
import { SKIN_FACES } from '/src/characters/CharacterSelect.tsx';
import { buildCharacter, buildGun, camoMap, setRoundBodies } from '/src/game/render/models.ts';
import { loadGun } from '/src/game/render/gunAssets.ts';

const $ = (s) => document.querySelector(s);
const svg = (d, cls = '') => `<svg viewBox="0 0 24 24" class="${cls}" aria-hidden="true">${d}</svg>`;
const LOCK =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V7a5 5 0 0 1 10 0v3h2v11H5V10zm2 0h6V7a3 3 0 0 0-6 0z"/></svg>';
const MODE_ICON = {
  ffa: '<circle cx="12" cy="12" r="7"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/>',
  teams:
    '<circle cx="8" cy="8" r="3"/><circle cx="16" cy="8" r="3"/><path d="M2 20c0-3.5 2.7-6 6-6s6 2.5 6 6M10 20c0-3.5 2.7-6 6-6s6 2.5 6 6"/>',
  ctf: '<path d="M5 22V3M5 4h13l-3 4.5L18 13H5"/>',
  gungame: '<path d="M4 20h4v-4h4v-4h4V8h4V4"/>',
  kc: '<rect x="6" y="3" width="12" height="16" rx="2"/><path d="M9 8h6M9 12h6M12 19v3"/>',
  infect: '<circle cx="12" cy="11" r="7"/><path d="M9 10h.01M15 10h.01M9 15c2-1.5 4-1.5 6 0M8 21l1-3M16 21l-1-3"/>',
  dom: '<path d="M12 3l9 5v8l-9 5-9-5V8z"/><circle cx="12" cy="12" r="3"/>',
  rounds: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/>',
};
const ABILITY_ICON = {
  smoke: '<path d="M6 18a4 4 0 0 1 0-8 5 5 0 0 1 9.6-1.5A4 4 0 1 1 18 18z"/><path d="M8 21h8"/>',
  mine: '<circle cx="12" cy="13" r="5"/><path d="M12 3v3M4 13H1M23 13h-3M6.3 7.3 4.2 5.2M17.7 7.3l2.1-2.1"/>',
  shield: '<path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5z"/>',
  dash: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  wall: '<path d="M3 6h18v12H3zM3 12h18M9 6v6M15 12v6"/>',
  radar: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><path d="M12 12 18 6"/>',
  medkit: '<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M9 6V4h6v2M12 10v6M9 13h6"/>',
};
const MODE_SUB = {
  ffa: 'Cada uno por su cuenta',
  teams: 'Rojo contra azul',
  ctf: 'Roba la bandera rival',
  gungame: 'Un arma nueva por baja',
  kc: 'Recoge las placas',
  infect: 'Huye de los del cuchillo',
  dom: 'Controla las zonas',
  rounds: 'El último en pie gana',
};
const MODE_HOW = {
  ffa: 'Gana quien llegue antes al límite de bajas.',
  teams: 'Las bajas suman para tu equipo. El reparto se equilibra solo.',
  ctf: 'Lleva la bandera rival a tu base con la tuya en casa.',
  gungame: 'Cada baja te da el arma siguiente; gana quien termine la escalera.',
  kc: 'Una baja solo cuenta al recoger su placa.',
  infect: 'Los infectados solo llevan cuchillo y contagian al matar.',
  dom: 'Cada zona que controlas suma puntos cada segundo.',
  rounds: 'Una vida por ronda: gana el equipo que quede en pie.',
};
// Ten outfit colours (one more than the game has today: Arena) so the picker is a symmetric 2×5 grid
const COLORS = OUTFIT_COLORS; // Arena is now one of the game's outfit colours

// ---------- Map backdrop: the selected map, blurred, behind every screen ----------
// The blur is baked once into a tiny image that the browser stretches: a full-screen CSS blur would cost every
// frame on integrated graphics.
const blurCache = new Map();
function blurredMap(id) {
  if (blurCache.has(id)) return Promise.resolve(blurCache.get(id));
  return new Promise((done) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = 64;
      c.height = 36;
      const g = c.getContext('2d');
      g.filter = 'blur(2px)';
      g.drawImage(img, -4, -4, 72, 44);
      const url = `url(${c.toDataURL('image/jpeg', 0.8)})`;
      blurCache.set(id, url);
      done(url);
    };
    img.src = `/maps/${id}.jpg`;
  });
}
async function setMap(id) {
  const url = await blurredMap(id);
  const bd = $('#backdrop');
  bd.classList.add('swap');
  setTimeout(() => {
    document.documentElement.style.setProperty('--bgmap', url);
    bd.classList.remove('swap');
  }, 180);
}

// ---------- Navigation ----------
const TABS = ['jugar', 'personaje', 'ranking', 'ajustes', 'estilo', 'plan'];
function route() {
  const t = TABS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'jugar';
  for (const id of TABS) $('#v-' + id).hidden = id !== t;
  document.querySelectorAll('[data-tab]').forEach((a) => a.classList.toggle('on', a.dataset.tab === t));
  if (t === 'personaje') studio.resize();
  if (t === 'ranking') podium.resize();
}
addEventListener('hashchange', route);

// ---------- Lobby ----------
const ROOMS = [
  { name: 'Sala de Ricardo', map: 'patio', mode: 'ffa', n: 5, max: 12 },
  { name: 'Clase 3B', map: 'almacen', mode: 'teams', n: 10, max: 10 },
  { name: 'Torneo viernes', map: 'desfiladero', mode: 'ffa', n: 3, max: 8, locked: true },
  { name: 'Recreo', map: 'ciudad', mode: 'ctf', n: 4, max: 12 },
];
const mapName = (id) => MAPS.find((m) => m.id === id)?.name ?? id;
const modeOf = (id) => MODES.find((m) => m.id === id);
function renderRooms() {
  $('#roomCount').textContent = ROOMS.length;
  const rows = ROOMS.map((r, i) => {
    const full = r.n >= r.max;
    return `<div class="room">
      <img src="/maps/${r.map}.jpg" alt="" />
      <div><div class="nm">${r.name}${r.locked ? LOCK : ''}</div><span class="meta">${mapName(r.map)} · ${modeOf(r.mode).name}</span></div>
      <div class="who"><span><b>${r.n}</b><span class="meta"> / ${r.max} jugadores</span></span><span class="fill"><i style="width:${(r.n / r.max) * 100}%"></i></span></div>
      <span class="state ${full ? 'full' : 'play'}">${full ? 'Llena' : 'En partida'}</span>
      <div class="join"><button class="btn primary" data-join="${i}" ${full ? 'disabled' : ''}>${full ? 'Llena' : 'Unirse'}</button></div></div>`;
  }).join('');
  $('#lt-salas').innerHTML = `<div class="rooms">${rows}</div>
    <div class="lobby-foot"><span class="meta">Las salas de la red del aula aparecen aquí solas.</span><button class="btn" data-go="crear">Crear sala</button></div>`;
}
$('#lt-salas').addEventListener('click', (e) => {
  const j = e.target.closest('[data-join]');
  if (j && !j.disabled) {
    const r = ROOMS[+j.dataset.join];
    if (r.locked) openPass(r);
  }
  if (e.target.closest('[data-go]')) lobbyTab('crear');
});
// Rooms with a password ask for it when you join, in a modal
const dlg = $('#passModal');
function openPass(r) {
  $('#passTitle').textContent = r.name;
  $('#passSub').textContent =
    `${mapName(r.map)} · ${modeOf(r.mode).name} · ${r.n}/${r.max} jugadores. Esta sala tiene contraseña.`;
  $('#passInput').value = '';
  $('#passErr').hidden = true;
  dlg.showModal();
  $('#passInput').focus();
}
$('#passOk').addEventListener('click', (e) => {
  if (!$('#passInput').value) {
    e.preventDefault();
    $('#passErr').hidden = false;
    $('#passInput').focus();
  }
});
function lobbyTab(t) {
  document.querySelectorAll('[data-lt]').forEach((b) => b.setAttribute('aria-selected', b.dataset.lt === t));
  $('#lt-salas').hidden = t !== 'salas';
  $('#lt-crear').hidden = t !== 'crear';
}
document.querySelectorAll('[data-lt]').forEach((b) => b.addEventListener('click', () => lobbyTab(b.dataset.lt)));

let mapSel = 0;
let modeSel = 0;
let limitSel = -1;
const SIZES = ['Pequeño', 'Mediano', 'Grande'];
let sizeSel = 1;
let players = 12;
function renderCreate() {
  $('#maps').innerHTML = MAPS.map(
    (m, i) =>
      `<button class="map ${i === mapSel ? 'on' : ''}" data-i="${i}"><img src="/maps/${m.id}.jpg" alt="" /><span>${m.name}</span></button>`,
  ).join('');
  $('#modes').innerHTML = MODES.map(
    (m, i) =>
      `<button class="mode ${i === modeSel ? 'on' : ''}" data-i="${i}">${svg(MODE_ICON[m.id])}<span>${m.name}<small>${MODE_SUB[m.id]}</small></span></button>`,
  ).join('');
  const mode = MODES[modeSel];
  const lim = limitSel < 0 ? mode.limits.indexOf(mode.def) : limitSel;
  $('#limits').innerHTML = mode.limits
    .map((l, i) => `<button class="${i === lim ? 'on' : ''}" data-l="${i}">${l} ${mode.unit}</button>`)
    .join('');
  const map = MAPS[mapSel];
  $('#mapPreview').innerHTML =
    `<img src="/maps/${map.id}.jpg" alt="" /><div><b>${map.name}</b><span class="chip">${svg(MODE_ICON[mode.id])}${mode.name}</span><p class="meta">${map.desc} ${MODE_HOW[mode.id]}</p></div>`;
  $('#sizes').innerHTML = SIZES.map(
    (z, i) => `<button class="${i === sizeSel ? 'on' : ''}" data-z="${i}">${z}</button>`,
  ).join('');
  $('#players b').textContent = players;
  const pass = $('#roomPass').value.trim();
  const rows = [
    ['Sala', ($('#roomName').value.trim() || $('#roomName').placeholder).toUpperCase()],
    ['Mapa', `${map.name} · ${SIZES[sizeSel]}`],
    ['Modo', mode.name],
    ['Para ganar', `${mode.limits[lim]} ${mode.unit}`],
    ['Jugadores', `Hasta ${players}`],
    ['Acceso', pass ? `${LOCK} Con contraseña` : 'Libre'],
  ];
  $('#summary').innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
}
$('#sizes').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (b) ((sizeSel = +b.dataset.z), renderCreate());
});
$('#players').addEventListener('click', (e) => {
  const b = e.target.closest('[data-step]');
  if (b) ((players = Math.min(16, Math.max(2, players + +b.dataset.step))), renderCreate());
});
$('#roomName').addEventListener('input', renderCreate);
$('#roomPass').addEventListener('input', renderCreate);
$('#maps').addEventListener('click', (e) => {
  const b = e.target.closest('.map');
  if (!b) return;
  mapSel = +b.dataset.i;
  renderCreate();
  setMap(MAPS[mapSel].id);
});
$('#modes').addEventListener('click', (e) => {
  const b = e.target.closest('.mode');
  if (b) ((modeSel = +b.dataset.i), (limitSel = -1), renderCreate());
});
$('#limits').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (b) ((limitSel = +b.dataset.l), renderCreate());
});
document.querySelectorAll('[data-seg]').forEach((s) =>
  s.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) s.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
  }),
);

// ---------- Character select ----------
let charSel = 0;
let skin = 'base';
let camo = 'liso';
let finish = 'estandar';
let skinTab = 'cara';
let color = CHARACTERS[0].color;
let improved = true;
const ramp = (v, max) => {
  const f = Math.max(1, Math.min(10, Math.round((v / max) * 10)));
  return `<span class="ramp">${Array.from({ length: 10 }, (_, i) => `<i class="${i < f ? 'f' : ''}"></i>`).join('')}</span>`;
};
const RANGE = { rifle: 6, sniper: 10, shotgun: 2, smg: 4, lmg: 6, dmr: 8, launcher: 5 };
function face(id) {
  const { rows, colors } = SKIN_FACES[id];
  const rects = rows.flatMap((row, y) =>
    [...row].map((ch, x) =>
      ch === '.' ? '' : `<rect x="${x}" y="${y}" width="1" height="1" fill="${ch === 'a' ? color : colors[ch]}"/>`,
    ),
  );
  return `<svg viewBox="0 0 8 8" shape-rendering="crispEdges" aria-hidden="true">${rects.join('')}</svg>`;
}
function renderChars(anim = false) {
  $('#v-personaje').style.setProperty('--cc', color);
  $('#roster').innerHTML = CHARACTERS.map(
    (c, i) =>
      `<li><button class="${i === charSel ? 'on' : ''}" data-i="${i}"><i style="background:${i === charSel ? color : c.color}"></i><span><b>${c.name}</b><small>${c.role}</small></span><kbd>${i + 1}</kbd></button></li>`,
  ).join('');
  const c = CHARACTERS[charSel];
  const gun = (id, slot) => {
    const w = WEAPONS[id];
    const dmg = w.pellets > 1 ? `${w.damage}×${w.pellets}` : w.damage;
    return `<div class="gun"><div class="gun-head"><b>${w.name}</b><span class="meta">${slot}</span></div><dl><div><dt>Daño</dt><dd>${dmg}</dd></div><div><dt>Disparos/s</dt><dd>${(1000 / w.fireRate).toFixed(1)}</dd></div><div><dt>Cargador</dt><dd>${w.mag}</dd></div></dl></div>`;
  };
  const ab = ABILITIES[c.ability];
  $('#info').innerHTML =
    `<div class="${anim ? 'anim' : ''}" style="display:flex;flex-direction:column;flex:1;min-height:0">
    <span class="role">${c.role}</span><h1>${c.name}</h1><p class="desc">${c.desc}</p>
    <div class="stat"><span>Vida</span>${ramp(c.hp, 140)}<b>${c.hp}</b></div>
    <div class="stat"><span>Velocidad</span>${ramp(c.speed - 5.5, 3.1)}<b>${c.speed.toFixed(1)}</b></div>
    <div class="stat"><span>Alcance</span>${ramp(RANGE[c.primary] ?? 5, 10)}<b>${RANGE[c.primary] ?? 5}</b></div>
    ${gun(c.primary, 'Principal · 1')}${gun(c.secondary, 'Secundaria · 2')}
    <div class="ability"><div class="ab-head"><span class="ic">${svg(ABILITY_ICON[c.ability])}</span><div><span class="lbl">Habilidad</span><b>${ab.name}</b></div><kbd class="k">E</kbd></div>
      <p class="meta">${ab.desc}</p>
      <div class="ab-cd"><span>Recarga</span><i style="--cd:${(ab.cooldownMs / 30000) * 100}%"></i><b>${ab.cooldownMs / 1000} s</b></div></div>
    <button class="btn primary">Jugar como ${c.name}</button></div>`;
  $('#colors').innerHTML = COLORS.map(
    (o) =>
      `<button class="${o.hex === color ? 'on' : ''}" data-c="${o.hex}" title="${o.name}" aria-label="${o.name}" style="background:${o.hex}"></button>`,
  ).join('');
  $('#skins').innerHTML = skinRow();
  $('#adds').hidden = !improved;
  if (anim) {
    const bg = $('#stageBg');
    bg.classList.remove('flash');
    void bg.offsetWidth;
    bg.classList.add('flash');
  }
}
function pickChar(i) {
  charSel = i;
  color = CHARACTERS[i].color;
  renderChars(true);
  studio.rebuild(true);
}
$('#roster').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (b) pickChar(+b.dataset.i);
});
$('#colors').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (b) ((color = b.dataset.c), renderChars(), studio.rebuild());
});
$('#skins').addEventListener('click', (e) => {
  const t = e.target.closest('[data-st]');
  if (t) return ((skinTab = t.dataset.st), renderChars(), studio.rebuild());
  const b = e.target.closest('.skin');
  if (!b) return;
  if (b.dataset.s) skin = b.dataset.s;
  if (b.dataset.camo) camo = b.dataset.camo;
  if (b.dataset.fin) finish = b.dataset.fin;
  renderChars();
  studio.rebuild();
});
// Skins in three tabs: the face (who you are), the uniform's camouflage and the guns' finish
const camoSwatch = (id) => {
  if (id === 'liso') return `<i class="sw" style="background:${color}"></i>`;
  const img = camoMap(color, id).image;
  return `<i class="sw" style="background:url(${img.toDataURL()}) 0 0/1.6rem;image-rendering:pixelated"></i>`;
};
const FINISH_SW = {
  estandar: 'linear-gradient(135deg,#2b2f36 50%,#6b5040 50%)',
  acero: 'linear-gradient(135deg,#3b4047,#a3abb5 60%,#3b4047)',
  arena: '#b59a6a',
  carbono: 'repeating-linear-gradient(45deg,#17181b 0 3px,#3c4048 3px 6px)',
  camuflaje: null,
  damasco: 'repeating-radial-gradient(circle at 30% 120%,#3c4249 0 3px,#9aa3ad 3px 5px)',
  oro: 'linear-gradient(135deg,#a87a12,#f0cf6a 55%,#a87a12)',
  hielo: 'linear-gradient(135deg,#7fc4f2,#e8f6ff 60%,#a9dcff)',
  lava: 'radial-gradient(circle at 40% 60%,#ff6a1a 0 12%,transparent 30%),radial-gradient(circle at 75% 25%,#ff9a3a 0 8%,transparent 22%),#17110f',
  neon: null,
};
const finishSwatch = (id) =>
  id === 'camuflaje'
    ? camoSwatch(camo === 'liso' ? 'bosque' : camo)
    : `<i class="sw" style="background:${id === 'neon' ? `linear-gradient(135deg,#14121b 45%,${color} 45% 60%,#14121b 60%)` : FINISH_SW[id]}"></i>`;
function skinRow() {
  const tabs = [
    ['cara', 'Cara', SKINS.length],
    ['camo', 'Camuflaje', CAMOS.length],
    ['arma', 'Arma', FINISHES.length],
  ]
    .map(
      ([id, n, k]) => `<button data-st="${id}" class="${skinTab === id ? 'on' : ''}">${n}<small>${k}</small></button>`,
    )
    .join('');
  const items =
    skinTab === 'cara'
      ? SKINS.map(
          (s) => `<button class="skin ${s.id === skin ? 'on' : ''}" data-s="${s.id}">${face(s.id)}${s.name}</button>`,
        )
      : skinTab === 'camo'
        ? CAMOS.map(
            (c) =>
              `<button class="skin ${c.id === camo ? 'on' : ''}" data-camo="${c.id}">${camoSwatch(c.id)}${c.name}</button>`,
          )
        : FINISHES.map(
            (f) =>
              `<button class="skin ${f.id === finish ? 'on' : ''}" data-fin="${f.id}">${finishSwatch(f.id)}${f.name}</button>`,
          );
  return `<div class="st-tabs">${tabs}</div><div class="st-grid ${skinTab === 'cara' ? 'two-rows' : ''}">${items.join('')}</div>`;
}
$('#lookSeg').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  improved = b.dataset.look === 'new';
  $('#lookSeg')
    .querySelectorAll('button')
    .forEach((x) => x.classList.toggle('on', x === b));
  renderChars();
  studio.rebuild();
});
addEventListener('keydown', (e) => {
  if (location.hash !== '#personaje' || e.target.tagName === 'INPUT') return;
  const n = +e.key;
  if (n >= 1 && n <= CHARACTERS.length) pickChar(n - 1);
});
$('#adds').innerHTML = [
  'Tela con trama (no color plano)',
  'Metal con reflejos suaves',
  'Cinchas MOLLE en el chaleco',
  'Funda en el muslo, mochila y bolsa',
]
  .map((t) => `<li>${t}</li>`)
  .join('');

// Fabric and cordura: small canvas textures for colour variation and bump
function noiseTex(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const weave = noiseTex(64, (g, n) => {
  g.fillStyle = '#e6e6e6';
  g.fillRect(0, 0, n, n);
  for (let y = 0; y < n; y += 2)
    for (let x = 0; x < n; x += 2) {
      const v = 222 + ((x * 7 + y * 13) % 5) * 5 + Math.random() * 12;
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(x + ((y / 2) % 2), y, 1, 2);
    }
});
weave.colorSpace = THREE.SRGBColorSpace;
weave.repeat.set(5, 5);
const cordura = noiseTex(32, (g, n) => {
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const v = 150 + ((x ^ y) & 3) * 25 + Math.random() * 30;
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(x, y, 1, 1);
    }
});
cordura.repeat.set(4, 4);

// The studio's look: matte, sober cloth and soft metal (the extra gear and the cloth textures now live in
// models.ts, so the game draws them too). The real CharacterPreview applies exactly this.
function improve(model) {
  const held = new Set();
  model.hand.traverse((o) => held.add(o)); // the gun keeps its own finish
  model.group.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || held.has(o)) return;
    const m = o.material.clone();
    if (m.metalness < 0.3) {
      if (!m.map) {
        m.map = weave;
        m.bumpMap = cordura;
        m.bumpScale = 0.3;
      }
      m.roughness = Math.max(m.roughness, 0.9); // matte cloth: no sheen
      m.color.offsetHSL(0, -0.12, 0).multiplyScalar(0.72); // sober, tactical tones instead of pastel
    }
    if (m.metalness >= 0.3) m.roughness = Math.max(m.roughness, 0.55);
    m.envMapIntensity = m.metalness >= 0.3 ? 0.45 : 0.08;
    o.material = m;
  });
}

const studio = (() => {
  const canvas = $('#studio');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const env = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 1.3, 5.5);
  camera.lookAt(0, 0.98, 0);

  // The game's current preview lighting vs the improved studio (softer, matte, rim in the character colour)
  const now = new THREE.Group();
  now.add(new THREE.HemisphereLight(0xe4f3ff, 0x6a5f4a, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.position.set(2, 5, 3);
  sun.castShadow = true;
  now.add(sun);
  const rimA = new THREE.DirectionalLight(0x9fd4ff, 1.2);
  rimA.position.set(-3, 2, -3);
  now.add(rimA);
  const better = new THREE.Group();
  better.add(new THREE.HemisphereLight(0xcfd8e6, 0x2a2724, 0.55));
  const key = new THREE.DirectionalLight(0xfff3e6, 1.3);
  key.position.set(2.2, 4, 2.6);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.radius = 5;
  key.shadow.bias = -0.0004;
  Object.assign(key.shadow.camera, { left: -1.5, right: 1.5, top: 2.4, bottom: -0.5 });
  better.add(key);
  const rim = new THREE.DirectionalLight(0xffffff, 1.4);
  rim.position.set(-2.5, 2.4, -2.8);
  better.add(rim);
  scene.add(now, better);

  const base = new THREE.Mesh(new THREE.CircleGeometry(1.1, 48), new THREE.ShadowMaterial({ opacity: 0.5 }));
  base.rotation.x = -Math.PI / 2;
  base.receiveShadow = true;
  scene.add(base);
  const ringMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.55 });
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.06, 1.1, 64), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.002;
  scene.add(ring);
  const holder = new THREE.Group();
  scene.add(holder);
  let popT = 1;

  // "Actual" keeps the procedural guns; "Mejorado" loads the pack's models with the chosen finish
  const gunFor = (id) =>
    improved ? loadGun(id, { finish, color, camo }) : Promise.resolve(buildGun(id, false, color));
  let build = 0;
  let spin = true; // the character turns; the guns only sway so they stay side-on
  async function rebuild(pop = false) {
    resize(); // the stage changes height when the skin tabs switch
    const n = ++build;
    const c = CHARACTERS[charSel];
    const showcase = skinTab === 'arma';
    const content = new THREE.Group();
    if (showcase) {
      // The two guns up close, side by side, turning on the stand
      const [a, b] = await Promise.all([gunFor(c.primary), gunFor(c.secondary)]);
      if (n !== build) return;
      a.scale.setScalar(2.2);
      a.position.set(0, 1.25, 0);
      b.scale.setScalar(2.2);
      b.position.set(0, 0.55, 0);
      for (const g of [a, b]) {
        g.rotation.y = Math.PI / 2;
        g.traverse((o) => o instanceof THREE.Mesh && (o.castShadow = true));
        content.add(g);
      }
    } else {
      setRoundBodies(improved); // "Mejorado": chamfered, better-proportioned bodies
      const model = buildCharacter(c.id, skin, color, camo);
      model.group.traverse((o) => o instanceof THREE.Mesh && (o.castShadow = true));
      const gun = await gunFor(c.primary);
      if (n !== build) return;
      gun.scale.setScalar(1.3);
      model.holdGun(gun);
      model.aim.rotation.x = 0.12;
      if (improved) improve(model);
      content.add(model.group);
    }
    holder.clear();
    holder.add(content);
    spin = !showcase;
    now.visible = !improved;
    better.visible = improved;
    scene.environment = improved ? env : null;
    renderer.toneMapping = improved ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
    renderer.toneMappingExposure = improved ? 0.8 : 0.95;
    ringMat.color.set(color);
    rim.color.set(color).lerp(new THREE.Color(0xffffff), 0.35);
    if (pop) popT = 0;
  }

  let angle = 0.5;
  let frozen = false;
  // For screenshots: hold the turntable at an angle (?pose=<radians> or window.studioPose)
  window.studioPose = (a) => ((frozen = true), (angle = a), (popT = 1));
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => ((drag = e.clientX), canvas.setPointerCapture(e.pointerId)));
  canvas.addEventListener('pointermove', (e) => {
    if (drag == null) return;
    angle += (e.clientX - drag) * 0.012;
    drag = e.clientX;
  });
  canvas.addEventListener('pointerup', () => (drag = null));
  function resize() {
    const r = canvas.getBoundingClientRect();
    if (!r.width) return;
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height;
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize);
  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(0.05, clock.getDelta());
    if ($('#v-personaje').hidden) return;
    if (drag == null && !frozen) angle += dt * ((Math.PI * 2) / 8);
    // On a new character: a quick spin-in and the ring swelling out
    popT = Math.min(1, popT + dt * 2.5);
    const e = 1 - (1 - popT) ** 3;
    holder.rotation.y = spin ? Math.PI + angle + (1 - e) * Math.PI * 0.6 : Math.sin(angle * 0.6) * 0.45;
    holder.scale.setScalar(0.9 + 0.1 * e);
    ring.scale.setScalar(1 + (1 - e) * 0.35);
    ringMat.opacity = 0.55 * e + (1 - e) * 0.9;
    renderer.render(scene, camera);
  });
  return { rebuild, resize };
})();

// ---------- Ranking (demo data) ----------
// name, wins, matches, kills, deaths, hits, shots, favourite character (most picked), its colour
const RANK = [
  ['Lucía', 14, 31, 212, 140, 610, 1450, 'cazador', '#3aa65a'],
  ['Ricardo', 12, 30, 198, 151, 702, 1820, 'soldado', '#3f7fe0'],
  ['Marcos', 9, 28, 176, 160, 540, 1610, 'tanque', '#d0533a'],
  ['Sofía', 8, 26, 150, 149, 480, 1300, 'rayo', '#e8b923'],
  ['Pablo', 6, 25, 131, 170, 455, 1390, 'bastion', '#8a5cd6'],
  ['Ana', 5, 19, 120, 118, 390, 1010, 'explorador', '#26b0a6'],
  ['Dani', 4, 22, 109, 141, 350, 1100, 'artillero', '#e0782e'],
  ['Eva', 3, 17, 88, 102, 300, 870, 'soldado', '#e0609e'],
];
const ME = 'Ricardo';
const charName = (id) => CHARACTERS.find((c) => c.id === id).name;
const pct = (a, b) => `${Math.round((a / b) * 100)} %`;
const meI = RANK.findIndex((r) => r[0] === ME);
const me = RANK[meI];
$('#v-ranking').innerHTML = `
  <section class="panel podium3d">
    <div class="headrow"><div><h1 class="title">Ranking</h1><p class="meta">Temporada actual · ordenado por victorias y, a igualdad, por bajas. Datos de ejemplo.</p></div>
      <button class="btn sm">Nueva temporada · admin</button></div>
    <div class="stage3d"><canvas id="podium"></canvas>
      <div class="plates">${[1, 0, 2]
        .map((i) => {
          const r = RANK[i];
          return `<div class="plate p${i + 1}" style="--pc:${r[8]}"><em>${i + 1}</em><b>${r[0]}</b><span>${r[1]} victorias · ${charName(r[7])}</span></div>`;
        })
        .join('')}</div>
    </div>
  </section>
  <section class="panel rank-side">
    <div class="me-card" style="--pc:${me[8]}">
      <div class="me-pos"><span class="lbl">Tu puesto</span><b>#${meI + 1}</b></div>
      <dl>${[
        ['Victorias', me[1]],
        ['% victorias', pct(me[1], me[2])],
        ['K/D', (me[3] / me[4]).toFixed(2)],
        ['Precisión', pct(me[5], me[6])],
        ['Favorito', charName(me[7])],
      ]
        .map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`)
        .join('')}</dl>
      <p class="meta">Te faltan <b>${RANK[meI - 1][1] - me[1] + 1}</b> victorias para pasar a ${RANK[meI - 1][0]}.</p>
    </div>
    <table class="tb"><thead><tr><th>#</th><th>Jugador</th><th>Personaje</th><th class="r">Victorias</th><th class="r">Partidas</th><th class="r">K/D</th><th class="r">Precisión</th></tr></thead>
    <tbody>${RANK.map(
      (r, i) =>
        `<tr class="${r[0] === ME ? 'you' : ''}"><td class="pos">${i + 1}</td><td class="nm">${r[0]}${r[0] === ME ? ' <span class="chip">Tú</span>' : ''}</td><td><span class="sw" style="background:${r[8]}"></span>${charName(r[7])}</td><td class="r">${r[1]}</td><td class="r">${r[2]}</td><td class="r">${(r[3] / r[4]).toFixed(2)}</td><td class="r">${pct(r[5], r[6])}</td></tr>`,
    ).join('')}</tbody></table>
  </section>`;

// The top three on a podium, each as their favourite character in their colour (same studio light)
const podium = (() => {
  const canvas = $('#podium');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.85;
  const scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  scene.add(new THREE.HemisphereLight(0xcfd8e6, 0x2a2724, 0.55));
  const key = new THREE.DirectionalLight(0xfff3e6, 1.4);
  key.position.set(2, 5, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.radius = 4;
  Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3.5, bottom: -1 });
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffad72, 1.2);
  rim.position.set(-2, 3, -3);
  scene.add(rim);
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
  camera.position.set(0, 1.7, 9.6);
  camera.lookAt(0, 0.95, 0);
  // Steps: 2nd left, 1st centre (tallest), 3rd right
  const STEPS = [
    [1, -1.35, 0.42],
    [0, 0, 0.7],
    [2, 1.35, 0.26],
  ];
  const stepMat = new THREE.MeshStandardMaterial({ color: 0x1c2028, roughness: 0.8 });
  const figures = [];
  setRoundBodies(true);
  for (const [i, x, h] of STEPS) {
    const r = RANK[i];
    const step = new THREE.Mesh(new THREE.BoxGeometry(1.25, h, 1.1), stepMat);
    step.position.set(x, h / 2, 0);
    step.receiveShadow = step.castShadow = true;
    scene.add(step);
    // A coloured band on the front edge of each step (orange for the winner)
    const edge = new THREE.Mesh(
      new THREE.BoxGeometry(1.26, 0.07, 0.02),
      new THREE.MeshBasicMaterial({ color: i === 0 ? 0xff7a1a : r[8] }),
    );
    edge.position.set(x, h - 0.035, 0.56);
    scene.add(edge);
    const c = CHARACTERS.find((k) => k.id === r[7]);
    const m = buildCharacter(c.id, 'base', r[8]);
    m.group.traverse((o) => o instanceof THREE.Mesh && (o.castShadow = true));
    m.group.position.set(x, h, 0);
    m.group.rotation.y = Math.PI - x * 0.18; // turned a little towards the centre
    m.aim.rotation.x = 0.12;
    scene.add(m.group);
    figures.push(m);
    loadGun(c.primary, { color: r[8] }).then((g) => (g.scale.setScalar(1.3), m.holdGun(g)));
  }
  setRoundBodies(false);
  const resize = () => {
    const rc = canvas.getBoundingClientRect();
    if (!rc.width) return;
    renderer.setSize(rc.width, rc.height, false);
    camera.aspect = rc.width / rc.height;
    // Back off on narrow canvases so the three steps (about 4.2 m wide) always fit
    const fit = 2.3 / (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect);
    camera.position.set(0, 1.7, Math.max(9.6, fit));
    camera.lookAt(0, 0.95, 0);
    camera.updateProjectionMatrix();
  };
  addEventListener('resize', resize);
  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    if ($('#v-ranking').hidden) return;
    const t = clock.getElapsedTime();
    // idle breathing so they don't look like statues
    figures.forEach((m, k) => (m.upper.position.y = Math.sin(t * 1.6 + k) * 0.008));
    renderer.render(scene, camera);
  });
  return { resize };
})();

// ---------- Controls: no Manual tab, the keys live in Settings (and in the pause menu in game) ----------
$('#keysList').innerHTML = CONTROLS.map(
  ([k, t]) =>
    `<div class="key"><span>${k.map((x) => `<kbd class="k">${x}</kbd>`).join('')}</span>${t.replace('este manual', 'los controles')}</div>`,
).join('');

// ---------- Settings: crosshair first, then mouse, then sound/accessibility/graphics ----------
const xh = { style: 'cross', color: '#ffffff', size: 6, thickness: 2, gap: 4, outline: true, dynamic: true };
let spread = 0; // holding the preview down opens a dynamic crosshair
let cbSel = 'off';
const range = (id, label, min, max, step, val, fmt) =>
  `<div class="set"><span>${label}</span><b class="val" id="${id}-v">${fmt(val)}</b><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}" aria-label="${label}" /></div>`;
const toggle = (label, on, key = '') =>
  `<div class="set"><span>${label}</span><button class="toggle ${on ? 'on' : ''}" ${key ? `data-t="${key}"` : ''} role="switch" aria-checked="${on}" aria-label="${label}"></button></div>`;
function cbRows() {
  return COLORBLIND.map((m) => {
    const p = palette({ colorblind: m.id });
    const sw = [
      [p.ally, 'Aliado'],
      [p.enemy, 'Enemigo'],
      [p.team[1], 'Equipo 1'],
      [p.team[2], 'Equipo 2'],
    ];
    return `<button class="${m.id === cbSel ? 'on' : ''}" data-cb="${m.id}" title="${m.help}">${m.name}${sw.map(([c, n]) => `<i style="background:${c}">${n}</i>`).join('')}</button>`;
  }).join('');
}
function renderAjustes() {
  $('#v-ajustes').innerHTML = `
  <section class="panel"><h2 class="sec">Mira</h2>
    <div class="xh-box" id="xhBox"><div class="xh" id="xh"></div><small class="xh-hint">Mantén pulsado para verla abrirse</small></div>
    <div class="set"><span>Estilo</span><div class="seg sm" id="xhStyle">${CROSSHAIRS.map((c) => `<button class="${c.id === xh.style ? 'on' : ''}" data-x="${c.id}">${c.name}</button>`).join('')}</div></div>
    <div class="set"><span>Color</span><div class="swatches" id="xhColor">${CROSSHAIR_COLORS.map((c) => `<button class="${c === xh.color ? 'on' : ''}" data-c="${c}" style="background:${c}" aria-label="Color ${c}"></button>`).join('')}<label class="custom" title="Otro color" aria-label="Otro color"><input type="color" id="xhCustom" value="#ffffff" /></label></div></div>
    ${range('xsize', 'Tamaño', 2, 20, 1, xh.size, (v) => v)}
    ${range('xthick', 'Grosor', 1, 5, 1, xh.thickness, (v) => v)}
    ${range('xgap', 'Separación', 0, 14, 1, xh.gap, (v) => v)}
    ${toggle('Contorno negro', xh.outline, 'outline')}
    ${toggle('Se abre al moverte y disparar', xh.dynamic, 'dynamic')}
  </section>
  <section class="panel"><h2 class="sec">Ratón y vista</h2>
    ${range('sens', 'Sensibilidad', 0.1, 3, 0.05, 1, (v) => (+v).toFixed(2))}
    <div class="set" style="padding-bottom:0.4rem;border:0"><span>Sensibilidad al apuntar</span><b class="val" id="ads-v">0.90</b><input type="range" id="ads" min="0.3" max="1.5" step="0.05" value="0.9" aria-label="Sensibilidad al apuntar" />
      <p class="tip">Se aplica solo mientras apuntas (clic derecho) y ya compensa el zoom de cada arma. 1,00 = igual que sin apuntar; por debajo, más lenta y precisa (útil con francotirador); por encima, más rápida.</p></div>
    ${range('fov', 'Campo de visión', 60, 110, 1, 80, (v) => `${v}°`)}
    ${toggle('Sacudida al recibir daño', true)}
    <div class="set"><span>Teclas y controles</span><button class="btn" data-keys>Ver controles</button></div>
  </section>
  <section class="panel"><h2 class="sec">Sonido, accesibilidad y gráficos</h2>
    ${range('vol', 'Volumen', 0, 100, 1, 80, (v) => `${v} %`)}
    <div class="set"><span>Daltonismo</span><div class="cb" id="cb">${cbRows()}</div></div>
    <div class="set"><span>Calidad gráfica<span class="new">Nuevo</span></span><div class="seg sm" data-seg><button class="on">Baja</button><button>Alta</button></div><small>Baja: pensada para gráfica integrada. Alta: sombras suaves, antialias y oclusión ambiental.</small></div>
    <div class="set reset"><span>Valores de fábrica</span><button class="btn" data-reset>Restablecer todo</button></div>
  </section>`;
  drawXh();
}
renderAjustes();
// A colour outside the six swatches lights up the rainbow "other colour" button
function markColor() {
  $('#xhColor')
    .querySelectorAll('button')
    .forEach((x) => x.classList.toggle('on', x.dataset.c === xh.color));
  $('#xhColor .custom').classList.toggle('on', !CROSSHAIR_COLORS.includes(xh.color));
}
// Holding the preview shows how the crosshair opens while moving and shooting
$('#v-ajustes').addEventListener('pointerdown', (e) => {
  if (!e.target.closest('#xhBox') || !xh.dynamic) return;
  spread = 1;
  drawXh();
  addEventListener('pointerup', () => ((spread = 0), drawXh()), { once: true });
});
// The game's crosshair (src/settings/Crosshair.tsx), same SVG geometry, centred on the preview
function drawXh() {
  // Port of the game's Crosshair (src/settings/Crosshair.tsx): square arms and dot on whole pixels, 1 px outline
  const { style, color, size, thickness: t, outline, dynamic } = xh;
  $('#xhBox').classList.toggle('static', !dynamic);
  const g = Math.round(xh.gap + (dynamic ? Math.min(36, (spread ? 0.03 : 0) * 350) : 0));
  const o = -t / 2;
  const rects = [];
  if (['cross', 'crossdot', 't', 'x'].includes(style)) {
    if (style !== 't') rects.push([o, -g - size, t, size]);
    rects.push([o, g, t, size], [-g - size, o, size, t], [g, o, size, t]);
  }
  const dot = style === 'dot' ? Math.max(2, t + 1) : style === 'crossdot' || style === 'circle' ? t : 0;
  if (dot) rects.push([-dot / 2, -dot / 2, dot, dot]);
  const ringR = style === 'circle' ? g + size * 0.6 : 0;
  const layer = (fill, e) =>
    `<g fill="${fill}">${rects
      .map(([x, y, w, h]) => `<rect x="${x - e}" y="${y - e}" width="${w + e * 2}" height="${h + e * 2}"/>`)
      .join(
        '',
      )}${ringR > 0 ? `<circle r="${ringR}" fill="none" stroke="${fill}" stroke-width="${t + e * 2}"/>` : ''}</g>`;
  const sr = style === 'x' || ringR ? 'geometricPrecision' : 'crispEdges';
  $('#xh').innerHTML =
    `<svg width="128" height="128" viewBox="-64 -64 128 128" shape-rendering="${sr}" style="position:absolute;left:-64px;top:-64px;overflow:visible"><g${style === 'x' ? ' transform="rotate(45)"' : ''}>${outline ? layer('rgba(0,0,0,0.7)', 1) : ''}${layer(color, 0)}</g></svg>`;
}
const FMT = { sens: (v) => (+v).toFixed(2), ads: (v) => (+v).toFixed(2), fov: (v) => `${v}°`, vol: (v) => `${v} %` };
$('#v-ajustes').addEventListener('input', (e) => {
  const el = e.target;
  const v = $(`#${el.id}-v`);
  if (v) v.textContent = (FMT[el.id] ?? String)(el.value);
  if (el.id === 'xsize') xh.size = +el.value;
  if (el.id === 'xthick') xh.thickness = +el.value;
  if (el.id === 'xgap') xh.gap = +el.value;
  if (el.id === 'xhCustom') ((xh.color = el.value), markColor());
  drawXh();
});
$('#v-ajustes').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.keys !== undefined) return $('#keysModal').showModal();
  if (b.classList.contains('toggle'))
    (b.classList.toggle('on'), b.setAttribute('aria-checked', b.classList.contains('on')));
  if (b.dataset.x)
    ((xh.style = b.dataset.x),
      $('#xhStyle')
        .querySelectorAll('button')
        .forEach((x) => x.classList.toggle('on', x === b)));
  if (b.dataset.c) ((xh.color = b.dataset.c), markColor());
  if (b.dataset.t) xh[b.dataset.t] = b.classList.contains('on');
  if (b.dataset.reset !== undefined) {
    Object.assign(xh, {
      style: 'cross',
      color: '#ffffff',
      size: 6,
      thickness: 2,
      gap: 4,
      outline: true,
      dynamic: true,
    });
    renderAjustes();
  }
  if (b.dataset.cb) ((cbSel = b.dataset.cb), ($('#cb').innerHTML = cbRows()));
  const seg = b.closest('[data-seg]');
  if (seg) seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
  drawXh();
});

// ---------- Style: palette from the logo, the chosen font, HUD sample ----------
const TOKENS = [
  ['Fondo', '#0e1014'],
  ['Panel', '#161a20'],
  ['Panel alto', '#1c2028'],
  ['Línea', '#2f3540'],
  ['Texto', '#f2f3f5'],
  ['Secundario', '#a2a8b3'],
  ['Naranja (acción)', '#ff7a1a'],
  ['Naranja claro', '#ffad72'],
  ['Naranja oscuro', '#a64f11'],
  ['Equipo rojo', '#ff4b6e'],
  ['Equipo azul', '#4c9dff'],
  ['Listo / bien', '#46d37f'],
];
const ink = (hex) =>
  parseInt(hex.slice(1, 3), 16) * 0.3 + parseInt(hex.slice(3, 5), 16) * 0.59 + parseInt(hex.slice(5, 7), 16) * 0.11 >
  140
    ? '#0e1014'
    : '#f2f3f5';
$('#v-estilo').innerHTML = `
  <section class="panel"><h2 class="sec">Paleta · sacada del logo</h2>
    <div class="tokens">${TOKENS.map(([n, h]) => `<div style="background:${h};color:${ink(h)}">${n}<br>${h}</div>`).join('')}</div>
    <p class="meta" style="margin-top:0.8rem">El naranja del cubo es el color de acción. El rojo de equipo tira a rosado para no confundirse con él; azul solo para equipo, verde solo para "listo".</p>
  </section>
  <section class="panel specimen"><h2 class="sec">Tipografía · Black Ops One + Chakra Petch</h2>
    <span class="big">Salas abiertas</span><span class="mid">Torneo viernes · 3/8</span>
    <p>Black Ops One, la plantilla militar del logo, para títulos, botones y números grandes. Chakra Petch para el texto, las tablas y las etiquetas: se lee bien en pequeño.</p>
  </section>
  <div class="hud-demo">
    <div class="hd hd-score"><span class="t1">ROJO 34</span><span class="clock">4:12</span><span class="t2">29 AZUL</span></div>
    <div class="hd hd-feed"><p><b class="t1">ANA</b><span class="w">Rifle</span><b class="t2">DANI</b></p><p><b class="t2">FRAN</b><span class="w">Francotirador</span><b class="t1">EVA</b></p><p><b class="t1">RICARDO</b><span class="w">Escopeta</span><b class="t2">BEA</b></p></div>
    <div class="mark en"><i></i>BEA</div><div class="mark al"><i></i>ANA</div>
    <div class="hd hd-hp"><b>87</b><span class="bar"><i></i></span><span class="meta">Tanque · Equipo rojo</span></div>
    <div class="hd hd-ammo"><b>5</b><span class="meta">/ 6 · Escopeta</span><span class="chip">E · Escudo</span></div>
  </div>`;

// ---------- Plan ----------
$('#v-plan').innerHTML = `
  ${[
    [
      'Interfaz',
      'ahora/lobby.png',
      'Ahora: amarillo sobre pizarra y fuente de cartel.',
      [
        '<b>Tu logo</b>, su naranja como color de acción y <b>Black Ops One</b> en títulos.',
        'Lobby con pestañas <b>Salas abiertas / Crear sala</b>; contraseña en una ventana al unirse.',
        'El mapa elegido, difuminado, de fondo. Todo en una pantalla y adaptable.',
        'Sin pestaña Manual: las teclas, en Ajustes y en el menú de pausa; los consejos, en la pantalla de carga.',
      ],
    ],
    [
      'Personajes y armas',
      'ahora/personaje.png',
      'Ahora: color plano, sin textura.',
      [
        '<b>Los mismos personajes</b> con tela mate, cinchas MOLLE, funda en el muslo y mochila.',
        'La pantalla se tiñe del color del personaje elegido, con una pequeña entrada al cambiar.',
        'Skins con su dibujo y 10 colores de traje (se añade Arena).',
      ],
    ],
    [
      'Mapas y luz',
      'ahora/juego.png',
      'Ahora: luz plana y suelo saturado.',
      [
        'Texturas PBR de <a href="https://polyhaven.com/textures" target="_blank" rel="noopener">Poly Haven</a> y <a href="https://ambientcg.com" target="_blank" rel="noopener">ambientCG</a> (CC0) a 512 px.',
        'Cielo e iluminación con un HDRI por mapa y niebla suave.',
        'Colisiones intactas: solo cambia lo que se ve.',
      ],
    ],
  ]
    .map(
      ([h, img, cap, items]) =>
        `<section class="panel ref"><h2 class="sec">${h}</h2><img src="./${img}" alt="" /><span class="cap">${cap}</span><ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul></section>`,
    )
    .join('')}
  <div class="bottom">
    <section class="panel"><h2 class="sec">Coste en gráfica integrada</h2>
      <table class="tb"><thead><tr><th>Efecto</th><th>Baja</th><th>Alta</th></tr></thead><tbody>
      ${[
        ['Sombras del sol', '1024 px', '2048 px, borde suave'],
        ['Niebla y HDRI', 'Sí (se calcula al cargar)', 'Sí'],
        ['Texturas PBR', 'Color + relieve', '+ rugosidad'],
        ['Post-procesado', 'Tonemapping + viñeta', '+ SMAA, bloom suave, oclusión'],
      ]
        .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`)
        .join('')}
      </tbody></table>
    </section>
    <section class="panel"><h2 class="sec">Ya decidido</h2><ul class="done">
      <li><b>Paleta:</b> grafito con el naranja del logo.</li>
      <li><b>Fuente:</b> Black Ops One + Chakra Petch.</li>
      <li><b>Personajes:</b> los actuales, con más detalle.</li>
      <li><b>Lobby:</b> pestañas, Unirse y contraseña en ventana; sin "listo".</li>
    </ul></section>
  </div>`;

setMap(MAPS[0].id);
renderRooms();
renderCreate();
renderChars();
drawXh();
studio.rebuild();
route();
