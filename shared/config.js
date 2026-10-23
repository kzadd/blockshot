import { rayAABB } from './physics.js';

// =====================================================================
//  Configuración compartida entre servidor y cliente.
//  Para balancear el juego, añadir armas/personajes o tocar el mapa,
//  basta con editar este archivo.
// =====================================================================

export const SERVER_TICK_MS = 50; // 20 snapshots/seg del servidor
export const CLIENT_SEND_MS = 50; // 20 envíos/seg de posición
export const SCORE_LIMIT = 20; // kills para ganar la partida (todos contra todos)
export const TEAM_SCORE_LIMIT = 40; // kills del equipo para ganar (por equipos)
export const MATCH_RESTART_MS = 8000;
export const LAG_COMP_MAX_MS = 250;
export const TEAM_SWITCH_COOLDOWN = 5000; // ms entre cambios de equipo // hasta cuánto atrás rebobina el servidor para comprobar un disparo

export const MODES = [
  { id: 'ffa', name: 'Todos contra todos' },
  { id: 'teams', name: 'Por equipos' },
];
export const TEAMS = {
  1: { name: 'Rojo', color: '#ff5a4d' },
  2: { name: 'Azul', color: '#4da3ff' },
};
// Avisos de racha (bajas seguidas sin morir)
export const STREAKS = { 3: 'En racha', 5: 'Imparable', 7: 'Dominando', 10: 'Leyenda' };

export const PLAYER = {
  radius: 0.35,
  height: 1.8,
  eye: 1.6,
  slideEye: 1.05,
  gravity: 26,
  jump: 9.2,
  stepUp: 0.55, // escalones que se suben andando
  crouchHeight: 1.25, // agachado (C) o deslizando
  crouchSpeed: 0.5, // multiplicador de velocidad agachado
  coyote: 0.1, // s en los que aún puedes saltar tras salir de un borde
  jumpBuffer: 0.15, // s que se recuerda un salto pulsado antes de tocar el suelo
  airCap: 0.3, // control en el aire (fracción de la velocidad); permite ganar velocidad girando
  airAccel: 6,
  maxSpeed: 1.8, // tope de velocidad horizontal (x velocidad del personaje) con slide y bunny hop
  sprint: 1.3, // multiplicador al esprintar (Shift)
  stamina: 100, // estamina máxima
  staminaDrain: 15, // por segundo esprintando (unos 6,5 s seguidos)
  staminaRegen: 25, // por segundo descansando
  staminaDelay: 700, // ms sin esprintar antes de recuperarla
  staminaMin: 25, // si se agota, hace falta esto para volver a esprintar
  slideCost: 20, // estamina que gasta cada deslizamiento
  respawnDelay: 3000,
  regenDelay: 5000, // ms sin recibir daño antes de regenerar
  regenRate: 15, // vida por segundo
  spawnProtection: 4000, // ms invulnerable al reaparecer (se pierde al disparar)
};

// fireRate = ms entre disparos · spread = radianes aprox (adsSpread apuntando) · zoom al apuntar
// weight = multiplicador de velocidad al llevarla en la mano (pesada < 1 < ligera)
// adsSpeed = rapidez al apuntar (más alto = antes) · adsMove = velocidad mientras apuntas
// falloff = [desde m, hasta m, daño mínimo]: el daño baja con la distancia
// moveSpread / airSpread = cuánto se abre la dispersión corriendo / en el aire
// bolt = cerrojo: tras cada disparo se sale de la mira durante boltTime ms
export const WEAPONS = {
  rifle: {
    name: 'Rifle de asalto', damage: 24, headMult: 1.6, fireRate: 100, mag: 30, reload: 2000,
    auto: true, spread: 0.022, adsSpread: 0.004, pellets: 1, range: 200, recoil: 0.012, zoom: 1.6, sound: 'rifle',
    weight: 0.97, adsSpeed: 12, adsMove: 0.6, falloff: [35, 90, 0.7],
  },
  sniper: {
    name: 'Francotirador', damage: 125, headMult: 2, fireRate: 1100, boltTime: 550, mag: 5, reload: 2700,
    auto: false, spread: 0.12, adsSpread: 0.0008, pellets: 1, range: 400, recoil: 0.07, zoom: 5, scope: true, sound: 'sniper',
    weight: 0.95, adsSpeed: 20, adsMove: 0.55, moveSpread: 3, airSpread: 4, bolt: true,
  },
  shotgun: {
    name: 'Escopeta', damage: 13, headMult: 1.3, fireRate: 850, mag: 6, reload: 2400,
    auto: false, spread: 0.075, adsSpread: 0.06, pellets: 10, range: 32, recoil: 0.05, zoom: 1.25, sound: 'shotgun',
    weight: 0.95, adsSpeed: 14, adsMove: 0.65, falloff: [8, 30, 0.35],
  },
  smg: {
    name: 'Subfusil', damage: 16, headMult: 1.5, fireRate: 68, mag: 35, reload: 1600,
    auto: true, spread: 0.028, adsSpread: 0.012, pellets: 1, range: 90, recoil: 0.008, zoom: 1.4, sound: 'smg',
    weight: 1, adsSpeed: 20, adsMove: 0.75, falloff: [15, 45, 0.6],
  },
  lmg: {
    name: 'Ametralladora', damage: 21, headMult: 1.5, fireRate: 115, mag: 80, reload: 4200,
    auto: true, spread: 0.04, adsSpread: 0.012, pellets: 1, range: 160, recoil: 0.014, zoom: 1.5, sound: 'lmg',
    weight: 0.9, adsSpeed: 9, adsMove: 0.55, falloff: [40, 110, 0.7],
  },
  pistol: {
    name: 'Pistola', damage: 25, headMult: 1.6, fireRate: 220, mag: 12, reload: 1300,
    auto: false, spread: 0.012, adsSpread: 0.004, pellets: 1, range: 100, recoil: 0.02, zoom: 1.35, sound: 'pistol',
    weight: 1.03, adsSpeed: 20, adsMove: 0.8, falloff: [20, 60, 0.65],
  },
  revolver: {
    name: 'Revólver', damage: 50, headMult: 1.8, fireRate: 600, mag: 6, reload: 2200,
    auto: false, spread: 0.01, adsSpread: 0.002, pellets: 1, range: 120, recoil: 0.045, zoom: 1.5, sound: 'revolver',
    weight: 1, adsSpeed: 14, adsMove: 0.7, falloff: [25, 70, 0.7],
  },
};

// Peso del arma en palabras (para la selección de personaje y el manual)
export const weightName = (w) => ((w.weight ?? 1) >= 1 ? 'Ligera' : w.weight >= 0.95 ? 'Media' : 'Pesada');
// Velocidad real de un personaje con un arma en la mano (m/s)
export const speedWith = (c, weaponId) => +(c.speed * (WEAPONS[weaponId].weight ?? 1)).toFixed(1);

// Daño de un impacto a cierta distancia (lo usa el servidor; el manual lo enseña)
export function damageAt(w, dist) {
  if (!w.falloff) return w.damage;
  const [a, b, min] = w.falloff;
  const k = Math.max(0, Math.min(1, (dist - a) / (b - a)));
  return w.damage * (1 - k * (1 - min));
}

export const CHARACTERS = [
  {
    id: 'soldado', name: 'Soldado', color: '#3f7fe0', hp: 100, speed: 7.3,
    primary: 'rifle', secondary: 'pistol',
    role: 'Equilibrado', desc: 'Equilibrado. Rinde a cualquier distancia y perdona los fallos.',
  },
  {
    id: 'cazador', name: 'Cazador', color: '#3aa65a', hp: 90, speed: 7.6,
    primary: 'sniper', secondary: 'pistol',
    role: 'Larga distancia', desc: 'Un disparo al cuerpo basta (al Tanque, a la cabeza). Busca altura y apunta.',
  },
  {
    id: 'tanque', name: 'Tanque', color: '#d0533a', hp: 150, speed: 6.8,
    primary: 'shotgun', secondary: 'revolver',
    role: 'Cuerpo a cuerpo', desc: 'Mucha vida y escopeta. Letal de cerca, lento de lejos.',
  },
  {
    id: 'rayo', name: 'Rayo', color: '#e8b923', hp: 85, speed: 8.9,
    primary: 'smg', secondary: 'pistol',
    role: 'Velocidad', desc: 'El más rápido. Entra, dispara y sal antes de que te vean.',
  },
  {
    id: 'bastion', name: 'Bastión', color: '#8a5cd6', hp: 120, speed: 7.3,
    primary: 'lmg', secondary: 'revolver',
    role: 'Supresión', desc: 'Cargador de 80 balas. Aguanta una esquina él solo.',
  },
];

export const CHAR_BY_ID = Object.fromEntries(CHARACTERS.map((c) => [c.id, c]));

// Skins: solo cambian el aspecto (los colores y dibujos están en client/src/game/models.js)
export const SKINS = [
  { id: 'base', name: 'Clásico' },
  { id: 'camo', name: 'Camuflaje' },
  { id: 'noche', name: 'Nocturno' },
  { id: 'artico', name: 'Ártico' },
  { id: 'oro', name: 'Dorado' },
];

// ---------------------------------------------------------------------
//  MAPAS: cajas alineadas a los ejes. x,z = centro · y = base · w,h,d = tamaño
//  Cada mapa es una función que coloca las cajas según el tamaño de la arena
//  (H = mitad del lado: la arena va de -H a H). Todo lo que sea caja tiene
//  colisión y bloquea balas.
// ---------------------------------------------------------------------
export const MAP_SIZES = {
  s: { id: 's', name: 'Pequeño', half: 26, players: 6 },
  m: { id: 'm', name: 'Mediano', half: 40, players: 12 },
  l: { id: 'l', name: 'Grande', half: 56, players: 20 },
};

// Aleatorio con semilla: servidor y clientes generan exactamente el mismo mapa
function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const seedOf = (s) => [...s].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 16777619), 2166136261);

// Escalera de `steps` peldaños de 0.5 que sube en dirección `dir` (±1, eje x o z) y acaba en (x, z)
function stairs(B, x, z, axis, dir, steps, width, c = 'step') {
  for (let i = 1; i <= steps; i++) {
    const len = steps + 1 - i;
    const off = -dir * len / 2;
    if (axis === 'x') B(x + off, 0, z, len, i * 0.5, width, c);
    else B(x, 0, z + off, width, i * 0.5, len, c);
  }
}

// --- Patio: torre central, muros intermedios y habitaciones en las esquinas
function buildPatio({ B, S, H }) {
  const k = H / 40;
  B(0, 0, 0, 12, 3, 12, 'platform');
  for (const s of [1, -1]) {
    stairs(B, 0, s * 6, 'z', -s, 5, 4);
    // Cajas para subir de un salto por este y oeste
    B(s * 8.5, 0, 0, 3, 1.2, 3, 'crate');
    B(s * 6.75, 0, 0, 1.5, 2.2, 3, 'crate');
  }
  B(-3.5, 3, -3.5, 2, 1.2, 2, 'crate2');
  B(3.5, 3, 3.5, 2, 1.2, 2, 'crate2');

  // Muros intermedios con hueco en el centro (segundo anillo en el grande)
  const rings = [Math.max(13, 0.45 * H)];
  if (H >= 50) rings.push(0.75 * H);
  for (const d of rings) {
    for (const s of [1, -1]) {
      B(s * d, 0, -7, 1, 4, 8, 'wall2');
      B(s * d, 0, 7, 1, 4, 8, 'wall2');
      B(-7, 0, s * d, 8, 4, 1, 'wall2');
      B(7, 0, s * d, 8, 4, 1, 'wall2');
    }
  }

  // Habitaciones en las esquinas (dos entradas cada una)
  const c = 0.55 * H;
  const L = H - 6 - c;
  for (const sx of [1, -1]) {
    for (const sz of [1, -1]) {
      B(sx * (c + L / 2), 0, sz * c, L, 5, 1);
      B(sx * c, 0, sz * (c + L / 2), 1, 5, L);
    }
  }

  const crates = [[-10, -28], [10, 28], [-28, 10], [28, -10], [-12, -12], [12, 12], [0, -26], [0, 26], [-26, 0], [26, 0]];
  for (const [x, z] of crates) B(x * k, 0, z * k, 2.4, 1.2, 2.4, 'crate');
  // Pilas de cajas (se escalan saltando)
  B(-12 * k, 0, 12 * k, 2.4, 2.4, 2.4, 'crate2');
  B(-12 * k - 2.4, 0, 12 * k, 2.4, 1.2, 2.4, 'crate');
  B(12 * k, 0, -12 * k, 2.4, 2.4, 2.4, 'crate2');
  B(12 * k + 2.4, 0, -12 * k, 2.4, 1.2, 2.4, 'crate');
  if (H >= 50) {
    for (const [x, z] of [[-0.6, -0.3], [0.6, 0.3], [0.3, -0.6], [-0.3, 0.6]]) {
      B(x * H, 0, z * H, 2.4, 2.4, 2.4, 'crate2');
      B(x * H + 2.4 * Math.sign(x), 0, z * H, 2.4, 1.2, 2.4, 'crate');
    }
  }

  const spawns = [
    [-31, -31], [31, -31], [-31, 31], [31, 31], [0, -34], [0, 34], [-34, 0], [34, 0],
    [20, 30], [-20, -30], [30, -14], [-30, 14],
  ];
  for (const [x, z] of spawns) S(x * k, z * k);
}

// --- Almacén: filas de contenedores, pasillos estrechos y entreplantas
function buildAlmacen({ B, S, H, rand }) {
  const mL = Math.round(0.55 * H);
  for (const s of [1, -1]) {
    // Entreplanta pegada al muro norte/sur, con barandilla y escaleras en los extremos
    B(0, 0, s * (H - 2.5), 2 * mL, 3.5, 5, 'platform');
    B(-(mL + 2) / 2, 3.5, s * (H - 4.85), mL - 4, 1, 0.3, 'rail');
    B((mL + 2) / 2, 3.5, s * (H - 4.85), mL - 4, 1, 0.3, 'rail');
    for (const t of [1, -1]) stairs(B, t * mL, s * (H - 2.5), 'x', -t, 7, 5);
  }

  // Contenedores en columnas; la zona central queda libre
  const zMax = H - 9;
  const rows = Math.floor((2 * zMax + 4) / 10);
  const colors = ['cont1', 'cont2', 'cont3'];
  for (let x = 6; x + 1.3 < H - 3.5; x += 8) {
    for (const sx of [1, -1]) {
      for (let r = 0; r < rows; r++) {
        const z = (r - (rows - 1) / 2) * 10;
        if (x < 8 && Math.abs(z) < 7) continue;
        const roll = rand();
        if (roll < 0.12) continue; // hueco para cruzar
        B(sx * x, 0, z, 2.6, 2.6, 6, colors[Math.floor(rand() * 3)]);
        if (roll < 0.35) B(sx * x, 2.6, z, 2.6, 2.6, 6, colors[Math.floor(rand() * 3)]);
        // Caja al lado para poder subirse
        if (rand() < 0.4) B(sx * (x + 2.2), 0, z + (rand() < 0.5 ? 2 : -2), 1.8, 1.2, 1.8, 'crate');
      }
    }
  }
  // Centro: cajas para pelear y subir
  B(-2, 0, -1.6, 2.4, 1.2, 2.4, 'crate');
  B(2, 0, 1.6, 2.4, 2.4, 2.4, 'crate2');
  B(4.4, 0, 1.6, 2.4, 1.2, 2.4, 'crate');

  for (const z of [-0.6, 0, 0.6]) {
    S(H - 1.8, z * H);
    S(-(H - 1.8), z * H);
  }
  for (const s of [1, -1]) {
    S(0, s * (H - 2.5));
    S(s * (H - 2), H - 2);
    S(s * (H - 2), -(H - 2));
  }
}

// --- Desfiladero: un cañón entre dos mesetas altas unidas por puentes
function buildDesfiladero({ B, S, H, rand }) {
  const P = Math.max(10, Math.round(0.32 * H)); // el cañón va de -P a P
  const bridges = [0, 0.5 * H, -0.5 * H];
  for (const s of [1, -1]) {
    B(s * (P + H) / 2, 0, 0, H - P, 4, 2 * H, 'platform');
    const ups = [s * 0.25 * H, -s * 0.7 * H];
    for (const z of ups) stairs(B, s * P, z, 'x', s, 8, 3);

    // Muretes al borde de la meseta, sin tapar escaleras ni puentes
    const keep = [...ups, ...bridges];
    for (let z = -H + 5; z < H - 4; z += 10) {
      if (keep.some((q) => Math.abs(q - z) < 6)) continue;
      B(s * (P + 1), 4, z, 0.8, 1.2, 5, 'wall2');
    }
    // Casetas en las mesetas
    for (const z of [-0.45, 0.1, 0.6]) {
      B(s * (P + 0.55 * (H - P)), 4, s * z * H, 4, 3, 4, 'wall');
      B(s * (P + 0.55 * (H - P)) - s * 3, 4, s * z * H + 2.5, 1.6, 1.2, 1.6, 'crate');
    }
  }
  for (const z of bridges) B(0, 3.4, z, 2 * P, 0.6, 4, 'bridge');

  // Rocas en el fondo del cañón (lejos del pie de las escaleras y de los spawns)
  const avoid = [0.25, 0.7, 0.45, 0.85].flatMap((f) => [f * H, -f * H]);
  for (let z = -H + 7; z < H - 6; z += 8) {
    if (avoid.some((q) => Math.abs(q - z) < 4)) continue;
    const sx = rand() < 0.5 ? 1 : -1;
    const w = 1.8 + rand() * 1.4;
    B(sx * (0.25 + rand() * 0.25) * P, 0, z, w, 1.2 + rand() * 0.9, w, 'rock');
  }

  for (const s of [1, -1]) {
    S(0, s * (H - 3));
    S(s * (H - 3), 0);
    S(s * (H - 3), 0.6 * H);
    S(s * (H - 3), -0.6 * H);
    S(-s * 0.5 * P, s * 0.45 * H);
    S(s * 0.5 * P, -s * 0.85 * H);
  }
}

const MAP_DEFS = {
  patio: {
    name: 'Patio', tag: 'Equilibrado', desc: 'Torre central y habitaciones en las esquinas. Equilibrado.',
    build: buildPatio, wallH: 8, sky: '#9fd4ff',
    colors: {
      floor: '#d6cdb8', wall: '#7e97aa', wall2: '#c48d5f', platform: '#8e84bd',
      step: '#b4abd8', crate: '#d4a24c', crate2: '#6fa86a',
    },
  },
  almacen: {
    name: 'Almacén', tag: 'Combate cercano', desc: 'Pasillos entre contenedores. Combate cercano y esquinas.',
    build: buildAlmacen, wallH: 9, sky: '#c4d0dc',
    colors: {
      floor: '#a8a8a0', wall: '#5d6b78', platform: '#7d8a96', step: '#9aa6b1', rail: '#e0b33a',
      crate: '#c9944a', crate2: '#8d6a3f', cont1: '#c0503e', cont2: '#3f78b5', cont3: '#4f9a5a',
    },
  },
  desfiladero: {
    name: 'Desfiladero', tag: 'Francotiradores', desc: 'Cañón entre dos mesetas. Líneas largas para francotiradores.',
    build: buildDesfiladero, wallH: 12, sky: '#ffd8a6',
    colors: {
      floor: '#e0c08f', wall: '#b0704a', wall2: '#c98a5a', platform: '#d19a64',
      step: '#a87a4e', bridge: '#8a6440', rock: '#9b8b7a', crate: '#d4a24c',
    },
  },
};

export const MAPS = Object.entries(MAP_DEFS).map(([id, m]) => ({ id, name: m.name, tag: m.tag, desc: m.desc }));

const r2 = (n) => Math.round(n * 100) / 100;

// Hacia dónde mirar al aparecer: la dirección más despejada, con preferencia hacia el centro
function spawnYaw(cols, x, y, z) {
  const o = [x, y + PLAYER.eye, z];
  const toCenter = Math.atan2(x, z);
  let best = toCenter;
  let bestScore = -Infinity;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const d = [-Math.sin(a), 0, -Math.cos(a)];
    let t = 40;
    for (const b of cols) t = Math.min(t, rayAABB(o, d, b.min, b.max));
    const score = t + 4 * Math.cos(a - toCenter);
    if (score > bestScore) {
      bestScore = score;
      best = a;
    }
  }
  return r2(best);
}
function groundAt(boxes, x, z) {
  let y = 0;
  for (const b of boxes) {
    if (Math.abs(x - b.x) <= b.w / 2 && Math.abs(z - b.z) <= b.d / 2) y = Math.max(y, b.y + b.h);
  }
  return r2(y);
}

const mapCache = new Map();
export function getMap(mapId, sizeId) {
  const id = MAP_DEFS[mapId] ? mapId : 'patio';
  const size = MAP_SIZES[sizeId] ? sizeId : 'm';
  const key = `${id}:${size}`;
  if (mapCache.has(key)) return mapCache.get(key);

  const def = MAP_DEFS[id];
  const H = MAP_SIZES[size].half;
  const boxes = [];
  const points = [];
  const B = (x, y, z, w, h, d, c = 'wall') => boxes.push({ x: r2(x), y: r2(y), z: r2(z), w: r2(w), h: r2(h), d: r2(d), c });
  // Suelo y muros exteriores
  B(0, -1, 0, 2 * H, 1, 2 * H, 'floor');
  B(0, 0, -H - 0.5, 2 * H + 2, def.wallH, 1);
  B(0, 0, H + 0.5, 2 * H + 2, def.wallH, 1);
  B(-H - 0.5, 0, 0, 1, def.wallH, 2 * H);
  B(H + 0.5, 0, 0, 1, def.wallH, 2 * H);
  def.build({ B, S: (x, z) => points.push([r2(x), r2(z)]), H, rand: rng(seedOf(key)) });

  const map = {
    id, size, name: def.name, sizeName: MAP_SIZES[size].name, half: H, bounds: H - 0.4,
    wallH: def.wallH, sky: def.sky, colors: def.colors, boxes,
    spawns: [],
  };
  const cols = getColliders(map);
  map.spawns = points.map(([x, z]) => {
    const y = groundAt(boxes, x, z);
    return [x, y, z, spawnYaw(cols, x, y, z)]; // [x, y, z, orientación]
  });
  mapCache.set(key, map);
  return map;
}

export function getColliders(map) {
  return map.boxes.map((b) => ({
    min: [b.x - b.w / 2, b.y, b.z - b.d / 2],
    max: [b.x + b.w / 2, b.y + b.h, b.z + b.d / 2],
  }));
}
