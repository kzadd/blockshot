// The first-person gun and arms: their own scene and camera (so the gun never clips through walls),
// with bob, kick, reload dip, weapon swap, sprint lean, slide tilt and the knife slash.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { WEAPON_HANDLING, type Weapon, type WeaponId } from '@blockshot/shared';
import { buildArms, buildGun, type GunModel } from '../render/models';
import { damp } from './util';

const VM_FOV = 60;
const HOLDER_SCALE = 0.72;
/** Reflections for the metal parts: a tiny room environment, prefiltered once. */
const ENV_INTENSITY = 0.55;
const ENV_BLUR = 0.04;
const BOB_RATE = 1.3;
const BOB_FULL_SPEED = 7;
const BOB_ADS_CUT = 0.85;
const BOB_SPRINT = 1.2;
const BOB_X = 0.014;
const BOB_Y = 0.012;
// Rest and aim positions: low and to the right, like Valorant/Krunker, clear of the ammo counter
const HIP_X = 0.13;
const HIP_Y = -0.19;
const HIP_Z = -0.52;
/** Slight muzzle-up pitch and inward yaw at the hip: the stock drops out of the bottom of the screen. */
const HIP_RX = 0.05;
const HIP_RY = 0.025;
/**
 * Gun position along the view while aiming: long guns sit with the eye over the stock (as with a real
 * cheek weld, so the stock stays below the view and the optic window reads well); handguns at arm's length.
 */
const AIM_Z: Partial<Record<WeaponId, number>> = {
  pistol: -0.6,
  revolver: -0.6,
  shotgun: -0.24,
  smg: -0.13,
  lmg: -0.18,
  rifle: -0.16,
  dmr: -0.14,
  launcher: -0.3,
  mpistol: -0.55,
  sawedoff: -0.36,
};
/** Hip position tweaks per gun (x, y, z, pitch): handguns a bit closer and higher, the knife blade up. */
const HIP_OFFSET: Partial<Record<WeaponId, readonly [number, number, number, number]>> = {
  pistol: [0, 0.035, 0.08, 0],
  revolver: [0, 0.035, 0.08, 0],
  mpistol: [0, 0.035, 0.08, 0],
  knife: [-0.03, 0.1, 0.08, 0.45],
};
const NO_OFFSET = [0, 0, 0, 0] as const;
const DEFAULT_AIM_Z = -0.2;
const KICK_Z = 0.07;
const KICK_RX = 0.12;
/** Aiming, the gun kicks less so the sight stays readable. */
const KICK_ADS_CUT = 0.5;
/** Weapons with more recoil than this kick twice as much. */
const HEAVY_RECOIL = 0.03;
const RELOAD_DIP_Y = 0.16;
const RELOAD_DIP_RX = 0.7;
const SWAP_DROP = 0.25;
const SLIDE_RX = 0.08;
const SLIDE_RZ = 0.25;
/** The slide tilt goes away while aiming and almost away while firing, so the sight and the tracers line up
 * with the crosshair; it eases in and out at this rate (1/s). */
const SLIDE_TILT_FIRING = 0.15;
const SLIDE_TILT_FOLLOW = 14;
const FIRING_MS = 350;
const SPRINT_X = 0.04;
const SPRINT_Y = 0.05;
const SPRINT_RX = 0.3;
const SPRINT_RY = 0.7;
const SPRINT_RZ = 0.3;
const SWING_MS = 280;
const FLASH_MS = 45;
/** Muzzle flash: random size range and the brief light it throws on the gun and hands. */
const FLASH_SCALE_MIN = 0.75;
const FLASH_SCALE_RANGE = 0.5;
const FLASH_LIGHT = 3;
const FLASH_LIGHT_RANGE = 1.2;
const FLASH_LIGHT_COLOR = 0xffb35a;

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
  private gunId: WeaponId = 'knife';
  private bobT = 0;
  /** 0..1: how much of the slide tilt is applied (eased) */
  private slideTilt = 0;
  private readonly flashLight = new THREE.PointLight(FLASH_LIGHT_COLOR, 0, FLASH_LIGHT_RANGE);
  private lastFlash = 0;
  private readonly tmp = new THREE.Vector3();

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(VM_FOV, aspect, 0.01, 10);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x777777, 2));
    const light = new THREE.DirectionalLight(0xffffff, 1.4);
    light.position.set(1, 2, 1);
    this.scene.add(light);
    this.holder.scale.setScalar(HOLDER_SCALE);
    this.scene.add(this.holder);
    // Always in the scene (intensity 0 when idle): adding/removing lights would recompile shaders
    this.scene.add(this.flashLight);
  }

  /** Prefilters a small environment so steel and brass catch reflections (done once, cheap). */
  initEnvironment(renderer: THREE.WebGLRenderer): void {
    const pmrem = new THREE.PMREMGenerator(renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), ENV_BLUR).texture;
    this.scene.environmentIntensity = ENV_INTENSITY;
    pmrem.dispose();
  }

  get visible(): boolean {
    return this.holder.visible;
  }

  setGun(id: WeaponId, color: string, skin: string): void {
    this.holder.clear();
    this.gunId = id;
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
    const [ox, oy, oz, orx] = HIP_OFFSET[this.gunId] ?? NO_OFFSET;
    let x = (HIP_X + ox) * (1 - t) + Math.sin(this.bobT) * BOB_X * amt;
    // Aiming, the sight (red dot / front post) lands exactly on the centre of the screen
    const sightY = this.gun.userData.sightY * this.holder.scale.y;
    let y = (HIP_Y + oy) * (1 - t) - sightY * t - Math.abs(Math.cos(this.bobT)) * BOB_Y * amt;
    let z =
      (HIP_Z + oz) * (1 - t) + (AIM_Z[this.gunId] ?? DEFAULT_AIM_Z) * t + f.kick * KICK_Z * (1 - t * KICK_ADS_CUT);
    let rx = f.kick * KICK_RX * (w.recoil > HEAVY_RECOIL ? 2 : 1) * (1 - t * KICK_ADS_CUT) + (HIP_RX + orx) * (1 - t);

    if (f.reloadEnd) {
      const p = 1 - (f.reloadEnd - now) / w.reload;
      const dip = Math.sin(Math.max(0, Math.min(1, p)) * Math.PI);
      y -= dip * RELOAD_DIP_Y;
      rx -= dip * RELOAD_DIP_RX;
    }
    if (now < f.swapUntil) y -= ((f.swapUntil - now) / WEAPON_HANDLING.swapMs) * SWAP_DROP;
    const firing = now - f.flashTime < FIRING_MS;
    const tilt = f.sliding ? (1 - t) * (firing ? SLIDE_TILT_FIRING : 1) : 0;
    this.slideTilt += (tilt - this.slideTilt) * damp(SLIDE_TILT_FOLLOW, dt);
    rx += this.slideTilt * SLIDE_RX;
    // Sprinting lowers and tilts the gun
    x -= sp * SPRINT_X;
    y -= sp * SPRINT_Y;
    rx -= sp * SPRINT_RX;

    let ry = sp * SPRINT_RY + HIP_RY * (1 - t);
    let rz = this.slideTilt * SLIDE_RZ + sp * SPRINT_RZ;
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
    this.updateFlash(now, f.flashTime);
  }

  private updateFlash(now: number, flashTime: number): void {
    const flash = this.gun?.userData.flash;
    if (!flash) return;
    const age = now - flashTime;
    flash.visible = age < FLASH_MS;
    if (flashTime !== this.lastFlash) {
      // Every shot gets a different star: random roll and size
      this.lastFlash = flashTime;
      flash.rotation.z = Math.random() * Math.PI * 2;
      flash.scale.setScalar(FLASH_SCALE_MIN + Math.random() * FLASH_SCALE_RANGE);
    }
    this.flashLight.intensity = flash.visible ? FLASH_LIGHT * (1 - age / FLASH_MS) : 0;
    if (flash.visible) this.flashLight.position.copy(flash.getWorldPosition(this.tmp));
  }

  /**
   * Where the muzzle of the first-person gun appears, as a world point seen by `camera` (the gun is
   * drawn with its own camera and FOV, so the point is rescaled to land on the same pixel).
   */
  muzzleWorld(camera: THREE.PerspectiveCamera, out: THREE.Vector3): THREE.Vector3 | null {
    if (!this.gun || !this.holder.visible) return null;
    this.holder.updateMatrixWorld();
    const p = out.set(0, this.gun.userData.muzzleY, this.gun.userData.muzzleZ).applyMatrix4(this.gun.matrixWorld);
    const k = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / Math.tan(THREE.MathUtils.degToRad(VM_FOV / 2));
    p.x *= k;
    p.y *= k;
    return p.applyMatrix4(camera.matrixWorld);
  }

  dispose(): void {
    this.scene.environment?.dispose();
    this.scene.environment = null;
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
}
