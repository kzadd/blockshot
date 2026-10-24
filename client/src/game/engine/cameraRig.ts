// The world camera: eye height, landing dip and FOV while alive; looking at the killer after dying; a
// slow orbit over the map before the first spawn.
import * as THREE from 'three';
import { PLAYER, type Weapon } from '@blockshot/shared';
import { damp } from './util';

const EYE_FOLLOW = 12;
const LAND_DIP_RECOVER = 9;
const LAND_DIP_MAX = 0.3;
const LAND_DIP_PER_MS = 0.014;
const SPRINT_FOLLOW = 10;
const FOV_FOLLOW = 18;
const SLIDE_FOV = 6;
const SPRINT_FOV = 5;
/** Sprinting only shows (FOV, lowered gun) above this speed. */
const SPRINT_MIN_SPEED = 1;
const DEATH_CAM_UP = 3;
const DEATH_CAM_FOLLOW = 3;
const DEATH_FOV_FOLLOW = 8;
const KILLER_EYE = 1.4;
const ORBIT_SPEED = 0.00006;
const ORBIT_RADIUS = 1.15;
const ORBIT_HEIGHT = 0.65;
const ORBIT_TARGET_Y = 2;

export interface CameraFrame {
  position: THREE.Vector3;
  yaw: number;
  pitch: number;
  low: boolean;
  sliding: boolean;
  sprinting: boolean;
  speed: number;
  weapon: Weapon;
  aimLerp: number;
  scoped: boolean;
}

export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  baseFov: number;
  fov: number;
  sprintLerp = 0;
  private eye = PLAYER.eye;
  private landDip = 0;
  private readonly tmp = new THREE.Vector3();

  constructor(fov: number, aspect: number, far: number) {
    this.baseFov = fov;
    this.fov = fov;
    this.camera = new THREE.PerspectiveCamera(fov, aspect, 0.05, far);
    this.camera.rotation.order = 'YXZ';
  }

  reset(): void {
    this.eye = PLAYER.eye;
    this.landDip = 0;
  }

  /** A hard landing dips the camera a little. */
  land(fall: number): void {
    this.landDip = Math.min(LAND_DIP_MAX, -fall * LAND_DIP_PER_MS);
  }

  alive(dt: number, f: CameraFrame): void {
    const cam = this.camera;
    this.eye += ((f.low ? PLAYER.slideEye : PLAYER.eye) - this.eye) * damp(EYE_FOLLOW, dt);
    this.landDip *= Math.exp(-LAND_DIP_RECOVER * dt);
    cam.position.set(f.position.x, f.position.y + this.eye - this.landDip, f.position.z);
    cam.rotation.set(f.pitch, f.yaw, 0);
    const running = f.sprinting && f.speed > SPRINT_MIN_SPEED;
    this.sprintLerp += ((running ? 1 : 0) - this.sprintLerp) * damp(SPRINT_FOLLOW, dt);
    const zoomT = f.weapon.scope ? (f.scoped ? 1 : 0) : f.aimLerp;
    const target =
      this.baseFov / (1 + (f.weapon.zoom - 1) * zoomT) + (f.sliding ? SLIDE_FOV : 0) + this.sprintLerp * SPRINT_FOV;
    this.fov += (target - this.fov) * damp(FOV_FOLLOW, dt);
    this.apply();
  }

  /** Death camera: rises and looks at whoever killed you. */
  dead(dt: number, deathPos: THREE.Vector3, killer: THREE.Vector3 | null): void {
    const cam = this.camera;
    cam.position.lerp(this.tmp.copy(deathPos).add(new THREE.Vector3(0, DEATH_CAM_UP, 0)), damp(DEATH_CAM_FOLLOW, dt));
    if (killer) cam.lookAt(killer.clone().add(new THREE.Vector3(0, KILLER_EYE, 0)));
    this.fov += (this.baseFov - this.fov) * damp(DEATH_FOV_FOLLOW, dt);
    this.apply();
  }

  /** Before spawning: a slow orbit over the map. */
  orbit(now: number, half: number): void {
    const t = now * ORBIT_SPEED;
    const r = half * ORBIT_RADIUS;
    this.camera.position.set(Math.sin(t) * r, half * ORBIT_HEIGHT, Math.cos(t) * r);
    this.camera.lookAt(0, ORBIT_TARGET_Y, 0);
    this.fov = this.baseFov;
    this.apply();
  }

  private apply(): void {
    this.camera.fov = this.fov;
    this.camera.updateProjectionMatrix();
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
}
