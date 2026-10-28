import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// First-person hands: Quaternius's "Glove" (CC0, see ASSETS_CREDITS.md). The pack's glove is an open hand: the
// fingers are bent at the knuckles into a fist round a grip or a cup under a handguard (a bend deformer, no new
// geometry). Hand space: wrist at the origin, fingers towards -Z before bending, back of the hand towards +Y,
// thumb towards -X on the right hand (the left hand is its mirror image).

/** Wrist to fingertip, open (view-model units, metres). */
export const HAND_LEN = 0.2;
/** The knuckle line, as a share of the length from the wrist: the fingers bend past it. */
const KNUCKLE = 0.56;
/** Total bend of the fingers (radians): a fist closes round a grip, a cup just wraps under a handguard. */
const BEND = { fist: 4.4, cup: 2.2 } as const;
export type Grip = keyof typeof BEND;

const URL = `${import.meta.env.BASE_URL}models/hands/glove.glb`;
let base: { geo: THREE.BufferGeometry; thick: number } | null = null;

/** Resolves once the glove is loaded (never rejects: without it the arms are drawn without hands). */
export const handsReady: Promise<void> = new GLTFLoader()
  .setMeshoptDecoder(MeshoptDecoder)
  .loadAsync(URL)
  .then((gltf) => {
    gltf.scene.updateMatrixWorld(true);
    const parts: THREE.BufferGeometry[] = [];
    gltf.scene.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        const g = (o.geometry as THREE.BufferGeometry).clone().applyMatrix4(o.matrixWorld);
        parts.push(g.index ? g.toNonIndexed() : g);
      }
    });
    for (const g of parts) for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k);
    const geo = mergeGeometries(parts)!;
    // The pack's glove: fingers to +Z, thumb to +X, palm down. Turn it to fingers -Z, thumb -X
    geo.rotateY(Math.PI);
    geo.computeBoundingBox();
    const b = geo.boundingBox!;
    const k = HAND_LEN / (b.max.z - b.min.z);
    geo.translate(-(b.min.x + b.max.x) / 2, -(b.min.y + b.max.y) / 2, -b.max.z);
    geo.scale(k, k, k);
    base = { geo, thick: (b.max.y - b.min.y) * k };
  })
  .catch(() => undefined);

export const handsLoaded = () => base !== null;

/** Where the hole of a bent hand is (what it holds), in hand space. */
export function holdPoint(grip: Grip): THREE.Vector3 {
  const r = (HAND_LEN * (1 - KNUCKLE)) / BEND[grip];
  return new THREE.Vector3(0, -(base?.thick ?? 0.05) / 2 - r * 0.85, -HAND_LEN * KNUCKLE - r * 0.3);
}

const cache = new Map<string, THREE.BufferGeometry>();
/** The glove bent into `grip`, mirrored for the left hand. Null until the glove has loaded. */
export function handGeometry(grip: Grip, left: boolean): THREE.BufferGeometry | null {
  if (!base) return null;
  const key = `${grip}|${left}`;
  let g = cache.get(key);
  if (g) return g;
  g = base.geo.clone();
  const pos = g.attributes.position!;
  const knuckle = HAND_LEN * KNUCKLE;
  const R = (HAND_LEN - knuckle) / BEND[grip];
  // Bend round an axis along X under the palm, at the knuckle line: a point s past the knuckles goes s/R round
  const pivotY = -base.thick / 2;
  for (let i = 0; i < pos.count; i++) {
    const s = -pos.getZ(i) - knuckle;
    if (s <= 0) continue;
    const a = s / R;
    const r = R + (pos.getY(i) - pivotY);
    pos.setY(i, pivotY - R + r * Math.cos(a));
    pos.setZ(i, -(knuckle + r * Math.sin(a)));
  }
  if (left) {
    g.scale(-1, 1, 1);
    // Mirroring turns the triangles inside out: swap two corners of each one
    for (let i = 0; i < pos.count; i += 3) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      pos.setXYZ(i, pos.getX(i + 1), pos.getY(i + 1), pos.getZ(i + 1));
      pos.setXYZ(i + 1, x, y, z);
    }
  }
  g.computeVertexNormals();
  cache.set(key, g);
  return g;
}

const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
const _z = new THREE.Vector3();
const _m = new THREE.Matrix4();
/**
 * A hand holding `target`: its fingers point along `fingers` (before bending) and the back of the hand faces
 * `back`. Returns the mesh and the wrist position (for the forearm).
 */
export function handAt(
  grip: Grip,
  left: boolean,
  target: THREE.Vector3,
  fingers: THREE.Vector3,
  back: THREE.Vector3,
  mat: THREE.Material,
): { mesh: THREE.Mesh; wrist: THREE.Vector3 } | null {
  const geo = handGeometry(grip, left);
  if (!geo) return null;
  _z.copy(fingers).normalize().negate();
  _y.copy(back).addScaledVector(_z, -back.dot(_z)).normalize();
  _x.crossVectors(_y, _z);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.quaternion.setFromRotationMatrix(_m.makeBasis(_x, _y, _z));
  const hold = holdPoint(grip);
  if (left) hold.x = -hold.x;
  mesh.position.copy(target).sub(hold.applyQuaternion(mesh.quaternion));
  return { mesh, wrist: mesh.position.clone() };
}
