import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { CamoId, FinishId, WeaponId } from '@blockshot/shared';
import { buildGun, camoMap, GRIP, patternMap, type GunModel } from './models';

// Each weapon has its own low-poly model in public/models/guns (CC BY 4.0, see ASSETS_CREDITS.md; the railgun keeps
// Quaternius's CC0 sniper): meshopt GLBs in metres, muzzle to +X, up +Y, flat shaded (no normals). Each one is
// fitted onto the procedural gun of the same weapon: pistol grip in the right hand, bore at the procedural muzzle's
// height, so hands, muzzle flash, sights and recoil keep working. Each file is named after its weapon id.
const BASE = `${import.meta.env.BASE_URL}models/guns/`;

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const sources = new Map<string, Promise<THREE.Group>>();
const source = (file: string): Promise<THREE.Group> => {
  let p = sources.get(file);
  if (!p) sources.set(file, (p = loader.loadAsync(`${BASE}${file}.glb`).then((g) => g.scene)));
  return p;
};

// ------------------------------------------------------------ Finishes
// The models' materials have no meaningful names, so each one is told apart by its colour (linear RGB): the dark
// frame, lighter metal parts, coloured furniture (wood, olive or tan polymer) and bright details nobody repaints
// (lenses, brass, lights). A finish repaints the frame, sometimes the rest.
type Part = 'frame' | 'metal' | 'furniture' | 'glass';
const FRAME_MAX = 0.045;
const COLOURED = 0.3;
const BRIGHT = 0.8;
function partOf(m: THREE.MeshStandardMaterial): Part {
  const { r, g, b } = m.color;
  const max = Math.max(r, g, b);
  const sat = max ? (max - Math.min(r, g, b)) / max : 0;
  if (/glass|lens|plexi/i.test(m.name) || (b > r * 1.3 && b > 0.3) || (sat > BRIGHT && max > COLOURED)) return 'glass';
  if (sat > COLOURED && max > FRAME_MAX) return 'furniture';
  return max < FRAME_MAX ? 'frame' : 'metal';
}

type Paint = THREE.MeshStandardMaterialParameters;
const TEX = 64;
function canvasMap(draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = TEX;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const texCache = new Map<string, THREE.Texture>();
const tex = (key: string, make: () => THREE.Texture): THREE.Texture => {
  let t = texCache.get(key);
  if (!t) {
    texCache.set(key, (t = make()));
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
  }
  return t;
};
// Damascus steel: wavy bands of light and dark steel
const damascus = () =>
  canvasMap((g) => {
    g.fillStyle = '#4f565e';
    g.fillRect(0, 0, TEX, TEX);
    for (let y = -8; y < TEX + 8; y += 3) {
      g.strokeStyle = (y / 3) % 2 ? '#7a828c' : '#3a4047';
      g.lineWidth = 1;
      g.beginPath();
      for (let x = 0; x <= TEX; x += 2) g.lineTo(x, y + Math.sin((x / TEX) * Math.PI * 4) * 3);
      g.stroke();
    }
  });
// Lava: black rock cracked with glowing seams (also the emissive map)
const lava = () =>
  canvasMap((g) => {
    g.fillStyle = '#17110f';
    g.fillRect(0, 0, TEX, TEX);
    let seed = 11;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    g.strokeStyle = '#ff6a1a';
    g.lineWidth = 1.5;
    for (let i = 0; i < 14; i++) {
      let x = rnd() * TEX;
      let y = rnd() * TEX;
      g.beginPath();
      g.moveTo(x, y);
      for (let s = 0; s < 5; s++) g.lineTo((x += (rnd() - 0.5) * 18), (y += (rnd() - 0.5) * 18));
      g.stroke();
    }
  });

function paint(finish: FinishId, part: Part, color: string, camo: CamoId): Paint | null {
  if (part === 'glass' || finish === 'estandar') return null;
  const frameOnly = (p: Paint) => (part === 'frame' ? p : null);
  switch (finish) {
    case 'acero':
      return part === 'furniture'
        ? null
        : part === 'frame'
          ? { color: '#3b4047', metalness: 0.6, roughness: 0.35 }
          : { color: '#a3abb5', metalness: 0.7, roughness: 0.25 };
    case 'arena':
      return part === 'metal'
        ? null
        : { color: part === 'frame' ? '#b59a6a' : '#8d7650', metalness: 0.05, roughness: 0.75 };
    case 'carbono':
      return part === 'metal'
        ? null
        : {
            color: '#ffffff',
            map: tex('carbono', () => patternMap(['#25272c', '#3c4048', '#17181b'], 'weave')),
            roughness: 0.45,
          };
    case 'camuflaje':
      return part === 'metal'
        ? null
        : { color: '#ffffff', map: tex(`camo|${color}|${camo}`, () => camoMap(color, camo)), roughness: 0.8 };
    case 'damasco':
      return frameOnly({ color: '#ffffff', map: tex('damasco', damascus), metalness: 0.6, roughness: 0.3 });
    case 'oro':
      return part === 'furniture'
        ? null
        : { color: part === 'frame' ? '#d9a62e' : '#f0cf6a', metalness: 0.8, roughness: 0.28, emissive: '#3a2a00' };
    case 'hielo':
      return {
        color: part === 'metal' ? '#e8f6ff' : '#a9dcff',
        metalness: 0.1,
        roughness: 0.12,
        emissive: '#2f6ea8',
        emissiveIntensity: 0.35,
      };
    case 'lava':
      return part === 'metal'
        ? { color: '#2a2220', roughness: 0.6 }
        : (() => {
            const m = tex('lava', lava);
            return {
              color: '#ffffff',
              map: m,
              emissive: '#ffffff',
              emissiveMap: m,
              emissiveIntensity: 0.9,
              roughness: 0.7,
            };
          })();
    case 'neon':
      // Dark body lit from inside in the outfit colour, bright parts glowing outright
      return part === 'metal'
        ? { color, emissive: color, emissiveIntensity: 1.4, roughness: 0.4 }
        : {
            color: '#14121b',
            emissive: color,
            emissiveIntensity: part === 'frame' ? 0.22 : 0.4,
            roughness: 0.45,
            metalness: 0.2,
          };
  }
  return null;
}

// The models have no UVs: patterned finishes get a box projection (each face takes the two axes it faces), on a
// flat-shaded copy of the geometry. `metres` turns the (quantized) positions into metres, so every part of a gun
// gets the same pattern size.
const UV_PER_METRE = 5;
const uvGeos = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>();
function boxUV(src: THREE.BufferGeometry, metres: number): THREE.BufferGeometry {
  let geo = uvGeos.get(src);
  if (geo) return geo;
  const flat = !src.attributes.normal;
  geo = src.index ? src.toNonIndexed() : src.clone();
  if (flat) geo.computeVertexNormals(); // non-indexed: each face's own normal
  const pos = geo.attributes.position!;
  const nor = geo.attributes.normal!;
  const k = UV_PER_METRE * metres;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const [ax, ay, az] = [Math.abs(nor.getX(i)), Math.abs(nor.getY(i)), Math.abs(nor.getZ(i))];
    const [u, v] =
      ax >= ay && ax >= az
        ? [pos.getZ(i), pos.getY(i)]
        : ay >= az
          ? [pos.getX(i), pos.getZ(i)]
          : [pos.getX(i), pos.getY(i)];
    uv[i * 2] = u * k;
    uv[i * 2 + 1] = v * k;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  if (flat) geo.deleteAttribute('normal'); // stays flat shaded like the rest
  uvGeos.set(src, geo);
  return geo;
}

const matCache = new Map<string, THREE.Material>();
function finished(src: THREE.MeshStandardMaterial, finish: FinishId, color: string, camo: CamoId): THREE.Material {
  const p = paint(finish, partOf(src), color, camo);
  if (!p) return lifted(src); // near-black parts lifted a little, so the gun reads in shading
  const key = `${src.uuid}|${finish}|${color}|${camo}`;
  let m = matCache.get(key);
  if (!m) {
    const c = src.clone();
    c.setValues({
      metalness: 0.1,
      roughness: 0.6,
      emissive: '#000000',
      emissiveIntensity: 1,
      map: null,
      emissiveMap: null,
      ...p,
    });
    matCache.set(key, (m = c));
  }
  return m;
}

// ------------------------------------------------------------ Fitting
const _v = new THREE.Vector3();
/** Calls `fn` with every vertex of the meshes under `root`, in `root` space (the vector is reused). */
function eachVertex(root: THREE.Object3D, fn: (v: THREE.Vector3) => void): void {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert();
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const m = o.matrixWorld.clone().premultiply(inv);
    const pos = o.geometry.attributes.position!;
    for (let i = 0; i < pos.count; i++) fn(_v.fromBufferAttribute(pos, i).applyMatrix4(m));
  });
}

/** Middle of the vertices that pass `test` (the muzzle's: the bore), in `root` space. */
function boreAt(root: THREE.Object3D, test: (v: THREE.Vector3) => boolean): { x: number; y: number } {
  let x = 0;
  let y = 0;
  let n = 0;
  eachVertex(root, (v) => {
    if (!test(v)) return;
    x += v.x;
    y += v.y;
    n++;
  });
  return n ? { x: x / n, y: y / n } : { x: 0, y: 0 };
}

/** Highest point of the front `slice` of the gun (its front sight: aiming looks along its top), in `root` space. */
function sightTop(root: THREE.Object3D, minZ: number, slice: number): { y: number; z: number } {
  let top = -Infinity;
  let z = minZ;
  eachVertex(root, (v) => {
    if (v.z < minZ + slice && v.y > top) {
      top = v.y;
      z = v.z;
    }
  });
  return { y: top, z };
}

/** Front share of the gun searched for its front sight, and how far above its tip the eye looks (m). */
const SIGHT_SLICE = 0.4;
const SIGHT_CLEAR = 0.002;
/** Aimed over their highest point (carry handles, the HK69's receiver), which stands further back. */
const SIGHT_SLICE_OF: Partial<Record<WeaponId, number>> = { minigun: 1, grenadelauncher: 1, autoshotgun: 1 };

/**
 * Pistol grip (its middle, where the fist closes) to muzzle, in metres on each model, measured on its side view.
 * The knife and the railgun have none: they are stretched over their procedural model instead.
 */
const GRIP_TO_MUZZLE: Partial<Record<WeaponId, number>> = {
  rifle: 0.61,
  heavyrifle: 0.605,
  lightrifle: 0.62,
  carbine: 0.46,
  sniper: 0.96,
  dmr: 0.88,
  frf1: 0.815,
  smg: 0.3,
  ump45: 0.39,
  pdw: 0.29,
  compact: 0.135,
  shotgun: 0.7,
  benelli: 0.715,
  sawedoff: 0.524,
  lmg: 0.8,
  lightlmg: 0.73,
  launcher: 0.5525,
  grenadelauncher: 0.49,
  pistol: 0.176,
  colt: 0.176,
  heavypistol: 0.208,
  revolver: 0.249,
  mpistol: 0.155,
  autoshotgun: 0.616,
  minigun: 0.75,
};
/**
 * Gun space is this many times life size: the hands and the first-person framing were made for guns this big. Each
 * model is scaled to its real length (REAL_LEN) times this, so they keep their real proportions to each other (a
 * pistol clearly smaller than a rifle). Third person shrinks it back (THIRD_PERSON_GUN).
 */
export const GUN_SPACE = 1.3;
/** Scale of a gun held by a body (third person, class screen): a bit over life size, so it reads at a distance. */
export const THIRD_PERSON_GUN = 1.1 / GUN_SPACE;
/** Real overall length of each gun (m). */
const REAL_LEN: Partial<Record<WeaponId, number>> = {
  rifle: 0.84,
  heavyrifle: 0.88,
  lightrifle: 0.84,
  carbine: 0.72,
  sniper: 1.3,
  dmr: 1.21,
  frf1: 1.14,
  smg: 0.33,
  ump45: 0.69,
  pdw: 0.5,
  compact: 0.25,
  shotgun: 1.04,
  benelli: 1.01,
  sawedoff: 0.6,
  lmg: 1.1,
  lightlmg: 1.04,
  launcher: 1.3, // the 0.95 m tube with its PG-7 warhead loaded, as modelled
  grenadelauncher: 0.68,
  pistol: 0.22,
  colt: 0.22,
  heavypistol: 0.27,
  revolver: 0.29,
  mpistol: 0.19,
  autoshotgun: 0.97,
  minigun: 0.8,
};
/**
 * Pistol grip to where the left hand holds the handguard or foregrip (m, on the model, from its side view).
 * Guns without one (handguns, the MAC-11) are held with both hands on the grip.
 */
const FORE_GRIP: Partial<Record<WeaponId, number>> = {
  rifle: 0.31,
  heavyrifle: 0.3,
  lightrifle: 0.32,
  carbine: 0.3,
  sniper: 0.36,
  dmr: 0.375,
  frf1: 0.325,
  smg: 0.235,
  ump45: 0.195,
  pdw: 0.14,
  shotgun: 0.44,
  benelli: 0.355,
  sawedoff: 0.31,
  lmg: 0.3,
  lightlmg: 0.36,
  launcher: 0.2,
  grenadelauncher: 0.25,
  autoshotgun: 0.33,
  minigun: 0.32,
};
const HANDGUARD_HALF_WIDTH = 0.05;
const FIST_HALF = 0.035;
const LEFT_MAX_DROP = 0.13;
/** Where the fist closes on the grip, as a share of the way from the bore down to the grip's bottom. */
const FIST_DEPTH = 0.55;
const GRIP_SLICE = 0.012;
const GRIP_STEP = 0.01;
const GRIP_SNAP_STEPS = 5;

export interface GunLook {
  finish?: FinishId;
  /** outfit colour: neón glows in it, the procedural parts are tinted with it */
  color?: string;
  camo?: CamoId;
  withFlash?: boolean;
}

/** Power weapons always wear their own glowing finish, so they read as special in every hand. */
const POWER_FINISH: Partial<Record<WeaponId, FinishId>> = { railgun: 'neon', minigun: 'lava', autoshotgun: 'oro' };

/**
 * The gun for a weapon with its model and the chosen finish. Resolves to the procedural gun when the file fails to
 * load, so callers can always use the result.
 */
export async function loadGun(id: WeaponId, look: GunLook = {}): Promise<GunModel> {
  const { color = '#ffc93c', camo = 'liso', withFlash = false } = look;
  const picked = look.finish && look.finish !== 'estandar' ? look.finish : undefined;
  const finish = POWER_FINISH[id] ?? picked ?? 'estandar';
  const gun = buildGun(id, withFlash, color);
  let model: THREE.Group;
  let optic: THREE.Group | null = null;
  const sight = OPTIC[id];
  try {
    model = (await source(id)).clone(true);
    if (sight) optic = (await source(`optic-${sight.kind}`)).clone(true);
  } catch {
    return gun;
  }

  // Replace the procedural parts, keeping the muzzle flash, and measure the space they took
  const target = new THREE.Box3();
  for (const o of [...gun.children]) {
    if (o === gun.userData.flash) continue;
    target.expandByObject(o);
    gun.remove(o);
  }
  const pivot = new THREE.Group();
  pivot.rotation.y = Math.PI / 2; // barrel from +X to -Z
  pivot.add(model);
  const holder = new THREE.Group();
  holder.add(pivot);
  holder.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(pivot);
  const gm = GRIP_TO_MUZZLE[id];
  const real = REAL_LEN[id];
  let len: number;
  if (gm && real) {
    // Real size; the grip in the right fist (the muzzle, flash, gear and left hand follow the model)
    const s = (real * GUN_SPACE) / (box.max.z - box.min.z);
    pivot.scale.setScalar(s);
    holder.updateMatrixWorld(true);
    box.setFromObject(pivot);
    len = box.max.z - box.min.z;
    const bore = boreAt(holder, (v) => v.z < box.min.z + len * 0.04);
    // The measured grip, snapped to the lowest point of the grip nearby (the side-view readings are a few cm off)
    const measured = box.min.z + gm * s;
    const bottoms = new Map<number, number>();
    eachVertex(holder, (v) => {
      const k = Math.round((v.z - measured) / GRIP_STEP);
      if (Math.abs(k) <= GRIP_SNAP_STEPS) bottoms.set(k, Math.min(bottoms.get(k) ?? bore.y, v.y));
    });
    let best = 0;
    for (const [k, y] of bottoms) if (y < (bottoms.get(best) ?? bore.y) - 1e-4) best = k;
    const gripZ = measured + best * GRIP_STEP;
    const bottom = bottoms.get(best) ?? bore.y;
    const gripY = bore.y - (bore.y - bottom) * FIST_DEPTH;
    pivot.position.set(GRIP.x - bore.x, GRIP.y - gripY, GRIP.z - gripZ);
    const muzzle = new THREE.Vector3(0, GRIP.y + bore.y - gripY, GRIP.z - (gripZ - box.min.z));
    gun.userData.flash?.position.add(
      muzzle.clone().sub(new THREE.Vector3(0, gun.userData.muzzleY, gun.userData.muzzleZ)),
    );
    gun.userData.muzzleY = muzzle.y;
    gun.userData.muzzleZ = muzzle.z;
    const fore = FORE_GRIP[id];
    if (fore) {
      // Left fist under the handguard (or round the foregrip), at most this far under the bore
      const z = GRIP.z - fore * s;
      let under = Infinity;
      eachVertex(holder, (v) => {
        if (Math.abs(v.z - z) < GRIP_SLICE && Math.abs(v.x) < HANDGUARD_HALF_WIDTH) under = Math.min(under, v.y);
      });
      const y = Math.max(under - FIST_HALF, muzzle.y - LEFT_MAX_DROP);
      gun.userData.leftHand = new THREE.Vector3(0, Number.isFinite(y) ? y : muzzle.y - LEFT_MAX_DROP, z);
    }
  } else {
    // Knife and railgun: stretched over their procedural model
    pivot.scale.setScalar((target.max.z - target.min.z) / (box.max.z - box.min.z));
    holder.updateMatrixWorld(true);
    box.setFromObject(pivot);
    len = box.max.z - box.min.z;
    pivot.position.z = target.min.z - box.min.z;
    pivot.position.x = -(box.min.x + box.max.x) / 2;
    pivot.position.y = gun.userData.muzzleY - boreAt(holder, (v) => v.z < box.min.z + len * 0.04).y;
  }
  holder.updateMatrixWorld(true);
  box.setFromObject(pivot);
  // Aimed, the eye looks along the top of the model's own front sight (the procedural gun's sight was elsewhere)
  if (id !== 'knife') {
    const sight = sightTop(holder, box.min.z, len * (SIGHT_SLICE_OF[id] ?? SIGHT_SLICE));
    gun.userData.sightY = sight.y + SIGHT_CLEAR;
    gun.userData.sightZ = sight.z;
  }

  const patterned = finish === 'carbono' || finish === 'camuflaje' || finish === 'damasco' || finish === 'lava';
  holder.updateMatrixWorld(true);
  const toModel = model.matrixWorld.clone().invert();
  holder.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    if (patterned)
      o.geometry = boxUV(o.geometry, new THREE.Vector3().setFromMatrixScale(toModel.clone().multiply(o.matrixWorld)).x);
    o.material = Array.isArray(o.material)
      ? o.material.map((m) => finished(m as THREE.MeshStandardMaterial, finish, color, camo))
      : finished(o.material as THREE.MeshStandardMaterial, finish, color, camo);
    o.castShadow = true;
  });
  gun.add(holder);
  // Iron sights: the eye at the stock, over the grip; handguns at arm's length
  if (gm) {
    const handgun = !(FORE_GRIP[id] || OPTIC[id]);
    // Iron sights: the eye at the stock (arm's length for handguns), but always behind anything that stands up to
    // the sight line (a carry handle, a rear block), so nothing fills the view
    let rear = -Infinity;
    // (only the guns aimed over a carry handle or a tall receiver: elsewhere a side bracket would push the eye back)
    if (SIGHT_SLICE_OF[id])
      eachVertex(holder, (v) => {
        if (v.y > gun.userData.sightY - IRON_CLEAR_BAND) rear = Math.max(rear, v.z);
      });
    gun.userData.eyeZ =
      Math.max(GRIP.z + (handgun ? HANDGUN_EYE : RIFLE_EYE), rear + IRON_EYE_CLEAR) + (EYE_BACK[id] ?? 0);
  }
  if (optic && sight) mountOptic(gun, holder, optic, sight);
  return gun;
}

// ------------------------------------------------------------ Optics
// GoldbergR's sights (CC BY 4.0), in public/models/guns/optic-*.glb: sight line along +X, life size, see-through lens.
type OpticKind = 'reflex' | 'acog' | 'reddot' | 'holo';
/** `scale`: the Romeo 8T is shrunk on the small SMGs, where it looked oversized. */
interface Optic {
  kind: OpticKind;
  at: number;
  scale?: number;
}
/**
 * Each family's optic, and how far ahead of the grip (m, life size) its middle sits on the receiver's rail. Not on
 * the P90 (its own sight is built in), the PSG1 (its own scope), the sawed-off (no rail), the AA-12 (its carry handle
 * would block the window) nor the handguns (irons).
 */
const OPTIC: Partial<Record<WeaponId, Optic>> = {
  rifle: { kind: 'reflex', at: 0.04 }, // over the rear sight, which would hide the window
  heavyrifle: { kind: 'reflex', at: 0.12 },
  lightrifle: { kind: 'reflex', at: 0.04 },
  carbine: { kind: 'reflex', at: 0.1 },
  frf1: { kind: 'acog', at: 0.12 },
  smg: { kind: 'reddot', at: 0.09, scale: 0.72 },
  ump45: { kind: 'reddot', at: 0.1, scale: 0.72 },
  compact: { kind: 'reddot', at: 0.06, scale: 0.72 },
  shotgun: { kind: 'holo', at: 0.1 },
  benelli: { kind: 'holo', at: 0.1 },
  lmg: { kind: 'holo', at: 0.16 },
  lightlmg: { kind: 'holo', at: 0.14 },
};
/** The glowing reticle inside each optic (gun space, m). */
const RETICLE_COLOR = '#ffd23a';
/** Sets how much of the screen height the optic's window fills when aimed (tuned on screenshots: about a third). */
const WINDOW_SHARE: Record<OpticKind, number> = { reflex: 0.3, acog: 0.21, holo: 0.2, reddot: 0.2 };
/** How far behind the optic's rear end the eye stays at least (the Romeo 8T's deep hood needs more room). */
// (the reflex sight's long low mount may pass under the eye)
const EYE_CLEAR: Record<OpticKind, number> = { reflex: -0.04, acog: 0.02, holo: 0.02, reddot: 0.02 };
/** The optic sits this high over the rail's top (its own mount). */
const OPTIC_RISER = 0.012;
/** Iron sights: how far behind the grip the eye sits (gun space, m); handguns are held at arm's length. */
const RIFLE_EYE = 0.08;
const HANDGUN_EYE = 0.14;
/** Parts within this of the sight line (below it) count as standing up to it; the eye stays this far behind them. */
const IRON_CLEAR_BAND = 0.012;
const IRON_EYE_CLEAR = 0.06;
/** The minigun's bulk sits further from the eye, so the rival's upper body clears its handle. */
const EYE_BACK: Partial<Record<WeaponId, number>> = { minigun: 0.3 };
/** Near-black optic parts are lifted to dark grey with some sheen, so the housing and its mount read in shading. */
const OPTIC_MIN = 0.045;
const liftedMats = new Map<THREE.Material, THREE.Material>();
function lifted(m: THREE.MeshStandardMaterial): THREE.Material {
  if (!m.color || Math.max(m.color.r, m.color.g, m.color.b) >= OPTIC_MIN) return m;
  let c = liftedMats.get(m);
  if (!c) {
    const n = m.clone();
    n.color.setRGB(OPTIC_MIN, OPTIC_MIN, OPTIC_MIN * 1.1);
    n.metalness = 0.5;
    n.roughness = 0.45;
    liftedMats.set(m, (c = n));
  }
  return c;
}
const reticleMat = new THREE.MeshBasicMaterial({ color: RETICLE_COLOR, toneMapped: false, side: THREE.DoubleSide });
const DOT_R = 0.0013;
/** The reticle floats this far behind the window (eye side), in front of the sight's own emitter. */
const RETICLE_BEHIND = 0.006;
const reticleGeo: Record<OpticKind, () => THREE.BufferGeometry> = {
  reflex: () => new THREE.CircleGeometry(DOT_R, 12),
  reddot: () => new THREE.CircleGeometry(DOT_R, 12),
  holo: () => mergeGeometries([new THREE.RingGeometry(0.0062, 0.0072, 32), new THREE.CircleGeometry(DOT_R * 0.9, 12)])!,
  acog: () => {
    // Chevron: two short bars meeting at the aim point
    const bar = (rz: number) => new THREE.PlaneGeometry(0.0007, 0.0035).translate(0, -0.00175, 0).rotateZ(rz);
    return mergeGeometries([bar(0.55), bar(-0.55)])!;
  },
};
const reticles = new Map<OpticKind, THREE.BufferGeometry>();
/** Width (m, gun space) of the rail strip searched for the receiver's top, and the size of its steps. */
const RAIL_HALF_WIDTH = 0.025;
const RAIL_STEP = 0.01;

/**
 * Puts the optic on top of the receiver (on the rail's usual height, ignoring iron sights sticking up from it), its
 * lens on the bore line, and the reticle in the lens; aiming then looks through the reticle.
 */
function mountOptic(gun: GunModel, holder: THREE.Object3D, optic: THREE.Group, sight: Optic): void {
  const pivot = new THREE.Group();
  pivot.rotation.y = Math.PI / 2; // sight line from +X to -Z
  pivot.scale.setScalar(GUN_SPACE * (sight.scale ?? 1));
  pivot.add(optic);
  const box = new THREE.Box3().setFromObject(pivot);
  const cz = GRIP.z - sight.at * GUN_SPACE;
  const half = (box.max.z - box.min.z) / 2;
  // Top of the receiver under the optic: highest point of each step along it, then the median (a sight post or a
  // charging handle in one step does not lift the optic)
  const tops = new Map<number, number>();
  eachVertex(holder, (v) => {
    if (Math.abs(v.x) > RAIL_HALF_WIDTH || Math.abs(v.z - cz) > half) return;
    const k = Math.floor((v.z - cz) / RAIL_STEP);
    tops.set(k, Math.max(tops.get(k) ?? -Infinity, v.y));
  });
  const sorted = [...tops.values()].sort((a, b) => a - b);
  const rail = sorted.length ? sorted[Math.floor(sorted.length / 2)]! : gun.userData.muzzleY;
  const lens = new THREE.Box3();
  pivot.updateMatrixWorld(true);
  pivot.traverse((o) => {
    if (o instanceof THREE.Mesh && /glass/i.test((o.material as THREE.Material).name)) lens.expandByObject(o);
  });
  const centre = lens.isEmpty() ? box.getCenter(new THREE.Vector3()) : lens.getCenter(new THREE.Vector3());
  pivot.position.set(-centre.x, rail + OPTIC_RISER - box.min.y, cz - (box.min.z + box.max.z) / 2);
  centre.add(pivot.position);
  pivot.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    o.castShadow = true;
    o.material = lifted(o.material as THREE.MeshStandardMaterial);
    // The glass is left out: the scene reads clear through the window
    if (/glass/i.test((o.material as THREE.Material).name)) o.visible = false;
  });
  let geo = reticles.get(sight.kind);
  if (!geo) reticles.set(sight.kind, (geo = reticleGeo[sight.kind]()));
  const reticle = new THREE.Mesh(geo, reticleMat);
  // just behind the glass (eye side), facing the eye
  reticle.position.set(0, centre.y, sight.kind === 'acog' ? centre.z : lens.max.z + pivot.position.z + RETICLE_BEHIND);
  reticle.renderOrder = 3;
  gun.add(pivot, reticle);
  gun.userData.sightY = centre.y;
  gun.userData.optic = true;
  gun.userData.sightZ = reticle.position.z;
  // The eye sits behind the optic, so close that its window fills about a third of the screen height (Krunker-style)
  // (but never inside a long hood: at least just behind the optic's rear end)
  gun.userData.eyeZ = Math.max(
    centre.z + (lens.max.y - lens.min.y) / WINDOW_SHARE[sight.kind],
    box.max.z + pivot.position.z + EYE_CLEAR[sight.kind],
  );
}
