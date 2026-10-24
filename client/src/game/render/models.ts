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
        camo: { colors: ['#25272c', '#3c4048', '#17181b'], pattern: 'weave' },
        vest: '#2c3036',
        gear: '#0f1012',
        boot: '#121315',
        glove: '#18191c',
        metal: '#a3abb5',
      };
    case 'neon':
      return {
        ...common,
        // Black suit tinted with the outfit colour and glowing accents
        main: mix('#16131f', color, 0.08),
        pants: mix('#0e0c14', color, 0.04),
        vest: mix('#1e1a2a', color, 0.12),
        gear: '#100e17',
        boot: '#0c0b10',
        glove: '#14121b',
        visor: color,
        glow: 1.6,
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
    k.box(w + 0.01, 0.025, w + 0.02, 0, -0.03, 0, 'accent'); // strap
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
      // The forearms drop steeply out of the bottom of the screen instead of reaching back to the camera
      const rWrist = v3(0.03, -0.16, 0.17);
      const rElbow = v3(0.11, -0.46, 0.34);
      k.beam(rWrist, rElbow, 0.072, 0.076, 'main', 0.02); // sleeve
      k.beam(rWrist, rWrist.clone().lerp(rElbow, 0.14), 0.08, 0.084, 'gear'); // cuff
      k.beam(rWrist.clone().lerp(rElbow, 0.3), rWrist.clone().lerp(rElbow, 0.36), 0.076, 0.08, 'accent'); // band
      // Left hand
      const ly = long ? -0.065 : -0.13;
      const lx = long ? -0.035 : -0.05;
      k.box(0.085, 0.07, 0.12, lx, ly, lz, 'glove'); // palm under the gun
      k.box(0.03, 0.06, 0.1, lx + 0.045, ly + 0.035, lz - 0.01, 'glove'); // fingers over the side
      k.box(0.05, 0.012, 0.03, lx - 0.02, ly - 0.02, lz + 0.03, 'accent');
      const lWrist = v3(lx - 0.04, ly - 0.06, lz + 0.07);
      const lElbow = long ? v3(lx - 0.2, ly - 0.42, lz + 0.26) : v3(lx - 0.12, ly - 0.42, lz + 0.2);
      k.beam(lWrist, lElbow, 0.072, 0.076, 'main', 0.02);
      k.beam(lWrist, lWrist.clone().lerp(lElbow, 0.14), 0.08, 0.084, 'gear');
    },
    false,
  );
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
/** Red dot radius (m) on the LMG: a few pixels at aiming distance, so it never hides a target. */
const RETICLE_DOT_R = 0.0008;
// The rifle and SMG optics sit closer to the eye (see AIM_Z in viewModel.ts): smaller dots look the same size
const RIFLE_DOT_R = RETICLE_DOT_R * 0.77;
const SMG_DOT_R = RETICLE_DOT_R * 0.6;
const FRAME = 0.0032;

/**
 * Compact red dot on a riser: thin frame and a clear window, so aiming hides almost nothing.
 * `railY` = top of the rail it sits on, `z` = window position.
 */
function redDot(d: GunDraw, railY: number, z: number, riser: number, dotR = RETICLE_DOT_R): void {
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
  d.ring(0, dotR, 0, sightY, z + 0.004, 'd');
  d.sight(sightY);
}

/** Holographic sight: boxy hood, wide window and a plain dot reticle. */
function holoSight(d: GunDraw, railY: number, z: number, dotR: number): void {
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
  d.ring(0, dotR, 0, sightY, z + 0.004, 'd');
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
    holoSight(d, 0.0685, 0.02, RIFLE_DOT_R);
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
    redDot(d, 0.0545, 0.02, 0.034, SMG_DOT_R);
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
// TODO(review): posible código muerto: the HUD health blocks no longer use hpColor
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

  // Name in Inter 600 with a soft shadow and a thin health bar of the same colour (green ally, red enemy)
  const tint = color || '#ffffff';
  const draw = (hp: number) => {
    g.clearRect(0, 0, 256, 96);
    g.font = '600 26px Inter, system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.shadowColor = 'rgba(0, 0, 0, 0.85)';
    g.shadowBlur = 6;
    g.shadowOffsetY = 1;
    g.fillStyle = tint;
    g.fillText(text, 128, 34);
    g.shadowColor = 'transparent';
    g.fillStyle = 'rgba(9, 14, 21, 0.75)';
    g.fillRect(70, 60, 116, 8);
    g.fillStyle = tint;
    g.fillRect(72, 62, 112 * hp, 4);
    tex.needsUpdate = true;
  };
  draw(1);

  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: !throughWalls }),
  ) as unknown as NameTag;
  s.scale.set(1.4, 0.525, 1);
  if (throughWalls) s.renderOrder = 5;
  s.userData.setHp = (f: number) => {
    const q = Math.round(Math.max(0, Math.min(1, f)) * 50) / 50; // only redrawn when it changes
    if (q !== last) draw((last = q));
  };
  return s;
}
