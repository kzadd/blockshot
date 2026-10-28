import * as THREE from 'three';

// Effect sprites from Kenney's "Smoke Particles" and "Particle Pack" and ExileGL's "Blood Splatter" (all CC0, see
// ASSETS_CREDITS.md), packed into one 512 px atlas of 4×4 cells (public/fx/fx.png): one image on the GPU, each
// frame is a texture view of it. White frames are tinted by the material colour.
export const FX = {
  puff: [0, 1, 2, 3], // white smoke puffs
  fire: [4, 5, 6], // explosion fire balls
  blackSmoke: 7,
  muzzleSide: 8,
  muzzleSide2: 9,
  flash: 10, // star burst: the muzzle flash seen from behind the gun
  glow: 11,
  debris: 12, // a spray of droplets / chips
  dust: 13,
  blood: [14, 15], // red splats (already coloured)
} as const;

const CELLS = 4;
const url = `${import.meta.env.BASE_URL}fx/fx.png`;
let atlas: THREE.Texture | null = null;
const frames = new Map<number, THREE.Texture>();

/** A texture showing one cell of the atlas (views share the image, so it is uploaded once). */
export function fxFrame(i: number): THREE.Texture {
  let t = frames.get(i);
  if (t) return t;
  if (!atlas) {
    // Views made before the image arrives get it when it does (each texture uploads on its own version)
    atlas = new THREE.TextureLoader().load(url, () => frames.forEach((f) => (f.needsUpdate = true)));
    atlas.colorSpace = THREE.SRGBColorSpace;
  }
  t = atlas.clone();
  t.repeat.set(1 / CELLS, 1 / CELLS);
  // Cell 0 is the top-left of the image; texture v grows upwards
  t.offset.set((i % CELLS) / CELLS, 1 - (Math.floor(i / CELLS) + 1) / CELLS);
  frames.set(i, t);
  return t;
}

export const pick = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)]!;
