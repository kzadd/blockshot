import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rng, type BoxKind, type GameMap, type MapBox, type MapId } from '@blockshot/shared'; // seeded random: the scenery is the same every time
import { FX, fxFrame } from './fxAtlas';
import { WorldModels } from './worldModels';

// =====================================================================
//  Map rendering. The boxes (collision) come from the shared package; here we only
//  decide how they look: canvas-painted textures for walls and floors, pack models for the props
//  (crates, containers, barrels, trees, cars… see worldModels.ts) and the scenery outside the walls,
//  which is decoration only. Meshes are merged per material and models instanced, so it runs smoothly.
// =====================================================================

// ------------------------------------------------------------ Textures
// Almost all are light grey with dark detail: the material (map.colors) adds the colour
const S = 256;
/** Texture seed: derived from the texture name, so every texture looks the same on every machine. */
const TEX_SEED_MULT = 7919;
const TEX_SEED_ADD = 13;
const ANISOTROPY = 8;
type Ctx = CanvasRenderingContext2D;
type Rand = () => number;
type TexName = keyof typeof GEN | PackTex;

function canvasTex(name: keyof typeof GEN): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  const rand = rng(name.length * TEX_SEED_MULT + TEX_SEED_ADD);
  GEN[name](g, rand);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = ANISOTROPY;
  return tex;
}
/** Cycles through a palette. */
const pick = <T>(list: readonly T[], i: number): T => list[i % list.length]!;
const gray = (v: number, a = 1): string => `rgba(${v | 0},${v | 0},${v | 0},${a})`;
function speckle(g: Ctx, rand: Rand, n: number, lo: number, hi: number, size = 2): void {
  for (let i = 0; i < n; i++) {
    g.fillStyle = gray(lo + rand() * (hi - lo));
    g.fillRect(rand() * S, rand() * S, size, size);
  }
}
function blotches(g: Ctx, rand: Rand, n: number, alpha: number, r0 = 10, r1 = 40, dark = true): void {
  for (let i = 0; i < n; i++) {
    const x = rand() * S;
    const y = rand() * S;
    const r = r0 + rand() * (r1 - r0);
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, dark ? `rgba(0,0,0,${alpha})` : `rgba(255,255,255,${alpha})`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

const GEN = {
  windows(g, rand) {
    g.fillStyle = gray(235);
    g.fillRect(0, 0, S, S);
    speckle(g, rand, 1500, 210, 250);
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 2; c++) {
        const x = 40 + c * 128;
        const y = 34 + r * 128;
        g.fillStyle = gray(90);
        g.fillRect(x - 4, y - 4, 56, 68);
        g.fillStyle = rand() < 0.3 ? '#f3e2a8' : '#5d7c96';
        g.fillRect(x, y, 48, 60);
        g.fillStyle = gray(90);
        g.fillRect(x + 22, y, 4, 60);
        g.fillRect(x, y + 28, 48, 4);
      }
    }
  },
  // Concrete cast in panels: seams and tie holes
  panels(g, rand) {
    g.fillStyle = gray(205);
    g.fillRect(0, 0, S, S);
    blotches(g, rand, 20, 0.05);
    speckle(g, rand, 900, 150, 235);
    g.fillStyle = 'rgba(0,0,0,0.16)';
    g.fillRect(0, S / 2 - 1, S, 2);
    g.fillRect(S / 2 - 1, 0, 2, S);
    g.fillStyle = 'rgba(255,255,255,0.18)';
    g.fillRect(0, S / 2 + 1, S, 1);
    for (const y of [S / 4, (3 * S) / 4]) {
      for (const x of [S / 8, (3 * S) / 8, (5 * S) / 8, (7 * S) / 8]) {
        g.fillStyle = gray(120, 0.55);
        g.beginPath();
        g.arc(x, y, 3, 0, Math.PI * 2);
        g.fill();
      }
    }
    // rain streaks
    for (let i = 0; i < 18; i++) {
      g.fillStyle = gray(0, 0.03 + rand() * 0.04);
      g.fillRect(rand() * S, 0, 2 + rand() * 6, S * (0.2 + rand() * 0.6));
    }
  },
  // Painted metal panels with seams and rivets
  metalPanel(g, rand) {
    g.fillStyle = gray(215);
    g.fillRect(0, 0, S, S);
    speckle(g, rand, 800, 190, 235, 1);
    blotches(g, rand, 10, 0.07, 10, 40);
    for (const x of [0, S / 2]) {
      g.fillStyle = 'rgba(0,0,0,0.3)';
      g.fillRect(x, 0, 3, S);
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.fillRect(x + 3, 0, 2, S);
      for (let y = 8; y < S; y += 32) {
        g.fillStyle = gray(130);
        g.fillRect(x + 8, y, 3, 3);
        g.fillRect(x + S / 2 - 11, y, 3, 3);
      }
    }
    g.fillStyle = 'rgba(0,0,0,0.12)';
    g.fillRect(0, S - 18, S, 18);
  },
  // Shutter slats
  louver(g) {
    g.fillStyle = gray(150);
    g.fillRect(0, 0, S, S);
    for (let y = 0; y < S; y += 16) {
      const grad = g.createLinearGradient(0, y, 0, y + 16);
      grad.addColorStop(0, gray(250));
      grad.addColorStop(1, gray(175));
      g.fillStyle = grad;
      g.fillRect(6, y + 2, S - 12, 12);
    }
  },
  // Awning stripes (the material colour tints the dark ones)
  stripes(g, rand) {
    for (let x = 0; x < S; x += 32) {
      g.fillStyle = (x / 32) % 2 ? gray(250) : gray(175);
      g.fillRect(x, 0, 32, S);
    }
    blotches(g, rand, 8, 0.06, 20, 50);
  },
  // Hazard stripes: already coloured (the material is white)
  hazard(g: Ctx) {
    g.fillStyle = '#e8b923';
    g.fillRect(0, 0, S, S);
    g.fillStyle = '#1c1f24';
    for (let i = -S; i < S * 2; i += 64) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i + 32, 0);
      g.lineTo(i + 32 - S, S);
      g.lineTo(i - S, S);
      g.fill();
    }
  },
} satisfies Record<string, (g: Ctx, rand: Rand) => void>;
const COLORED = new Set<string>(['hazard']);

/**
 * Surfaces from ambientCG (CC0, see ASSETS_CREDITS.md): photo textures turned light grey with their detail kept,
 * so the map colour tints them like the canvas ones (public/textures). The rest (windows, shutters, awnings, crates,
 * stripes…) are still drawn on a canvas.
 */
type PackTex = (typeof PACK)[number];
const PACK = [
  'concrete',
  'paving',
  'brick',
  'plaster',
  'planks',
  'corrugated',
  'diamond',
  'rock',
  'sand',
  'grass',
  'asphalt',
  'tiles',
  'gravel',
  'woodFloor',
] as const;
const PACK_TEX = new Set<string>(PACK);
const loader = new THREE.TextureLoader();
const texCache = new Map<string, THREE.Texture>();
function tex(name: TexName): THREE.Texture {
  let t = texCache.get(name);
  if (!t) {
    if (PACK_TEX.has(name)) {
      t = loader.load(`${import.meta.env.BASE_URL}textures/${name}.jpg`);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = ANISOTROPY;
    } else t = canvasTex(name as keyof typeof GEN);
    texCache.set(name, t);
  }
  return t;
}

// Look of each map: texture and metres per repetition. 0 = one texture per face (crates)
/** [texture, metres per repetition] · null texture = flat colour */
type Look = [TexName | null, number?];
const COMMON: Partial<Record<BoxKind, Look>> = {
  rail: ['hazard', 1],
  bridge: ['planks', 2],
  planter: ['concrete', 1.6],
  roof: ['planks', 2],
  bld1: ['plaster', 3],
  bld2: ['brick', 2.4],
  bld3: ['plaster', 3],
  bld4: ['concrete', 3],
  brick: ['brick', 2.4],
  plaster: ['plaster', 3],
  concrete: ['panels', 3],
  metal: ['metalPanel', 3],
  wood: ['woodFloor', 2],
  slab: ['gravel', 3],
  stair: ['concrete', 1.5],
  tile: ['tiles', 2],
  railing: [null],
  trim: ['concrete', 2],
  frame: [null],
  shutter: ['louver', 1],
  awning: ['stripes', 2],
};
interface Theme extends Partial<Record<BoxKind, Look>> {
  wall: Look;
  ground: [TexName, number, string];
  sun: number;
  sky: string;
  scenery: (batch: Batch, map: GameMap, rand: Rand, models: WorldModels) => void;
}

const THEMES: Record<MapId, Theme> = {
  patio: {
    floor: ['paving', 3],
    wall: ['brick', 2.4],
    wall2: ['plaster', 3],
    platform: ['concrete', 3],
    step: ['concrete', 2],
    ground: ['grass', 4, '#6f9a4a'],
    sun: 0xfff1d6,
    sky: '#5d9fe0',
    scenery: town,
  },
  almacen: {
    floor: ['concrete', 4],
    wall: ['corrugated', 3],
    platform: ['diamond', 2],
    step: ['diamond', 2],
    ground: ['asphalt', 5, '#7d7d78'],
    sun: 0xffffff,
    sky: '#7c95b0',
    scenery: industrial,
  },
  desfiladero: {
    floor: ['sand', 4],
    wall: ['rock', 6],
    wall2: ['plaster', 3],
    platform: ['rock', 6],
    step: ['planks', 2],
    ground: ['sand', 6, '#d9b98a'],
    sun: 0xffe0b0,
    sky: '#5f86c4',
    scenery: desert,
  },
  polvo: {
    floor: ['sand', 4],
    wall: ['plaster', 3],
    wall2: ['plaster', 3],
    platform: ['paving', 3],
    step: ['paving', 2],
    ground: ['sand', 6, '#d9bf90'],
    sun: 0xfff0d0,
    sky: '#6f9fd8',
    scenery: desert,
  },
  ciudad: {
    floor: ['asphalt', 5],
    wall: ['concrete', 4],
    platform: ['concrete', 2],
    step: ['concrete', 2],
    ground: ['asphalt', 5, '#6b6e74'],
    sun: 0xffffff,
    sky: '#5d8fd0',
    scenery: city,
  },
  obra: {
    floor: ['gravel', 3],
    wall: ['panels', 3],
    platform: ['planks', 2],
    step: ['concrete', 2],
    ground: ['gravel', 4, '#9a8f7c'],
    sun: 0xffe9cc,
    sky: '#6f9ccc',
    scenery: construction,
  },
};
const CAR_COLORS = ['#c0503e', '#3d6e9e', '#e8e4dc', '#2b2f36', '#c9a13a', '#4f7a45'];
const HOUSES = ['a', 'c', 'e', 'h', 'k', 'o'].map((k) => `world/u-building-type-${k}`);
const FACTORIES = ['a', 'c', 'e', 'g', 'k'].map((k) => `world/i-building-${k}`);
const TOWERS = ['a', 'b', 'c', 'd', 'e'].map((k) => `world/c-building-skyscraper-${k}`);
const BLOCKS = ['a', 'c', 'e', 'g', 'i'].map((k) => `world/c-low-detail-building-${k}`);
const CLOUDS = 14;
const CRANE_YELLOW = '#e9b824';

// Box with UVs scaled to its real size: the texture always has the same size
function tiledBox(w: number, h: number, d: number, tile: number | undefined): THREE.BoxGeometry {
  const geo = new THREE.BoxGeometry(w, h, d);
  if (!tile) return geo;
  const uv = geo.attributes.uv!;
  const dims: [number, number][] = [
    [d, h],
    [d, h],
    [w, d],
    [w, d],
    [w, h],
    [w, h],
  ];
  for (let f = 0; f < 6; f++) {
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, (uv.getX(i) * dims[f]![0]) / tile, (uv.getY(i) * dims[f]![1]) / tile);
    }
  }
  return geo;
}

// Box with UVs taken from world coordinates: the pieces of a wall split by doors and windows continue
// the same bricks, and every face keeps the real texture size
type Placed = Pick<MapBox, 'x' | 'y' | 'z' | 'w' | 'h' | 'd'>;
function worldBox(b: Placed, tile: number): THREE.BoxGeometry {
  const geo = new THREE.BoxGeometry(b.w, b.h, b.d);
  const pos = geo.attributes.position!;
  const nor = geo.attributes.normal!;
  const uv = geo.attributes.uv!;
  const cy = b.y + b.h / 2;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + b.x;
    const y = pos.getY(i) + cy;
    const z = pos.getZ(i) + b.z;
    const nx = nor.getX(i);
    const ny = nor.getY(i);
    const nz = nor.getZ(i);
    if (Math.abs(nx) > 0.5) uv.setXY(i, (-nx * z) / tile, y / tile);
    else if (Math.abs(nz) > 0.5) uv.setXY(i, (nz * x) / tile, y / tile);
    else uv.setXY(i, x / tile, (-ny * z) / tile);
  }
  return geo;
}

// Sky occlusion: surfaces with something above them (inside houses, under roofs and bridges) are darker
const INDOOR_SHADE = 0.62;
const OCCLUSION_CELL = 4;
/** How far from a surface the occlusion is sampled (m), so a box does not cover its own faces. */
const OCCLUSION_PROBE = 0.06;
type Shade = (x: number, y: number, z: number) => number;
function skyShade(boxes: readonly MapBox[]): Shade {
  const grid = new Map<number, MapBox[]>();
  const key = (i: number, j: number) => i * 4096 + j;
  for (const b of boxes) {
    if (b.c === 'floor' || b.c === 'pad' || b.p) continue;
    const i0 = Math.floor((b.x - b.w / 2) / OCCLUSION_CELL);
    const i1 = Math.floor((b.x + b.w / 2) / OCCLUSION_CELL);
    const j0 = Math.floor((b.z - b.d / 2) / OCCLUSION_CELL);
    const j1 = Math.floor((b.z + b.d / 2) / OCCLUSION_CELL);
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        const list = grid.get(key(i, j));
        if (list) list.push(b);
        else grid.set(key(i, j), [b]);
      }
    }
  }
  return (x, y, z) => {
    const list = grid.get(key(Math.floor(x / OCCLUSION_CELL), Math.floor(z / OCCLUSION_CELL)));
    if (!list) return 1;
    for (const b of list) {
      if (b.y > y && Math.abs(x - b.x) < b.w / 2 && Math.abs(z - b.z) < b.d / 2) return INDOOR_SHADE;
    }
    return 1;
  };
}

// Merges every part sharing a material into a single mesh
class Batch {
  private readonly parts = new Map<THREE.Material, THREE.BufferGeometry[]>();

  /** `shade` (optional) bakes a brightness per vertex into a colour attribute. */
  constructor(private readonly shade?: Shade) {}

  add(
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    x: number,
    y: number,
    z: number,
    ry = 0,
    sx = 1,
    sy = 1,
    sz = 1,
  ): void {
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry),
      new THREE.Vector3(sx, sy, sz),
    );
    const g = (geo.index ? geo.toNonIndexed() : geo.clone()).applyMatrix4(m);
    if (this.shade) {
      const pos = g.attributes.position!;
      const nor = g.attributes.normal!;
      const colors = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) {
        const v = this.shade(
          pos.getX(i) + nor.getX(i) * OCCLUSION_PROBE,
          pos.getY(i) + nor.getY(i) * OCCLUSION_PROBE,
          pos.getZ(i) + nor.getZ(i) * OCCLUSION_PROBE,
        );
        colors.fill(v, i * 3, i * 3 + 3);
      }
      g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    }
    const list = this.parts.get(mat);
    if (list) list.push(g);
    else this.parts.set(mat, [g]);
  }
  build(scene: THREE.Scene, { cast = false, receive = false } = {}): void {
    for (const [mat, list] of this.parts) {
      const mesh = new THREE.Mesh(mergeGeometries(list), mat);
      mesh.castShadow = cast;
      mesh.receiveShadow = receive;
      mesh.matrixAutoUpdate = false;
      scene.add(mesh);
      for (const g of list) g.dispose();
    }
  }
}

const matCache = new Map<string, THREE.MeshLambertMaterial>();
function mat(
  color: string,
  texName: TexName | null | undefined,
  extra: THREE.MeshLambertMaterialParameters = {},
): THREE.MeshLambertMaterial {
  const key = `${color}|${texName}|${JSON.stringify(extra)}`;
  let m = matCache.get(key);
  if (!m) {
    const map = texName ? tex(texName) : null;
    m = new THREE.MeshLambertMaterial({ color: texName && COLORED.has(texName) ? '#ffffff' : color, map, ...extra });
    matCache.set(key, m);
  }
  return m;
}
const glow = (color: string): THREE.MeshLambertMaterial => mat(color, null, { emissive: color, emissiveIntensity: 1 });

const BOX = new THREE.BoxGeometry(1, 1, 1);
const CONE4 = new THREE.ConeGeometry(0.71, 1, 4);
const BLOB = new THREE.IcosahedronGeometry(0.5, 1);

// ------------------------------------------------------------ Props: pack models (worldModels.ts)
const TREES = ['world/n-tree_oak', 'world/n-tree_detailed', 'world/n-tree_default'];
const CARS = ['world/q-car-sedan', 'world/q-car-hatch', 'world/q-car-suv'];
const BARRELS = ['#3d6e9e', '#b04a3a', '#c9a13a', '#4f7a45'];
/** Spot of a tree: its height (m) in the arena; outside they are bigger. */
const TREE_H = 5.2;

type PropBox = Pick<MapBox, 'x' | 'y' | 'z' | 'w' | 'h' | 'd' | 'c'>;
/** Props drawn with a pack model (false: drawn as a box). The model fills the prop's collision box. */
function addProp(models: WorldModels, b: PropBox, rand: Rand, i: number): boolean {
  const at = { x: b.x, y: b.y, z: b.z, w: b.w, h: b.h, d: b.d };
  // Containers, cars and pallets lie along their longer side; the models run along z
  const turn = b.w > b.d ? Math.PI / 2 : 0;
  const along = turn ? { w: b.d, d: b.w } : {};
  switch (b.c) {
    case 'barrel':
      models.add('world/s-barrel', { ...at, ry: rand() * 6, tint: pick(BARRELS, i) });
      return true;
    case 'trunk':
      models.add(pick(TREES, i), { ...at, h: TREE_H * (0.85 + rand() * 0.3), fit: 'height', ry: rand() * 6 });
      return true;
    case 'lamp':
      models.add('world/q-lamp', { ...at, h: b.h + 0.4, fit: 'height', ry: rand() < 0.5 ? 0 : Math.PI });
      return true;
    case 'car':
      models.add(pick(CARS, i), { ...at, ...along, h: b.h + 0.75, ry: turn, tint: pick(CAR_COLORS, i) });
      return true;
    case 'carTop':
      return true; // the car model already has its roof
    case 'cactus':
      models.add('world/n-cactus_tall', { ...at, h: b.h, fit: 'height', ry: rand() * 6 });
      return true;
    case 'crate':
    case 'crate2':
      models.add(b.c === 'crate' ? 'world/q-crate' : 'world/q-crate2', {
        ...at,
        ry: Math.round(rand() * 4) * (Math.PI / 2),
      });
      return true;
    case 'cont1':
    case 'cont2':
    case 'cont3':
      models.add(`world/i-shipping-container-${'abc'[Number(b.c[4]) - 1]}`, { ...at, ...along, ry: turn });
      return true;
    case 'pallet':
      models.add('world/q-pallet', { ...at, ...along, ry: turn });
      return true;
    case 'sandbag':
      models.add('props/sacks', { ...at, ...along, ry: turn });
      return true;
    case 'rock':
      models.add(rand() < 0.5 ? 'world/s-rock-sand-a' : 'world/s-rock-sand-b', {
        ...at,
        ry: Math.round(rand() * 4) * (Math.PI / 2),
      });
      return true;
    default:
      return false;
  }
}

// ------------------------------------------------------------ Windows: Quaternius's windows (CC0, Poly Pizza)
/** A closed facade window (decor 'shutter' box): a window model in its place, facing out of the wall. */
function addWindow(models: WorldModels, b: MapBox): void {
  const facesX = b.w < b.d;
  models.add(b.h > b.w + 0.4 || b.h > b.d + 0.4 ? 'world/q-window-small' : 'world/q-window-large', {
    x: b.x,
    y: b.y,
    z: b.z,
    w: facesX ? b.d : b.w,
    h: b.h,
    d: WINDOW_DEPTH,
    ry: facesX ? Math.PI / 2 : 0,
  });
}

/**
 * Windows on every free face of a solid block of flats: a row per story, spread along the face. A face against
 * another box (a neighbour, the outer wall) gets none.
 */
const STORY_H = 3;
const WINDOW_W = 1.2;
const WINDOW_H = 1.5;
const WINDOW_SILL = 1.1;
const WINDOW_GAP = 2.8;
const WINDOW_DEPTH = 0.12;
function facadeWindows(models: WorldModels, b: MapBox, boxes: readonly MapBox[]): void {
  const blocked = (x: number, y: number, z: number) =>
    boxes.some(
      (o) => o !== b && Math.abs(x - o.x) < o.w / 2 && Math.abs(z - o.z) < o.d / 2 && y > o.y && y < o.y + o.h,
    );
  const file = b.c === 'bld2' || b.c === 'bld4' ? 'world/q-window-small' : 'world/q-window-large';
  for (const [nx, nz] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const) {
    const along = nx ? b.d : b.w;
    const n = Math.floor((along - 1) / WINDOW_GAP);
    if (n < 1) continue;
    for (let y = b.y + WINDOW_SILL; y + WINDOW_H < b.y + b.h - 0.5; y += STORY_H) {
      for (let i = 0; i < n; i++) {
        const a = -along / 2 + (i + 0.5) * (along / n);
        const x = b.x + (nx ? (nx * b.w) / 2 : a);
        const z = b.z + (nz ? (nz * b.d) / 2 : a);
        if (blocked(x + nx * 0.3, y + WINDOW_H / 2, z + nz * 0.3)) continue;
        models.add(file, {
          x: x + nx * (WINDOW_DEPTH / 2 - 0.02),
          y,
          z: z + nz * (WINDOW_DEPTH / 2 - 0.02),
          w: WINDOW_W,
          h: WINDOW_H,
          d: WINDOW_DEPTH,
          ry: nx ? Math.PI / 2 : 0,
        });
      }
    }
  }
}

// Railings: a solid box for collisions, drawn as a top rail, a foot rail and thin posts
const RAIL_BAR = 0.06;
const RAIL_POST = 0.04;
const RAIL_POST_GAP = 0.3;
function addRailing(batch: Batch, b: PropBox, color: string): void {
  const metal = mat(color, null);
  const alongX = b.w >= b.d;
  const len = alongX ? b.w : b.d;
  const thick = Math.min(alongX ? b.d : b.w, RAIL_BAR);
  const bar = (y: number, h: number) =>
    batch.add(BOX, metal, b.x, y, b.z, 0, alongX ? len : thick, h, alongX ? thick : len);
  bar(b.y + b.h - RAIL_BAR / 2, RAIL_BAR);
  bar(b.y + 0.12, RAIL_BAR * 0.7);
  const posts = Math.max(1, Math.round(len / RAIL_POST_GAP));
  for (let i = 0; i <= posts; i++) {
    const a = -len / 2 + (len * i) / posts;
    const big = i === 0 || i === posts;
    const s = big ? RAIL_BAR : RAIL_POST;
    batch.add(BOX, metal, b.x + (alongX ? a : 0), b.y + b.h / 2, b.z + (alongX ? 0 : a), 0, s, b.h, s);
  }
}

// ------------------------------------------------------------ Sky and clouds
function addSky(scene: THREE.Scene, map: GameMap, theme: Theme): void {
  const R = map.half * 7;
  const geo = new THREE.SphereGeometry(R, 32, 16);
  const top = new THREE.Color(theme.sky);
  const horizon = new THREE.Color(map.sky);
  const colors: number[] = [];
  const pos = geo.attributes.position!;
  for (let i = 0; i < pos.count; i++) {
    const t = Math.max(0, pos.getY(i) / R);
    const c = horizon.clone().lerp(top, Math.pow(t, 0.6));
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const sky = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }),
  );
  sky.renderOrder = -1;
  scene.add(sky);

  // Sun
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(R * 0.04, 24),
    new THREE.MeshBasicMaterial({ color: 0xfff6dc, fog: false }),
  );
  sun.position
    .set(0.45, 0.75, 0.3)
    .normalize()
    .multiplyScalar(R * 0.9);
  sun.lookAt(0, 0, 0);
  scene.add(sun);

  // Clouds: a few of Kenney's white puffs each, high up (no fog: they belong to the sky)
  const rand = rng(map.half * 31 + map.id.length);
  for (let i = 0; i < CLOUDS; i++) {
    const a = rand() * Math.PI * 2;
    const r = map.half * (1 + rand() * 3);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const y = 80 + rand() * 40;
    const n = 4 + Math.floor(rand() * 3);
    for (let k = 0; k < n; k++) {
      const puff = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: fxFrame(FX.puff[(i + k) % FX.puff.length]!),
          color: 0xffffff,
          transparent: true,
          opacity: 0.75,
          depthWrite: false,
          fog: false,
          rotation: rand() * Math.PI * 2,
        }),
      );
      puff.position.set(x + (rand() - 0.5) * 40, y + rand() * 6, z + (rand() - 0.5) * 24);
      puff.scale.setScalar(30 + rand() * 24);
      scene.add(puff);
    }
  }
}

// ------------------------------------------------------------ Scenery outside the walls
// Random point outside the arena, between `near` and `far` metres from the wall
/** A centre outside the arena, with the whole footprint (`radius` from the centre) at least `near` past the walls. */
function outside(rand: Rand, H: number, near: number, far: number, radius = 0): [number, number] {
  for (;;) {
    const x = (rand() * 2 - 1) * (H + far);
    const z = (rand() * 2 - 1) * (H + far);
    if (Math.max(Math.abs(x), Math.abs(z)) > H + near + radius) return [x, z];
  }
}

function town(batch: Batch, map: GameMap, rand: Rand, models: WorldModels): void {
  const H = map.half;
  for (let i = 0; i < 70; i++) {
    const [x, z] = outside(rand, H, 3, 45);
    models.add(pick(TREES, i), { x, y: 0, z, w: 1, h: 6.5 + rand() * 4, d: 1, fit: 'height', ry: rand() * 6 });
  }
  // Kenney's suburban houses round the yard
  for (let i = 0; i < 18; i++) {
    const [x, z] = outside(rand, H, 12, 55, 6);
    const ry = Math.round(rand() * 4) * (Math.PI / 2);
    models.add(pick(HOUSES, i), { x, y: 0, z, w: 1, h: 7 + rand() * 3, d: 1, fit: 'height', ry });
  }
  hills(batch, map, rand, '#5f8f45');
}

function industrial(batch: Batch, map: GameMap, rand: Rand, models: WorldModels): void {
  const H = map.half;
  // Warehouse roof structure: trusses and hanging lights
  const steel = mat('#4a5562', null);
  const y = map.wallH + 0.4;
  for (let x = -H + 4; x < H; x += 8) {
    batch.add(BOX, steel, x, y, 0, 0, 0.35, 0.7, 2 * H + 1);
    for (let z = -H + 10; z < H - 4; z += 14) {
      batch.add(BOX, mat('#2b2f36', null), x, y - 0.5, z, 0, 0.04, 0.9, 0.04);
      batch.add(CONE4, mat('#3a4048', null), x, y - 1.2, z, Math.PI / 4, 1.1, 0.6, 1.1);
      batch.add(BOX, glow('#fff6d6'), x, y - 1.52, z, 0, 0.6, 0.05, 0.6);
    }
  }
  for (const z of [-H / 2, 0, H / 2]) batch.add(BOX, steel, 0, y + 0.5, z, 0, 2 * H + 1, 0.35, 0.35);
  // Kenney's factories, tanks and chimneys around
  for (let i = 0; i < 16; i++) {
    const h = 10 + rand() * 8;
    const [x, z] = outside(rand, H, 8, 60, h * 1.2);
    models.add(pick(FACTORIES, i), {
      x,
      y: 0,
      z,
      w: 1,
      h,
      d: 1,
      fit: 'height',
      ry: Math.round(rand() * 4) * (Math.PI / 2),
    });
  }
  for (let i = 0; i < 6; i++) {
    const [x, z] = outside(rand, H, 20, 60);
    models.add(i % 3 ? 'world/i-chimney-large' : 'world/i-water-tower', {
      x,
      y: 0,
      z,
      w: 1,
      h: 22 + rand() * 18,
      d: 1,
      fit: 'height',
    });
  }
}

function desert(_batch: Batch, map: GameMap, rand: Rand, models: WorldModels): void {
  const H = map.half;
  const rockCols = ['#e0a070', '#c98a5a', '#e8b07a', '#c27a52'];
  // Mesas and buttes: Kenney's tall rocks stretched big and tinted to the desert's rock
  for (let i = 0; i < 22; i++) {
    const w = 18 + rand() * 30;
    const d = 18 + rand() * 30;
    const h = 12 + rand() * 30;
    const [x, z] = outside(rand, H, 15, 110, Math.hypot(w, d) / 2);
    const ry = rand() * 3;
    const tint = pick(rockCols, i);
    models.add(i % 2 ? 'world/n-rock_tallA' : 'world/n-rock_tallC', { x, y: 0, z, w, h: h + 6, d, ry, tint });
  }
  for (let i = 0; i < 40; i++) {
    const [x, z] = outside(rand, H, 2, 50);
    models.add(i % 3 ? 'world/n-cactus_tall' : 'world/n-cactus_short', {
      x,
      y: 0,
      z,
      w: 1,
      h: 2 + rand() * 1.6,
      d: 1,
      fit: 'height',
      ry: rand() * 6,
    });
  }
  for (let i = 0; i < 16; i++) {
    const [x, z] = outside(rand, H, 4, 40);
    const s = 1.5 + rand() * 3;
    models.add(i % 2 ? 'world/n-rock_largeA' : 'world/n-rock_largeC', {
      x,
      y: 0,
      z,
      w: s * 2,
      h: s * 0.8,
      d: s * 2,
      ry: rand() * 6,
      tint: pick(rockCols, i),
    });
  }
}

function city(_batch: Batch, map: GameMap, rand: Rand, models: WorldModels): void {
  const H = map.half;
  // Kenney's towers and blocks: tall ones further out
  for (let i = 0; i < 40; i++) {
    const h = 16 + rand() * 45;
    const [x, z] = outside(rand, H, 6, 70, h * 0.18 + 4);
    const tall = h > 34;
    models.add(tall ? pick(TOWERS, i) : pick(BLOCKS, i), {
      x,
      y: 0,
      z,
      w: 1,
      h,
      d: 1,
      fit: 'height',
      ry: Math.round(rand() * 4) * (Math.PI / 2),
    });
  }
}

// Around the site: more concrete skeletons, tower cranes and the city behind
function construction(batch: Batch, map: GameMap, rand: Rand, models: WorldModels): void {
  const H = map.half;
  city(batch, map, rand, models);
  const concrete = mat('#b3afa6', 'concrete');
  for (let i = 0; i < 5; i++) {
    const [x, z] = outside(rand, H, 14, 40);
    const floors = 3 + Math.floor(rand() * 4);
    const w = 12 + rand() * 8;
    for (let f = 1; f <= floors; f++) batch.add(BOX, concrete, x, f * 3.2, z, 0, w, 0.35, w);
    for (const cx of [-1, 1]) {
      for (const cz of [-1, 1]) {
        batch.add(
          BOX,
          concrete,
          x + (cx * (w - 1)) / 2,
          (floors * 3.2) / 2,
          z + (cz * (w - 1)) / 2,
          0,
          0.8,
          floors * 3.2,
          0.8,
        );
      }
    }
  }
  // Tower cranes from pack parts: lakescorp's scaffolding truss as mast and jib (painted crane yellow), cg_world's
  // hook on its cable at the tip, and Kenney's concrete barriers as the counterweight
  for (let i = 0; i < 3; i++) {
    const [x, z] = outside(rand, H, 20, 55);
    const h = 30 + rand() * 12;
    const ry = rand() * Math.PI;
    const ax = Math.cos(ry);
    const az = -Math.sin(ry);
    const yellow = CRANE_YELLOW;
    models.add('world/lk-truss', { x, y: h / 2, z, w: 1.6, h: 1.6, d: h, rx: -Math.PI / 2, tint: yellow });
    models.add('world/lk-truss', {
      x: x + ax * 10,
      y: h,
      z: z + az * 10,
      w: 1.2,
      h: 1.2,
      d: 30,
      ry: ry + Math.PI / 2,
      tint: yellow,
    });
    models.add('world/cw-crane-hook', {
      x: x + ax * 22,
      y: h * 0.35,
      z: z + az * 22,
      w: 1,
      h: h * 0.65,
      d: 1,
      fit: 'height',
    });
    models.add('world/r-construction-barrier', {
      x: x - ax * 4,
      y: h + 0.6,
      z: z - az * 4,
      w: 1.6,
      h: 1.6,
      d: 3,
      ry: ry + Math.PI / 2,
    });
  }
}

function hills(batch: Batch, map: GameMap, rand: Rand, color: string): void {
  const H = map.half;
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + rand() * 0.3;
    const r = H * 3 + rand() * H;
    const s = H * (0.9 + rand() * 0.8);
    batch.add(BLOB, mat(color, 'grass'), Math.cos(a) * r, -s * 0.15, Math.sin(a) * r, 0, s * 2, s * 0.7, s * 2);
  }
}

// 1 m boxes with the texture repeated `n` times per face (scaled when added)
const unitBoxes = new Map<number, THREE.BoxGeometry>();
function tiledBoxCached(n: number): THREE.BoxGeometry {
  let geo = unitBoxes.get(n);
  if (!geo) unitBoxes.set(n, (geo = tiledBox(1, 1, 1, 1 / n)));
  return geo;
}

// ------------------------------------------------------------ World
// Lights (tuned for ACES tone mapping): sky fill from above, warm bounce from the ground, and the sun
const SKY_LIGHT = 0xdcecff;
const GROUND_LIGHT = 0xb3a68e;
const HEMI_INTENSITY = 1.4;
const SUN_INTENSITY = 2.3;
/** Step caps: a lighter slab on each step, a hair above it and sticking out a little (a nosing). */
const STEP_CAP_H = 0.05;
const STEP_CAP_LIFT = 0.005;
const STEP_NOSING = 0.03;
const STEP_CAP_TINT = 1.18;
export function buildWorld(scene: THREE.Scene, map: GameMap, shadowMap = 2048): void {
  const H = map.half;
  const theme = THEMES[map.id];
  scene.background = new THREE.Color(map.sky);
  scene.fog = new THREE.Fog(map.sky, H * 1.9, H * 5);

  scene.add(new THREE.HemisphereLight(SKY_LIGHT, GROUND_LIGHT, HEMI_INTENSITY));
  const sun = new THREE.DirectionalLight(theme.sun, SUN_INTENSITY);
  sun.position.set(30, 50, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(shadowMap, shadowMap);
  Object.assign(sun.shadow.camera, { left: -H - 8, right: H + 8, top: H + 8, bottom: -H - 8, near: 1, far: H * 4 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);
  addSky(scene, map, theme);

  const rand = rng(H * 97 + map.id.length);
  const arena = new Batch(skyShade(map.boxes));
  const props = new Batch();
  const models = new WorldModels(true);
  const solid = (b: MapBox, tint?: string) => {
    const [texName, tile] = theme[b.c] || COMMON[b.c] || theme.wall;
    const color = tint ?? (map.colors[b.c] || map.colors.wall);
    const geo = tile ? worldBox(b, tile) : tiledBox(b.w, b.h, b.d, tile);
    arena.add(geo, mat(color, texName, { vertexColors: true }), b.x, b.y + b.h / 2, b.z);
  };
  let n = 0;
  for (const b of map.boxes) {
    if (addProp(models, b, rand, b.c === 'car' || b.c === 'barrel' || b.c === 'trunk' ? ++n : n)) continue;
    if (b.c === 'railing') {
      addRailing(props, b, map.colors.railing ?? map.colors.wall);
      continue;
    }
    // Jump pad: dark base and glowing green top
    if (b.c === 'pad') {
      props.add(BOX, mat('#2b2f36', 'diamond'), b.x, b.y + b.h * 0.35, b.z, 0, b.w, b.h * 0.7, b.d);
      props.add(BOX, glow(map.colors.pad!), b.x, b.y + b.h * 0.85, b.z, 0, b.w - 0.25, b.h * 0.3, b.d - 0.25);
      props.add(BOX, glow('#eafff2'), b.x, b.y + b.h + 0.005, b.z, Math.PI / 4, 0.5, 0.01, 0.5);
      continue;
    }
    // Buildings: rooftop with a concrete coping and the pack's windows on their faces
    if (b.c.startsWith('bld')) {
      props.add(BOX, mat('#7d7f84', 'concrete'), b.x, b.y + b.h + 0.15, b.z, 0, b.w + 0.3, 0.3, b.d + 0.3);
      facadeWindows(models, b, map.boxes);
    }
    solid(b);
    // Steps: a lighter cap on top so every step reads on its own
    if (b.c === 'stair' || b.c === 'step') {
      const cap = new THREE.Color(map.colors[b.c] ?? map.colors.wall).multiplyScalar(STEP_CAP_TINT).getStyle();
      solid(
        { ...b, y: b.y + b.h + STEP_CAP_LIFT - STEP_CAP_H, h: STEP_CAP_H, w: b.w + STEP_NOSING, d: b.d + STEP_NOSING },
        cap,
      );
    }
  }
  for (const b of map.decor) {
    if (b.c === 'shutter') addWindow(models, b);
    else solid(b);
  }
  arena.build(scene, { cast: true, receive: true });
  props.build(scene, { cast: true, receive: true });

  // Coping on the outer walls
  const deco = new Batch();
  const trim = mat(new THREE.Color(map.colors.wall).multiplyScalar(0.7).getStyle(), 'concrete');
  for (const s of [1, -1]) {
    deco.add(tiledBoxCached(2), trim, 0, map.wallH + 0.15, s * (H + 0.5), 0, 2 * H + 2.4, 0.3, 1.4);
    deco.add(tiledBoxCached(2), trim, s * (H + 0.5), map.wallH + 0.15, 0, 0, 1.4, 0.3, 2 * H + 2.4);
  }
  deco.build(scene, { cast: true, receive: true });

  // Outside ground and scenery
  const [gTex, gTile, gColor] = theme.ground;
  const R = H * 14;
  const ground = new THREE.PlaneGeometry(R, R);
  ground.rotateX(-Math.PI / 2);
  const uv = ground.attributes.uv!;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * R) / gTile, (uv.getY(i) * R) / gTile);
  const gm = new THREE.Mesh(ground, mat(gColor, gTex));
  gm.position.y = -0.03;
  scene.add(gm);

  models.build(scene);
  const scenery = new Batch();
  // Outside the walls: no shadows (the sun's shadow map only covers the arena)
  const far = new WorldModels(false);
  theme.scenery(scenery, map, rng(H * 131 + map.id.length * 7), far);
  scenery.build(scene);
  far.build(scene);
}
