import * as THREE from 'three';

const geoCache = new Map();
function boxGeo(w, h, d) {
  const k = `${w}|${h}|${d}`;
  if (!geoCache.has(k)) geoCache.set(k, new THREE.BoxGeometry(w, h, d));
  return geoCache.get(k);
}

function addBox(parent, w, h, d, mat, x, y, z, shadow = true) {
  const m = new THREE.Mesh(boxGeo(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  parent.add(m);
  return m;
}

// ------------------------------------------------------------ Skins
// Cada skin da los colores del personaje. `accent` mantiene el color de la clase
// para que se reconozca aunque cambie la skin.
const shade = (hex, k) => '#' + new THREE.Color(hex).multiplyScalar(k).getHexString();

function camoTexture(colors) {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  g.fillStyle = colors[0];
  g.fillRect(0, 0, 32, 32);
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 46; i++) {
    g.fillStyle = colors[1 + (i % (colors.length - 1))];
    g.fillRect(Math.floor(rnd() * 32), Math.floor(rnd() * 32), 2 + Math.floor(rnd() * 6), 2 + Math.floor(rnd() * 4));
  }
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function skinPalette(color, skin) {
  switch (skin) {
    case 'camo':
      return {
        main: '#ffffff',
        mainMap: ['#5b6b3a', shade(color, 0.75), '#3d4a2a', '#8c8a5a'],
        pants: '#46523a',
        gear: '#2f3526',
        accent: color,
        face: '#e0b07a',
        visor: '#1b2a4a',
      };
    case 'noche':
      return {
        main: '#1f2433',
        pants: '#141824',
        gear: '#0d1018',
        accent: color,
        face: '#c99a6a',
        visor: color,
        glow: true,
      };
    case 'artico':
      return {
        main: '#ffffff',
        mainMap: ['#eef3f8', '#c9d4e0', '#aebccc', '#dfe7ef'],
        pants: '#c7d1dc',
        gear: '#7d8b9a',
        accent: color,
        face: '#f0c08a',
        visor: '#2d4a70',
      };
    case 'oro':
      return {
        main: '#e8b923',
        pants: '#9c6f12',
        gear: '#5a3f0a',
        accent: color,
        face: '#f0c08a',
        visor: '#1b2a4a',
        shiny: true,
      };
    default:
      return {
        main: color,
        pants: shade(color, 0.55),
        gear: '#2b2f36',
        accent: shade(color, 1.25),
        face: '#f0c08a',
        visor: '#1b2a4a',
      };
  }
}

const matCache = new Map();
function skinMaterials(color, skin) {
  const key = `${color}|${skin}`;
  if (matCache.has(key)) return matCache.get(key);
  const p = skinPalette(color, skin);
  const lambert = (c, extra = {}) => new THREE.MeshLambertMaterial({ color: c, ...extra });
  const m = {
    main: lambert(p.main, p.mainMap ? { map: camoTexture(p.mainMap) } : p.shiny ? { emissive: '#3a2a00' } : {}),
    pants: lambert(p.pants),
    gear: lambert(p.gear),
    accent: lambert(p.accent, p.glow ? { emissive: p.accent, emissiveIntensity: 0.6 } : {}),
    face: lambert(p.face),
    visor: lambert(p.visor, p.glow ? { emissive: p.visor, emissiveIntensity: 0.9 } : {}),
  };
  matCache.set(key, m);
  return m;
}

// ------------------------------------------------------------ Personaje
// Mira hacia -Z (igual que la cámara). Pies en y=0. Las hitboxes del servidor no dependen del modelo.
const EXTRAS = {
  // Casco con borde y chaleco
  soldado(u, m) {
    addBox(u, 0.46, 0.16, 0.46, m.gear, 0, 1.9, 0);
    addBox(u, 0.52, 0.04, 0.52, m.gear, 0, 1.83, 0);
    addBox(u, 0.48, 0.03, 0.1, m.accent, 0, 1.94, -0.2, false);
    addBox(u, 0.54, 0.42, 0.06, m.gear, 0, 1.16, -0.2);
    addBox(u, 0.12, 0.12, 0.04, m.accent, -0.15, 1.24, -0.235, false);
  },
  // Gorra con visera, gafas y mochila
  cazador(u, m) {
    addBox(u, 0.43, 0.1, 0.43, m.accent, 0, 1.88, 0);
    addBox(u, 0.36, 0.03, 0.2, m.accent, 0, 1.84, -0.29);
    addBox(u, 0.4, 0.46, 0.18, m.gear, 0, 1.14, 0.27);
    addBox(u, 0.08, 0.5, 0.06, m.gear, -0.22, 1.12, -0.19);
  },
  // Hombreras y casco pesado con protector
  tanque(u, m) {
    for (const s of [1, -1]) addBox(u, 0.28, 0.16, 0.44, m.gear, s * 0.4, 1.43, 0);
    addBox(u, 0.5, 0.26, 0.5, m.gear, 0, 1.85, 0);
    addBox(u, 0.44, 0.12, 0.05, m.gear, 0, 1.56, -0.225);
    addBox(u, 0.5, 0.06, 0.06, m.accent, 0, 1.92, -0.25, false);
    addBox(u, 0.66, 0.5, 0.4, m.main, 0, 1.12, 0);
  },
  // Cinta en la frente, pelo de punta y gafas en la frente
  rayo(u, m) {
    addBox(u, 0.42, 0.06, 0.42, m.accent, 0, 1.76, 0);
    for (const [x, z] of [
      [-0.1, 0.05],
      [0.08, -0.06],
      [0.02, 0.12],
    ])
      addBox(u, 0.12, 0.14, 0.12, m.gear, x, 1.89, z);
    addBox(u, 0.34, 0.08, 0.05, m.visor, 0, 1.79, -0.215, false);
  },
  // Casco integral con ranura y caja de munición a la espalda
  bastion(u, m) {
    addBox(u, 0.47, 0.47, 0.47, m.main, 0, 1.66, 0);
    addBox(u, 0.38, 0.07, 0.04, m.visor, 0, 1.69, -0.24, false);
    addBox(u, 0.46, 0.5, 0.24, m.gear, 0, 1.14, 0.3);
    addBox(u, 0.47, 0.06, 0.25, m.accent, 0, 1.3, 0.3, false);
  },
};

export function buildCharacter(charId, skin = 'base', color = '#3f7fe0') {
  const group = new THREE.Group();
  const m = skinMaterials(color, skin);

  const legs = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(s * 0.14, 0.8, 0);
    addBox(leg, 0.24, 0.64, 0.26, m.pants, 0, -0.32, 0);
    addBox(leg, 0.27, 0.18, 0.33, m.gear, 0, -0.71, -0.03); // bota
    group.add(leg);
    legs.push(leg);
  }

  const upper = new THREE.Group();
  group.add(upper);
  addBox(upper, 0.62, 0.62, 0.36, m.main, 0, 1.11, 0);
  addBox(upper, 0.64, 0.08, 0.38, m.gear, 0, 0.83, 0); // cinturón
  addBox(upper, 0.18, 0.08, 0.18, m.face, 0, 1.45, 0); // cuello
  addBox(upper, 0.4, 0.4, 0.4, m.face, 0, 1.66, 0); // cabeza
  addBox(upper, 0.3, 0.08, 0.04, m.visor, 0, 1.7, -0.21, false); // ojos
  EXTRAS[charId]?.(upper, m);

  const aim = new THREE.Group();
  aim.position.set(0, 1.36, 0);
  upper.add(aim);
  for (const s of [-1, 1]) {
    addBox(aim, 0.16, 0.16, 0.44, m.main, s * 0.28, -0.04, -0.2);
    addBox(aim, 0.17, 0.05, 0.17, m.accent, s * 0.28, -0.04, -0.02, false); // brazalete
    addBox(aim, 0.13, 0.13, 0.12, m.face, s * 0.2, -0.04, -0.46); // mano
  }
  const hand = new THREE.Group();
  hand.position.set(0.12, -0.02, -0.5);
  aim.add(hand);

  return { group, legL: legs[0], legR: legs[1], upper, aim, hand };
}

// Brazos en primera persona: se añaden al arma para que parezca que la sujetas
export function buildArms(gun, gunId, skin = 'base', color = '#3f7fe0') {
  const m = skinMaterials(color, skin);
  const g = new THREE.Group();
  const long = gun.userData.muzzleZ < -0.4;
  // Mano derecha en la empuñadura y antebrazo hacia la cámara
  addBox(g, 0.075, 0.09, 0.1, m.face, 0.005, -0.12, 0.12, false);
  const r = addBox(g, 0.1, 0.1, 0.42, m.main, 0.05, -0.2, 0.36, false);
  r.rotation.x = 0.35;
  addBox(g, 0.105, 0.04, 0.105, m.accent, 0.05, -0.15, 0.2, false).rotation.x = 0.35;
  // Mano izquierda: en el guardamanos de las armas largas o junto a la derecha en las cortas
  const lz = long ? gun.userData.muzzleZ * 0.45 : 0.08;
  // sobresale por el lado izquierdo del arma para que se vea desde la cámara
  addBox(g, 0.1, 0.09, 0.13, m.face, -0.05, long ? -0.07 : -0.13, lz, false);
  const l = addBox(g, 0.1, 0.1, 0.46, m.main, -0.17, -0.2, lz + 0.24, false);
  l.rotation.set(0.3, -0.6, 0);
  gun.add(g);
  return g;
}

// ------------------------------------------------------------ Armas
// Cañón hacia -Z, empuñadura en z≈0.1. Cada arma se dibuja con piezas:
// box(ancho, alto, fondo, x, y, z, material, giroX) y cyl(radio, largo, x, y, z, material, lados)
// (los cilindros van a lo largo de Z). Materiales: o oscuro, m metal, s acero, p/q polímero,
// w/x madera, v/y verde oliva, r goma, l latón, e cartucho, c color del personaje, g cristal, d punto rojo.
const cylCache = new Map();
function cylGeo(r, len, segs) {
  const k = `${r}|${len}|${segs}`;
  if (!cylCache.has(k)) {
    const g = new THREE.CylinderGeometry(r, r, len, segs);
    g.rotateX(Math.PI / 2);
    cylCache.set(k, g);
  }
  return cylCache.get(k);
}

const gunMatCache = new Map();
function gunMaterials(tint) {
  if (gunMatCache.has(tint)) return gunMatCache.get(tint);
  const L = (color, extra) => new THREE.MeshLambertMaterial({ color, ...extra });
  const m = {
    o: L('#1c1f24'),
    m: L('#3a4048'),
    s: L('#8b939d'),
    p: L('#2a2e35'),
    q: L('#353a42'),
    w: L('#8a5a2b'),
    x: L('#6b4320'),
    v: L('#4d5a3a'),
    y: L('#3c472d'),
    r: L('#141619'),
    l: L('#d9a640', { emissive: '#3a2600' }),
    e: L('#c0392b'),
    c: L(tint, { emissive: tint, emissiveIntensity: 0.25 }),
    g: new THREE.MeshBasicMaterial({ color: '#7fd8ff' }),
    t: new THREE.MeshBasicMaterial({ color: '#9fe4ff', transparent: true, opacity: 0.07, depthWrite: false }),
    d: new THREE.MeshBasicMaterial({ color: '#ff3b3b' }),
  };
  gunMatCache.set(tint, m);
  return m;
}

const GUNS = {
  rifle(box, cyl) {
    box(0.07, 0.1, 0.36, 0, 0, -0.02, 'p'); // cajón
    box(0.05, 0.02, 0.34, 0, 0.06, -0.02, 'm'); // raíl
    box(0.005, 0.03, 0.07, 0.037, 0.02, 0, 'o'); // ventana de expulsión
    box(0.076, 0.085, 0.26, 0, 0.005, -0.33, 'q'); // guardamanos
    for (const z of [-0.26, -0.33, -0.4]) box(0.078, 0.02, 0.045, 0, 0.005, z, 'o');
    cyl(0.016, 0.16, 0, 0.02, -0.54, 'm');
    box(0.04, 0.04, 0.06, 0, 0.02, -0.64, 'o'); // bocacha
    box(0.05, 0.012, 0.06, 0, 0.076, 0.06, 'm'); // mira de punto rojo: base, marco fino y cristal
    for (const x of [-0.023, 0.023]) box(0.004, 0.05, 0.008, x, 0.104, 0.035, 'm');
    box(0.05, 0.004, 0.008, 0, 0.131, 0.035, 'm');
    box(0.042, 0.046, 0.002, 0, 0.104, 0.035, 't');
    box(0.004, 0.004, 0.003, 0, 0.104, 0.033, 'd');
    box(0.05, 0.13, 0.07, 0, -0.11, -0.1, 'm', -0.2); // cargador curvo
    box(0.05, 0.08, 0.07, 0, -0.2, -0.07, 'm', -0.4);
    box(0.045, 0.12, 0.06, 0, -0.1, 0.1, 'p', 0.3); // empuñadura
    box(0.012, 0.012, 0.07, 0, -0.065, 0.03, 'm'); // guardamonte
    cyl(0.018, 0.1, 0, 0.02, 0.2, 'm'); // tubo de la culata
    box(0.06, 0.08, 0.18, 0, -0.01, 0.31, 'p');
    box(0.065, 0.11, 0.03, 0, -0.02, 0.41, 'r');
    box(0.072, 0.02, 0.1, 0, -0.025, -0.12, 'c'); // franja de color
  },
  sniper(box, cyl) {
    box(0.07, 0.09, 0.5, 0, -0.01, 0.05, 'v'); // culata y cuerpo
    box(0.065, 0.06, 0.14, 0, -0.06, 0.24, 'v');
    box(0.06, 0.04, 0.18, 0, 0.055, 0.25, 'y'); // carrillera
    box(0.072, 0.13, 0.03, 0, -0.03, 0.33, 'r');
    box(0.072, 0.02, 0.08, 0, -0.01, 0.18, 'c');
    box(0.06, 0.07, 0.22, 0, 0.035, -0.02, 'm'); // cajón
    box(0.08, 0.015, 0.015, 0.05, 0.05, 0.07, 's'); // cerrojo
    box(0.025, 0.025, 0.025, 0.09, 0.05, 0.07, 's');
    cyl(0.018, 0.55, 0, 0.04, -0.45, 'm'); // cañón
    box(0.045, 0.045, 0.08, 0, 0.04, -0.74, 'o'); // freno de boca
    for (const z of [-0.72, -0.755]) box(0.047, 0.012, 0.012, 0, 0.04, z, 'm');
    for (const x of [-0.02, 0.02]) box(0.012, 0.012, 0.2, x, -0.025, -0.33, 'm'); // bípode plegado
    box(0.045, 0.05, 0.07, 0, -0.07, -0.02, 'm'); // cargador
    box(0.045, 0.11, 0.06, 0, -0.09, 0.13, 'v', 0.3);
    box(0.012, 0.012, 0.06, 0, -0.06, 0.06, 'm');
    for (const z of [-0.1, 0.06]) box(0.05, 0.05, 0.025, 0, 0.085, z, 'o'); // anillas
    cyl(0.032, 0.34, 0, 0.125, -0.02, 'o'); // visor
    cyl(0.042, 0.07, 0, 0.125, 0.17, 'o');
    cyl(0.046, 0.08, 0, 0.125, -0.22, 'o');
    cyl(0.04, 0.005, 0, 0.125, -0.263, 'g'); // lente
    box(0.03, 0.03, 0.03, 0, 0.17, -0.02, 'm'); // torretas
    box(0.03, 0.03, 0.03, 0.045, 0.125, -0.02, 'm');
  },
  shotgun(box, cyl) {
    box(0.08, 0.1, 0.26, 0, 0, 0, 'm'); // cajón
    box(0.082, 0.02, 0.08, 0, 0.02, -0.04, 'c');
    cyl(0.024, 0.6, 0, 0.03, -0.4, 's'); // cañón
    cyl(0.022, 0.46, 0, -0.025, -0.33, 'm'); // depósito
    box(0.088, 0.07, 0.2, 0, -0.02, -0.3, 'w'); // corredera
    for (const z of [-0.37, -0.33, -0.29, -0.25]) box(0.09, 0.012, 0.02, 0, -0.02, z, 'x');
    box(0.012, 0.012, 0.012, 0, 0.06, -0.68, 'l'); // punto
    for (let i = 0; i < 4; i++) {
      box(0.014, 0.034, 0.018, -0.046, 0.005, 0.07 - i * 0.03, 'e'); // cartuchos de repuesto
      box(0.015, 0.012, 0.019, -0.046, -0.017, 0.07 - i * 0.03, 'l');
    }
    box(0.012, 0.012, 0.07, 0, -0.065, 0.1, 'm');
    box(0.05, 0.11, 0.06, 0, -0.1, 0.17, 'w', 0.35); // empuñadura
    box(0.07, 0.1, 0.24, 0, -0.04, 0.3, 'w', 0.12); // culata
    box(0.075, 0.13, 0.03, 0, -0.06, 0.43, 'r');
  },
  smg(box, cyl) {
    box(0.07, 0.1, 0.3, 0, 0, 0, 'p');
    box(0.05, 0.02, 0.24, 0, 0.06, 0, 'm');
    box(0.072, 0.02, 0.08, 0, -0.02, 0.06, 'c');
    box(0.05, 0.012, 0.06, 0, 0.072, 0.02, 'm'); // mira de punto rojo: base, marco fino y cristal
    for (const x of [-0.023, 0.023]) box(0.004, 0.05, 0.008, x, 0.1, -0.005, 'm');
    box(0.05, 0.004, 0.008, 0, 0.127, -0.005, 'm');
    box(0.042, 0.046, 0.002, 0, 0.1, -0.005, 't');
    box(0.004, 0.004, 0.003, 0, 0.1, -0.007, 'd');
    box(0.05, 0.055, 0.12, 0, 0.02, -0.21, 'q'); // camisa
    cyl(0.014, 0.06, 0, 0.02, -0.3, 'm');
    box(0.045, 0.2, 0.06, 0, -0.15, -0.06, 'm'); // cargador recto
    box(0.035, 0.08, 0.035, 0, -0.08, -0.17, 'p'); // empuñadura delantera
    box(0.045, 0.11, 0.055, 0, -0.1, 0.09, 'p', 0.25);
    box(0.012, 0.012, 0.06, 0, -0.06, 0.03, 'm');
    for (const x of [-0.025, 0.025]) box(0.012, 0.012, 0.2, x, 0, 0.25, 'm'); // culata plegable
    box(0.06, 0.08, 0.02, 0, -0.01, 0.35, 'r');
  },
  lmg(box, cyl) {
    box(0.11, 0.13, 0.4, 0, 0, 0, 'v');
    box(0.1, 0.03, 0.3, 0, 0.08, -0.02, 'm'); // tapa
    for (const x of [-0.016, 0.016]) box(0.012, 0.035, 0.025, x, 0.11, 0.1, 'o'); // alza
    box(0.02, 0.05, 0.14, -0.062, 0.03, -0.06, 'o'); // asa plegada al lado
    box(0.07, 0.07, 0.3, 0, 0.02, -0.35, 'm'); // camisa con agujeros
    for (const z of [-0.26, -0.32, -0.38, -0.44])
      for (const x of [-0.036, 0.036]) box(0.004, 0.025, 0.025, x, 0.02, z, 'o');
    cyl(0.02, 0.18, 0, 0.02, -0.58, 's');
    box(0.05, 0.05, 0.07, 0, 0.02, -0.68, 'o');
    box(0.012, 0.08, 0.015, 0, 0.09, -0.47, 'm'); // punto de mira
    box(0.14, 0.14, 0.14, 0, -0.13, -0.04, 'y'); // caja de munición
    box(0.142, 0.03, 0.142, 0, -0.1, -0.04, 'c');
    for (let i = 0; i < 4; i++) box(0.02, 0.026, 0.024, 0.066, -0.05 + i * 0.024, -0.02, 'l'); // cinta
    for (const x of [-0.025, 0.025]) box(0.014, 0.014, 0.22, x, -0.035, -0.36, 'o'); // bípode
    box(0.05, 0.12, 0.06, 0, -0.12, 0.13, 'v', 0.3);
    box(0.08, 0.11, 0.22, 0, -0.02, 0.33, 'v');
    box(0.085, 0.13, 0.03, 0, -0.025, 0.45, 'r');
  },
  pistol(box, cyl) {
    box(0.055, 0.06, 0.24, 0, 0.02, -0.04, 's'); // corredera
    for (const z of [0.04, 0.055, 0.07]) box(0.057, 0.04, 0.007, 0, 0.022, z, 'm');
    box(0.05, 0.035, 0.2, 0, -0.025, -0.05, 'p'); // armazón
    box(0.051, 0.012, 0.06, 0, -0.025, -0.1, 'c');
    cyl(0.012, 0.02, 0, 0.02, -0.165, 'o');
    box(0.048, 0.14, 0.065, 0, -0.1, 0.06, 'p', 0.2);
    box(0.05, 0.08, 0.045, 0, -0.1, 0.065, 'q', 0.2);
    box(0.012, 0.012, 0.06, 0, -0.055, -0.01, 'p');
    box(0.01, 0.015, 0.01, 0, 0.058, -0.15, 'o');
    for (const x of [-0.012, 0.012]) box(0.01, 0.015, 0.012, x, 0.058, 0.07, 'o');
  },
  knife(box) {
    box(0.03, 0.1, 0.035, 0, -0.04, 0.06, 'r', 0.15); // mango
    for (const y of [-0.07, -0.04, -0.01]) box(0.032, 0.008, 0.037, 0, y, 0.06, 'o');
    box(0.06, 0.014, 0.03, 0, 0.012, 0.03, 'm'); // guarda
    box(0.006, 0.035, 0.2, 0, 0.022, -0.08, 's'); // hoja
    box(0.007, 0.012, 0.06, 0, 0.038, -0.19, 's', -0.5); // punta
    box(0.008, 0.004, 0.2, 0, 0.005, -0.08, 'c'); // filo con el color
  },
  revolver(box, cyl) {
    cyl(0.02, 0.2, 0, 0.03, -0.17, 's'); // cañón
    box(0.02, 0.02, 0.2, 0, 0.052, -0.17, 's');
    box(0.03, 0.03, 0.14, 0, 0.002, -0.13, 'm');
    cyl(0.042, 0.08, 0, 0.012, -0.02, 'm', 6); // tambor
    box(0.045, 0.08, 0.12, 0, 0.01, 0.03, 's'); // armazón
    box(0.047, 0.015, 0.05, 0, -0.025, 0.03, 'c');
    box(0.015, 0.03, 0.03, 0, 0.06, 0.09, 'o'); // martillo
    box(0.012, 0.012, 0.06, 0, -0.045, 0.04, 's');
    box(0.045, 0.14, 0.06, 0, -0.075, 0.095, 'w', 0.35);
    box(0.01, 0.02, 0.012, 0, 0.07, -0.26, 'o');
  },
};

// Altura (y del arma) que queda en el centro de la pantalla al apuntar: el punto rojo o la punta
// del punto de mira. Al apuntar se oculta la cruz del HUD y se apunta con esto.
const SIGHT_Y = {
  knife: 0.02,
  rifle: 0.104,
  sniper: 0.125,
  shotgun: 0.064,
  smg: 0.1,
  lmg: 0.13,
  pistol: 0.0655,
  revolver: 0.08,
};

export function buildGun(id, withFlash = false, tint = '#ffc93c') {
  const draw = GUNS[id] || GUNS.pistol;
  const mats = gunMaterials(tint);
  const g = new THREE.Group();
  let muzzleZ = 0;
  const add = (geo, mat, x, y, z, rx, half) => {
    const mesh = new THREE.Mesh(geo, mats[mat]);
    mesh.position.set(x, y, z);
    if (rx) mesh.rotation.x = rx;
    mesh.castShadow = true;
    g.add(mesh);
    muzzleZ = Math.min(muzzleZ, z - half);
  };
  draw(
    (w, h, d, x, y, z, m, rx = 0) => add(boxGeo(w, h, d), m, x, y, z, rx, d / 2),
    (r, len, x, y, z, m, segs = 10) => add(cylGeo(r, len, segs), m, x, y, z, 0, len / 2),
  );
  g.userData.muzzleZ = muzzleZ;
  g.userData.sightY = SIGHT_Y[id] ?? 0.12;
  if (withFlash) {
    const flash = new THREE.Mesh(new THREE.OctahedronGeometry(0.07), new THREE.MeshBasicMaterial({ color: 0xffd24a }));
    flash.position.set(0, 0.02, muzzleZ - 0.05);
    flash.visible = false;
    g.add(flash);
    g.userData.flash = flash;
  }
  return g;
}

// ------------------------------------------------------------ Nombre y barra de vida
// Colores de la barra de vida: verde > 50 %, sol 25–50 %, rojo ≤ 25 % (cambian con el modo daltónico)
export { hpColor } from '../palette.js';

// throughWalls: se ve detrás de las paredes (compañeros de equipo)
export function makeNameTag(text, color, throughWalls = false) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 96;
  const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  let last = -1;

  // Nombre en Rubik 800 con contorno y barrita de vida del mismo color (verde aliado, rojo enemigo)
  const tint = color || '#ffffff';
  const draw = (hp) => {
    g.clearRect(0, 0, 256, 96);
    g.font = '800 30px Rubik, system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    g.lineWidth = 8;
    g.strokeStyle = '#1b2a4a';
    g.strokeText(text, 128, 30);
    g.fillStyle = tint;
    g.fillText(text, 128, 30);
    g.fillStyle = '#1b2a4a';
    g.fillRect(58, 58, 140, 18);
    g.fillStyle = 'rgba(247,249,252,0.18)';
    g.fillRect(62, 62, 132, 10);
    g.fillStyle = tint;
    g.fillRect(62, 62, 132 * hp, 10);
    tex.needsUpdate = true;
  };
  draw(1);

  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: !throughWalls }));
  s.scale.set(1.6, 0.6, 1);
  if (throughWalls) s.renderOrder = 5;
  s.userData.setHp = (f) => {
    const q = Math.round(Math.max(0, Math.min(1, f)) * 50) / 50; // solo se redibuja si cambia
    if (q !== last) draw((last = q));
  };
  return s;
}
