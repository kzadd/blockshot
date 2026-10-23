// The first-person gun and arms: their own scene and camera (so the gun never clips through walls),
// with bob, kick, reload dip, weapon swap, sprint lean, slide tilt and the knife slash.
import * as THREE from 'three';
import type { Weapon, WeaponId } from '@blockshot/shared';
import { buildArms, buildGun, type GunModel } from '../render/models';

const VM_FOV = 60;
const HOLDER_SCALE = 0.85;
const DEFAULT_SIGHT_Y = 0.12;
const BOB_RATE = 1.3;
const BOB_FULL_SPEED = 7;
const BOB_ADS_CUT = 0.85;
const BOB_SPRINT = 1.2;
const BOB_X = 0.014;
const BOB_Y = 0.012;
// Rest and aim positions
const HIP_X = 0.22;
const HIP_Y = -0.2;
const HIP_Z = -0.42;
const AIM_Z = -0.46;
const KICK_Z = 0.07;
const KICK_RX = 0.12;
/** Weapons with more recoil than this kick twice as much. */
const HEAVY_RECOIL = 0.03;
const RELOAD_DIP_Y = 0.16;
const RELOAD_DIP_RX = 0.7;
const SWAP_MS = 250;
const SWAP_DROP = 0.25;
const SLIDE_RX = 0.08;
const SLIDE_RZ = 0.25;
const SPRINT_X = 0.04;
const SPRINT_Y = 0.05;
const SPRINT_RX = 0.3;
const SPRINT_RY = 0.7;
const SPRINT_RZ = 0.3;
const SWING_MS = 280;
const FLASH_MS = 45;

export interface ViewModelFrame {
  weapon: Weapon;
  speed: number;
  grounded: boolean;
  sliding: boolean;
  sprintLerp: number;
  aimLerp: number;
  kick: number;
  reloadEnd: number;
  swapUntil: number;
  swingAt: number;
  flashTime: number;
}

export class ViewModel {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  private readonly holder = new THREE.Group();
  private gun: GunModel | null = null;
  private bobT = 0;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(VM_FOV, aspect, 0.01, 10);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x777777, 2));
    const light = new THREE.DirectionalLight(0xffffff, 1.4);
    light.position.set(1, 2, 1);
    this.scene.add(light);
    this.holder.scale.setScalar(HOLDER_SCALE);
    this.scene.add(this.holder);
  }

  get visible(): boolean {
    return this.holder.visible;
  }

  setGun(id: WeaponId, color: string, skin: string): void {
    this.holder.clear();
    this.gun = buildGun(id, true, color);
    buildArms(this.gun, skin, color);
    this.holder.add(this.gun);
  }

  update(dt: number, now: number, show: boolean, f: ViewModelFrame | null): void {
    this.holder.visible = show;
    if (!show || !f || !this.gun) return;
    const w = f.weapon;
    if (f.grounded && !f.sliding) this.bobT += dt * f.speed * BOB_RATE;
    const sp = f.sprintLerp;
    const amt = Math.min(f.speed / BOB_FULL_SPEED, 1) * (1 - f.aimLerp * BOB_ADS_CUT) * (1 + sp * BOB_SPRINT);
    const t = f.aimLerp;
    let x = HIP_X * (1 - t) + Math.sin(this.bobT) * BOB_X * amt;
    const sightY = (this.gun.userData.sightY ?? DEFAULT_SIGHT_Y) * this.holder.scale.y;
    let y = HIP_Y * (1 - t) - sightY * t - Math.abs(Math.cos(this.bobT)) * BOB_Y * amt;
    // Aiming, the gun sits a bit further away: the red dot hides less of the target
    let z = HIP_Z * (1 - t) + AIM_Z * t + f.kick * KICK_Z;
    let rx = f.kick * KICK_RX * (w.recoil > HEAVY_RECOIL ? 2 : 1);

    if (f.reloadEnd) {
      const p = 1 - (f.reloadEnd - now) / w.reload;
      const dip = Math.sin(Math.max(0, Math.min(1, p)) * Math.PI);
      y -= dip * RELOAD_DIP_Y;
      rx -= dip * RELOAD_DIP_RX;
    }
    if (now < f.swapUntil) y -= ((f.swapUntil - now) / SWAP_MS) * SWAP_DROP;
    if (f.sliding) rx += SLIDE_RX;
    // Sprinting lowers and tilts the gun
    x -= sp * SPRINT_X;
    y -= sp * SPRINT_Y;
    rx -= sp * SPRINT_RX;

    let ry = sp * SPRINT_RY;
    let rz = (f.sliding ? SLIDE_RZ : 0) + sp * SPRINT_RZ;
    // Knife: right-to-left slash
    const sw = (now - f.swingAt) / SWING_MS;
    if (w.melee && sw < 1) {
      const k = Math.sin(sw * Math.PI);
      x -= k * 0.18;
      z -= k * 0.12;
      ry += k * 0.9;
      rz -= k * 0.6;
      rx -= k * 0.3;
    }
    this.holder.position.set(x, y, z);
    this.holder.rotation.set(rx, ry, rz);
    if (this.gun.userData.flash) this.gun.userData.flash.visible = now - f.flashTime < FLASH_MS;
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
}
