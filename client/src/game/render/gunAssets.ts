import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import type { CamoId, FinishId, WeaponId } from '@blockshot/shared';
import { buildGun, camoMap, patternMap, type GunModel } from './models';

// Guns from Quaternius's "Ultimate Gun Pack" (CC0, see ASSETS_CREDITS.md), as meshopt GLBs in public/models/guns.
// Each one is fitted onto the procedural gun of the same weapon: same length, muzzle on the same spot and the
// bore at the same height, so hands, muzzle flash, sights and recoil keep working. The pack has no grenade
// launcher: it is put together from its parts (see launcherTube).
const FILES: Partial<Record<WeaponId, { file: string; bipod?: boolean; tube?: boolean; upright?: boolean }>> = {
  launcher: { file: 'launcher-body', tube: true },
  rifle: { file: 'rifle' },
  sniper: { file: 'sniper' },
  dmr: { file: 'dmr' },
  shotgun: { file: 'shotgun' },
  smg: { file: 'smg' },
  lmg: { file: 'lmg', bipod: true },
  pistol: { file: 'pistol' },
  revolver: { file: 'revolver' },
  mpistol: { file: 'mpistol' },
  sawedoff: { file: 'sawedoff' },
  // Quaternius's Knife (CC0, Poly Pizza) stands blade up: laid down along +X like the guns
  knife: { file: 'knife', upright: true },
};
const BASE = `${import.meta.env.BASE_URL}models/guns/`;

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const sources = new Map<string, Promise<THREE.Group>>();
const source = (file: string): Promise<THREE.Group> => {
  let p = sources.get(file);
  if (!p) sources.set(file, (p = loader.loadAsync(`${BASE}${file}.glb`).then((g) => g.scene)));
  return p;
};

// ------------------------------------------------------------ Finishes
// The pack names its materials by what they are: the frame (Black, DarkMetal, Main…), bright metal parts
// (Metal, LightMetal, Grey…) and furniture (Wood, Green). A finish repaints the frame, sometimes the rest.
type Part = 'frame' | 'metal' | 'furniture' | 'glass';
const partOf = (name: string): Part =>
  /glass/i.test(name)
    ? 'glass'
    : /wood|green/i.test(name)
      ? 'furniture'
      : /^(black2?|darkmetal|main|maindark)$/i.test(name)
        ? 'frame'
        : 'metal';

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

// The pack has no UVs: patterned finishes get a box projection (each face takes the two axes it faces)
const UV_SCALE = 1.4;
function boxUV(geo: THREE.BufferGeometry): void {
  if (geo.userData.boxUV) return;
  const pos = geo.attributes.position!;
  const nor = geo.attributes.normal!;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const [ax, ay, az] = [Math.abs(nor.getX(i)), Math.abs(nor.getY(i)), Math.abs(nor.getZ(i))];
    const [u, v] =
      ax >= ay && ax >= az
        ? [pos.getZ(i), pos.getY(i)]
        : ay >= az
          ? [pos.getX(i), pos.getZ(i)]
          : [pos.getX(i), pos.getY(i)];
    uv[i * 2] = u * UV_SCALE;
    uv[i * 2 + 1] = v * UV_SCALE;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.userData.boxUV = true;
}

const matCache = new Map<string, THREE.Material>();
function finished(src: THREE.MeshStandardMaterial, finish: FinishId, color: string, camo: CamoId): THREE.Material {
  const p = paint(finish, partOf(src.name), color, camo);
  if (!p) return src;
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
/** Average height of the vertices in the last `slice` of the barrel (the bore), in `root` space. */
function boreY(root: THREE.Object3D, minZ: number, slice: number): number {
  let sum = 0;
  let n = 0;
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert();
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const m = o.matrixWorld.clone().premultiply(inv);
    const pos = o.geometry.attributes.position!;
    for (let i = 0; i < pos.count; i++) {
      _v.fromBufferAttribute(pos, i).applyMatrix4(m);
      if (_v.z < minZ + slice) {
        sum += _v.y;
        n++;
      }
    }
  });
  return n ? sum / n : 0;
}

/** Highest point of the front `slice` of the gun (its front sight: aiming looks along its top), in `root` space. */
function sightTop(root: THREE.Object3D, minZ: number, slice: number): number {
  let top = -Infinity;
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert();
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const m = o.matrixWorld.clone().premultiply(inv);
    const pos = o.geometry.attributes.position!;
    for (let i = 0; i < pos.count; i++) {
      _v.fromBufferAttribute(pos, i).applyMatrix4(m);
      if (_v.z < minZ + slice) top = Math.max(top, _v.y);
    }
  });
  return top;
}

/**
 * Grenade launcher from the pack's parts: the short-stock shotgun gives the stock, grip and receiver, and a fat
 * suppressor slid over its barrel and pump becomes the launcher tube (an M79-like silhouette).
 */
/** Front share of the gun searched for its front sight, and how far above its tip the eye looks (m). */
const SIGHT_SLICE = 0.4;
const SIGHT_CLEAR = 0.002;
const TUBE_FROM = 0.4; // tube starts this far along the gun (from the butt), past the receiver
const TUBE_WIDTH = 0.72; // tube diameter in the pack's units (the barrel is about 0.2)
const TUBE_DROP = 0.1; // the tube sits a bit under the bore so it swallows the pump
function launcherTube(body: THREE.Group, tube: THREE.Group): THREE.Group {
  const b = new THREE.Box3().setFromObject(body);
  const len = b.max.x - b.min.x;
  // The pack's guns point to +X: find the bore height at the muzzle, in the same way as boreY but along X
  let sum = 0;
  let n = 0;
  body.updateMatrixWorld(true);
  body.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const pos = o.geometry.attributes.position!;
    for (let i = 0; i < pos.count; i++) {
      _v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      if (_v.x > b.max.x - len * 0.04) {
        sum += _v.y;
        n++;
      }
    }
  });
  const bore = n ? sum / n : (b.min.y + b.max.y) / 2;
  const t = new THREE.Box3().setFromObject(tube);
  const tubeLen = len * (1 - TUBE_FROM) + len * 0.02;
  tube.scale.set(tubeLen / (t.max.x - t.min.x), TUBE_WIDTH / (t.max.y - t.min.y), TUBE_WIDTH / (t.max.z - t.min.z));
  tube.updateMatrixWorld(true);
  t.setFromObject(tube);
  tube.position.set(
    b.max.x + len * 0.02 - t.max.x,
    bore - TUBE_DROP - (t.min.y + t.max.y) / 2,
    -(t.min.z + t.max.z) / 2,
  );
  return tube;
}

export interface GunLook {
  finish?: FinishId;
  /** outfit colour: neón glows in it, the procedural parts are tinted with it */
  color?: string;
  camo?: CamoId;
  withFlash?: boolean;
}

/**
 * The gun for a weapon with the pack's model and the chosen finish. Resolves to the procedural gun when the
 * weapon has no model (launcher) or the file fails to load, so callers can always use the result.
 */
export async function loadGun(id: WeaponId, look: GunLook = {}): Promise<GunModel> {
  const { finish = 'estandar', color = '#ffc93c', camo = 'liso', withFlash = false } = look;
  const gun = buildGun(id, withFlash, color);
  const entry = FILES[id];
  if (!entry) return gun;
  let model: THREE.Group;
  try {
    model = (await source(entry.file)).clone(true);
    if (entry.bipod) {
      const bipod = (await source('bipod')).clone(true);
      // Under the front of the barrel (the pack's guns point to +X)
      const b = new THREE.Box3().setFromObject(model);
      bipod.scale.setScalar(0.7);
      bipod.position.set(b.max.x - (b.max.x - b.min.x) * 0.28, b.min.y + (b.max.y - b.min.y) * 0.55, 0);
      model.add(bipod);
    }
    if (entry.tube) model.add(launcherTube(model, (await source('launcher-tube')).clone(true)));
    if (entry.upright) model.rotation.z = -Math.PI / 2;
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
  const len = box.max.z - box.min.z;
  pivot.scale.setScalar((target.max.z - target.min.z) / len);
  holder.updateMatrixWorld(true);
  box.setFromObject(pivot);
  const bore = boreY(holder, box.min.z, (box.max.z - box.min.z) * 0.04);
  pivot.position.set(-(box.min.x + box.max.x) / 2, gun.userData.muzzleY - bore, target.min.z - box.min.z);
  // Aimed, the eye looks along the top of the model's own front sight (the procedural gun's sight was elsewhere)
  if (id !== 'knife')
    gun.userData.sightY = sightTop(holder, target.min.z, (target.max.z - target.min.z) * SIGHT_SLICE) + SIGHT_CLEAR;

  const patterned = finish === 'carbono' || finish === 'camuflaje' || finish === 'damasco' || finish === 'lava';
  holder.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    if (patterned) boxUV(o.geometry);
    o.material = Array.isArray(o.material)
      ? o.material.map((m) => finished(m as THREE.MeshStandardMaterial, finish, color, camo))
      : finished(o.material as THREE.MeshStandardMaterial, finish, color, camo);
    o.castShadow = true;
  });
  gun.add(holder);
  return gun;
}
