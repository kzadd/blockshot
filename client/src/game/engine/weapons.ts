// The player's weapons on the client: ammo, reload, fire rate, spread, recoil and aiming. Shots are only
// drawn here; the server decides what they hit (it receives origin and directions).
import * as THREE from 'three';
import {
  VIEW_DELAY_MS,
  WEAPONS,
  castShot,
  type Collider,
  type HitTarget,
  type MoveState,
  type ShootMessage,
  type Vec3,
  type Weapon,
  type WeaponId,
} from '@blockshot/shared';
import type { EventBus } from './events';
import type { InputController } from './input';
import { damp, spreadDir } from './util';

const SWAP_MS = 250;
/** Scope only counts once the rifle is almost up. */
const SCOPE_READY = 0.85;
const DEFAULT_ADS_SPEED = 16;
/** Recoil starts coming back this long after the last shot. */
const RECOIL_RECOVER_DELAY_MS = 90;
const RECOIL_RECOVER_BASE = 0.25;
const RECOIL_RECOVER_RATE = 6;
const PITCH_LIMIT = 1.55;
/** Aiming reduces recoil by up to this fraction. */
const ADS_RECOIL_CUT = 0.35;
const RECOIL_JITTER = 0.4;
const RECOIL_YAW = 0.3;
/** Bloom recovers this long after the last shot, at this rate (1/s). */
const BLOOM_RECOVER_DELAY_MS = 140;
const BLOOM_RECOVER_RATE = 7;
// Spread factors (hip fire defaults, overridden while aiming by the weapon's own values)
const HIP_MOVE_SPREAD = 0.6;
const HIP_AIR_SPREAD = 1.8;
const MOVE_SPREAD_FULL_SPEED = 8;
const CROUCH_SPREAD = 0.7;
const SPRINT_SPREAD = 1.5;
/** While aiming, bloom opens half as much. */
const ADS_BLOOM_CUT = 0.5;
/** Hip-fire tracers leave the gun on the right; aiming, from the centre. */
const MUZZLE_HIP: Vec3 = [0.22, -0.16, -0.7];
const MUZZLE_AIM_X = 0;
/** A shot counts as missed if no hit marker arrives within this time. */
const SHOT_CONFIRM_MS = 400;
/** Hits in a row (combo ×N) reset after this long without hitting. */
const COMBO_RESET_MS = 1500;
const AIM_HALF = 0.5;
/** Gun kick animation recovery (1/s). */
const KICK_RECOVER = 9;
const DIRECTION_DECIMALS = 4;

interface Ammo {
  mag: number;
  /** performance.now() when the reload ends (0 = not reloading) */
  reloadEnd: number;
}

export interface Shooter {
  camera: THREE.Camera;
  colliders: readonly Collider[];
  targets(): HitTarget[];
  rtt(): number;
  send(msg: ShootMessage): void;
  /** a shot or slash was fired (it removes spawn protection) */
  fired(): void;
  sendReload(): void;
  sendSwitch(slot: number): void;
  tracer(from: THREE.Vector3, to: THREE.Vector3): void;
  impact(at: THREE.Vector3, onPlayer: boolean): void;
}

const round = (v: number) => +v.toFixed(DIRECTION_DECIMALS);

export class WeaponController {
  loadout: WeaponId[] = [];
  slot = 0;
  prevSlot = 1;
  ammo: Ammo[] = [];
  lastShot: number[] = [0, 0, 0];
  swapUntil = 0;
  swingAt = 0;
  aimLerp = 0;
  /** accumulated recoil that comes back by itself */
  recoil = 0;
  /** extra spread from firing in a row (recovers by itself) */
  bloom = 0;
  /** gun kick animation (1 → 0) */
  kick = 0;
  flashTime = 0;
  combo = 0;
  comboAt = 0;
  private readonly pendingShots: number[] = [];

  constructor(
    private readonly input: InputController,
    private readonly bus: EventBus,
    private readonly shooter: Shooter,
    /** called when the gun in hand changes (to rebuild the first-person model) */
    private readonly onGunChanged: () => void,
  ) {}

  weaponId(slot = this.slot): WeaponId {
    return this.loadout[slot] ?? this.loadout[0] ?? 'knife';
  }
  weapon(): Weapon {
    return WEAPONS[this.weaponId()];
  }
  current(): Ammo {
    return this.ammo[this.slot] ?? { mag: 0, reloadEnd: 0 };
  }

  /** Weapons for the mode and level, with full magazines. */
  equip(loadout: WeaponId[]): void {
    this.loadout = loadout;
    this.ammo = loadout.map((id) => ({ mag: WEAPONS[id].mag, reloadEnd: 0 }));
    this.lastShot = loadout.map(() => 0);
    this.slot = 0;
    this.prevSlot = 1;
    this.bloom = 0;
    this.recoil = 0;
    this.aimLerp = 0;
    this.onGunChanged();
  }

  /** Mouse sensitivity multiplier: 1 hip fire; while aiming it compensates the zoom × adsSens. */
  sensMultiplier(adsSens: number): number {
    const w = this.weapon();
    const t = w.scope ? (this.scoped() ? 1 : 0) : this.aimLerp;
    const zoom = 1 + (w.zoom - 1) * t;
    return 1 + (adsSens / zoom - 1) * t;
  }

  switchSlot(s: number, now: number): void {
    if (s === this.slot || s >= this.loadout.length) return;
    this.current().reloadEnd = 0;
    this.prevSlot = this.slot;
    this.slot = s;
    this.swapUntil = now + SWAP_MS;
    this.bloom = 0;
    this.input.aiming = false;
    this.onGunChanged();
    this.shooter.sendSwitch(s);
  }

  cycle(dir: 1 | -1, now: number): void {
    const n = this.loadout.length;
    if (n) this.switchSlot((this.slot + (dir < 0 ? n - 1 : 1)) % n, now);
  }

  startReload(now: number): void {
    const w = this.weapon();
    const a = this.current();
    if (w.melee || a.reloadEnd || a.mag === w.mag) return;
    a.reloadEnd = now + w.reload;
    this.shooter.sendReload();
    this.bus.emit('reload');
  }

  scoped(): boolean {
    const w = this.weapon();
    return !!w.scope && this.aimLerp > SCOPE_READY && !this.current().reloadEnd;
  }

  /** The view comes back down by itself after shooting (unless you already pulled it down). */
  recoverRecoil(dt: number, now: number): void {
    if (this.recoil <= 0 || now - (this.lastShot[this.slot] ?? 0) < RECOIL_RECOVER_DELAY_MS) return;
    const back = Math.min(this.recoil, dt * (RECOIL_RECOVER_BASE + this.recoil * RECOIL_RECOVER_RATE));
    this.input.pitch -= back;
    this.recoil -= back;
  }

  pulledDown(radians: number): void {
    this.recoil = Math.max(0, this.recoil - radians);
  }

  /** Aiming is not instant: the sight comes up at the weapon's adsSpeed (bolt, reload and swap lower it). */
  updateAim(dt: number, now: number): void {
    const w = this.weapon();
    const bolt = w.bolt && now - (this.lastShot[this.slot] ?? 0) < (w.boltTime ?? w.fireRate * SCOPE_READY);
    const busy = this.current().reloadEnd || now < this.swapUntil || bolt;
    this.aimLerp +=
      ((this.input.aiming && !busy && !w.melee ? 1 : 0) - this.aimLerp) * damp(w.adsSpeed ?? DEFAULT_ADS_SPEED, dt);
  }

  update(now: number, dt: number, move: MoveState): void {
    const w = this.weapon();
    const a = this.current();
    if (a.reloadEnd && now >= a.reloadEnd) {
      a.mag = w.mag;
      a.reloadEnd = 0;
    }
    if (a.mag === 0 && !a.reloadEnd && !w.melee) this.startReload(now);
    if ((this.input.mouseDown || this.input.clicked) && this.input.locked) this.tryShoot(now, w, a, move);
    this.input.clicked = false;
    this.recoverRecoil(dt, now);
    // Burst spread comes down as soon as you stop firing
    if (now - (this.lastShot[this.slot] ?? 0) > BLOOM_RECOVER_DELAY_MS)
      this.bloom *= Math.exp(-BLOOM_RECOVER_RATE * dt);
    this.kick = Math.max(0, this.kick - dt * KICK_RECOVER);
  }

  /** Hits in a row: a shot without a hit marker in time, or a pause, resets the combo (also while dead). */
  tickCombo(now: number): void {
    while (this.pendingShots.length && now - this.pendingShots[0]! > SHOT_CONFIRM_MS) {
      this.pendingShots.shift();
      this.combo = 0;
    }
    if (this.combo && now - this.comboAt > COMBO_RESET_MS) this.combo = 0;
  }

  /** Current spread: moving, sprinting and jumping open it; aiming and crouching close it. */
  spread(w: Weapon, move: MoveState): number {
    const hs = Math.hypot(move.vx, move.vz);
    // With the scope on screen the shot goes where you look (no need to wait for it to finish rising)
    const t = this.scoped() ? 1 : this.aimLerp * this.aimLerp * (3 - 2 * this.aimLerp);
    // Base (hip → aim) plus what consecutive fire opened (half as much while aiming)
    let sp = w.spread + (w.adsSpread - w.spread) * t + this.bloom * (1 - ADS_BLOOM_CUT * t);
    const moveSpread = HIP_MOVE_SPREAD + ((w.moveSpread ?? HIP_MOVE_SPREAD) - HIP_MOVE_SPREAD) * t;
    const airSpread = HIP_AIR_SPREAD + ((w.airSpread ?? HIP_AIR_SPREAD) - HIP_AIR_SPREAD) * t;
    sp *= 1 + Math.min(hs / MOVE_SPREAD_FULL_SPEED, 1) * moveSpread;
    if (!move.grounded) sp *= airSpread;
    else if (move.crouching && !move.sliding) sp *= CROUCH_SPREAD;
    if (move.sprinting) sp *= SPRINT_SPREAD;
    return sp;
  }

  private lag(): number {
    return Math.round(this.shooter.rtt() / 2 + VIEW_DELAY_MS);
  }

  private tryShoot(now: number, w: Weapon, a: Ammo, move: MoveState): void {
    if (a.reloadEnd || a.mag <= 0 || now < this.swapUntil) return;
    if (now - (this.lastShot[this.slot] ?? 0) < w.fireRate) return;
    if (!w.auto && !this.input.triggerReleased) return;
    this.input.triggerReleased = false;
    this.lastShot[this.slot] = now;
    this.shooter.fired();
    this.input.markShot(); // shooting stops the sprint for a moment (simulated with the movement)
    if (w.melee) return this.swing(now, w);
    a.mag--;

    const cam = this.shooter.camera;
    const base = cam.getWorldDirection(new THREE.Vector3());
    const sp = this.spread(w, move);
    const o: Vec3 = [cam.position.x, cam.position.y, cam.position.z];
    const targets = this.shooter.targets();
    const muzzle = new THREE.Vector3(
      this.aimLerp > AIM_HALF ? MUZZLE_AIM_X : MUZZLE_HIP[0],
      MUZZLE_HIP[1],
      MUZZLE_HIP[2],
    )
      .applyQuaternion(cam.quaternion)
      .add(cam.position);
    const dirs: Vec3[] = [];
    for (let i = 0; i < w.pellets; i++) {
      const d = spreadDir(base, sp);
      dirs.push([round(d.x), round(d.y), round(d.z)]);
      const { t, hit } = castShot(o, [d.x, d.y, d.z], this.shooter.colliders, targets, '', w.range);
      const end = cam.position.clone().addScaledVector(d, t);
      this.shooter.tracer(muzzle, end);
      if (hit) this.shooter.impact(end, hit.type === 'player');
    }
    this.shooter.send({ o, d: dirs, lag: this.lag() });
    this.bloom = Math.min(w.bloomMax ?? 0, this.bloom + (w.bloom ?? 0));
    this.pendingShots.push(now);

    // Aiming, recoil is smaller
    const kickUp =
      w.recoil * (1 - RECOIL_JITTER / 2 + Math.random() * RECOIL_JITTER) * (1 - ADS_RECOIL_CUT * this.aimLerp);
    this.input.pitch = Math.min(PITCH_LIMIT, this.input.pitch + kickUp);
    this.recoil += kickUp;
    this.input.yaw += (Math.random() - 0.5) * w.recoil * RECOIL_YAW;
    this.kick = 1;
    this.flashTime = now;
    this.bus.emit('shot', { weapon: w.sound, volume: 1 });
  }

  // Knife slash: no tracer or recoil; the server forgives the aim a bit at this distance
  private swing(now: number, w: Weapon): void {
    const cam = this.shooter.camera;
    const d = cam.getWorldDirection(new THREE.Vector3());
    const o: Vec3 = [cam.position.x, cam.position.y, cam.position.z];
    this.shooter.send({ o, d: [[round(d.x), round(d.y), round(d.z)]], lag: this.lag() });
    this.pendingShots.push(now);
    this.swingAt = now;
    this.bus.emit('shot', { weapon: w.sound, volume: 1 });
  }

  /** The server confirmed a hit of one of our shots. */
  confirmHit(now: number): void {
    if (!this.pendingShots.length) return;
    this.pendingShots.shift();
    this.combo++;
    this.comboAt = now;
  }
}
