// The class's accessory on the models (props.ts models): the Kevlar vest, helmet, night-vision goggles, bandages and
// the drum magazine on the body; the suppressor and the laser module on the gun, and the laser's beam and dot for
// the others.
import * as THREE from 'three';
import { silenced, type AccessoryId } from '@blockshot/shared';
import type { CharacterModel, GunModel } from './models';
import { prop, type PropName } from './props';

const GEAR = 'accessory-gear';
const KEVLAR = 'accessory-kevlar';
const LASER_RED = 0xff2a2a;

/** Suppressor (2026-11-04): length and diameter (m, gun space). */
const SUPPRESSOR = { len: 0.17, d: 0.042 };
/** Laser module on the right side of the barrel: size (w, h, d), and how far along the gun (share of the muzzle's z). */
const LASER_BOX = [0.03, 0.026, 0.065] as const;
const LASER_AT = 0.6;
const SLICE = 0.03;

/** Rightmost point of the gun's model around `z` (gun space), so the laser sits on its side whatever the model. */
function sideX(gun: GunModel, z: number): number {
  let x = 0.02;
  const v = new THREE.Vector3();
  gun.updateMatrixWorld(true);
  const inv = gun.matrixWorld.clone().invert();
  gun.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || o === gun.userData.flash) return;
    const m = o.matrixWorld.clone().premultiply(inv);
    const pos = o.geometry.attributes.position!;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m);
      if (Math.abs(v.z - z) < SLICE && Math.abs(v.y - gun.userData.muzzleY) < 0.05) x = Math.max(x, v.x);
    }
  });
  return x;
}

/**
 * Puts the accessory's parts on a gun (again after every model swap): a suppressor on the muzzle of a silenced gun,
 * a laser module on the right of the barrel. The muzzle flash moves to the end of the suppressor and shrinks.
 */
export function fitGunGear(gun: GunModel, acc: AccessoryId | null | undefined): void {
  gun.getObjectByName(GEAR)?.removeFromParent();
  const id = gun.userData.id;
  if (!acc || acc === 'none' || id === 'knife') return;
  const { muzzleY: y, muzzleZ: z } = gun.userData;
  const g = new THREE.Group();
  g.name = GEAR;
  if (silenced(id, acc)) {
    const tube = prop('silencer', [SUPPRESSOR.d, SUPPRESSOR.d, SUPPRESSOR.len]);
    tube.position.set(0, y - SUPPRESSOR.d / 2, z - SUPPRESSOR.len / 2 + 0.01);
    g.add(tube);
    const flash = gun.userData.flash;
    if (flash && !flash.userData.moved) {
      flash.position.z -= SUPPRESSOR.len;
      flash.scale.setScalar(0.4);
      flash.userData.moved = true;
    }
  }
  if (acc === 'laser') {
    const [w, h, d] = LASER_BOX;
    const at = z * LASER_AT;
    // The PEQ's emitters face +Z in its file: turned round to face the muzzle's way
    const box = prop('laser', [w, h, d]);
    box.rotation.y = Math.PI;
    const x = sideX(gun, at) + w / 2;
    box.position.set(x, y - h / 2, at);
    g.add(box);
    g.userData.laser = new THREE.Vector3(x, y, at - d / 2);
  }
  gun.add(g);
}

/** Where the laser leaves the gun (gun space): the module's front face, for the beam. */
export const laserOrigin = (gun: GunModel, out: THREE.Vector3): THREE.Vector3 => {
  const at = gun.getObjectByName(GEAR)?.userData.laser as THREE.Vector3 | undefined;
  return at ? out.copy(at) : out.set(0, gun.userData.muzzleY, gun.userData.muzzleZ * LASER_AT);
};

/**
 * Body accessories: model, size (largest side, or a box it is stretched to), where its bottom-centre goes and how it
 * turns, on the upper body or (`thigh`) the left thigh. Drawn a bit bigger than any class kit under them.
 */
const WORN: Partial<
  Record<
    AccessoryId,
    {
      prop: PropName;
      size: number | [number, number, number];
      at: [number, number, number];
      rot?: [number, number, number];
      thigh?: boolean;
    }
  >
> = {
  kevlar: { prop: 'kevlar', size: [0.6, 0.54, 0.46], at: [0, 0.95, 0] },
  helmet: { prop: 'helmet', size: [0.42, 0.36, 0.5], at: [0, 1.57, 0.02] },
  goggles: { prop: 'goggles', size: 0.2, at: [0, 1.76, -0.17] },
  bandage: { prop: 'bandage', size: 0.11, at: [-0.1, -0.2, 0], thigh: true },
  ammo: { prop: 'ammo', size: 0.17, at: [0.1, 0.8, 0.19], rot: [0, Math.PI / 2, 0] },
};

/** The body accessory over whatever kit the body wears (the gun ones are fitGunGear's). */
export function wearKevlar(model: CharacterModel, acc: AccessoryId | null | undefined): void {
  for (const part of [model.upper, model.legL]) part.getObjectByName(KEVLAR)?.removeFromParent();
  const w = acc ? WORN[acc] : undefined;
  if (!w) return;
  const g = prop(w.prop, w.size);
  g.name = KEVLAR;
  g.position.set(...w.at);
  if (w.rot) g.rotation.set(...w.rot);
  (w.thigh ? model.legL : model.upper).add(g);
}

/** Longest a remote's laser is drawn (m). */
export const LASER_RANGE = 60;
const DOT_SIZE = 0.09;

let dotTexture: THREE.CanvasTexture | null = null;
function dotMap(): THREE.CanvasTexture {
  if (dotTexture) return dotTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,60,60,1)');
  grad.addColorStop(1, 'rgba(255,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 32);
  dotTexture = new THREE.CanvasTexture(c);
  return dotTexture;
}

/** A laser seen by the others: a thin red beam from the gun to what it touches, and a dot there. */
export class LaserBeam {
  readonly beam: THREE.Mesh;
  readonly dot: THREE.Sprite;
  private readonly look = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    const geo = new THREE.BoxGeometry(0.006, 0.006, 1).translate(0, 0, -0.5);
    this.beam = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({
        color: LASER_RED,
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.beam.frustumCulled = false;
    this.dot = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: dotMap(),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.dot.scale.setScalar(DOT_SIZE);
    scene.add(this.beam, this.dot);
  }

  /** From `from` along the unit `dir` for `len` m (the dot sits there when it touched something). */
  set(from: THREE.Vector3, dir: THREE.Vector3, len: number, touched: boolean): void {
    this.beam.position.copy(from);
    this.beam.lookAt(this.look.copy(from).sub(dir));
    this.beam.scale.set(1, 1, len);
    this.beam.visible = true;
    this.dot.position.copy(from).addScaledVector(dir, len - 0.02);
    this.dot.visible = touched;
  }

  hide(): void {
    this.beam.visible = this.dot.visible = false;
  }

  dispose(): void {
    this.beam.removeFromParent();
    this.dot.removeFromParent();
    (this.beam.material as THREE.Material).dispose();
    this.dot.material.dispose();
  }
}
