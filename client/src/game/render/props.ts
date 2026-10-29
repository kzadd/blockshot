import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

// Small props for grenades and abilities, from Quaternius and Pichuliru on Poly Pizza (CC0, see ASSETS_CREDITS.md),
// as meshopt GLBs in public/models/props. Clones share geometry and materials, so many of them cost little.
export type PropName = 'grenade' | 'smokegren' | 'mine' | 'sacks' | 'shield' | 'medkit' | 'radio' | 'barrel' | 'crate';
/** Props that are one of the world kits' models (public/models/world, Kenney; see ASSETS_CREDITS.md). */
const FILE: Partial<Record<PropName, string>> = { barrel: '../world/s-barrel', crate: '../world/q-crate' };

const BASE = `${import.meta.env.BASE_URL}models/props/`;
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const sources = new Map<PropName, Promise<THREE.Group | null>>();
const source = (name: PropName): Promise<THREE.Group | null> => {
  let p = sources.get(name);
  if (!p) {
    p = loader
      .loadAsync(`${BASE}${FILE[name] ?? name}.glb`)
      .then((g) => {
        g.scene.traverse((o) => {
          if (o instanceof THREE.Mesh) o.castShadow = o.receiveShadow = true;
        });
        return g.scene;
      })
      .catch(() => null);
    sources.set(name, p);
  }
  return p;
};

/** Starts loading props that will be needed soon (so the first grenade does not pop in late). */
export const preloadProps = (...names: PropName[]): void => names.forEach((n) => void source(n));

/**
 * A prop sitting on y = 0 and centred on x/z, in a group returned at once (the model appears when loaded).
 * `size`: a number scales the model evenly so its largest side is that long; [w, h, d] stretches it to that box.
 */
export function prop(name: PropName, size: number | readonly [number, number, number]): THREE.Group {
  const holder = new THREE.Group();
  void source(name).then((src) => {
    if (!src) return;
    const m = src.clone(true);
    const box = new THREE.Box3().setFromObject(m);
    const s = box.getSize(new THREE.Vector3());
    if (typeof size === 'number') m.scale.setScalar(size / Math.max(s.x, s.y, s.z));
    else m.scale.set(size[0] / s.x, size[1] / s.y, size[2] / s.z);
    const c = box.getCenter(new THREE.Vector3());
    m.position.set(-c.x * m.scale.x, -box.min.y * m.scale.y, -c.z * m.scale.z);
    holder.add(m);
  });
  return holder;
}
