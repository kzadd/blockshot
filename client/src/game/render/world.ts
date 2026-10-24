import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rng, type BoxKind, type GameMap, type MapBox, type MapColors, type MapId } from '@blockshot/shared'; // seeded random: the scenery is the same every time

// =====================================================================
//  Map rendering. The boxes (collision) come from the shared package; here we only
//  decide how they look: canvas-painted textures, props with their own shape
//  (barrels, trees, lamps, cacti) and the scenery outside the walls,
//  which is decoration only. Meshes are merged per material so it runs smoothly.
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
type TexName = keyof typeof GEN;

function canvasTex(name: TexName): THREE.CanvasTexture {
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
  concrete(g, rand) {
    g.fillStyle = gray(222);
    g.fillRect(0, 0, S, S);
    speckle(g, rand, 3500, 195, 245);
    blotches(g, rand, 30, 0.06);
    g.strokeStyle = 'rgba(0,0,0,0.18)';
    g.lineWidth = 2;
    g.strokeRect(1, 1, S - 2, S - 2);
  },
  paving(g, rand) {
    g.fillStyle = gray(150);
    g.fillRect(0, 0, S, S);
    const n = 4;
    const t = S / n;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n * 2; c++) {
        const off = r % 2 ? t / 2 : 0;
        const x = c * t * 0.5 * 2 - off;
        g.fillStyle = gray(205 + rand() * 35);
        g.fillRect(x + 3, r * t + 3, t - 6, t - 6);
      }
    }
    speckle(g, rand, 2500, 180, 240);
    blotches(g, rand, 18, 0.07);
  },
  brick(g, rand) {
    g.fillStyle = gray(205);
    g.fillRect(0, 0, S, S);
    const rows = 8;
    const h = S / rows;
    const w = S / 4;
    for (let r = 0; r < rows; r++) {
      const off = r % 2 ? w / 2 : 0;
      for (let c = -1; c < 5; c++) {
        const v = 170 + rand() * 60;
        g.fillStyle = gray(v);
        g.fillRect(c * w + off + 3, r * h + 3, w - 6, h - 6);
        g.fillStyle = gray(v - 35, 0.5);
        g.fillRect(c * w + off + 3, r * h + h - 7, w - 6, 4);
      }
    }
    speckle(g, rand, 2500, 140, 230);
    blotches(g, rand, 10, 0.08);
  },
  plaster(g, rand) {
    g.fillStyle = gray(232);
    g.fillRect(0, 0, S, S);
    speckle(g, rand, 3000, 205, 250);
    blotches(g, rand, 26, 0.07, 15, 60);
    g.strokeStyle = 'rgba(0,0,0,0.22)';
    g.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      let x = rand() * S;
      let y = rand() * S;
      g.beginPath();
      g.moveTo(x, y);
      for (let k = 0; k < 6; k++) g.lineTo((x += (rand() - 0.5) * 30), (y += rand() * 18));
      g.stroke();
    }
  },
  planks(g, rand) {
    const n = 4;
    const h = S / n;
    for (let i = 0; i < n; i++) {
      g.fillStyle = gray(190 + rand() * 50);
      g.fillRect(0, i * h, S, h);
      g.strokeStyle = 'rgba(0,0,0,0.09)';
      for (let k = 0; k < 14; k++) {
        const y = i * h + rand() * h;
        g.beginPath();
        g.moveTo(0, y);
        g.bezierCurveTo(S / 3, y + (rand() - 0.5) * 8, (2 * S) / 3, y + (rand() - 0.5) * 8, S, y);
        g.stroke();
      }
      g.fillStyle = 'rgba(0,0,0,0.45)';
      g.fillRect(0, i * h, S, 3);
      g.fillStyle = 'rgba(0,0,0,0.5)';
      for (const x of [10, S - 14]) g.fillRect(x, i * h + h / 2 - 2, 4, 4);
    }
  },
  crate(g, rand) {
    GEN.planks(g, rand);
    g.fillStyle = 'rgba(0,0,0,0.0)';
    g.strokeStyle = 'rgba(60,40,20,0.55)';
    g.lineWidth = 22;
    g.strokeRect(11, 11, S - 22, S - 22);
    g.lineWidth = 20;
    g.beginPath();
    g.moveTo(22, S - 22);
    g.lineTo(S - 22, 22);
    g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.18)';
    g.lineWidth = 3;
    g.strokeRect(22, 22, S - 44, S - 44);
  },
  corrugated(g, rand) {
    const w = 16;
    for (let x = 0; x < S; x += w) {
      const grad = g.createLinearGradient(x, 0, x + w, 0);
      grad.addColorStop(0, gray(170));
      grad.addColorStop(0.5, gray(240));
      grad.addColorStop(1, gray(165));
      g.fillStyle = grad;
      g.fillRect(x, 0, w, S);
    }
    blotches(g, rand, 14, 0.12, 6, 30);
    speckle(g, rand, 1200, 120, 200, 1);
  },
  diamond(g, rand) {
    g.fillStyle = gray(200);
    g.fillRect(0, 0, S, S);
    speckle(g, rand, 1500, 170, 225);
    for (let y = 0; y < S; y += 16) {
      for (let x = (y / 16) % 2 ? 8 : 0; x < S; x += 16) {
        g.save();
        g.translate(x + 4, y + 8);
        g.rotate(((y / 16) % 2 ? 1 : -1) * 0.7);
        g.fillStyle = gray(240);
        g.fillRect(-5, -1.5, 10, 3);
        g.fillStyle = gray(130, 0.6);
        g.fillRect(-5, 1.5, 10, 1.5);
        g.restore();
      }
    }
  },
  rock(g, rand) {
    g.fillStyle = gray(210);
    g.fillRect(0, 0, S, S);
    blotches(g, rand, 60, 0.1, 8, 45);
    blotches(g, rand, 30, 0.15, 8, 35, false);
    // rock strata
    for (let i = 0; i < 9; i++) {
      let y = rand() * S;
      g.strokeStyle = `rgba(0,0,0,${0.08 + rand() * 0.12})`;
      g.lineWidth = 1 + rand() * 3;
      g.beginPath();
      g.moveTo(0, y);
      for (let x = 0; x <= S; x += 16) g.lineTo(x, (y += (rand() - 0.5) * 5));
      g.stroke();
    }
    speckle(g, rand, 2500, 150, 245);
  },
  sand(g, rand) {
    g.fillStyle = gray(228);
    g.fillRect(0, 0, S, S);
    speckle(g, rand, 6000, 200, 250, 1.5);
    blotches(g, rand, 20, 0.05, 20, 70);
    g.strokeStyle = 'rgba(0,0,0,0.06)';
    g.lineWidth = 2;
    for (let i = 0; i < 10; i++) {
      const y = rand() * S;
      g.beginPath();
      g.moveTo(0, y);
      g.bezierCurveTo(S / 3, y - 10, (2 * S) / 3, y + 10, S, y);
      g.stroke();
    }
  },
  grass(g, rand) {
    g.fillStyle = gray(200);
    g.fillRect(0, 0, S, S);
    blotches(g, rand, 40, 0.1, 15, 50);
    for (let i = 0; i < 5000; i++) {
      g.fillStyle = gray(150 + rand() * 105);
      g.fillRect(rand() * S, rand() * S, 1.5, 3 + rand() * 3);
    }
  },
  asphalt(g, rand) {
    g.fillStyle = gray(180);
    g.fillRect(0, 0, S, S);
    speckle(g, rand, 7000, 130, 230, 1.5);
    blotches(g, rand, 20, 0.08, 20, 60);
  },
  sandbag(g, rand) {
    g.fillStyle = gray(110);
    g.fillRect(0, 0, S, S);
    const rows = 4;
    const h = S / rows;
    for (let r = 0; r < rows; r++) {
      const off = r % 2 ? S / 4 : 0;
      for (let c = -1; c < 2; c++) {
        const x = c * (S / 2) + off;
        const grad = g.createLinearGradient(0, r * h, 0, r * h + h);
        grad.addColorStop(0, gray(245));
        grad.addColorStop(1, gray(180));
        g.fillStyle = grad;
        g.beginPath();
        g.roundRect(x + 4, r * h + 4, S / 2 - 8, h - 8, 18);
        g.fill();
      }
    }
    speckle(g, rand, 2000, 150, 230, 1);
  },
  barrel(g, rand) {
    g.fillStyle = gray(225);
    g.fillRect(0, 0, S, S);
    blotches(g, rand, 12, 0.12, 6, 25);
    for (const y of [0.2, 0.5, 0.8]) {
      g.fillStyle = gray(150);
      g.fillRect(0, y * S - 5, S, 10);
      g.fillStyle = gray(250, 0.6);
      g.fillRect(0, y * S - 5, S, 2);
    }
  },
  bark(g, rand) {
    g.fillStyle = gray(190);
    g.fillRect(0, 0, S, S);
    for (let i = 0; i < 60; i++) {
      g.fillStyle = gray(110 + rand() * 60, 0.7);
      g.fillRect(rand() * S, 0, 2 + rand() * 4, S);
    }
  },
  leaves(g, rand) {
    g.fillStyle = gray(190);
    g.fillRect(0, 0, S, S);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = gray(120 + rand() * 135);
      g.beginPath();
      g.arc(rand() * S, rand() * S, 3 + rand() * 6, 0, Math.PI * 2);
      g.fill();
    }
  },
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
    GEN.concrete(g, rand);
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
  // Narrow floorboards with staggered joints
  woodFloor(g, rand) {
    const n = 8;
    const h = S / n;
    for (let i = 0; i < n; i++) {
      const v = 175 + rand() * 60;
      g.fillStyle = gray(v);
      g.fillRect(0, i * h, S, h);
      g.strokeStyle = gray(v - 40, 0.25);
      g.lineWidth = 1;
      for (let k = 0; k < 5; k++) {
        const y = i * h + 3 + rand() * (h - 6);
        g.beginPath();
        g.moveTo(0, y);
        g.bezierCurveTo(S / 3, y + (rand() - 0.5) * 4, (2 * S) / 3, y + (rand() - 0.5) * 4, S, y);
        g.stroke();
      }
      g.fillStyle = 'rgba(0,0,0,0.4)';
      g.fillRect(0, i * h, S, 2);
      const joint = rand() * S;
      g.fillRect(joint, i * h, 2, h);
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
  // Ceramic floor tiles, slightly uneven in tone
  tiles(g, rand) {
    const n = 4;
    const t = S / n;
    g.fillStyle = gray(150);
    g.fillRect(0, 0, S, S);
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        g.fillStyle = gray((r + c) % 2 ? 235 - rand() * 12 : 200 - rand() * 12);
        g.fillRect(c * t + 2, r * t + 2, t - 4, t - 4);
      }
    }
    speckle(g, rand, 1500, 170, 245, 1);
    blotches(g, rand, 10, 0.05, 15, 40);
  },
  // Flat roof: gravel over a membrane, with seams
  gravel(g, rand) {
    g.fillStyle = gray(200);
    g.fillRect(0, 0, S, S);
    speckle(g, rand, 9000, 140, 250, 2);
    blotches(g, rand, 16, 0.08, 20, 60);
    g.fillStyle = 'rgba(0,0,0,0.12)';
    g.fillRect(0, 0, S, 3);
    g.fillRect(0, 0, 3, S);
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

const texCache = new Map<string, THREE.CanvasTexture>();
function tex(name: TexName): THREE.CanvasTexture {
  let t = texCache.get(name);
  if (!t) texCache.set(name, (t = canvasTex(name)));
  return t;
}

// Look of each map: texture and metres per repetition. 0 = one texture per face (crates)
/** [texture, metres per repetition] · null texture = flat colour */
type Look = [TexName | null, number?];
const COMMON: Partial<Record<BoxKind, Look>> = {
  crate: ['crate', 0],
  crate2: ['crate', 0],
  cont1: ['corrugated', 2.6],
  cont2: ['corrugated', 2.6],
  cont3: ['corrugated', 2.6],
  rail: ['hazard', 1],
  bridge: ['planks', 2],
  rock: ['rock', 3],
  sandbag: ['sandbag', 1.4],
  pallet: ['planks', 1.2],
  planter: ['concrete', 1.6],
  lamp: [null],
  cactus: [null],
  trunk: ['bark', 1],
  barrel: ['barrel', 0],
  roof: ['planks', 2],
  bld1: ['windows', 4],
  bld2: ['windows', 4],
  bld3: ['windows', 4],
  bld4: ['windows', 4],
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
  frame: ['planks', 1],
  shutter: ['louver', 1],
  awning: ['stripes', 2],
};
interface Theme extends Partial<Record<BoxKind, Look>> {
  wall: Look;
  ground: [TexName, number, string];
  sun: number;
  sky: string;
  scenery: (batch: Batch, map: GameMap, rand: Rand) => void;
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
};
const CAR_COLORS = ['#c0503e', '#3d6e9e', '#e8e4dc', '#2b2f36', '#c9a13a', '#4f7a45'];

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
const CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 14);
const CONE4 = new THREE.ConeGeometry(0.71, 1, 4);
const BLOB = new THREE.IcosahedronGeometry(0.5, 1);
const BARREL_COLORS = ['#3d6e9e', '#b04a3a', '#c9a13a', '#4f7a45'];

// ------------------------------------------------------------ Props with their own shape
function addTree(batch: Batch, x: number, y: number, z: number, s: number, rand: Rand, leafColor = '#4f8f3e'): void {
  batch.add(BOX, mat('#6b4a2b', 'bark'), x, y + 1.3 * s, z, 0, 0.35 * s, 2.6 * s, 0.35 * s);
  const leaves = mat(leafColor, 'leaves');
  const top = y + 2.6 * s;
  batch.add(BOX, leaves, x, top + 0.6 * s, z, rand() * 3, 2.3 * s, 1.6 * s, 2.3 * s);
  batch.add(BOX, leaves, x + 0.4 * s, top + 1.5 * s, z - 0.2 * s, rand() * 3, 1.6 * s, 1.1 * s, 1.6 * s);
  batch.add(
    BOX,
    mat(leafColor, 'leaves', { color: new THREE.Color(leafColor).multiplyScalar(0.85) }),
    x - 0.5 * s,
    top + 0.2 * s,
    z + 0.5 * s,
    rand() * 3,
    1.4 * s,
    1 * s,
    1.4 * s,
  );
}

type PropBox = Pick<MapBox, 'x' | 'y' | 'z' | 'w' | 'h' | 'd' | 'c'>;
function addProp(batch: Batch, b: PropBox, colors: Partial<MapColors>, rand: Rand, i: number): boolean {
  const cx = b.x;
  const cy = b.y + b.h / 2;
  const cz = b.z;
  switch (b.c) {
    case 'barrel': {
      const color = pick(BARREL_COLORS, i);
      batch.add(CYL, mat(color, 'barrel'), cx, cy, cz, rand() * 6, b.w, b.h, b.d);
      batch.add(CYL, mat('#2b2f36', null), cx, b.y + b.h + 0.01, cz, 0, b.w * 0.92, 0.03, b.d * 0.92);
      return true;
    }
    case 'trunk':
      addTree(batch, cx, b.y, cz, 1, rand);
      return true;
    case 'planter':
      batch.add(BOX, mat(colors.planter!, 'concrete'), cx, cy, cz, 0, b.w, b.h, b.d);
      batch.add(BOX, mat('#4a3424', 'sand'), cx, b.y + b.h + 0.005, cz, 0, b.w - 0.2, 0.02, b.d - 0.2);
      return true;
    case 'lamp': {
      const top = b.y + b.h;
      const metal = mat(colors.lamp!, null);
      batch.add(CYL, metal, cx, cy, cz, 0, b.w, b.h, b.d);
      batch.add(CYL, metal, cx, b.y + 0.3, cz, 0, b.w * 1.8, 0.6, b.d * 1.8);
      batch.add(BOX, metal, cx, top, cz, 0, 0.5, 0.25, 0.5);
      batch.add(BOX, glow('#fff3c4'), cx, top - 0.16, cz, 0, 0.36, 0.08, 0.36);
      return true;
    }
    case 'car': {
      const color = pick(CAR_COLORS, i);
      const alongX = b.w > b.d;
      batch.add(BOX, mat(color, 'barrel'), cx, b.y + 0.55, cz, 0, b.w, 0.7, b.d);
      const dark = mat('#1c1f24', null);
      for (const s of [1, -1]) {
        for (const t of [1, -1]) {
          const [wx, wz] = alongX ? [s * b.w * 0.32, t * (b.d / 2 - 0.1)] : [t * (b.w / 2 - 0.1), s * b.d * 0.32];
          batch.add(BOX, dark, cx + wx, b.y + 0.35, cz + wz, 0, alongX ? 0.7 : 0.25, 0.7, alongX ? 0.25 : 0.7);
        }
        // headlights
        const [fx, fz] = alongX ? [s * (b.w / 2), b.d * 0.3] : [b.w * 0.3, s * (b.d / 2)];
        for (const q of [1, -1])
          batch.add(
            BOX,
            glow(s > 0 ? '#fff6d6' : '#ff4d4d'),
            cx + (alongX ? fx : q * fx),
            b.y + 0.65,
            cz + (alongX ? q * fz : fz),
            0,
            alongX ? 0.04 : 0.3,
            0.16,
            alongX ? 0.3 : 0.04,
          );
      }
      return true;
    }
    case 'carTop': {
      batch.add(BOX, mat('#22303d', null), cx, cy - 0.05, cz, 0, b.w, b.h - 0.1, b.d);
      batch.add(BOX, mat(pick(CAR_COLORS, i), 'barrel'), cx, b.y + b.h - 0.05, cz, 0, b.w + 0.04, 0.1, b.d + 0.04);
      return true;
    }
    case 'cactus': {
      const green = mat(colors.cactus!, 'bark');
      batch.add(BOX, green, cx, cy, cz, 0, b.w, b.h, b.d);
      const side = rand() < 0.5 ? 1 : -1;
      batch.add(BOX, green, cx + side * 0.4, b.y + b.h * 0.5, cz, 0, 0.4, 0.25, 0.25);
      batch.add(BOX, green, cx + side * 0.55, b.y + b.h * 0.68, cz, 0, 0.25, 0.6, 0.25);
      batch.add(BOX, green, cx - side * 0.35, b.y + b.h * 0.62, cz, 0, 0.3, 0.2, 0.22);
      batch.add(BOX, green, cx - side * 0.45, b.y + b.h * 0.75, cz, 0, 0.2, 0.4, 0.22);
      return true;
    }
    default:
      return false;
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

  // Block clouds
  const rand = rng(map.half * 31 + map.id.length);
  const batch = new Batch();
  const cloud = new THREE.MeshLambertMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 0.45,
    fog: false,
  });
  for (let i = 0; i < 16; i++) {
    const a = rand() * Math.PI * 2;
    const r = map.half * (1 + rand() * 3);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const y = 45 + rand() * 30;
    const n = 3 + Math.floor(rand() * 4);
    for (let k = 0; k < n; k++) {
      batch.add(
        BOX,
        cloud,
        x + (rand() - 0.5) * 18,
        y + rand() * 3,
        z + (rand() - 0.5) * 10,
        0,
        8 + rand() * 10,
        2.5 + rand() * 2,
        6 + rand() * 6,
      );
    }
  }
  batch.build(scene);
}

// ------------------------------------------------------------ Scenery outside the walls
// Random point outside the arena, between `near` and `far` metres from the wall
function outside(rand: Rand, H: number, near: number, far: number): [number, number] {
  for (;;) {
    const x = (rand() * 2 - 1) * (H + far);
    const z = (rand() * 2 - 1) * (H + far);
    if (Math.max(Math.abs(x), Math.abs(z)) > H + near) return [x, z];
  }
}

function town(batch: Batch, map: GameMap, rand: Rand): void {
  const H = map.half;
  for (let i = 0; i < 70; i++) {
    const [x, z] = outside(rand, H, 3, 45);
    addTree(batch, x, 0, z, 1.3 + rand() * 1.2, rand, rand() < 0.3 ? '#3f7a35' : '#5a9a44');
  }
  const walls = ['#e8dcc4', '#d9c4a8', '#f0e6d2', '#c9b79a', '#e3cfb0'];
  const roofs = ['#a5523c', '#8a4a35', '#6e5a4a', '#b8653f'];
  for (let i = 0; i < 18; i++) {
    const [x, z] = outside(rand, H, 12, 55);
    const w = 7 + rand() * 6;
    const d = 7 + rand() * 5;
    const h = 4 + Math.floor(rand() * 3) * 3;
    const ry = Math.round(rand() * 4) * (Math.PI / 2);
    batch.add(tiledBoxCached(1), mat(pick(walls, i), 'windows'), x, h / 2, z, ry, w, h, d);
    batch.add(CONE4, mat(pick(roofs, i), 'planks'), x, h + 1.6, z, ry + Math.PI / 4, w * 1.1, 3.2, d * 1.1);
  }
  hills(batch, map, rand, '#5f8f45');
}

function industrial(batch: Batch, map: GameMap, rand: Rand): void {
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
  // Sheds and chimneys around
  const cols = ['#8a96a3', '#a3a9b0', '#7b8794', '#b0a48e'];
  for (let i = 0; i < 16; i++) {
    const [x, z] = outside(rand, H, 8, 60);
    const w = 14 + rand() * 18;
    const d = 12 + rand() * 14;
    const h = 9 + rand() * 9;
    batch.add(tiledBoxCached(1), mat(pick(cols, i), 'corrugated'), x, h / 2, z, 0, w, h, d);
    batch.add(BOX, mat('#5d6670', 'diamond'), x, h + 0.3, z, 0, w + 0.6, 0.6, d + 0.6);
  }
  for (let i = 0; i < 6; i++) {
    const [x, z] = outside(rand, H, 20, 60);
    const h = 25 + rand() * 20;
    batch.add(CYL, mat('#9a7b6a', 'brick'), x, h / 2, z, 0, 2.6, h, 2.6);
    batch.add(CYL, mat('#c0503e', null), x, h - 1.5, z, 0, 2.75, 1.2, 2.75);
  }
}

function desert(batch: Batch, map: GameMap, rand: Rand): void {
  const H = map.half;
  const rockCols = ['#c98a5a', '#b0704a', '#d19a64', '#a86a48'];
  for (let i = 0; i < 22; i++) {
    const [x, z] = outside(rand, H, 15, 110);
    const w = 18 + rand() * 30;
    const d = 18 + rand() * 30;
    const h = 12 + rand() * 30;
    batch.add(tiledBoxCached(8), mat(pick(rockCols, i), 'rock'), x, h / 2, z, rand() * 3, w, h, d);
    batch.add(tiledBoxCached(8), mat(pick(rockCols, i + 1), 'rock'), x, h + 2, z, rand() * 3, w * 0.7, 4, d * 0.7);
  }
  for (let i = 0; i < 40; i++) {
    const [x, z] = outside(rand, H, 2, 50);
    const s = 1 + rand() * 0.8;
    addProp(batch, { c: 'cactus', x, y: 0, z, w: 0.45 * s, h: 2.3 * s, d: 0.45 * s }, { cactus: '#4f8a45' }, rand, i);
  }
}

function city(batch: Batch, map: GameMap, rand: Rand): void {
  const H = map.half;
  const cols = ['#9fb0c4', '#c9b79a', '#8a96a3', '#d8c8b0', '#7b8794', '#b58c74'];
  for (let i = 0; i < 40; i++) {
    const [x, z] = outside(rand, H, 6, 70);
    const w = 10 + rand() * 14;
    const d = 10 + rand() * 14;
    const h = 16 + rand() * 45;
    batch.add(tiledBoxCached(Math.round(h / 6)), mat(pick(cols, i), 'windows'), x, h / 2, z, 0, w, h, d);
    batch.add(BOX, mat('#4a5562', 'concrete'), x, h + 0.4, z, 0, w * 0.5, 0.8, d * 0.5);
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
export function buildWorld(scene: THREE.Scene, map: GameMap): void {
  const H = map.half;
  const theme = THEMES[map.id];
  scene.background = new THREE.Color(map.sky);
  scene.fog = new THREE.Fog(map.sky, H * 1.9, H * 5);

  scene.add(new THREE.HemisphereLight(SKY_LIGHT, GROUND_LIGHT, HEMI_INTENSITY));
  const sun = new THREE.DirectionalLight(theme.sun, SUN_INTENSITY);
  sun.position.set(30, 50, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -H - 8, right: H + 8, top: H + 8, bottom: -H - 8, near: 1, far: H * 4 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);
  addSky(scene, map, theme);

  const rand = rng(H * 97 + map.id.length);
  const arena = new Batch(skyShade(map.boxes));
  const props = new Batch();
  const solid = (b: MapBox) => {
    const [texName, tile] = theme[b.c] || COMMON[b.c] || theme.wall;
    const color = map.colors[b.c] || map.colors.wall;
    const geo = tile ? worldBox(b, tile) : tiledBox(b.w, b.h, b.d, tile);
    arena.add(geo, mat(color, texName, { vertexColors: true }), b.x, b.y + b.h / 2, b.z);
  };
  let n = 0;
  for (const b of map.boxes) {
    if (b.p && addProp(props, b, map.colors, rand, b.c === 'car' ? ++n : n)) continue;
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
    // Buildings: rooftop with a concrete coping
    if (b.c.startsWith('bld'))
      props.add(BOX, mat('#7d7f84', 'concrete'), b.x, b.y + b.h + 0.15, b.z, 0, b.w + 0.3, 0.3, b.d + 0.3);
    solid(b);
  }
  for (const b of map.decor) solid(b);
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

  const scenery = new Batch();
  theme.scenery(scenery, map, rng(H * 131 + map.id.length * 7));
  scenery.build(scene);
}
