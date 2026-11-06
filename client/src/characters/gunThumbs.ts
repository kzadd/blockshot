import * as THREE from 'three';
import type { WeaponId } from '@blockshot/shared';
import { loadGun, type GunLook } from '../game/render/gunAssets';

// Side-on pictures of the guns for the loadout options of the class screen. One small offscreen renderer
// draws them (the same models and finishes the player holds) and lets its WebGL context go once it has been idle
// for a moment, so it never adds to the context count while the game runs. Each picture is kept as a data URL.

const W = 240;
const H = 90;
/** Empty space around the gun, as a fraction of the frame. */
const MARGIN = 0.1;
/** The renderer is freed after this long without a request. */
const IDLE_MS = 3000;

const cache = new Map<string, Promise<string>>();
let ctx: { renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.OrthographicCamera } | null = null;
let idle: ReturnType<typeof setTimeout> | undefined;
let queue: Promise<unknown> = Promise.resolve();

function context() {
  if (ctx) return ctx;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 2.2; // most real guns are black: lit up so they read on the dark cards
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xdfe6f0, 0x4a4540, 2.2));
  const key = new THREE.DirectionalLight(0xfff3e6, 2.4);
  key.position.set(1, 2, 3);
  const rim = new THREE.DirectionalLight(0xffffff, 1.2);
  rim.position.set(-2, 1, -1);
  scene.add(rim);
  scene.add(key);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 20);
  camera.position.set(0, 0, 10);
  return (ctx = { renderer, scene, camera });
}

function release() {
  clearTimeout(idle);
  idle = setTimeout(() => {
    if (!ctx) return;
    ctx.renderer.dispose();
    ctx.renderer.forceContextLoss();
    ctx = null;
  }, IDLE_MS);
}

async function draw(id: WeaponId, look: GunLook): Promise<string> {
  const gun = await loadGun(id, look);
  const { renderer, scene, camera } = context();
  // The guns point along -Z: turn them side-on, muzzle to the right
  gun.rotation.set(0, -Math.PI / 2, 0);
  scene.add(gun);
  const box = new THREE.Box3().setFromObject(gun);
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  // Fit the longer side with the margin, keeping the frame's aspect
  const half = Math.max(size.x / 2, (size.y / 2) * (W / H)) / (1 - MARGIN * 2);
  Object.assign(camera, { left: -half, right: half, top: half * (H / W), bottom: -half * (H / W) });
  camera.position.set(centre.x, centre.y, centre.z + 10);
  camera.lookAt(centre);
  camera.updateProjectionMatrix();
  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL('image/png');
  scene.remove(gun);
  release();
  return url;
}

/** A side-on picture of the gun with this look (cached; drawn one at a time). */
export function gunThumb(id: WeaponId, look: GunLook): Promise<string> {
  const key = `${id}|${look.finish ?? ''}|${look.color ?? ''}|${look.camo ?? ''}`;
  let p = cache.get(key);
  if (!p) {
    p = queue.then(() => draw(id, look));
    queue = p.catch(() => undefined);
    p.catch(() => cache.delete(key)); // a failed picture is drawn again next time
    cache.set(key, p);
  }
  return p;
}
