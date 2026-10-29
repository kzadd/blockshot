// The first-person gun and arms: their own scene and camera (so the gun never clips through walls),
// with bob, kick, reload dip, weapon swap, sprint lean, slide tilt and the knife slash.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { WEAPON_HANDLING, type CamoId, type FinishId, type Weapon, type WeaponId } from '@blockshot/shared';
import { loadGun } from '../render/gunAssets';
import { prop } from '../render/props';
import {
  FpArm,
  KNIFE_PITCH,
  KNIFE_ROLL,
  KNIFE_YAW,
  armPoses,
  buildGun,
  type GunModel,
  type HandPose,
} from '../render/models';
import { damp } from './util';

const VM_FOV = 60;
const HOLDER_SCALE = 0.62;
/** Reflections for the metal parts: a tiny room environment, prefiltered once. */
const ENV_INTENSITY = 0.55;
const ENV_BLUR = 0.04;
const BOB_RATE = 1.3;
const BOB_FULL_SPEED = 7;
const BOB_ADS_CUT = 0.85;
const BOB_SPRINT = 1.2;
const BOB_X = 0.014;
const BOB_Y = 0.012;
// Rest and aim positions: low and to the right, like Valorant/Krunker, clear of the ammo counter; high and close
// enough for both gloves to show
const HIP_X = 0.14;
const HIP_Y = -0.1;
const HIP_Z = -0.34;
/** Slight muzzle-up pitch and inward yaw at the hip: the stock drops out of the bottom of the screen. */
const HIP_RX = 0.08;
const HIP_RY = 0.03;
/** Canted a little at the hip so the right side of the gun and the hand on its grip face the camera. */
const HIP_RZ = 0.06;
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
/** Hip position tweaks per gun (x, y, z, pitch): the knife blade up (every gun shares the handguns' framing: the
 * right fist on the grip, the left hand under the barrel, its forearm to the bottom-left). */
const HIP_OFFSET: Partial<Record<WeaponId, readonly [number, number, number, number]>> = {
  knife: [0.03, 0.08, -0.16, KNIFE_PITCH - 0.05],
};
const NO_OFFSET = [0, 0, 0, 0] as const;
const DEFAULT_AIM_Z = -0.2;
/** Aimed, the gun's front sight sits this far (m) under the centre of the screen, inside the HUD's hexagon. */
const ADS_DROP = 0.03;
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
/** The left hand with a grenade (G) or an ability's object: how fast it comes up and the throw's length (ms). */
const OFFHAND_RISE = 12;
const THROW_MS = 280;
const OFFHAND_GRENADE = 0.075;
const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
/** The left hand raised by the left side of the gun, holding something (gun space), palm in, thumb up. */
const HELD: HandPose = { at: v3(-0.22, 0.03, -0.2), back: v3(-1, 0, 0.3), fore: v3(-0.4, -0.7, 0.6) };
/** Where the left arm waits when nothing needs it (handguns, the knife): down out of sight. */
const DOWN: HandPose = { ...HELD, at: v3(-0.32, -0.55, 0.2) };
/** Aimed, the forearms run back and down under the gun (no V of two arms across the screen). */
const AIM_FORE_R = v3(0.2, -0.7, 1);
const AIM_FORE_L = v3(-0.2, -0.7, 1);
const aimed = (p: HandPose, fore: THREE.Vector3, t: number): HandPose => ({ ...p, fore: p.fore.clone().lerp(fore, t) });
/** Abilities with an object in the left hand: pack model, size and how it sits in the hand (gun space). */
export type Gadget = 'shield' | 'medkit' | 'radio';
const GADGETS: Record<
  Gadget,
  { prop: 'shield' | 'medkit' | 'radio'; size: number; at: [number, number, number]; rot: [number, number, number] }
> = {
  // Riot shield: held up on the left, standing, its face to the front
  shield: { prop: 'shield', size: 0.62, at: [-0.06, -0.12, -0.02], rot: [-Math.PI / 2 + 0.15, 0.4, 0] },
  medkit: { prop: 'medkit', size: 0.13, at: [0, 0, 0], rot: [0, 0.4, 0] },
  radio: { prop: 'radio', size: 0.12, at: [0, 0, 0], rot: [0, 0.3, 0] },
};
const lerpPose = (a: HandPose, b: HandPose, t: number): HandPose => ({
  at: a.at.clone().lerp(b.at, t),
  back: a.back.clone().lerp(b.back, t),
  fore: a.fore.clone().lerp(b.fore, t),
});
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
  /** G held: the left hand brings a grenade up; released (thrownAt) it is thrown forward */
  grenadeAim?: boolean;
  thrownAt?: number;
}

export class ViewModel {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  private readonly holder = new THREE.Group();
  /** the forearms: the right hand stays on the gun, the left one leaves it to hold a grenade or a gadget */
  private armR: FpArm | null = null;
  private armL: FpArm | null = null;
  /** where the left hand holds the gun (null: the knife, held in the right hand alone) */
  private leftPose: HandPose | null = null;
  private rightPose: HandPose | null = null;
  /** what the left hand can hold: the grenade and the abilities' objects (children of the gun) */
  private readonly held = new THREE.Group();
  private offhandUp = 0;
  /** an ability's object in the left hand (Tanque's shield, the medkit, the radar's radio) until `gadgetUntil` */
  private gadget: Gadget | null = null;
  private gadgetUntil = 0;
  private gun: GunModel | null = null;
  private gunId: WeaponId = 'knife';
  /** bumps on every gun change, so a late pack model doesn't replace a newer gun */
  private gunToken = 0;
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
    const nade = prop('grenade', OFFHAND_GRENADE);
    nade.name = 'grenade';
    this.held.add(nade);
    for (const [name, g] of Object.entries(GADGETS)) {
      const item = prop(g.prop, g.size);
      item.name = name;
      item.position.set(...g.at);
      item.rotation.set(...g.rot);
      this.held.add(new THREE.Group().add(item));
      this.held.children[this.held.children.length - 1]!.name = name;
    }
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

  setGun(id: WeaponId, color: string, skin: string, camo: CamoId = 'liso', finish: FinishId = 'estandar'): void {
    const hold = (gun: GunModel) => {
      this.holder.clear();
      this.gun = gun;
      // The knife turns in the hand so the flat of the blade faces the camera
      if (id === 'knife') gun.rotation.z = KNIFE_ROLL;
      this.holder.add(gun);
      gun.add(this.held);
      const poses = armPoses(gun);
      this.leftPose = poses.left;
      this.rightPose = poses.right;
      this.armR = new FpArm(1, color, skin, camo);
      this.armL = new FpArm(-1, color, skin, camo);
      gun.add(this.armR.root, this.armL.root);
      this.armR.pose(poses.right);
      this.armL.pose(poses.left ?? DOWN);
    };
    this.gunId = id;
    // The procedural gun shows at once; the pack's model with the chosen finish replaces it when loaded
    hold(buildGun(id, true, color));
    const token = ++this.gunToken;
    void loadGun(id, { finish, color, camo, withFlash: true }).then((g) => {
      if (token === this.gunToken) hold(g);
    });
  }

  /** Shows an ability's object in the left hand until `until` (ms, performance.now()). */
  showGadget(g: Gadget, until: number): void {
    this.gadget = g;
    this.gadgetUntil = until;
  }

  /**
   * The left hand: on the gun (or down, with the knife) and, while G is held or an ability's object is out, raised
   * by the side of the gun holding it; a throw pushes it forward, opens it and brings it back. No third arm.
   */
  private updateOffhand(dt: number, now: number, f: ViewModelFrame): void {
    const throwT = (now - (f.thrownAt ?? -1e9)) / THROW_MS;
    const throwing = throwT < 1;
    const gadget = now < this.gadgetUntil && !f.grenadeAim && !throwing ? this.gadget : null;
    const up = !!f.grenadeAim || !!gadget || throwing;
    this.offhandUp += ((up ? 1 : 0) - this.offhandUp) * damp(OFFHAND_RISE, dt);
    for (const c of this.held.children) c.visible = c.name === (gadget ?? (f.grenadeAim ? 'grenade' : ''));
    if (!this.armL) return;
    let target = HELD;
    if (throwing) {
      // Forward and up as it lets go, then back
      const k = Math.sin(throwT * Math.PI);
      target = { ...HELD, at: HELD.at.clone().add(v3(0.1 * k, 0.06 * k, -0.28 * k)) };
    }
    const rest = this.leftPose ? aimed(this.leftPose, AIM_FORE_L, f.aimLerp) : DOWN;
    const pose = lerpPose(rest, target, this.offhandUp);
    this.armL.pose(pose);
    // The object sits in the palm, opposite the back of the hand
    this.held.position.copy(pose.at).addScaledVector(pose.back.clone().normalize(), -0.07);
  }

  update(dt: number, now: number, show: boolean, f: ViewModelFrame | null): void {
    this.holder.visible = show;
    if (!show || !f || !this.gun) return;
    this.updateOffhand(dt, now, f);
    if (this.armR && this.rightPose) this.armR.pose(aimed(this.rightPose, AIM_FORE_R, f.aimLerp));
    const w = f.weapon;
    if (f.grounded && !f.sliding) this.bobT += dt * f.speed * BOB_RATE;
    const sp = f.sprintLerp;
    const amt = Math.min(f.speed / BOB_FULL_SPEED, 1) * (1 - f.aimLerp * BOB_ADS_CUT) * (1 + sp * BOB_SPRINT);
    const t = f.aimLerp;
    const [ox, oy, oz, orx] = HIP_OFFSET[this.gunId] ?? NO_OFFSET;
    let x = (HIP_X + ox) * (1 - t) + Math.sin(this.bobT) * BOB_X * amt;
    // Aiming, the front sight sits just under the centre, inside the HUD's holographic hexagon
    const sightY = this.gun.userData.sightY * this.holder.scale.y;
    let y = (HIP_Y + oy) * (1 - t) - (sightY + ADS_DROP) * t - Math.abs(Math.cos(this.bobT)) * BOB_Y * amt;
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

    let ry = sp * SPRINT_RY + (this.gunId === 'knife' ? KNIFE_YAW : HIP_RY) * (1 - t);
    let rz = this.slideTilt * SLIDE_RZ + sp * SPRINT_RZ + (this.gunId === 'knife' ? 0 : HIP_RZ * (1 - t));
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
