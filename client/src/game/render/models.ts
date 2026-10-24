import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { CharacterId, WeaponId } from '@blockshot/shared';

/** Guns whose muzzle is further than this (m) are held with the left hand on the handguard. */
const LONG_GUN_MUZZLE_Z = -0.4;

const geoCache = new Map<string, THREE.BoxGeometry>();
function boxGeo(w: number, h: number, d: number): THREE.BoxGeometry {
  const k = `${w}|${h}|${d}`;
  let geo = geoCache.get(k);
  if (!geo) geoCache.set(k, (geo = new THREE.BoxGeometry(w, h, d)));
  return geo;
}

function addBox(
  parent: THREE.Object3D,
  w: number,
  h: number,
  d: number,
  mat: THREE.Material,
  x: number,
  y: number,
  z: number,
  shadow = true,
): THREE.Mesh {
  const m = new THREE.Mesh(boxGeo(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  parent.add(m);
  return m;
}

// ------------------------------------------------------------ Skins
// Each skin gives the character colours. `accent` keeps the class colour
// so it is recognisable whatever the skin.
const shade = (hex: string, k: number): string => '#' + new THREE.Color(hex).multiplyScalar(k).getHexString();

function camoTexture(colors: string[]): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d')!;
  g.fillStyle = colors[0]!;
  g.fillRect(0, 0, 32, 32);
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 46; i++) {
    g.fillStyle = colors[1 + (i % (colors.length - 1))]!;
    g.fillRect(Math.floor(rnd() * 32), Math.floor(rnd() * 32), 2 + Math.floor(rnd() * 6), 2 + Math.floor(rnd() * 4));
  }
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

interface SkinColors {
  main: string;
  mainMap?: string[];
  pants: string;
  gear: string;
  accent: string;
  face: string;
  visor: string;
  glow?: boolean;
  shiny?: boolean;
}

function skinPalette(color: string, skin: string): SkinColors {
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

type SkinMaterials = Record<'main' | 'pants' | 'gear' | 'accent' | 'face' | 'visor', THREE.MeshLambertMaterial>;
const matCache = new Map<string, SkinMaterials>();
function skinMaterials(color: string, skin: string): SkinMaterials {
  const key = `${color}|${skin}`;
  const cached = matCache.get(key);
  if (cached) return cached;
  const p = skinPalette(color, skin);
  const lambert = (c: string, extra: THREE.MeshLambertMaterialParameters = {}) =>
    new THREE.MeshLambertMaterial({ color: c, ...extra });
  const m: SkinMaterials = {
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

// ------------------------------------------------------------ Character
// Faces -Z (like the camera). Feet at y=0. Server hitboxes do not depend on the model.
const EXTRAS: Record<CharacterId, (u: THREE.Group, m: SkinMaterials) => void> = {
  // Helmet with brim and vest
  soldado(u, m) {
    addBox(u, 0.46, 0.16, 0.46, m.gear, 0, 1.9, 0);
    addBox(u, 0.52, 0.04, 0.52, m.gear, 0, 1.83, 0);
    addBox(u, 0.48, 0.03, 0.1, m.accent, 0, 1.94, -0.2, false);
    addBox(u, 0.54, 0.42, 0.06, m.gear, 0, 1.16, -0.2);
    addBox(u, 0.12, 0.12, 0.04, m.accent, -0.15, 1.24, -0.235, false);
  },
  // Cap with visor, goggles and backpack
  cazador(u, m) {
    addBox(u, 0.43, 0.1, 0.43, m.accent, 0, 1.88, 0);
    addBox(u, 0.36, 0.03, 0.2, m.accent, 0, 1.84, -0.29);
    addBox(u, 0.4, 0.46, 0.18, m.gear, 0, 1.14, 0.27);
    addBox(u, 0.08, 0.5, 0.06, m.gear, -0.22, 1.12, -0.19);
  },
  // Shoulder pads and heavy helmet with guard
  tanque(u, m) {
    for (const s of [1, -1]) addBox(u, 0.28, 0.16, 0.44, m.gear, s * 0.4, 1.43, 0);
    addBox(u, 0.5, 0.26, 0.5, m.gear, 0, 1.85, 0);
    addBox(u, 0.44, 0.12, 0.05, m.gear, 0, 1.56, -0.225);
    addBox(u, 0.5, 0.06, 0.06, m.accent, 0, 1.92, -0.25, false);
    addBox(u, 0.66, 0.5, 0.4, m.main, 0, 1.12, 0);
  },
  // Headband, spiky hair and goggles on the forehead
  rayo(u, m) {
    addBox(u, 0.42, 0.06, 0.42, m.accent, 0, 1.76, 0);
    for (const [x, z] of [
      [-0.1, 0.05],
      [0.08, -0.06],
      [0.02, 0.12],
    ] as const)
      addBox(u, 0.12, 0.14, 0.12, m.gear, x, 1.89, z);
    addBox(u, 0.34, 0.08, 0.05, m.visor, 0, 1.79, -0.215, false);
  },
  // Full helmet with slit and ammo box on the back
  bastion(u, m) {
    addBox(u, 0.47, 0.47, 0.47, m.main, 0, 1.66, 0);
    addBox(u, 0.38, 0.07, 0.04, m.visor, 0, 1.69, -0.24, false);
    addBox(u, 0.46, 0.5, 0.24, m.gear, 0, 1.14, 0.3);
    addBox(u, 0.47, 0.06, 0.25, m.accent, 0, 1.3, 0.3, false);
  },
};

export interface CharacterModel {
  group: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  upper: THREE.Group;
  aim: THREE.Group;
  hand: THREE.Group;
}

export function buildCharacter(charId: CharacterId, skin: string = 'base', color = '#3f7fe0'): CharacterModel {
  const group = new THREE.Group();
  const m = skinMaterials(color, skin);

  const legs: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(s * 0.14, 0.8, 0);
    addBox(leg, 0.24, 0.64, 0.26, m.pants, 0, -0.32, 0);
    addBox(leg, 0.27, 0.18, 0.33, m.gear, 0, -0.71, -0.03); // boot
    group.add(leg);
    legs.push(leg);
  }

  const upper = new THREE.Group();
  group.add(upper);
  addBox(upper, 0.62, 0.62, 0.36, m.main, 0, 1.11, 0);
  addBox(upper, 0.64, 0.08, 0.38, m.gear, 0, 0.83, 0); // belt
  addBox(upper, 0.18, 0.08, 0.18, m.face, 0, 1.45, 0); // neck
  addBox(upper, 0.4, 0.4, 0.4, m.face, 0, 1.66, 0); // head
  addBox(upper, 0.3, 0.08, 0.04, m.visor, 0, 1.7, -0.21, false); // eyes
  EXTRAS[charId]?.(upper, m);

  const aim = new THREE.Group();
  aim.position.set(0, 1.36, 0);
  upper.add(aim);
  for (const s of [-1, 1]) {
    addBox(aim, 0.16, 0.16, 0.44, m.main, s * 0.28, -0.04, -0.2);
    addBox(aim, 0.17, 0.05, 0.17, m.accent, s * 0.28, -0.04, -0.02, false); // armband
    addBox(aim, 0.13, 0.13, 0.12, m.face, s * 0.2, -0.04, -0.46); // hand
  }
  const hand = new THREE.Group();
  hand.position.set(0.12, -0.02, -0.5);
  aim.add(hand);

  return { group, legL: legs[0]!, legR: legs[1]!, upper, aim, hand };
}

// First-person arms: added to the gun so it looks held
export function buildArms(gun: GunModel, skin: string = 'base', color = '#3f7fe0'): THREE.Group {
  const m = skinMaterials(color, skin);
  const g = new THREE.Group();
  const long = gun.userData.muzzleZ < LONG_GUN_MUZZLE_Z;
  // Right hand on the grip and forearm towards the camera
  addBox(g, 0.075, 0.09, 0.1, m.face, 0.005, -0.12, 0.12, false);
  const r = addBox(g, 0.1, 0.1, 0.42, m.main, 0.05, -0.2, 0.36, false);
  r.rotation.x = 0.35;
  addBox(g, 0.105, 0.04, 0.105, m.accent, 0.05, -0.15, 0.2, false).rotation.x = 0.35;
  // Left hand: on the handguard of long guns, next to the right one on short guns
  const lz = long ? gun.userData.muzzleZ * 0.45 : 0.08;
  // sticks out on the left of the gun so the camera sees it
  addBox(g, 0.1, 0.09, 0.13, m.face, -0.05, long ? -0.07 : -0.13, lz, false);
  const l = addBox(g, 0.1, 0.1, 0.46, m.main, -0.17, -0.2, lz + 0.24, false);
  l.rotation.set(0.3, -0.6, 0);
  gun.add(g);
  return g;
}

// ------------------------------------------------------------ Weapons
// Barrel towards -Z, grip at z≈0.1, bore at y≈0.02. Each gun is drawn from parts (see GunDraw) and the
// parts that share a material are merged into one geometry per weapon, so a gun costs a handful of
// draw calls however detailed it is. Materials: o blackened steel, m anodised gunmetal, s bright steel,
// z polished edge, p black polymer, q grey polymer, k tan polymer, w/x wood, v/y olive drab, r rubber,
// l brass, e shell plastic, c character colour, g lens glass, t optic window, d red reticle, n tritium dot.
type GunMat =
  'o' | 'm' | 's' | 'z' | 'p' | 'q' | 'k' | 'w' | 'x' | 'v' | 'y' | 'r' | 'l' | 'e' | 'c' | 'g' | 't' | 'd' | 'n';

/** Chamfer of a bevelled block, as a fraction of its smaller side. */
const BEVEL_FRACTION = 0.22;
const DEFAULT_CYL_SIDES = 10;
/** Muzzle flash: star size (m), streak length and how far in front of the muzzle it sits. */
const FLASH_SIZE = 0.16;
const FLASH_STREAK = 0.22;
const FLASH_OFFSET = 0.03;
const FLASH_CANVAS = 64;
const FLASH_POINTS = 8;

interface GunDraw {
  /** box(width, height, depth, x, y, z, material, rotX, rotZ) */
  box: (w: number, h: number, d: number, x: number, y: number, z: number, m: GunMat, rx?: number, rz?: number) => void;
  /** block with chamfered long edges (receivers, handguards, stocks), runs along Z */
  bev: (w: number, h: number, d: number, x: number, y: number, z: number, m: GunMat, rx?: number) => void;
  /** cylinder along Z */
  cyl: (r: number, len: number, x: number, y: number, z: number, m: GunMat, sides?: number) => void;
  /** flat ring facing the camera (+Z), for holographic reticles */
  ring: (inner: number, outer: number, x: number, y: number, z: number, m: GunMat) => void;
  /** the gun y that sits at the centre of the screen while aiming */
  sight: (y: number) => void;
}

const gunGeoCache = new Map<string, THREE.BufferGeometry>();
function cachedGeo(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = gunGeoCache.get(key);
  if (!g) gunGeoCache.set(key, (g = make()));
  return g;
}

function bevelGeo(w: number, h: number, d: number): THREE.BufferGeometry {
  return cachedGeo(`bev|${w}|${h}|${d}`, () => {
    const c = Math.min(w, h) * BEVEL_FRACTION;
    const x = w / 2;
    const y = h / 2;
    const s = new THREE.Shape();
    s.moveTo(-x + c, -y);
    s.lineTo(x - c, -y);
    s.lineTo(x, -y + c);
    s.lineTo(x, y - c);
    s.lineTo(x - c, y);
    s.lineTo(-x + c, y);
    s.lineTo(-x, y - c);
    s.lineTo(-x, -y + c);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false });
    g.translate(0, 0, -d / 2);
    return g;
  });
}

function cylGeo(r: number, len: number, sides: number): THREE.BufferGeometry {
  return cachedGeo(`cyl|${r}|${len}|${sides}`, () => {
    const g = new THREE.CylinderGeometry(r, r, len, sides);
    g.rotateX(Math.PI / 2);
    return g;
  });
}

function ringGeo(inner: number, outer: number): THREE.BufferGeometry {
  return cachedGeo(`ring|${inner}|${outer}`, () => new THREE.RingGeometry(inner, outer, 20));
}

// Shared optic and sight parts ------------------------------------------------------------
const RETICLE_DOT = 0.0032;
const FRAME = 0.0032;

/**
 * Compact red dot on a riser: thin frame and a clear window, so aiming hides almost nothing.
 * `railY` = top of the rail it sits on, `z` = window position.
 */
function redDot(d: GunDraw, railY: number, z: number, riser: number): void {
  const winW = 0.036;
  const winH = 0.03;
  const depth = 0.026;
  const sightY = railY + riser + winH / 2;
  // Skeleton riser (two side plates on a rail clamp: you see through it) and the housing under the window
  const plate = riser - 0.012;
  d.box(0.034, 0.006, 0.05, 0, railY + 0.003, z + 0.01, 'o');
  for (const s of [-1, 1]) d.box(0.004, plate, 0.044, s * 0.014, railY + 0.006 + plate / 2, z + 0.01, 'o');
  d.bev(0.04, 0.008, 0.04, 0, railY + riser - 0.004, z + 0.004, 'm');
  d.box(0.012, 0.01, 0.012, 0.024, railY + riser - 0.006, z + 0.01, 'm'); // brightness knob
  // Thin frame
  for (const s of [-1, 1]) d.box(FRAME, winH + FRAME, depth, s * (winW / 2 + FRAME / 2), sightY + FRAME / 2, z, 'm');
  d.box(winW + FRAME * 2, FRAME, depth, 0, sightY + winH / 2 + FRAME / 2, z, 'm');
  d.box(winW, winH, 0.002, 0, sightY, z - depth / 2 + 0.002, 't');
  d.box(RETICLE_DOT, RETICLE_DOT, 0.002, 0, sightY, z + 0.004, 'd');
  d.sight(sightY);
}

/** Holographic sight: boxy hood, wide window and a ring-and-dot reticle. */
function holoSight(d: GunDraw, railY: number, z: number): void {
  const winW = 0.046;
  const winH = 0.036;
  const depth = 0.03;
  const base = 0.022;
  const sightY = railY + base + winH / 2;
  d.bev(0.036, base, 0.07, 0, railY + base / 2, z + 0.016, 'o'); // body with the batteries
  d.box(0.024, 0.006, 0.016, 0, railY + base * 0.6, z + 0.054, 'm'); // rear buttons
  for (const s of [-1, 1]) d.box(FRAME, winH + FRAME, depth, s * (winW / 2 + FRAME / 2), sightY + FRAME / 2, z, 'o');
  d.box(winW + FRAME * 2, FRAME, depth, 0, sightY + winH / 2 + FRAME / 2, z, 'o');
  d.box(winW, winH, 0.002, 0, sightY, z - depth / 2 + 0.003, 't');
  d.ring(0.0085, 0.0102, 0, sightY, z + 0.004, 'd');
  d.box(RETICLE_DOT * 0.9, RETICLE_DOT * 0.9, 0.002, 0, sightY, z + 0.004, 'd');
  d.sight(sightY);
}

/** Picatinny rail: flat base and teeth. */
function rail(d: GunDraw, y: number, z0: number, z1: number, width = 0.036): void {
  const len = z1 - z0;
  d.box(width, 0.007, len, 0, y + 0.0035, (z0 + z1) / 2, 'o');
  const teeth = Math.floor(len / 0.022);
  for (let i = 0; i < teeth; i++) d.box(width + 0.004, 0.003, 0.009, 0, y + 0.0085, z0 + 0.011 + i * 0.022, 'o');
}

/** Trigger guard loop and trigger blade (in front of a grip at gripZ). */
function triggerGroup(d: GunDraw, bottomY: number, gripZ: number, mat: GunMat = 'm'): void {
  d.box(0.008, 0.006, 0.075, 0, bottomY - 0.045, gripZ - 0.07, mat);
  d.box(0.008, 0.045, 0.006, 0, bottomY - 0.022, gripZ - 0.106, mat);
  d.box(0.006, 0.026, 0.008, 0, bottomY - 0.018, gripZ - 0.068, 's', 0.25);
}

/** Pistol grip with a back strap, angled like the real thing. */
function pistolGrip(d: GunDraw, y: number, z: number, mat: GunMat, h = 0.11): void {
  d.bev(0.036, h, 0.056, 0, y, z, mat, 0.3);
  d.box(0.038, h * 0.6, 0.012, 0, y - h * 0.05, z + 0.03, 'r', 0.3); // rubber back strap
}

// The eight weapons ------------------------------------------------------------------------
const GUNS: Record<WeaponId, (d: GunDraw) => void> = {
  // M4-style carbine: black upper, tan furniture, M-LOK handguard and a holographic sight
  rifle(d) {
    d.bev(0.058, 0.058, 0.3, 0, 0.03, -0.02, 'm'); // upper receiver
    d.bev(0.054, 0.046, 0.2, 0, -0.022, 0.01, 'm'); // lower receiver
    d.box(0.004, 0.02, 0.06, 0.03, 0.028, 0.0, 'o'); // ejection port
    d.box(0.012, 0.012, 0.022, 0.032, 0.04, 0.06, 'o'); // forward assist
    d.box(0.034, 0.01, 0.026, 0, 0.064, 0.13, 'o'); // charging handle
    rail(d, 0.059, -0.17, 0.12);
    holoSight(d, 0.0685, 0.02);
    d.bev(0.062, 0.064, 0.3, 0, 0.022, -0.32, 'p'); // handguard
    for (const z of [-0.22, -0.28, -0.34, -0.4]) d.box(0.064, 0.012, 0.034, 0, 0.014, z, 'o'); // M-LOK slots
    rail(d, 0.054, -0.47, -0.17, 0.03);
    d.box(0.064, 0.006, 0.02, 0, 0.022, -0.185, 'c'); // colour band
    d.cyl(0.011, 0.16, 0, 0.022, -0.55, 'o'); // barrel
    d.box(0.022, 0.03, 0.022, 0, 0.034, -0.5, 'o'); // gas block
    d.cyl(0.017, 0.06, 0, 0.022, -0.655, 'o', 8); // compensator
    for (const s of [-1, 1]) d.box(0.004, 0.008, 0.034, s * 0.016, 0.03, -0.655, 'p');
    d.box(0.042, 0.03, 0.064, 0, -0.058, -0.072, 'm'); // magwell
    d.box(0.04, 0.1, 0.064, 0, -0.115, -0.082, 'k', -0.16); // curved magazine
    d.box(0.04, 0.08, 0.062, 0, -0.2, -0.06, 'k', -0.36);
    d.box(0.044, 0.01, 0.068, 0, -0.24, -0.045, 'p', -0.36);
    triggerGroup(d, -0.045, 0.11);
    pistolGrip(d, -0.1, 0.11, 'k');
    d.cyl(0.015, 0.14, 0, 0.022, 0.18, 'm'); // buffer tube
    d.bev(0.048, 0.07, 0.16, 0, 0.004, 0.31, 'k'); // stock
    d.box(0.05, 0.022, 0.1, 0, -0.04, 0.3, 'k', 0.15);
    d.box(0.052, 0.1, 0.02, 0, -0.008, 0.398, 'r'); // butt pad
  },
  // Bolt-action sniper: olive chassis, long blackened barrel, 5× scope (the HUD overlay does the aiming)
  sniper(d) {
    d.bev(0.06, 0.07, 0.36, 0, -0.012, 0.1, 'v'); // chassis
    d.bev(0.058, 0.056, 0.32, 0, 0.004, -0.26, 'v'); // fore-end
    for (const z of [-0.18, -0.26, -0.34]) d.box(0.06, 0.01, 0.04, 0, -0.004, z, 'y');
    d.bev(0.058, 0.12, 0.15, 0, -0.03, 0.36, 'v'); // butt
    d.box(0.05, 0.026, 0.15, 0, 0.044, 0.34, 'y'); // cheek rest
    d.box(0.06, 0.13, 0.02, 0, -0.03, 0.443, 'r');
    d.box(0.062, 0.012, 0.06, 0, -0.04, 0.23, 'c');
    pistolGrip(d, -0.098, 0.13, 'v');
    triggerGroup(d, -0.04, 0.13, 'o');
    d.cyl(0.024, 0.26, 0, 0.034, -0.01, 'm', 12); // receiver
    d.box(0.064, 0.01, 0.01, 0.036, 0.036, 0.09, 's'); // bolt handle
    d.box(0.02, 0.02, 0.02, 0.072, 0.03, 0.09, 'o');
    d.cyl(0.015, 0.54, 0, 0.034, -0.41, 'o', 12); // barrel
    d.box(0.038, 0.034, 0.075, 0, 0.034, -0.715, 'm'); // muzzle brake
    for (const z of [-0.7, -0.725]) d.box(0.04, 0.026, 0.01, 0, 0.034, z, 'o');
    d.box(0.04, 0.046, 0.08, 0, -0.052, -0.02, 'o'); // magazine
    for (const s of [-1, 1]) d.box(0.01, 0.012, 0.22, s * 0.018, -0.032, -0.3, 'o'); // folded bipod
    rail(d, 0.058, -0.12, 0.12, 0.03);
    for (const z of [-0.08, 0.07]) d.bev(0.032, 0.036, 0.022, 0, 0.082, z, 'o'); // rings
    d.cyl(0.022, 0.3, 0, 0.112, -0.005, 'o', 14); // scope tube
    d.cyl(0.028, 0.03, 0, 0.112, -0.17, 'o', 14);
    d.cyl(0.034, 0.08, 0, 0.112, -0.22, 'o', 14); // objective bell
    d.cyl(0.0345, 0.008, 0, 0.112, -0.19, 'c', 14);
    d.cyl(0.03, 0.004, 0, 0.112, -0.261, 'g', 14); // lens
    d.cyl(0.028, 0.08, 0, 0.112, 0.18, 'o', 14); // eyepiece
    d.box(0.024, 0.026, 0.024, 0, 0.142, -0.01, 'm'); // turrets
    d.box(0.026, 0.024, 0.024, 0.032, 0.112, -0.01, 'm');
    d.sight(0.112);
  },
  // Pump shotgun: steel barrel with vent rib, walnut pump and stock, shells on the side saddle
  shotgun(d) {
    d.bev(0.058, 0.074, 0.18, 0, 0.0, -0.02, 'm'); // receiver, its rear sloping down into the wrist
    d.bev(0.054, 0.05, 0.07, 0, -0.016, 0.085, 'm', 0.45);
    d.box(0.004, 0.024, 0.06, 0.03, 0.012, -0.01, 'o'); // ejection port
    d.cyl(0.016, 0.56, 0, 0.022, -0.38, 's', 12); // barrel
    d.box(0.008, 0.006, 0.52, 0, 0.041, -0.37, 'o'); // vent rib
    for (let i = 0; i < 9; i++) d.box(0.006, 0.006, 0.01, 0, 0.0355, -0.14 - i * 0.055, 'o');
    d.box(0.006, 0.006, 0.006, 0, 0.047, -0.62, 'l'); // brass mid bead
    d.box(0.004, 0.022, 0.01, 0, 0.05, -0.64, 'o'); // front post with a red fibre dot
    d.box(0.0042, 0.0042, 0.002, 0, 0.062, -0.634, 'd');
    d.box(0.016, 0.016, 0.022, 0, 0.045, 0.04, 'o'); // ghost ring rear sight
    d.ring(0.0075, 0.0105, 0, 0.062, 0.04, 'o');
    for (const s of [-1, 1]) d.box(0.004, 0.026, 0.018, s * 0.013, 0.056, 0.04, 'o');
    d.cyl(0.015, 0.42, 0, -0.02, -0.31, 'm', 10); // magazine tube
    d.cyl(0.017, 0.02, 0, -0.02, -0.53, 'o', 10);
    d.bev(0.062, 0.05, 0.18, 0, -0.02, -0.29, 'w'); // pump
    for (const z of [-0.36, -0.33, -0.3, -0.27, -0.24]) d.box(0.064, 0.008, 0.012, 0, -0.02, z, 'x');
    d.box(0.064, 0.006, 0.014, 0, -0.02, -0.205, 'c');
    d.box(0.006, 0.036, 0.1, -0.031, 0.006, 0.037, 'p'); // side saddle with four shells
    for (let i = 0; i < 4; i++) {
      d.box(0.014, 0.03, 0.017, -0.039, 0.01, 0.07 - i * 0.022, 'e');
      d.box(0.015, 0.01, 0.018, -0.039, -0.01, 0.07 - i * 0.022, 'l');
    }
    triggerGroup(d, -0.037, 0.15);
    pistolGrip(d, -0.085, 0.15, 'w', 0.1);
    d.bev(0.052, 0.085, 0.24, 0, -0.05, 0.32, 'w', 0.16); // stock, with drop at the heel
    d.box(0.056, 0.11, 0.022, 0, -0.075, 0.44, 'r', 0.16);
    d.sight(0.062);
  },
  // Compact SMG: black polymer, integral suppressor, vertical foregrip and a mini red dot
  smg(d) {
    d.bev(0.052, 0.066, 0.28, 0, 0.012, -0.03, 'p'); // receiver
    d.box(0.004, 0.018, 0.05, 0.027, 0.02, -0.02, 'o');
    d.box(0.054, 0.012, 0.06, 0, -0.012, 0.05, 'c');
    rail(d, 0.045, -0.16, 0.1, 0.03);
    redDot(d, 0.0545, 0.02, 0.034);
    d.bev(0.056, 0.054, 0.13, 0, 0.008, -0.235, 'q'); // handguard
    for (const z of [-0.2, -0.24, -0.28]) d.box(0.058, 0.01, 0.022, 0, 0.004, z, 'p');
    d.cyl(0.019, 0.17, 0, 0.012, -0.385, 'o', 12); // suppressor
    for (const z of [-0.31, -0.46]) d.cyl(0.0205, 0.012, 0, 0.012, z, 'm', 12);
    d.box(0.038, 0.15, 0.048, 0, -0.1, -0.08, 'm', -0.08); // straight magazine
    d.box(0.042, 0.012, 0.052, 0, -0.178, -0.074, 'p', -0.08);
    d.bev(0.03, 0.075, 0.034, 0, -0.06, -0.24, 'p'); // foregrip
    triggerGroup(d, -0.022, 0.09);
    pistolGrip(d, -0.08, 0.09, 'p', 0.1);
    for (const s of [-1, 1]) d.box(0.008, 0.012, 0.22, s * 0.02, 0.0, 0.22, 'o'); // folding stock
    d.box(0.05, 0.085, 0.018, 0, -0.012, 0.335, 'r');
  },
  // Belt-fed LMG: olive body, feed cover with a red dot, ammo box and folded bipod
  lmg(d) {
    d.bev(0.088, 0.105, 0.36, 0, 0.0, 0.0, 'v'); // receiver
    d.bev(0.084, 0.028, 0.2, 0, 0.064, -0.02, 'm'); // feed cover
    rail(d, 0.078, -0.1, 0.08, 0.034);
    redDot(d, 0.0875, 0.0, 0.036);
    d.box(0.01, 0.04, 0.12, -0.05, 0.02, -0.03, 'o'); // charging handle slot
    d.bev(0.068, 0.068, 0.24, 0, 0.002, -0.3, 'y'); // handguard
    for (const z of [-0.22, -0.27, -0.32, -0.37])
      for (const s of [-1, 1]) d.box(0.004, 0.02, 0.026, s * 0.035, 0.005, z, 'o'); // vents
    d.cyl(0.018, 0.24, 0, 0.012, -0.54, 'o', 12); // barrel
    d.box(0.014, 0.02, 0.05, 0, -0.012, -0.5, 'o'); // gas tube
    d.cyl(0.022, 0.06, 0, 0.012, -0.69, 'o', 6); // flash hider
    d.box(0.008, 0.04, 0.012, 0, 0.044, -0.58, 'o'); // front sight post
    d.bev(0.11, 0.115, 0.14, 0, -0.13, -0.04, 'y'); // ammo box
    d.box(0.112, 0.02, 0.142, 0, -0.1, -0.04, 'c');
    for (let i = 0; i < 4; i++) d.box(0.018, 0.024, 0.022, 0.06, -0.06 + i * 0.024, -0.02, 'l', 0, 0.2); // belt
    for (const s of [-1, 1]) d.box(0.012, 0.012, 0.22, s * 0.022, -0.035, -0.38, 'o'); // bipod
    triggerGroup(d, -0.05, 0.13);
    pistolGrip(d, -0.11, 0.13, 'v');
    d.bev(0.066, 0.1, 0.2, 0, -0.02, 0.3, 'v'); // stock
    d.box(0.07, 0.12, 0.024, 0, -0.024, 0.41, 'r');
  },
  // Striker pistol: gunmetal slide with serrations, polymer frame, three-dot tritium sights
  pistol(d) {
    d.bev(0.036, 0.04, 0.2, 0, 0.03, -0.04, 'm'); // slide
    for (const z of [0.025, 0.037, 0.049]) d.box(0.0375, 0.026, 0.005, 0, 0.032, z, 'o'); // serrations
    d.box(0.0375, 0.012, 0.04, 0, 0.042, -0.05, 'o'); // ejection port
    d.box(0.02, 0.006, 0.03, 0, 0.0505, -0.05, 'l'); // barrel hood
    d.cyl(0.0075, 0.004, 0, 0.03, -0.139, 'o', 10); // muzzle
    d.bev(0.034, 0.026, 0.17, 0, -0.003, -0.045, 'p'); // frame
    d.box(0.03, 0.01, 0.05, 0, -0.019, -0.1, 'p'); // accessory rail
    d.box(0.0345, 0.006, 0.04, 0, -0.008, -0.1, 'c');
    triggerGroup(d, -0.01, 0.07, 'p');
    d.bev(0.034, 0.12, 0.05, 0, -0.072, 0.06, 'p', 0.22); // grip
    for (const y of [-0.05, -0.07, -0.09]) d.box(0.0355, 0.008, 0.042, 0, y, 0.058 - (y + 0.05) * 0.22, 'q', 0.22);
    d.box(0.036, 0.012, 0.054, 0, -0.134, 0.075, 'p', 0.22); // magazine base
    d.box(0.004, 0.009, 0.006, 0, 0.0545, -0.13, 'o'); // front sight
    d.box(0.003, 0.003, 0.002, 0, 0.056, -0.1265, 'n');
    d.box(0.026, 0.006, 0.008, 0, 0.053, 0.048, 'o'); // rear sight
    for (const s of [-1, 1]) {
      d.box(0.008, 0.007, 0.008, s * 0.0085, 0.0565, 0.048, 'o');
      d.box(0.003, 0.003, 0.002, s * 0.0085, 0.056, 0.053, 'n');
    }
    d.sight(0.056);
  },
  // Combat knife: rubber handle, steel blade with a polished edge and a clipped point
  knife(d) {
    d.bev(0.026, 0.03, 0.11, 0, -0.1, 0.095, 'r'); // handle
    for (const z of [0.06, 0.09, 0.12]) d.box(0.028, 0.032, 0.006, 0, -0.1, z, 'o');
    d.box(0.028, 0.008, 0.02, 0, -0.1, 0.152, 'c'); // pommel band
    d.box(0.026, 0.026, 0.014, 0, -0.1, 0.156 + 0.01, 'm'); // pommel
    d.box(0.03, 0.05, 0.01, 0, -0.098, 0.036, 'm'); // guard
    d.box(0.005, 0.028, 0.16, 0, -0.096, -0.05, 's'); // blade
    d.box(0.0035, 0.008, 0.16, 0, -0.112, -0.05, 'z'); // edge
    d.box(0.0056, 0.005, 0.1, 0, -0.091, -0.03, 'o'); // fuller
    d.box(0.005, 0.02, 0.05, 0, -0.1, -0.14, 's', 0.45); // clipped point
    d.box(0.0035, 0.006, 0.05, 0, -0.109, -0.14, 'z', 0.25);
    d.sight(-0.096);
  },
  // Revolver: bright steel frame, fluted cylinder, full underlug and walnut grip
  revolver(d) {
    d.cyl(0.013, 0.17, 0, 0.032, -0.165, 's', 12); // barrel
    d.box(0.012, 0.012, 0.17, 0, 0.045, -0.165, 's'); // top rib
    d.bev(0.018, 0.024, 0.13, 0, 0.012, -0.145, 's'); // underlug
    d.cyl(0.0065, 0.004, 0, 0.032, -0.251, 'o', 10); // muzzle
    d.bev(0.032, 0.07, 0.11, 0, 0.018, 0.025, 's'); // frame
    d.cyl(0.029, 0.058, 0, 0.02, -0.03, 'm', 12); // cylinder
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
      d.box(0.007, 0.007, 0.044, Math.sin(a) * 0.027, 0.02 + Math.cos(a) * 0.027, -0.03, 'o', 0, -a); // flutes
    }
    d.box(0.01, 0.022, 0.02, 0, 0.06, 0.082, 'o', 0.5); // hammer
    triggerGroup(d, -0.012, 0.11, 's');
    d.bev(0.034, 0.115, 0.052, 0, -0.07, 0.1, 'w', 0.4); // grip
    d.box(0.035, 0.012, 0.012, 0, -0.06, 0.098, 'c', 0.4);
    d.box(0.004, 0.014, 0.018, 0, 0.0555, -0.235, 'o'); // ramp front sight
    d.box(0.0042, 0.004, 0.006, 0, 0.06, -0.232, 'd');
    for (const s of [-1, 1]) d.box(0.007, 0.01, 0.01, s * 0.0085, 0.057, 0.065, 'o'); // rear notch
    d.sight(0.06);
  },
};

const gunMatCache = new Map<string, Record<GunMat, THREE.Material>>();
function gunMaterials(tint: string): Record<GunMat, THREE.Material> {
  const cached = gunMatCache.get(tint);
  if (cached) return cached;
  const S = (color: string, roughness: number, metalness: number, extra?: THREE.MeshStandardMaterialParameters) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
  const m: Record<GunMat, THREE.Material> = {
    o: S('#1e2125', 0.5, 0.55),
    m: S('#353b43', 0.42, 0.6),
    s: S('#9aa2ab', 0.3, 0.85),
    z: S('#d6dce2', 0.18, 0.95),
    p: S('#25282d', 0.78, 0.05),
    q: S('#3c4148', 0.72, 0.05),
    k: S('#8a7656', 0.8, 0.02),
    w: S('#7a4a26', 0.62, 0.0),
    x: S('#55321a', 0.7, 0.0),
    v: S('#505b3d', 0.74, 0.08),
    y: S('#3b4530', 0.76, 0.08),
    r: S('#16181b', 0.95, 0.0),
    l: S('#c99a3e', 0.32, 0.9),
    e: S('#a8352a', 0.55, 0.0),
    c: S(tint, 0.5, 0.1, { emissive: tint, emissiveIntensity: 0.2 }),
    g: new THREE.MeshBasicMaterial({ color: '#5fb8e0' }),
    t: new THREE.MeshBasicMaterial({ color: '#b8ecff', transparent: true, opacity: 0.06, depthWrite: false }),
    d: new THREE.MeshBasicMaterial({ color: '#ff2a2a' }),
    n: new THREE.MeshBasicMaterial({ color: '#9dff6a' }),
  };
  gunMatCache.set(tint, m);
  return m;
}

interface GunGeometry {
  parts: { mat: GunMat; geo: THREE.BufferGeometry }[];
  muzzleZ: number;
  muzzleY: number;
  sightY: number;
}

/** Draws a weapon once and merges its parts by material; the result is shared by every copy of it. */
const gunGeometryCache = new Map<WeaponId, GunGeometry>();
function gunGeometry(id: WeaponId): GunGeometry {
  const cached = gunGeometryCache.get(id);
  if (cached) return cached;
  const byMat = new Map<GunMat, THREE.BufferGeometry[]>();
  let muzzleZ = 0;
  let muzzleY = 0;
  let sightY = 0;
  const tmp = new THREE.Object3D();
  const put = (
    geo: THREE.BufferGeometry,
    mat: GunMat,
    x: number,
    y: number,
    z: number,
    rx: number,
    rz: number,
    half: number,
  ) => {
    tmp.position.set(x, y, z);
    tmp.rotation.set(rx, 0, rz);
    tmp.updateMatrix();
    const g = (geo.index ? geo.toNonIndexed() : geo.clone()).applyMatrix4(tmp.matrix);
    let list = byMat.get(mat);
    if (!list) byMat.set(mat, (list = []));
    list.push(g);
    if (z - half < muzzleZ) {
      muzzleZ = z - half;
      muzzleY = y;
    }
  };
  GUNS[id]({
    box: (w, h, dd, x, y, z, m, rx = 0, rz = 0) => put(boxGeo(w, h, dd), m, x, y, z, rx, rz, dd / 2),
    bev: (w, h, dd, x, y, z, m, rx = 0) => put(bevelGeo(w, h, dd), m, x, y, z, rx, 0, dd / 2),
    cyl: (r, len, x, y, z, m, sides = DEFAULT_CYL_SIDES) => put(cylGeo(r, len, sides), m, x, y, z, 0, 0, len / 2),
    ring: (inner, outer, x, y, z, m) => put(ringGeo(inner, outer), m, x, y, z, 0, 0, 0),
    sight: (y) => (sightY = y),
  });
  const parts = [...byMat].map(([mat, list]) => {
    const geo = mergeGeometries(list)!;
    for (const g of list) g.dispose();
    return { mat, geo };
  });
  const result = { parts, muzzleZ, muzzleY, sightY };
  gunGeometryCache.set(id, result);
  return result;
}

// Muzzle flash: a star texture drawn once, on a camera-facing quad plus two crossed streak quads
let flashTexture: THREE.CanvasTexture | null = null;
function getFlashTexture(): THREE.CanvasTexture {
  if (flashTexture) return flashTexture;
  const c = document.createElement('canvas');
  c.width = c.height = FLASH_CANVAS;
  const g = c.getContext('2d')!;
  const h = FLASH_CANVAS / 2;
  const glow = g.createRadialGradient(h, h, 0, h, h, h);
  glow.addColorStop(0, 'rgba(255,250,220,1)');
  glow.addColorStop(0.25, 'rgba(255,200,90,0.9)');
  glow.addColorStop(0.6, 'rgba(255,120,30,0.25)');
  glow.addColorStop(1, 'rgba(255,90,0,0)');
  g.fillStyle = glow;
  g.beginPath();
  for (let i = 0; i < FLASH_POINTS * 2; i++) {
    const a = (i / (FLASH_POINTS * 2)) * Math.PI * 2;
    const r = i % 2 ? h * 0.28 : h * (i % 4 ? 0.75 : 1);
    g.lineTo(h + Math.cos(a) * r, h + Math.sin(a) * r);
  }
  g.closePath();
  g.fill();
  flashTexture = new THREE.CanvasTexture(c);
  flashTexture.colorSpace = THREE.SRGBColorSpace;
  return flashTexture;
}

let flashGeo: THREE.BufferGeometry | null = null;
function getFlashGeometry(): THREE.BufferGeometry {
  if (flashGeo) return flashGeo;
  const front = new THREE.PlaneGeometry(FLASH_SIZE, FLASH_SIZE);
  const side = new THREE.PlaneGeometry(FLASH_SIZE * 0.7, FLASH_STREAK);
  side.rotateX(-Math.PI / 2);
  side.translate(0, 0, -FLASH_STREAK / 2 + FLASH_OFFSET);
  const side2 = side.clone().rotateZ(Math.PI / 2);
  flashGeo = mergeGeometries([front, side, side2])!;
  return flashGeo;
}

const flashMaterial = (): THREE.MeshBasicMaterial =>
  new THREE.MeshBasicMaterial({
    map: getFlashTexture(),
    color: 0xffffff,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

export interface GunModel extends THREE.Group {
  userData: { muzzleZ: number; muzzleY: number; sightY: number; flash?: THREE.Mesh };
}

export function buildGun(id: WeaponId, withFlash = false, tint = '#ffc93c'): GunModel {
  const mats = gunMaterials(tint);
  const geo = gunGeometry(id);
  const g = new THREE.Group() as GunModel;
  for (const p of geo.parts) {
    const mesh = new THREE.Mesh(p.geo, mats[p.mat]);
    mesh.castShadow = p.mat !== 't' && p.mat !== 'd' && p.mat !== 'n';
    g.add(mesh);
  }
  g.userData.muzzleZ = geo.muzzleZ;
  g.userData.muzzleY = geo.muzzleY;
  g.userData.sightY = geo.sightY;
  if (withFlash) {
    const flash = new THREE.Mesh(getFlashGeometry(), flashMaterial());
    flash.position.set(0, geo.muzzleY, geo.muzzleZ - FLASH_OFFSET);
    flash.visible = false;
    flash.renderOrder = 2;
    g.add(flash);
    g.userData.flash = flash;
  }
  return g;
}

// ------------------------------------------------------------ Name tag and health bar
// Health bar colours: green > 50 %, yellow 25–50 %, red ≤ 25 % (they follow the colourblind mode)
export { hpColor } from '../../settings/palette';

// throughWalls: visible behind walls (teammates)
export interface NameTag extends THREE.Sprite {
  userData: { setHp: (fraction: number) => void };
}

export function makeNameTag(text: string, color: string | undefined, throughWalls = false): NameTag {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 96;
  const g = c.getContext('2d')!;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  let last = -1;

  // Name in Rubik 800 with outline and a small health bar of the same colour (green ally, red enemy)
  const tint = color || '#ffffff';
  const draw = (hp: number) => {
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

  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: !throughWalls }),
  ) as unknown as NameTag;
  s.scale.set(1.6, 0.6, 1);
  if (throughWalls) s.renderOrder = 5;
  s.userData.setHp = (f: number) => {
    const q = Math.round(Math.max(0, Math.min(1, f)) * 50) / 50; // only redrawn when it changes
    if (q !== last) draw((last = q));
  };
  return s;
}
