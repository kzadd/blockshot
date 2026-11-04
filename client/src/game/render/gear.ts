// The class's accessory on the models (cheap block parts in the characters' style): the Kevlar vest and helmet on
// the body, the suppressor tube and the laser module on the gun, and the laser's beam and dot for the others.
import * as THREE from 'three';
import { silenced, type AccessoryId } from '@blockshot/shared';
import type { CharacterModel, GunModel } from './models';

const GEAR = 'accessory-gear';
const KEVLAR = 'accessory-kevlar';

const kevlarMat = new THREE.MeshStandardMaterial({ color: '#4b5139', roughness: 0.85, metalness: 0.05 });
const strapMat = new THREE.MeshStandardMaterial({ color: '#23262b', roughness: 0.9 });
const tubeMat = new THREE.MeshStandardMaterial({ color: '#1d2024', roughness: 0.45, metalness: 0.6 });
const laserBodyMat = new THREE.MeshStandardMaterial({ color: '#2a2d32', roughness: 0.5, metalness: 0.4 });
const LASER_RED = 0xff2a2a;
const laserLensMat = new THREE.MeshBasicMaterial({ color: LASER_RED });

const box = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
};

/** Suppressor (2026-11-04): length and radius (m, gun space). */
const SUPPRESSOR = { len: 0.17, r: 0.024 };

/**
 * Puts the accessory's parts on a gun (again after every model swap): a suppressor on the muzzle of a silenced gun,
 * a laser module under the barrel. The muzzle flash moves to the end of the suppressor and shrinks.
 */
export function fitGunGear(gun: GunModel, acc: AccessoryId | null | undefined): void {
  gun.getObjectByName(GEAR)?.removeFromParent();
  const id = gun.userData.id;
  if (!acc || acc === 'none' || id === 'knife') return;
  const { muzzleY: y, muzzleZ: z } = gun.userData;
  const g = new THREE.Group();
  g.name = GEAR;
  if (silenced(id, acc)) {
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(SUPPRESSOR.r, SUPPRESSOR.r, SUPPRESSOR.len, 10), tubeMat);
    tube.rotation.x = Math.PI / 2;
    tube.position.set(0, y, z - SUPPRESSOR.len / 2 + 0.01);
    tube.castShadow = true;
    g.add(tube);
    const flash = gun.userData.flash;
    if (flash && !flash.userData.moved) {
      flash.position.z -= SUPPRESSOR.len;
      flash.scale.setScalar(0.4);
      flash.userData.moved = true;
    }
  }
  if (acc === 'laser') {
    // Under the front of the barrel: the module and its red lens
    const at = z * 0.6;
    g.add(box(0.032, 0.03, 0.08, laserBodyMat, 0, y - 0.045, at));
    g.add(box(0.018, 0.016, 0.004, laserLensMat, 0, y - 0.045, at - 0.042));
  }
  gun.add(g);
}

/** Where the laser leaves the gun (gun space), for the beam. */
export const laserOrigin = (gun: GunModel, out: THREE.Vector3): THREE.Vector3 =>
  out.set(0, gun.userData.muzzleY - 0.045, gun.userData.muzzleZ * 0.6 - 0.045);

/** The armour accessory over whatever kit the body wears: the Kevlar vest, or the helmet (anything else: none). */
export function wearKevlar(model: CharacterModel, acc: AccessoryId | null | undefined): void {
  model.upper.getObjectByName(KEVLAR)?.removeFromParent();
  if (acc !== 'kevlar' && acc !== 'helmet') return;
  const g = new THREE.Group();
  g.name = KEVLAR;
  if (acc === 'helmet') {
    // A shell over the head with a brim (drawn a bit bigger than any hat under it)
    g.add(box(0.36, 0.13, 0.38, kevlarMat, 0, 1.83, 0.01));
    g.add(box(0.38, 0.05, 0.4, kevlarMat, 0, 1.765, 0.01));
    g.add(box(0.33, 0.03, 0.08, strapMat, 0, 1.79, -0.2)); // front rim
    model.upper.add(g);
    return;
  }
  g.add(box(0.47, 0.4, 0.07, kevlarMat, 0, 1.19, -0.19)); // front plate
  g.add(box(0.47, 0.42, 0.07, kevlarMat, 0, 1.19, 0.19)); // back plate
  g.add(box(0.53, 0.14, 0.42, kevlarMat, 0, 1.02, 0)); // side wrap
  for (const x of [-0.15, 0.15]) g.add(box(0.07, 0.04, 0.42, strapMat, x, 1.42, 0)); // shoulder straps
  for (const x of [-0.12, 0, 0.12]) g.add(box(0.09, 0.1, 0.04, strapMat, x, 1.09, -0.24)); // pouches
  model.upper.add(g);
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
