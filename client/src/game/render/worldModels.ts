import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

// Pack models placed in the maps (props in the arena and the scenery outside): Kenney's city, industrial,
// suburban, survival and nature kits and Quaternius's crates, pallet, cars and street light (all CC0, see
// ASSETS_CREDITS.md), in public/models/world. They are only looks: collisions stay the map's boxes.
// Each model part is one InstancedMesh for all its copies, so a map costs a draw call per part, not per prop;
// the materials become Lambert (cheaper than the packs' standard ones on integrated graphics).

/** How a model fills its spot: `box` stretches it to w×h×d; `height` scales it evenly to height h. */
export type Fit = 'box' | 'height';
export interface Placement {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  ry?: number;
  /** tipped over first (radians round x): a model lying along z stood up */
  rx?: number;
  fit?: Fit;
  /** multiplies the model's colours (all parts, or only the `tintPart` ones when the model names one) */
  tint?: string;
}

/** Parts that take the tint instead of the whole model (a car's paint). */
const TINT_PART: Record<string, RegExp> = {
  'q-car-sedan': /^blue$/i,
  'q-car-hatch': /^lightblue$/i,
  'q-car-suv': /^white$/i,
};

const BASE = `${import.meta.env.BASE_URL}models/`;
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const sources = new Map<string, Promise<THREE.Group | null>>();
function source(file: string): Promise<THREE.Group | null> {
  let p = sources.get(file);
  if (!p) {
    p = loader
      .loadAsync(`${BASE}${file}.glb`)
      .then((g) => g.scene)
      .catch(() => null);
    sources.set(file, p);
  }
  return p;
}

/**
 * The nature kit's flat colours are bright toy ones: leaves and bark get natural colours; its rocks' dirt and
 * grass go white so each placement's tint gives the rock its colour (desert mesas).
 */
const RECOLOR: Record<string, string> = {
  leafsGreen: '#4f8a3c',
  woodBark: '#6b4a2b',
  dirt: '#ffffff',
  grass: '#efe2c8',
};

const lambert = new Map<THREE.Material, THREE.MeshLambertMaterial>();
function cheap(m: THREE.Material): THREE.MeshLambertMaterial {
  let l = lambert.get(m);
  if (!l) {
    const s = m as THREE.MeshStandardMaterial;
    const color = RECOLOR[s.name] ?? s.color;
    l = new THREE.MeshLambertMaterial({ color, map: s.map, vertexColors: s.vertexColors, name: s.name });
    lambert.set(m, l);
  }
  return l;
}

export class WorldModels {
  private readonly placed = new Map<string, Placement[]>();

  constructor(private readonly shadows: boolean) {}

  /** `file`: path under public/models without .glb ('world/q-crate', 'props/sacks'). */
  add(file: string, p: Placement): void {
    const list = this.placed.get(file);
    if (list) list.push(p);
    else this.placed.set(file, [p]);
  }

  /** Loads the models and adds them to the scene as they arrive. */
  build(scene: THREE.Scene): void {
    for (const [file, list] of this.placed)
      void source(file).then((src) => src && this.instance(scene, file, src, list));
  }

  private instance(scene: THREE.Scene, file: string, src: THREE.Group, list: Placement[]): void {
    src.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(src);
    const size = box.getSize(new THREE.Vector3());
    // Model space → a unit spot: centred on x/z, standing on y = 0
    const toBase = new THREE.Matrix4().makeTranslation(
      -(box.min.x + box.max.x) / 2,
      -box.min.y,
      -(box.min.z + box.max.z) / 2,
    );
    const spots = list.map((p) => {
      const s =
        p.fit === 'height'
          ? new THREE.Vector3().setScalar(p.h / size.y)
          : new THREE.Vector3(p.w / size.x, p.h / size.y, p.d / size.z);
      return new THREE.Matrix4()
        .compose(
          new THREE.Vector3(p.x, p.y, p.z),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(p.rx ?? 0, p.ry ?? 0, 0, 'YXZ')),
          s,
        )
        .multiply(toBase);
    });
    const part = TINT_PART[file.split('/').pop()!];
    const m = new THREE.Matrix4();
    const white = new THREE.Color(1, 1, 1);
    const tint = new THREE.Color();
    src.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const mats = (Array.isArray(o.material) ? o.material : [o.material]) as THREE.Material[];
      const mesh = new THREE.InstancedMesh(
        o.geometry,
        mats.length > 1 ? mats.map(cheap) : cheap(mats[0]!),
        list.length,
      );
      const tinted = !part || mats.some((x) => part.test(x.name));
      list.forEach((p, i) => {
        mesh.setMatrixAt(i, m.multiplyMatrices(spots[i]!, o.matrixWorld));
        if (list.some((q) => q.tint)) mesh.setColorAt(i, p.tint && tinted ? tint.set(p.tint) : white);
      });
      mesh.castShadow = mesh.receiveShadow = this.shadows;
      mesh.computeBoundingSphere();
      scene.add(mesh);
    });
  }
}
