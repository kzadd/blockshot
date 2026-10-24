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

// ------------------------------------------------------------ Skins
// Each skin dresses the character. `color` is the outfit colour (class, team or the player's pick):
// the classic skin wears it on the whole uniform, the patterned ones keep it on the accent details
// (arm bands, patches, stripes) so the player stays recognisable whatever the skin.
const shade = (hex: string, k: number): string => '#' + new THREE.Color(hex).multiplyScalar(k).getHexString();
const mix = (a: string, b: string, t: number): string =>
  '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();

type Pattern = 'blotch' | 'digital' | 'weave';
const TEX_SIZE = 32;

function patternTexture(colors: string[], pattern: Pattern): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = TEX_SIZE;
  const g = c.getContext('2d')!;
  g.fillStyle = colors[0]!;
  g.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pick = (i: number) => colors[1 + (i % (colors.length - 1))]!;
  if (pattern === 'weave') {
    // Carbon fibre: 2×2 tiles alternating direction
    for (let y = 0; y < TEX_SIZE; y += 2)
      for (let x = 0; x < TEX_SIZE; x += 2) {
        g.fillStyle = pick((x + y) / 2);
        g.fillRect(x, y, (x + y) % 4 ? 2 : 1, (x + y) % 4 ? 1 : 2);
      }
  } else if (pattern === 'digital') {
    for (let i = 0; i < 90; i++) {
      g.fillStyle = pick(i);
      const s = 2 + 2 * Math.floor(rnd() * 2);
      g.fillRect(Math.floor(rnd() * 16) * 2, Math.floor(rnd() * 16) * 2, s, s);
    }
  } else {
    for (let i = 0; i < 46; i++) {
      g.fillStyle = pick(i);
      g.fillRect(Math.floor(rnd() * 32), Math.floor(rnd() * 32), 2 + Math.floor(rnd() * 6), 2 + Math.floor(rnd() * 4));
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

interface SkinColors {
  /** shirt / jacket */
  main: string;
  pants: string;
  /** pattern printed on shirt and pants (their colours are then multiplied by white) */
  camo?: { colors: string[]; pattern: Pattern; pants?: string[] };
  /** plate carrier, helmet shell, armour */
  vest: string;
  /** pouches, belt, straps */
  gear: string;
  accent: string;
  visor: string;
  boot: string;
  glove: string;
  metal: string;
  /** accent and visor glow */
  glow?: number;
  shiny?: boolean;
}

const GEAR_DARK = '#2b2f36';
const BOOT_DARK = '#23262b';
const GLOVE_DARK = '#2a2c30';
const METAL = '#5d636b';
const VISOR_DARK = '#1b2a4a';

function skinPalette(color: string, skin: string): SkinColors {
  const common = { accent: color, boot: BOOT_DARK, glove: GLOVE_DARK, metal: METAL, visor: VISOR_DARK };
  switch (skin) {
    case 'camo':
      return {
        ...common,
        main: '#ffffff',
        pants: '#4a5638',
        camo: { colors: ['#5b6b3a', shade(color, 0.75), '#3d4a2a', '#8c8a5a'], pattern: 'blotch' },
        vest: '#4a5236',
        gear: '#2f3526',
        glove: '#3b4130',
      };
    case 'noche':
      return {
        ...common,
        main: '#1f2433',
        pants: '#141824',
        vest: '#171b26',
        gear: '#0d1018',
        boot: '#0b0d12',
        glove: '#101319',
        visor: color,
        glow: 0.7,
      };
    case 'artico':
      return {
        ...common,
        main: '#ffffff',
        pants: '#ffffff',
        camo: {
          colors: ['#eef3f8', '#c9d4e0', '#aebccc', '#dfe7ef'],
          pattern: 'blotch',
          pants: ['#d5dde6', '#b4c1cf', '#e8eef4'],
        },
        vest: '#d9e1ea',
        gear: '#7d8b9a',
        boot: '#e3e8ee',
        glove: '#9aa7b5',
        visor: '#2d4a70',
      };
    case 'oro':
      return {
        ...common,
        main: '#e8b923',
        pants: '#9c6f12',
        vest: '#f0c440',
        gear: '#5a3f0a',
        boot: '#3a2a08',
        glove: '#7a5610',
        metal: '#f5d27a',
        shiny: true,
      };
    case 'urbano':
      return {
        ...common,
        main: '#ffffff',
        pants: '#ffffff',
        camo: { colors: ['#6b6f75', '#4a4e54', '#8a8e93', '#33363b'], pattern: 'digital' },
        vest: '#3a3d42',
        gear: '#25272b',
      };
    case 'desierto':
      return {
        ...common,
        main: '#ffffff',
        pants: '#b39a70',
        camo: { colors: ['#c8b088', '#a68a5e', '#8a6f48', '#dccaa4'], pattern: 'blotch' },
        vest: '#9a845c',
        gear: '#6e5c3f',
        boot: '#8a6f4e',
        glove: '#7d6a4c',
      };
    case 'bosque':
      return {
        ...common,
        main: '#ffffff',
        pants: '#ffffff',
        camo: { colors: ['#4b5a32', '#2c3620', '#6b5a3a', '#1d2418'], pattern: 'blotch' },
        vest: '#3c4a2c',
        gear: '#2a3320',
        boot: '#2e2a22',
        glove: '#3a3a2a',
      };
    case 'carbono':
      return {
        ...common,
        main: '#ffffff',
        pants: '#1a1b1e',
        camo: { colors: ['#202226', '#2c2f34', '#16171a'], pattern: 'weave' },
        vest: '#151619',
        gear: '#0f1012',
        boot: '#121315',
        glove: '#18191c',
        metal: '#8d949d',
        glow: 0.35,
      };
    case 'neon':
      return {
        ...common,
        main: '#16131f',
        pants: '#0e0c14',
        vest: '#1e1a2a',
        gear: '#100e17',
        boot: '#0c0b10',
        glove: '#14121b',
        visor: color,
        glow: 1.3,
      };
    default:
      return {
        ...common,
        main: color,
        // Coloured shirt and sleeves, neutral tinted pants and a darker vest: readable but not a onesie
        pants: mix(color, '#3b4048', 0.62),
        vest: mix(color, '#262a30', 0.7),
        gear: GEAR_DARK,
        accent: mix(color, '#ffffff', 0.25),
      };
  }
}

/** Body parts are painted with one of these materials. */
type BodyMat =
  | 'main'
  | 'pants'
  | 'vest'
  | 'gear'
  | 'accent'
  | 'visor'
  | 'boot'
  | 'glove'
  | 'metal'
  | 'skin'
  | 'hair'
  | 'eye'
  | 'brass';
type BodyMaterials = Record<BodyMat, THREE.Material>;

// Roughness / metalness per kind of material: fabric, polymer, metal…
const FABRIC = { roughness: 0.92, metalness: 0 };
const POLYMER = { roughness: 0.7, metalness: 0.05 };
const METALLIC = { roughness: 0.42, metalness: 0.6 };
const std = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, ...FABRIC, ...extra });

const skinMatCache = new Map<string, Omit<BodyMaterials, 'skin' | 'hair'>>();
function skinMaterials(color: string, skin: string): Omit<BodyMaterials, 'skin' | 'hair'> {
  const key = `${color}|${skin}`;
  const cached = skinMatCache.get(key);
  if (cached) return cached;
  const p = skinPalette(color, skin);
  const glow = (c: string, k: number) => (p.glow ? { emissive: c, emissiveIntensity: p.glow * k } : {});
  const map = p.camo ? patternTexture(p.camo.colors, p.camo.pattern) : undefined;
  const pantsMap = p.camo?.pants ? patternTexture(p.camo.pants, p.camo.pattern) : map;
  const m = {
    main: std(p.main, map ? { map } : p.shiny ? { ...METALLIC, emissive: '#3a2a00' } : {}),
    pants: std(p.pants, pantsMap && p.pants === '#ffffff' ? { map: pantsMap } : {}),
    vest: std(p.vest, p.shiny ? { ...METALLIC, emissive: '#3a2a00' } : POLYMER),
    gear: std(p.gear, { roughness: 0.85 }),
    accent: std(p.accent, { ...POLYMER, ...glow(p.accent, 1) }),
    visor: std(p.visor, { roughness: 0.2, metalness: 0.3, ...glow(p.visor, 1.2) }),
    boot: std(p.boot, POLYMER),
    glove: std(p.glove, { roughness: 0.8 }),
    metal: std(p.metal, METALLIC),
    eye: std('#15171c', { roughness: 0.3 }),
    brass: std('#c9a03a', { ...METALLIC, emissive: '#2a1d00' }),
  };
  skinMatCache.set(key, m);
  return m;
}

// ------------------------------------------------------------ Character
// Faces -Z (like the camera). Feet at y=0. The proportions follow the server hitboxes
// (body box up to 1.45 m, head sphere centred at 1.64 m).
// Every body segment is drawn once per character into a few merged meshes (one per material),
// cached and shared by every player: a character costs ~30 draw calls whatever its detail.

type V3 = THREE.Vector3;
const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const Z_AXIS = v3(0, 0, 1);
const tmpM4 = new THREE.Matrix4();
const tmpEuler = new THREE.Euler();
const tmpQuat = new THREE.Quaternion();

/** Collects boxes and cylinders per material and merges them into one geometry each. */
class Kit {
  private readonly parts = new Map<BodyMat, THREE.BufferGeometry[]>();

  private push(mat: BodyMat, g: THREE.BufferGeometry): void {
    const list = this.parts.get(mat);
    if (list) list.push(g);
    else this.parts.set(mat, [g]);
  }

  box(w: number, h: number, d: number, x: number, y: number, z: number, mat: BodyMat, rx = 0, ry = 0, rz = 0): void {
    const g = new THREE.BoxGeometry(w, h, d);
    if (rx || ry || rz) g.applyMatrix4(tmpM4.makeRotationFromEuler(tmpEuler.set(rx, ry, rz)));
    g.translate(x, y, z);
    this.push(mat, g);
  }

  /** Box mirrored on both sides (x and -x). */
  pair(w: number, h: number, d: number, x: number, y: number, z: number, mat: BodyMat, rx = 0, ry = 0, rz = 0): void {
    this.box(w, h, d, x, y, z, mat, rx, ry, rz);
    this.box(w, h, d, -x, y, z, mat, rx, -ry, -rz);
  }

  /** Vertical cylinder (rotated by rx / rz). */
  cyl(r: number, h: number, x: number, y: number, z: number, mat: BodyMat, segs = 8, rx = 0, rz = 0): void {
    const g = new THREE.CylinderGeometry(r, r, h, segs);
    if (rx || rz) g.applyMatrix4(tmpM4.makeRotationFromEuler(tmpEuler.set(rx, 0, rz)));
    g.translate(x, y, z);
    this.push(mat, g);
  }

  /** Box of section w×h stretched from a to b (limbs, straps). */
  beam(a: V3, b: V3, w: number, h: number, mat: BodyMat, overhang = 0): void {
    const dir = b.clone().sub(a);
    const len = dir.length() + overhang * 2;
    const g = new THREE.BoxGeometry(w, h, len);
    g.translate(0, 0, len / 2 - overhang);
    g.applyQuaternion(tmpQuat.setFromUnitVectors(Z_AXIS, dir.normalize()));
    g.translate(a.x, a.y, a.z);
    this.push(mat, g);
  }

  merge(): [BodyMat, THREE.BufferGeometry][] {
    const out: [BodyMat, THREE.BufferGeometry][] = [];
    for (const [mat, list] of this.parts) {
      const merged = mergeGeometries(list, false);
      for (const g of list) g.dispose();
      if (merged) out.push([mat, merged]);
    }
    return out;
  }
}

const kitCache = new Map<string, [BodyMat, THREE.BufferGeometry][]>();
function addKit(parent: THREE.Object3D, key: string, mats: BodyMaterials, draw: (k: Kit) => void, shadow = true): void {
  let geos = kitCache.get(key);
  if (!geos) {
    const k = new Kit();
    draw(k);
    kitCache.set(key, (geos = k.merge()));
  }
  for (const [mat, geo] of geos) {
    const mesh = new THREE.Mesh(geo, mats[mat]);
    mesh.castShadow = shadow;
    parent.add(mesh);
  }
}

/** Elbow of a two-bone arm from shoulder s to hand h, bending towards `bend`. */
function elbowOf(s: V3, h: V3, upper: number, fore: number, bend: V3): V3 {
  const d = h.clone().sub(s);
  const dist = Math.min(d.length(), upper + fore - 1e-3);
  d.normalize();
  const along = (upper * upper - fore * fore + dist * dist) / (2 * dist);
  const out = Math.sqrt(Math.max(0, upper * upper - along * along));
  const perp = bend.clone().addScaledVector(d, -bend.dot(d)).normalize();
  return s.clone().addScaledVector(d, along).addScaledVector(perp, out);
}

type Build = 'standard' | 'light' | 'heavy';

interface CharacterLook {
  build: Build;
  skinTone: string;
  hair: string;
  /** bare forearms (t-shirt) */
  shortSleeves?: boolean;
  /** head gear, back pack and anything particular on the upper body */
  upper(k: Kit): void;
  thigh?(k: Kit, side: number): void;
  shin?(k: Kit, side: number): void;
}

/** Face looking at -Z: jaw, nose, ears, eyes and brows. Head centre at y=1.64. */
function drawHead(k: Kit): void {
  k.box(0.28, 0.27, 0.3, 0, 1.665, 0.005, 'skin'); // cranium
  k.box(0.24, 0.11, 0.25, 0, 1.53, -0.015, 'skin'); // jaw
  k.box(0.12, 0.05, 0.05, 0, 1.495, -0.11, 'skin'); // chin
  k.box(0.045, 0.07, 0.05, 0, 1.615, -0.16, 'skin'); // nose
  k.pair(0.035, 0.075, 0.07, 0.152, 1.625, 0.01, 'skin'); // ears
  k.pair(0.05, 0.026, 0.012, 0.062, 1.66, -0.152, 'eye'); // eyes
  k.pair(0.075, 0.022, 0.03, 0.062, 1.69, -0.148, 'hair'); // brows
  k.box(0.07, 0.012, 0.012, 0, 1.56, -0.14, 'eye'); // mouth
  k.box(0.13, 0.1, 0.12, 0, 1.43, 0.0, 'skin'); // neck
}

/** Torso, belt and the vest of each build. Shoulders at y≈1.38. */
function drawTorso(k: Kit, build: Build): void {
  const heavy = build === 'heavy';
  const light = build === 'light';
  const w = heavy ? 0.5 : light ? 0.42 : 0.46;
  k.box(0.46, 0.2, 0.26, 0, 0.83, 0, 'pants'); // hips
  k.box(w - 0.04, 0.42, 0.24, 0, 1.13, 0, 'main'); // belly
  k.box(w + 0.04, 0.2, 0.27, 0, 1.33, 0, 'main'); // chest
  k.pair(0.16, 0.15, 0.2, w / 2 + 0.06, 1.37, 0, 'main'); // shoulders
  k.box(0.2, 0.05, 0.18, 0, 1.445, 0.01, 'main'); // collar
  k.box(0.45, 0.06, 0.27, 0, 0.93, 0, 'gear'); // belt
  k.box(0.07, 0.045, 0.012, 0, 0.93, -0.138, 'metal'); // buckle
  k.pair(0.08, 0.09, 0.07, 0.17, 0.92, -0.08, 'gear'); // belt pouches
  if (light) {
    // Chest rig: two crossed straps and a row of small pouches
    k.beam(v3(-0.16, 1.43, -0.13), v3(0.16, 1.02, -0.13), 0.06, 0.02, 'gear');
    k.beam(v3(0.16, 1.43, -0.13), v3(-0.16, 1.02, -0.13), 0.06, 0.02, 'gear');
    for (const x of [-0.12, 0, 0.12]) k.box(0.085, 0.09, 0.05, x, 1.08, -0.145, 'gear');
    k.pair(0.06, 0.4, 0.012, 0.12, 1.2, 0.128, 'accent'); // back stripes
    k.box(0.1, 0.04, 0.008, 0.11, 1.33, -0.14, 'accent'); // patch
    return;
  }
  const d = heavy ? 0.08 : 0.055;
  const vw = heavy ? 0.48 : 0.42;
  k.box(vw, 0.36, d, 0, 1.2, -0.12 - d / 2, 'vest'); // front plate
  k.box(vw, 0.38, d, 0, 1.2, 0.12 + d / 2, 'vest'); // back plate
  k.box(w + 0.03, 0.15, 0.3, 0, 1.06, 0, 'vest'); // cummerbund
  k.pair(0.08, 0.035, 0.32, 0.13, 1.43, 0, 'gear'); // shoulder straps
  k.box(vw - 0.04, 0.025, 0.01, 0, 1.37, -0.125 - d, 'accent'); // top edge stripe
  for (const x of [-0.12, 0, 0.12]) {
    k.box(0.09, 0.11, 0.05, x, 1.1, -0.145 - d, 'gear'); // magazine pouches
    k.box(0.092, 0.03, 0.054, x, 1.16, -0.145 - d, 'vest'); // flaps
  }
  k.box(0.11, 0.05, 0.008, 0.1, 1.28, -0.122 - d, 'accent'); // name patch
  k.box(0.05, 0.11, 0.04, -0.15, 1.3, -0.12 - d - 0.02, 'gear'); // radio
  k.box(0.012, 0.08, 0.012, -0.16, 1.4, -0.12 - d - 0.02, 'metal'); // antenna
}

const EXTRAS: Record<CharacterId, CharacterLook> = {
  // Standard rifleman: ballistic helmet with headset, plate carrier
  soldado: {
    build: 'standard',
    skinTone: '#d9a77c',
    hair: '#3a2a1e',
    upper(k) {
      k.box(0.34, 0.12, 0.36, 0, 1.79, 0.01, 'vest'); // helmet shell
      k.box(0.3, 0.04, 0.32, 0, 1.86, 0.01, 'vest');
      k.pair(0.04, 0.12, 0.3, 0.17, 1.72, 0.03, 'vest'); // sides
      k.box(0.34, 0.1, 0.04, 0, 1.73, 0.18, 'vest'); // nape
      k.box(0.32, 0.025, 0.05, 0, 1.745, -0.17, 'vest'); // brim
      k.box(0.3, 0.02, 0.01, 0, 1.77, -0.176, 'accent'); // stripe
      k.box(0.07, 0.05, 0.04, 0, 1.79, -0.19, 'metal'); // NVG mount
      k.pair(0.05, 0.1, 0.1, 0.18, 1.63, 0.01, 'gear'); // headset
      k.pair(0.012, 0.11, 0.012, 0.15, 1.56, -0.06, 'gear', 0.5); // chin strap
      k.box(0.16, 0.06, 0.1, 0, 1.15, 0.2, 'gear'); // hydration pack
    },
    thigh(k, s) {
      if (s > 0) {
        k.box(0.06, 0.18, 0.13, 0.11, -0.12, 0, 'gear'); // holster
        k.box(0.035, 0.08, 0.06, 0.12, -0.02, -0.02, 'metal');
      }
    },
  },
  // Sniper: hood over a cap, scarf on the face and a pack with a bedroll
  cazador: {
    build: 'standard',
    skinTone: '#b07b52',
    hair: '#1e1612',
    upper(k) {
      k.box(0.34, 0.07, 0.36, 0, 1.81, 0.02, 'main'); // hood top
      k.pair(0.04, 0.3, 0.32, 0.17, 1.68, 0.02, 'main'); // hood sides
      k.box(0.34, 0.34, 0.05, 0, 1.66, 0.18, 'main'); // hood back
      k.box(0.3, 0.06, 0.06, 0, 1.47, 0.14, 'main'); // hood fold
      k.box(0.26, 0.022, 0.13, 0, 1.765, -0.2, 'accent'); // cap brim
      k.box(0.27, 0.1, 0.27, 0, 1.53, -0.02, 'gear'); // scarf over the jaw
      k.box(0.3, 0.06, 0.24, 0, 1.46, 0, 'gear');
      k.box(0.34, 0.42, 0.18, 0, 1.15, 0.24, 'vest'); // pack
      k.box(0.3, 0.12, 0.05, 0, 1.0, 0.34, 'gear');
      k.cyl(0.06, 0.38, 0, 1.4, 0.26, 'pants', 8, 0, Math.PI / 2); // bedroll
      k.box(0.07, 0.05, 0.1, 0.14, 1.3, -0.2, 'metal'); // rangefinder
    },
    thigh(k, s) {
      k.box(0.06, 0.13, 0.12, s * 0.11, -0.16, 0, 'gear'); // leg pouch
    },
  },
  // Heavy armour: big pauldrons, chest plate, helmet with visor and jaw guard
  tanque: {
    build: 'heavy',
    skinTone: '#8a5a3c',
    hair: '#141414',
    upper(k) {
      k.box(0.37, 0.16, 0.38, 0, 1.79, 0.01, 'vest'); // helmet
      k.pair(0.05, 0.22, 0.34, 0.18, 1.68, 0.02, 'vest');
      k.box(0.36, 0.2, 0.05, 0, 1.69, 0.18, 'vest');
      k.box(0.3, 0.07, 0.03, 0, 1.665, -0.18, 'visor'); // visor
      k.box(0.34, 0.03, 0.05, 0, 1.715, -0.18, 'vest');
      k.box(0.28, 0.1, 0.05, 0, 1.53, -0.15, 'metal'); // jaw guard
      k.pair(0.025, 0.06, 0.02, 0.07, 1.53, -0.178, 'gear');
      k.box(0.36, 0.025, 0.02, 0, 1.87, -0.05, 'accent'); // crest
      k.pair(0.26, 0.1, 0.32, 0.33, 1.47, 0, 'vest', 0, 0, -0.25); // pauldrons
      k.pair(0.22, 0.08, 0.28, 0.35, 1.39, 0, 'metal', 0, 0, -0.3);
      k.pair(0.2, 0.02, 0.3, 0.34, 1.53, 0, 'accent', 0, 0, -0.25);
      k.box(0.36, 0.26, 0.05, 0, 1.25, -0.215, 'metal'); // chest plate
      k.box(0.28, 0.14, 0.05, 0, 0.84, -0.14, 'vest'); // groin plate
      k.box(0.44, 0.08, 0.3, 0, 1.47, 0, 'vest'); // gorget
    },
    thigh(k, s) {
      k.box(0.07, 0.26, 0.2, s * 0.12, -0.18, 0, 'vest'); // side plates
      k.box(0.2, 0.22, 0.04, 0, -0.18, -0.125, 'vest');
    },
    shin(k) {
      k.box(0.17, 0.26, 0.05, 0, -0.17, -0.11, 'vest'); // shin guard
    },
  },
  // Runner: light top with bare forearms, headband, spiky hair, goggles on the forehead
  rayo: {
    build: 'light',
    skinTone: '#efc49c',
    hair: '#d9a520',
    shortSleeves: true,
    upper(k) {
      k.box(0.3, 0.08, 0.32, 0, 1.8, 0.01, 'hair'); // hair
      k.pair(0.035, 0.12, 0.26, 0.15, 1.74, 0.03, 'hair');
      k.box(0.3, 0.14, 0.05, 0, 1.72, 0.16, 'hair');
      for (const [x, z, r] of [
        [-0.08, -0.06, 0.3],
        [0.06, -0.08, -0.3],
        [0, 0.04, 0],
        [-0.1, 0.08, 0.4],
        [0.1, 0.06, -0.4],
      ] as const)
        k.box(0.09, 0.12, 0.09, x, 1.87, z, 'hair', 0.2, 0, r);
      k.box(0.31, 0.04, 0.33, 0, 1.73, 0.0, 'accent'); // headband
      k.box(0.3, 0.07, 0.04, 0, 1.775, -0.17, 'visor'); // goggles
      k.pair(0.08, 0.075, 0.045, 0.07, 1.775, -0.17, 'metal');
    },
    shin(k, s) {
      k.box(0.21, 0.025, 0.31, 0, -0.395, -0.04, 'accent'); // sneaker sole
      k.box(0.015, 0.06, 0.18, s * 0.1, -0.33, -0.04, 'accent'); // side stripe
    },
  },
  // Heavy gunner: closed helmet with a glowing slit, ammo belt and an ammo backpack
  bastion: {
    build: 'heavy',
    skinTone: '#a06c46',
    hair: '#2a1d14',
    upper(k) {
      k.box(0.35, 0.36, 0.37, 0, 1.66, 0.01, 'vest'); // closed helmet
      k.box(0.31, 0.04, 0.33, 0, 1.855, 0.01, 'vest');
      k.box(0.27, 0.05, 0.02, 0, 1.675, -0.185, 'visor'); // slit
      k.box(0.31, 0.03, 0.03, 0, 1.715, -0.185, 'metal');
      k.pair(0.06, 0.06, 0.06, 0.1, 1.53, -0.18, 'metal'); // filters
      k.box(0.07, 0.07, 0.05, 0, 1.55, -0.195, 'gear');
      k.box(0.04, 0.3, 0.02, 0, 1.7, -0.19, 'accent', 0, 0, 0); // ridge
      k.box(0.04, 0.02, 0.36, 0, 1.86, 0.01, 'accent');
      k.box(0.46, 0.5, 0.24, 0, 1.15, 0.27, 'gear'); // ammo backpack
      k.box(0.47, 0.06, 0.25, 0, 1.33, 0.27, 'accent');
      k.box(0.4, 0.04, 0.03, 0, 1.0, 0.4, 'metal');
      // Ammo belt across the chest
      for (let i = 0; i < 8; i++) {
        const t = i / 7;
        k.box(0.03, 0.06, 0.03, 0.2 - t * 0.38, 1.4 - t * 0.38, -0.215, 'brass', 0, 0, 0.8);
      }
      k.beam(v3(0.22, 1.43, -0.2), v3(-0.2, 1.0, -0.2), 0.05, 0.02, 'gear');
      k.pair(0.22, 0.09, 0.3, 0.32, 1.46, 0, 'vest', 0, 0, -0.2); // pauldrons
    },
    shin(k) {
      k.box(0.19, 0.16, 0.08, 0, -0.04, -0.1, 'vest'); // big knee guard
    },
  },
};

/** Arm segment lengths (m). */
const UPPER_ARM = 0.34;
const FOREARM = 0.36;
/** Shoulder joints and grip hand in the aim group (pivot at y=1.36). */
const SHOULDER_X = 0.29;
const RIGHT_HAND = v3(0.12, -0.15, -0.37);
const SHORT_GUN_LEFT_HAND = v3(0.08, -0.2, -0.34);
const AIM_Y = 1.36;
/** Gun mount in the aim group; guns are scaled for remote players. */
const GUN_MOUNT = v3(0.12, -0.02, -0.5);

function drawArm(k: Kit, look: CharacterLook, side: number, hand: V3): void {
  const shoulder = v3(side * SHOULDER_X, 0, 0.01);
  const reach = UPPER_ARM + FOREARM - 0.01;
  if (hand.distanceTo(shoulder) > reach) hand = shoulder.clone().add(hand.clone().sub(shoulder).setLength(reach));
  const elbow = elbowOf(shoulder, hand, UPPER_ARM, FOREARM, v3(side * 0.7, -1, 0.2));
  const fore = hand.clone().sub(elbow).normalize();
  const wrist = hand.clone().addScaledVector(fore, -0.06);
  const heavy = look.build === 'heavy';
  const t = heavy ? 0.15 : look.build === 'light' ? 0.115 : 0.13;
  k.beam(shoulder, elbow, t, t, 'main', 0.03); // upper sleeve
  const band = shoulder.clone().lerp(elbow, 0.45);
  k.beam(band, shoulder.clone().lerp(elbow, 0.6), t + 0.01, t + 0.01, 'accent'); // arm band
  k.beam(elbow, wrist, t - 0.015, t - 0.015, look.shortSleeves ? 'skin' : 'main', 0.02); // forearm
  if (!look.shortSleeves) k.beam(wrist.clone().addScaledVector(fore, -0.07), wrist, t, t, 'main'); // cuff
  k.box(t - 0.02, t - 0.02, t - 0.02, elbow.x, elbow.y, elbow.z, heavy ? 'metal' : 'gear'); // elbow pad
  k.beam(wrist, hand.clone().addScaledVector(fore, 0.05), 0.085, 0.1, 'glove', 0.01); // glove
}

function drawLeg(k: Kit, look: CharacterLook, side: number): void {
  const w = look.build === 'heavy' ? 0.24 : look.build === 'light' ? 0.2 : 0.22;
  k.box(w, 0.44, w + 0.02, 0, -0.2, 0, 'pants'); // thigh
  k.box(w + 0.01, 0.06, w + 0.03, 0, -0.06, 0, 'pants'); // seam
  k.box(0.04, 0.1, 0.1, side * (w / 2 + 0.01), -0.24, -0.01, 'pants'); // cargo pocket
  look.thigh?.(k, side);
}

function drawShin(k: Kit, look: CharacterLook, side: number): void {
  const w = look.build === 'heavy' ? 0.21 : look.build === 'light' ? 0.17 : 0.19;
  k.box(w, 0.3, w + 0.01, 0, -0.16, 0, 'pants'); // shin
  if (look.build !== 'light') {
    k.box(0.15, 0.12, 0.05, 0, -0.03, -0.11, 'vest'); // knee pad
    k.box(w + 0.01, 0.025, w + 0.02, 0, -0.03, 0, 'gear'); // strap
  }
  k.box(w + 0.02, 0.1, w + 0.04, 0, -0.29, 0, 'boot'); // boot shaft
  k.box(w + 0.02, 0.1, 0.3, 0, -0.345, -0.05, 'boot'); // foot
  k.box(w + 0.03, 0.03, 0.31, 0, -0.385, -0.05, 'gear'); // sole
  k.box(w - 0.04, 0.012, 0.1, 0, -0.29, -0.15, 'gear'); // laces
  look.shin?.(k, side);
}

export interface CharacterModel {
  group: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  /** knee joints inside each leg (rotate the shin) */
  kneeL: THREE.Group;
  kneeR: THREE.Group;
  upper: THREE.Group;
  aim: THREE.Group;
  /** gun mount: use holdGun to put a gun in it */
  hand: THREE.Group;
  /** Puts the gun in the hand and moves the left hand to its handguard. */
  holdGun(gun: GunModel): void;
}

/** Hip joints at this height; thigh and shin are 0.4 m each. */
const HIP_Y = 0.8;
const KNEE_Y = -0.4;
const HIP_X = 0.12;

function bodyMaterials(charId: CharacterId, color: string, skin: string): BodyMaterials {
  const look = EXTRAS[charId];
  return { ...skinMaterials(color, skin), ...characterMaterials(charId, look) };
}
const charMatCache = new Map<CharacterId, Pick<BodyMaterials, 'skin' | 'hair'>>();
function characterMaterials(charId: CharacterId, look: CharacterLook): Pick<BodyMaterials, 'skin' | 'hair'> {
  let m = charMatCache.get(charId);
  if (!m) {
    m = { skin: std(look.skinTone, { roughness: 0.65 }), hair: std(look.hair, { roughness: 0.95 }) };
    charMatCache.set(charId, m);
  }
  return m;
}

export function buildCharacter(charId: CharacterId, skin: string = 'base', color = '#3f7fe0'): CharacterModel {
  const look = EXTRAS[charId];
  const mats = bodyMaterials(charId, color, skin);
  const group = new THREE.Group();

  const legs: THREE.Group[] = [];
  const knees: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(s * HIP_X, HIP_Y, 0);
    addKit(leg, `${charId}:thigh:${s}`, mats, (k) => drawLeg(k, look, s));
    const knee = new THREE.Group();
    knee.position.y = KNEE_Y;
    addKit(knee, `${charId}:shin:${s}`, mats, (k) => drawShin(k, look, s));
    leg.add(knee);
    group.add(leg);
    legs.push(leg);
    knees.push(knee);
  }

  const upper = new THREE.Group();
  group.add(upper);
  addKit(upper, `${charId}:upper`, mats, (k) => {
    drawTorso(k, look.build);
    drawHead(k);
    look.upper(k);
  });

  const aim = new THREE.Group();
  aim.position.set(0, AIM_Y, 0);
  upper.add(aim);
  const arms = new THREE.Group();
  aim.add(arms);
  const hand = new THREE.Group();
  hand.position.copy(GUN_MOUNT);
  aim.add(hand);

  const poseArms = (left: V3) => {
    arms.clear();
    const key = `${charId}:arms:${left.x.toFixed(2)},${left.y.toFixed(2)},${left.z.toFixed(2)}`;
    addKit(arms, key, mats, (k) => {
      drawArm(k, look, 1, RIGHT_HAND.clone());
      drawArm(k, look, -1, left.clone());
    });
  };
  poseArms(SHORT_GUN_LEFT_HAND);

  const holdGun = (gun: GunModel) => {
    hand.clear();
    hand.add(gun);
    const long = gun.userData.muzzleZ < LONG_GUN_MUZZLE_Z;
    // Left hand on the handguard of long guns (as far as the arm reaches), under the right one on short guns
    const z = GUN_MOUNT.z + gun.userData.muzzleZ * 0.45 * gun.scale.z;
    poseArms(long ? v3(0.1, -0.08, Math.round(z * 20) / 20) : SHORT_GUN_LEFT_HAND);
  };

  return { group, legL: legs[0]!, legR: legs[1]!, kneeL: knees[0]!, kneeR: knees[1]!, upper, aim, hand, holdGun };
}

// First-person arms: added to the gun so it looks held. Sleeves and gloves follow the skin.
export function buildArms(gun: GunModel, skin: string = 'base', color = '#3f7fe0'): THREE.Group {
  const mats = { ...skinMaterials(color, skin), ...characterMaterials('soldado', EXTRAS.soldado) };
  const g = new THREE.Group();
  const long = gun.userData.muzzleZ < LONG_GUN_MUZZLE_Z;
  // Left hand: on the handguard of long guns, next to the right one on short guns
  const lz = long ? Math.round(gun.userData.muzzleZ * 0.45 * 100) / 100 : 0.08;
  addKit(
    g,
    `fp:${lz}`,
    mats,
    (k) => {
      // Right hand wrapped around the grip, forearm towards the camera
      k.box(0.07, 0.085, 0.1, 0.006, -0.115, 0.115, 'glove'); // palm
      k.box(0.075, 0.03, 0.06, -0.012, -0.09, 0.08, 'glove', 0.2); // fingers round the grip
      k.box(0.025, 0.025, 0.07, -0.035, -0.07, 0.1, 'glove', 0, 0.3); // thumb
      k.box(0.05, 0.012, 0.03, 0.04, -0.09, 0.13, 'accent'); // glove strap
      const rWrist = v3(0.03, -0.16, 0.17);
      const rElbow = v3(0.09, -0.3, 0.6);
      k.beam(rWrist, rElbow, 0.095, 0.1, 'main', 0.02); // sleeve
      k.beam(rWrist, v3(0.035, -0.17, 0.22), 0.105, 0.11, 'gear'); // cuff
      k.beam(v3(0.05, -0.205, 0.3), v3(0.055, -0.215, 0.33), 0.1, 0.105, 'accent'); // watch / band
      // Left hand
      const ly = long ? -0.065 : -0.13;
      const lx = long ? -0.035 : -0.05;
      k.box(0.085, 0.07, 0.12, lx, ly, lz, 'glove'); // palm under the gun
      k.box(0.03, 0.06, 0.1, lx + 0.045, ly + 0.035, lz - 0.01, 'glove'); // fingers over the side
      k.box(0.05, 0.012, 0.03, lx - 0.02, ly - 0.02, lz + 0.03, 'accent');
      const lWrist = v3(lx - 0.04, ly - 0.06, lz + 0.07);
      const lElbow = v3(lx - 0.3, ly - 0.18, lz + 0.45);
      k.beam(lWrist, lElbow, 0.1, 0.1, 'main', 0.02);
      k.beam(lWrist, lWrist.clone().lerp(lElbow, 0.12), 0.11, 0.11, 'gear');
    },
    false,
  );
  gun.add(g);
  return g;
}

// ------------------------------------------------------------ Weapons
// Barrel towards -Z, grip at z≈0.1. Each gun is drawn with parts:
// box(width, height, depth, x, y, z, material, rotX) and cyl(radius, length, x, y, z, material, sides)
// (cylinders run along Z). Materials: o dark, m metal, s steel, p/q polymer,
// w/x wood, v/y olive green, r rubber, l brass, e shell, c character colour, g glass, d red dot.
const cylCache = new Map<string, THREE.CylinderGeometry>();
function cylGeo(r: number, len: number, segs: number): THREE.CylinderGeometry {
  const k = `${r}|${len}|${segs}`;
  let g = cylCache.get(k);
  if (!g) {
    g = new THREE.CylinderGeometry(r, r, len, segs);
    g.rotateX(Math.PI / 2);
    cylCache.set(k, g);
  }
  return g;
}

type GunMat = 'o' | 'm' | 's' | 'p' | 'q' | 'w' | 'x' | 'v' | 'y' | 'r' | 'l' | 'e' | 'c' | 'g' | 't' | 'd';
const gunMatCache = new Map<string, Record<GunMat, THREE.Material>>();
function gunMaterials(tint: string): Record<GunMat, THREE.Material> {
  const cached = gunMatCache.get(tint);
  if (cached) return cached;
  const L = (color: string, extra?: THREE.MeshLambertMaterialParameters) =>
    new THREE.MeshLambertMaterial({ color, ...extra });
  const m: Record<GunMat, THREE.Material> = {
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

type BoxDraw = (w: number, h: number, d: number, x: number, y: number, z: number, m: GunMat, rx?: number) => void;
type CylDraw = (r: number, len: number, x: number, y: number, z: number, m: GunMat, segs?: number) => void;

const GUNS: Record<WeaponId, (box: BoxDraw, cyl: CylDraw) => void> = {
  rifle(box, cyl) {
    box(0.07, 0.1, 0.36, 0, 0, -0.02, 'p'); // receiver
    box(0.05, 0.02, 0.34, 0, 0.06, -0.02, 'm'); // rail
    box(0.005, 0.03, 0.07, 0.037, 0.02, 0, 'o'); // ejection port
    box(0.076, 0.085, 0.26, 0, 0.005, -0.33, 'q'); // handguard
    for (const z of [-0.26, -0.33, -0.4]) box(0.078, 0.02, 0.045, 0, 0.005, z, 'o');
    cyl(0.016, 0.16, 0, 0.02, -0.54, 'm');
    box(0.04, 0.04, 0.06, 0, 0.02, -0.64, 'o'); // muzzle
    box(0.05, 0.012, 0.06, 0, 0.076, 0.06, 'm'); // red dot sight: base, thin frame and glass
    for (const x of [-0.023, 0.023]) box(0.004, 0.05, 0.008, x, 0.104, 0.035, 'm');
    box(0.05, 0.004, 0.008, 0, 0.131, 0.035, 'm');
    box(0.042, 0.046, 0.002, 0, 0.104, 0.035, 't');
    box(0.004, 0.004, 0.003, 0, 0.104, 0.033, 'd');
    box(0.05, 0.13, 0.07, 0, -0.11, -0.1, 'm', -0.2); // curved magazine
    box(0.05, 0.08, 0.07, 0, -0.2, -0.07, 'm', -0.4);
    box(0.045, 0.12, 0.06, 0, -0.1, 0.1, 'p', 0.3); // grip
    box(0.012, 0.012, 0.07, 0, -0.065, 0.03, 'm'); // trigger guard
    cyl(0.018, 0.1, 0, 0.02, 0.2, 'm'); // buffer tube
    box(0.06, 0.08, 0.18, 0, -0.01, 0.31, 'p');
    box(0.065, 0.11, 0.03, 0, -0.02, 0.41, 'r');
    box(0.072, 0.02, 0.1, 0, -0.025, -0.12, 'c'); // colour stripe
  },
  sniper(box, cyl) {
    box(0.07, 0.09, 0.5, 0, -0.01, 0.05, 'v'); // stock and body
    box(0.065, 0.06, 0.14, 0, -0.06, 0.24, 'v');
    box(0.06, 0.04, 0.18, 0, 0.055, 0.25, 'y'); // cheek rest
    box(0.072, 0.13, 0.03, 0, -0.03, 0.33, 'r');
    box(0.072, 0.02, 0.08, 0, -0.01, 0.18, 'c');
    box(0.06, 0.07, 0.22, 0, 0.035, -0.02, 'm'); // receiver
    box(0.08, 0.015, 0.015, 0.05, 0.05, 0.07, 's'); // bolt
    box(0.025, 0.025, 0.025, 0.09, 0.05, 0.07, 's');
    cyl(0.018, 0.55, 0, 0.04, -0.45, 'm'); // barrel
    box(0.045, 0.045, 0.08, 0, 0.04, -0.74, 'o'); // muzzle brake
    for (const z of [-0.72, -0.755]) box(0.047, 0.012, 0.012, 0, 0.04, z, 'm');
    for (const x of [-0.02, 0.02]) box(0.012, 0.012, 0.2, x, -0.025, -0.33, 'm'); // folded bipod
    box(0.045, 0.05, 0.07, 0, -0.07, -0.02, 'm'); // magazine
    box(0.045, 0.11, 0.06, 0, -0.09, 0.13, 'v', 0.3);
    box(0.012, 0.012, 0.06, 0, -0.06, 0.06, 'm');
    for (const z of [-0.1, 0.06]) box(0.05, 0.05, 0.025, 0, 0.085, z, 'o'); // rings
    cyl(0.032, 0.34, 0, 0.125, -0.02, 'o'); // scope
    cyl(0.042, 0.07, 0, 0.125, 0.17, 'o');
    cyl(0.046, 0.08, 0, 0.125, -0.22, 'o');
    cyl(0.04, 0.005, 0, 0.125, -0.263, 'g'); // lens
    box(0.03, 0.03, 0.03, 0, 0.17, -0.02, 'm'); // turrets
    box(0.03, 0.03, 0.03, 0.045, 0.125, -0.02, 'm');
  },
  shotgun(box, cyl) {
    box(0.08, 0.1, 0.26, 0, 0, 0, 'm'); // receiver
    box(0.082, 0.02, 0.08, 0, 0.02, -0.04, 'c');
    cyl(0.024, 0.6, 0, 0.03, -0.4, 's'); // barrel
    cyl(0.022, 0.46, 0, -0.025, -0.33, 'm'); // tube magazine
    box(0.088, 0.07, 0.2, 0, -0.02, -0.3, 'w'); // slide
    for (const z of [-0.37, -0.33, -0.29, -0.25]) box(0.09, 0.012, 0.02, 0, -0.02, z, 'x');
    box(0.012, 0.012, 0.012, 0, 0.06, -0.68, 'l'); // front sight
    for (let i = 0; i < 4; i++) {
      box(0.014, 0.034, 0.018, -0.046, 0.005, 0.07 - i * 0.03, 'e'); // spare shells
      box(0.015, 0.012, 0.019, -0.046, -0.017, 0.07 - i * 0.03, 'l');
    }
    box(0.012, 0.012, 0.07, 0, -0.065, 0.1, 'm');
    box(0.05, 0.11, 0.06, 0, -0.1, 0.17, 'w', 0.35); // grip
    box(0.07, 0.1, 0.24, 0, -0.04, 0.3, 'w', 0.12); // stock
    box(0.075, 0.13, 0.03, 0, -0.06, 0.43, 'r');
  },
  smg(box, cyl) {
    box(0.07, 0.1, 0.3, 0, 0, 0, 'p');
    box(0.05, 0.02, 0.24, 0, 0.06, 0, 'm');
    box(0.072, 0.02, 0.08, 0, -0.02, 0.06, 'c');
    box(0.05, 0.012, 0.06, 0, 0.072, 0.02, 'm'); // red dot sight: base, thin frame and glass
    for (const x of [-0.023, 0.023]) box(0.004, 0.05, 0.008, x, 0.1, -0.005, 'm');
    box(0.05, 0.004, 0.008, 0, 0.127, -0.005, 'm');
    box(0.042, 0.046, 0.002, 0, 0.1, -0.005, 't');
    box(0.004, 0.004, 0.003, 0, 0.1, -0.007, 'd');
    box(0.05, 0.055, 0.12, 0, 0.02, -0.21, 'q'); // barrel shroud
    cyl(0.014, 0.06, 0, 0.02, -0.3, 'm');
    box(0.045, 0.2, 0.06, 0, -0.15, -0.06, 'm'); // straight magazine
    box(0.035, 0.08, 0.035, 0, -0.08, -0.17, 'p'); // foregrip
    box(0.045, 0.11, 0.055, 0, -0.1, 0.09, 'p', 0.25);
    box(0.012, 0.012, 0.06, 0, -0.06, 0.03, 'm');
    for (const x of [-0.025, 0.025]) box(0.012, 0.012, 0.2, x, 0, 0.25, 'm'); // folding stock
    box(0.06, 0.08, 0.02, 0, -0.01, 0.35, 'r');
  },
  lmg(box, cyl) {
    box(0.11, 0.13, 0.4, 0, 0, 0, 'v');
    box(0.1, 0.03, 0.3, 0, 0.08, -0.02, 'm'); // cover
    for (const x of [-0.016, 0.016]) box(0.012, 0.035, 0.025, x, 0.11, 0.1, 'o'); // rear sight
    box(0.02, 0.05, 0.14, -0.062, 0.03, -0.06, 'o'); // carry handle folded to the side
    box(0.07, 0.07, 0.3, 0, 0.02, -0.35, 'm'); // perforated barrel shroud
    for (const z of [-0.26, -0.32, -0.38, -0.44])
      for (const x of [-0.036, 0.036]) box(0.004, 0.025, 0.025, x, 0.02, z, 'o');
    cyl(0.02, 0.18, 0, 0.02, -0.58, 's');
    box(0.05, 0.05, 0.07, 0, 0.02, -0.68, 'o');
    box(0.012, 0.08, 0.015, 0, 0.09, -0.47, 'm'); // front sight
    box(0.14, 0.14, 0.14, 0, -0.13, -0.04, 'y'); // ammo box
    box(0.142, 0.03, 0.142, 0, -0.1, -0.04, 'c');
    for (let i = 0; i < 4; i++) box(0.02, 0.026, 0.024, 0.066, -0.05 + i * 0.024, -0.02, 'l'); // ammo belt
    for (const x of [-0.025, 0.025]) box(0.014, 0.014, 0.22, x, -0.035, -0.36, 'o'); // bipod
    box(0.05, 0.12, 0.06, 0, -0.12, 0.13, 'v', 0.3);
    box(0.08, 0.11, 0.22, 0, -0.02, 0.33, 'v');
    box(0.085, 0.13, 0.03, 0, -0.025, 0.45, 'r');
  },
  pistol(box, cyl) {
    box(0.055, 0.06, 0.24, 0, 0.02, -0.04, 's'); // slide
    for (const z of [0.04, 0.055, 0.07]) box(0.057, 0.04, 0.007, 0, 0.022, z, 'm');
    box(0.05, 0.035, 0.2, 0, -0.025, -0.05, 'p'); // frame
    box(0.051, 0.012, 0.06, 0, -0.025, -0.1, 'c');
    cyl(0.012, 0.02, 0, 0.02, -0.165, 'o');
    box(0.048, 0.14, 0.065, 0, -0.1, 0.06, 'p', 0.2);
    box(0.05, 0.08, 0.045, 0, -0.1, 0.065, 'q', 0.2);
    box(0.012, 0.012, 0.06, 0, -0.055, -0.01, 'p');
    box(0.01, 0.015, 0.01, 0, 0.058, -0.15, 'o');
    for (const x of [-0.012, 0.012]) box(0.01, 0.015, 0.012, x, 0.058, 0.07, 'o');
  },
  knife(box) {
    box(0.03, 0.1, 0.035, 0, -0.04, 0.06, 'r', 0.15); // handle
    for (const y of [-0.07, -0.04, -0.01]) box(0.032, 0.008, 0.037, 0, y, 0.06, 'o');
    box(0.06, 0.014, 0.03, 0, 0.012, 0.03, 'm'); // guard
    box(0.006, 0.035, 0.2, 0, 0.022, -0.08, 's'); // blade
    box(0.007, 0.012, 0.06, 0, 0.038, -0.19, 's', -0.5); // tip
    box(0.008, 0.004, 0.2, 0, 0.005, -0.08, 'c'); // edge in the character colour
  },
  revolver(box, cyl) {
    cyl(0.02, 0.2, 0, 0.03, -0.17, 's'); // barrel
    box(0.02, 0.02, 0.2, 0, 0.052, -0.17, 's');
    box(0.03, 0.03, 0.14, 0, 0.002, -0.13, 'm');
    cyl(0.042, 0.08, 0, 0.012, -0.02, 'm', 6); // cylinder
    box(0.045, 0.08, 0.12, 0, 0.01, 0.03, 's'); // frame
    box(0.047, 0.015, 0.05, 0, -0.025, 0.03, 'c');
    box(0.015, 0.03, 0.03, 0, 0.06, 0.09, 'o'); // hammer
    box(0.012, 0.012, 0.06, 0, -0.045, 0.04, 's');
    box(0.045, 0.14, 0.06, 0, -0.075, 0.095, 'w', 0.35);
    box(0.01, 0.02, 0.012, 0, 0.07, -0.26, 'o');
  },
};

// Height (gun y) that sits at the centre of the screen while aiming: the red dot or the tip
// of the front sight. While aiming the HUD crosshair hides and this is what you aim with.
const SIGHT_Y: Record<WeaponId, number> = {
  knife: 0.02,
  rifle: 0.104,
  sniper: 0.125,
  shotgun: 0.064,
  smg: 0.1,
  lmg: 0.13,
  pistol: 0.0655,
  revolver: 0.08,
};

export interface GunModel extends THREE.Group {
  userData: { muzzleZ: number; sightY: number; flash?: THREE.Mesh };
}

export function buildGun(id: WeaponId, withFlash = false, tint = '#ffc93c'): GunModel {
  const draw = GUNS[id];
  const mats = gunMaterials(tint);
  const g = new THREE.Group() as GunModel;
  let muzzleZ = 0;
  const add = (geo: THREE.BufferGeometry, mat: GunMat, x: number, y: number, z: number, rx: number, half: number) => {
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
  g.userData.sightY = SIGHT_Y[id];
  if (withFlash) {
    const flash = new THREE.Mesh(new THREE.OctahedronGeometry(0.07), new THREE.MeshBasicMaterial({ color: 0xffd24a }));
    flash.position.set(0, 0.02, muzzleZ - 0.05);
    flash.visible = false;
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
