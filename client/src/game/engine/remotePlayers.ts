// Other players: their models, name tags and an interpolation buffer. They are drawn VIEW_DELAY_MS in the
// past, between two received snapshots, so they move smoothly whatever the network jitter (the server
// rewinds by the same delay when checking shots).
import * as THREE from 'three';
import {
  CHAR_BY_ID,
  VIEW_DELAY_MS,
  isOutfitColor,
  isTeamMode,
  loadoutOf,
  type CamoId,
  type CharacterId,
  type FinishId,
  type HitTarget,
  type ModeId,
  type PlayerSnapshot,
  type SkinId,
  type Team,
  type WeaponId,
} from '@blockshot/shared';
import { prop } from '../render/props';
import { palette, teamColor } from '../../settings/palette';
import {
  buildCharacter,
  buildGun,
  makeNameTag,
  type CharacterModel,
  type GunModel,
  type NameTag,
} from '../render/models';
import { loadGun } from '../render/gunAssets';
import { damp, dampAngle } from './util';

const INFECTED_COLOR = '#6fcf3a';
/** Snapshots kept per player: 4.5 s at 20 Hz, enough to replay how you died. */
const BUFFER_SIZE = 90;
const NAME_TAG_Y = 2.3;
const REMOTE_GUN_SCALE = 1.3;
/** Muzzle flash of remote guns (ms) and the shot origin when the gun is not drawn yet. */
const REMOTE_FLASH_MS = 60;
const MUZZLE_Y_STANDING = 1.35;
const MUZZLE_Y_SLIDING = 0.85;
const BUBBLE_Y = 0.95;
// Spawn protection bubble
const bubbleGeo = new THREE.SphereGeometry(1, 18, 12);
const bubbleMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, depthWrite: false });
/** Scope glint: a bright star at the lens, the same size on screen at any distance. */
const GLINT_X = 0.14;
const GLINT_Y = 1.58;
const GLINT_Z = -0.7;
const GLINT_SIZE = 0.07;
let glintMaterial: THREE.SpriteMaterial | null = null;
function glintMat(): THREE.SpriteMaterial {
  if (glintMaterial) return glintMaterial;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,240,190,0.9)');
  grad.addColorStop(1, 'rgba(255,220,120,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = 'rgba(255,255,255,0.8)'; // star rays
  g.fillRect(0, 31, 64, 2);
  g.fillRect(31, 0, 2, 64);
  glintMaterial = new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(c),
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: false,
  });
  return glintMaterial;
}

/** Tanque's shield: the pack's riot shield held in front of the body (the model faces -z), feet to chest. */
const SHIELD_Y = 0.25;
const SHIELD_Z = -0.6;
const SHIELD_SIZE: [number, number, number] = [0.95, 0.08, 1.55];
const BUBBLE_OPACITY = 0.14;
const BUBBLE_PULSE = 0.08;
const BUBBLE_PULSE_SPEED = 0.008;
// Animation
const AIM_FOLLOW = 14;
const WALK_CYCLE = 2.2;
const WALK_FULL_SPEED = 7;
const LEG_SWING = 0.7;
const LEG_SWING_CROUCHED = 0.35;
/** Knee bend per radian of the leg swinging back while walking. */
const KNEE_BEND = 1.3;
/** Crouched: front shin vertical, back knee on the floor. */
const KNEE_CROUCH_FRONT = -1.1;
const KNEE_CROUCH_BACK = -1.25;
/** A running enemy (not crouched, not in the air) this close leaves a footstep mark. */
const FOOTSTEP_SPEED = 3;
const FOOTSTEP_EVERY_M = 4.5;
const FOOTSTEP_RANGE = 20;
const AIRBORNE_DY = 0.3;

export interface Sample {
  t: number;
  x: number;
  y: number;
  z: number;
  ry: number;
  rx: number;
  sl: number;
  cr: number;
}

export interface Outfit {
  color: string;
  skin: string;
  camo: CamoId;
}

export interface Remote {
  id: string;
  name: string;
  model: CharacterModel | null;
  tag: NameTag | null;
  bubble: THREE.Mesh | null;
  /** Tanque's shield in front of the body */
  shield: THREE.Object3D | null;
  /** lens glint of a sniper who is scoped in */
  glint: THREE.Sprite | null;
  charId: CharacterId | null;
  skin: SkinId | null;
  /** outfit colour picked by the player */
  co: string;
  cm: CamoId;
  fn: FinishId;
  team: Team | -1;
  color: string;
  weaponId: WeaponId | null;
  gun: GunModel | null;
  /** bumps on every gun change, so a late pack model doesn't replace a newer gun */
  gunToken: number;
  buffer: Sample[];
  rx: number;
  sl: number;
  cr: number;
  alive: boolean;
  wasAlive: boolean;
  prot: boolean;
  walk: number;
  stepAcc: number;
  /** performance.now() of its last shot (minimap) */
  lastShot: number;
}

/**
 * Walking swings the legs (`walk`: the cycle's phase); sliding stretches them; crouching puts a knee down.
 * `k` eases knees and height towards their pose. Also used for our own body in the death replay.
 */
export function animateLegs(m: CharacterModel, walk: number, speed: number, sl: number, cr: number, k: number): void {
  const swing = sl ? 0 : Math.sin(walk) * Math.min(speed / WALK_FULL_SPEED, 1) * (cr ? LEG_SWING_CROUCHED : LEG_SWING);
  const low = sl || cr;
  m.legL.rotation.x = sl ? 1.2 : cr ? 1.1 + swing : swing;
  m.legR.rotation.x = sl ? 1.2 : cr ? -0.35 - swing : -swing;
  const kneeL = sl ? 0 : cr ? KNEE_CROUCH_FRONT : -Math.max(0, -swing) * KNEE_BEND;
  const kneeR = sl ? 0 : cr ? KNEE_CROUCH_BACK : -Math.max(0, swing) * KNEE_BEND;
  m.kneeL.rotation.x += (kneeL - m.kneeL.rotation.x) * k;
  m.kneeR.rotation.x += (kneeR - m.kneeR.rotation.x) * k;
  m.legL.position.y = m.legR.position.y += ((low ? 0.5 : 0.8) - m.legR.position.y) * k;
  m.upper.position.y += ((low ? -0.5 : 0) - m.upper.position.y) * k;
}

/** How fast the walk cycle turns per metre walked (shared with the replay ghost). */
export const WALK_PHASE_PER_M = WALK_CYCLE;

/**
 * In team modes everybody wears its team colour on a plain uniform (a camouflage would hide who is who);
 * in free for all, the colour and camouflage the player picked. The skin (who you are) is always yours.
 */
export function outfitFor(
  mode: ModeId,
  charId: CharacterId,
  skin: string,
  team: Team,
  color?: string,
  camo: CamoId = 'liso',
): Outfit {
  const ch = CHAR_BY_ID[charId];
  if (mode === 'infect' && team === 2) return { color: INFECTED_COLOR, skin: 'zombi', camo: 'liso' };
  if (isTeamMode(mode) && team) return { color: teamColor(team, ch.color), skin, camo: 'liso' };
  return { color: isOutfitColor(color) ? color : ch.color, skin, camo };
}

export class RemotePlayers {
  readonly all = new Map<string, Remote>();
  private readonly tmp = new THREE.Vector3();

  constructor(
    private readonly scene: THREE.Scene,
    private readonly mode: ModeId,
    private readonly limit: number,
    private readonly isMate: (team: Team) => boolean,
    private readonly myTeam: () => Team,
  ) {}

  /** Forces every model to be rebuilt (team change, colourblind palette). */
  invalidate(): void {
    for (const r of this.all.values()) r.team = -1;
  }

  onSnapshot(players: readonly PlayerSnapshot[], myId: string, now: number): void {
    const seen = new Set<string>();
    for (const p of players) {
      if (p.id === myId) continue;
      seen.add(p.id);
      let r = this.all.get(p.id);
      if (!r) {
        r = {
          id: p.id,
          name: p.n,
          model: null,
          tag: null,
          bubble: null,
          shield: null,
          glint: null,
          charId: null,
          skin: null,
          co: '',
          team: -1,
          color: '#ffffff',
          weaponId: null,
          gun: null,
          buffer: [],
          rx: 0,
          sl: 0,
          cr: 0,
          alive: false,
          wasAlive: false,
          prot: false,
          walk: 0,
          stepAcc: 0,
          gunToken: 0,
          cm: 'liso',
          fn: 'estandar',
          lastShot: 0,
        };
        this.all.set(p.id, r);
      }
      const changed =
        r.charId !== p.c || r.skin !== p.sk || r.co !== p.co || r.cm !== p.cm || r.fn !== p.fn || r.team !== p.tm;
      if (p.c && changed) this.build(r, p);
      r.name = p.n;
      r.rx = p.rx;
      r.sl = p.sl;
      r.cr = p.cr;
      r.alive = !!p.a;
      r.prot = !!p.pr;
      if (r.shield) r.shield.visible = !!p.sh;
      if (r.glint) r.glint.visible = !!p.gl;
      if (!r.model || !r.charId) continue;
      // A player that just (re)spawned jumps to its new place instead of sliding there
      if (r.alive && !r.wasAlive) r.buffer.length = 0;
      r.buffer.push({ t: now, x: p.x, y: p.y, z: p.z, ry: p.ry, rx: p.rx, sl: p.sl, cr: p.cr });
      if (r.buffer.length > BUFFER_SIZE) r.buffer.shift();
      const ch = CHAR_BY_ID[r.charId];
      r.tag?.userData.setHp(Math.min(1, p.h / (p.mh || ch.hp)));
      const wid = loadoutOf(this.mode, ch, p.lv, this.limit, p.tm)[p.s] ?? ch.primary;
      if (wid !== r.weaponId) this.setGun(r, wid);
      if (r.alive && !r.wasAlive) {
        r.model.group.position.set(p.x, p.y, p.z);
        r.model.group.rotation.y = p.ry;
      }
      r.wasAlive = r.alive;
      r.model.group.visible = r.alive;
    }
    for (const id of [...this.all.keys()]) if (!seen.has(id)) this.remove(id);
  }

  private build(r: Remote, p: PlayerSnapshot): void {
    if (!p.c) return;
    if (r.model) this.scene.remove(r.model.group);
    const { color, skin, camo } = outfitFor(this.mode, p.c, p.sk, p.tm, p.co, p.cm);
    r.model = buildCharacter(p.c, skin, color, camo);
    r.color = color;
    // Team modes: name in the team colour (teammates are seen through walls); otherwise the enemy colour
    const teams = isTeamMode(this.mode);
    const mate = teams && p.tm === this.myTeam();
    const tag = makeNameTag(p.n, teams ? teamColor(p.tm, palette().enemy) : palette().enemy, mate);
    tag.position.y = NAME_TAG_Y;
    r.model.group.add(tag);
    r.tag = tag;
    r.bubble = new THREE.Mesh(bubbleGeo, bubbleMat);
    r.bubble.scale.set(0.7, 1.1, 0.7);
    r.bubble.position.y = BUBBLE_Y;
    r.bubble.visible = false;
    r.model.group.add(r.bubble);
    // The model lies flat (long side along z): stood up on its bottom edge
    r.shield = new THREE.Group().add(prop('shield', SHIELD_SIZE));
    r.shield.children[0]!.rotation.x = -Math.PI / 2;
    r.shield.children[0]!.position.y = SHIELD_SIZE[2] / 2;
    r.shield.position.set(0, SHIELD_Y, SHIELD_Z);
    r.shield.visible = false;
    r.model.group.add(r.shield);
    r.glint = new THREE.Sprite(glintMat());
    r.glint.position.set(GLINT_X, GLINT_Y, GLINT_Z);
    r.glint.scale.setScalar(GLINT_SIZE);
    r.glint.visible = false;
    r.model.group.add(r.glint);
    r.model.group.position.set(p.x, p.y, p.z);
    this.scene.add(r.model.group);
    r.charId = p.c;
    r.skin = p.sk;
    r.co = p.co;
    r.cm = p.cm;
    r.fn = p.fn;
    r.team = p.tm;
    r.weaponId = null;
    r.gun = null;
    r.buffer.length = 0;
  }

  private setGun(r: Remote, wid: WeaponId): void {
    if (!r.model) return;
    const hold = (g: GunModel) => {
      g.scale.setScalar(REMOTE_GUN_SCALE);
      r.model?.holdGun(g);
      r.gun = g;
    };
    // The procedural gun shows at once; the pack's model (with the player's finish) replaces it when loaded
    hold(buildGun(wid, true, r.color));
    r.weaponId = wid;
    const token = ++r.gunToken;
    const model = r.model;
    void loadGun(wid, { finish: r.fn, color: r.color, camo: r.cm, withFlash: true }).then((g) => {
      if (r.gunToken === token && r.model === model) hold(g);
    });
  }

  private remove(id: string): void {
    const r = this.all.get(id);
    if (r?.model) this.scene.remove(r.model.group);
    this.all.delete(id);
  }

  /** Interpolated pose at `renderTime` (ms, performance.now based). */
  private sample(r: Remote, renderTime: number): Sample | null {
    const b = r.buffer;
    const last = b[b.length - 1];
    if (!last) return null;
    if (renderTime >= last.t || b.length === 1) return last;
    for (let i = b.length - 1; i > 0; i--) {
      const a = b[i - 1]!;
      const c = b[i]!;
      if (a.t <= renderTime) {
        const k = (renderTime - a.t) / Math.max(1, c.t - a.t);
        return {
          t: renderTime,
          x: a.x + (c.x - a.x) * k,
          y: a.y + (c.y - a.y) * k,
          z: a.z + (c.z - a.z) * k,
          ry: dampAngle(a.ry, c.ry, k),
          rx: a.rx + (c.rx - a.rx) * k,
          sl: c.sl,
          cr: c.cr,
        };
      }
    }
    return b[0]!;
  }

  /** Pose of a remote at `renderTime` (death replay camera). */
  poseAt(id: string, renderTime: number): Sample | null {
    const r = this.all.get(id);
    return r ? this.sample(r, renderTime) : null;
  }

  /**
   * Moves and animates every remote; `footstep` is called for nearby running enemies. `rewind` (ms) draws
   * everybody that much further in the past (death replay); `hidden` is not drawn (the replay camera is in it).
   */
  update(
    dt: number,
    now: number,
    me: THREE.Vector3 | null,
    footstep: (x: number, z: number) => void,
    rewind = 0,
    hidden: string | null = null,
  ): void {
    const k = damp(AIM_FOLLOW, dt);
    bubbleMat.opacity = BUBBLE_OPACITY + BUBBLE_PULSE * Math.sin(now * BUBBLE_PULSE_SPEED);
    const renderTime = now - VIEW_DELAY_MS - rewind;
    for (const r of this.all.values()) {
      if (r.model) r.model.group.visible = r.alive && r.id !== hidden;
      if (!r.model || !r.alive) continue;
      if (r.bubble) r.bubble.visible = r.prot;
      const flash = r.gun?.userData.flash;
      if (flash) flash.visible = now - r.lastShot < REMOTE_FLASH_MS;
      const g = r.model.group;
      const s = this.sample(r, renderTime);
      if (!s) continue;
      const bx = g.position.x;
      const bz = g.position.z;
      g.position.set(s.x, s.y, s.z);
      g.rotation.y = s.ry;
      r.model.aim.rotation.x += (s.rx - r.model.aim.rotation.x) * k;
      const speed = Math.hypot(g.position.x - bx, g.position.z - bz) / Math.max(dt, 1e-4);
      r.walk += speed * dt * WALK_CYCLE;
      const latest = r.buffer[r.buffer.length - 1]!;
      // Footsteps: a nearby enemy running (not crouched, not in the air) leaves a white mark
      if (
        me &&
        !this.isMate(r.team === -1 ? 0 : r.team) &&
        !r.cr &&
        speed > FOOTSTEP_SPEED &&
        Math.abs(g.position.y - latest.y) < AIRBORNE_DY
      ) {
        r.stepAcc += speed * dt;
        if (r.stepAcc > FOOTSTEP_EVERY_M && g.position.distanceTo(me) < FOOTSTEP_RANGE) {
          r.stepAcc = 0;
          footstep(g.position.x, g.position.z);
        }
      }
      animateLegs(r.model, r.walk, speed, s.sl, s.cr, k);
    }
  }

  /** Where every visible enemy is drawn right now (what the player aims at). */
  targets(): HitTarget[] {
    const out: HitTarget[] = [];
    for (const r of this.all.values()) {
      const g = r.model?.group.position;
      if (r.alive && g && !this.isMate(r.team === -1 ? 0 : r.team)) {
        out.push({ id: r.id, x: g.x, y: g.y, z: g.z, sl: r.sl, cr: r.cr, alive: true });
      }
    }
    return out;
  }

  /** World position of a remote's model, if it is drawn. */
  position(id: string | null): THREE.Vector3 | null {
    if (!id) return null;
    return this.all.get(id)?.model?.group.position ?? null;
  }

  markShot(id: string, now: number): Remote | undefined {
    const r = this.all.get(id);
    if (!r) return r;
    r.lastShot = now;
    const flash = r.gun?.userData.flash;
    if (flash) {
      flash.rotation.z = Math.random() * Math.PI * 2;
      flash.visible = true;
    }
    return r;
  }

  /** Shot origin of a remote: the muzzle of the gun it holds (or its gun height while not drawn). */
  muzzle(r: Remote, out = this.tmp): THREE.Vector3 | null {
    if (r.gun && r.model) {
      r.model.group.updateMatrixWorld(true);
      return r.gun.localToWorld(out.set(0, r.gun.userData.muzzleY, r.gun.userData.muzzleZ));
    }
    const g = r.model?.group.position;
    return g ? out.set(g.x, g.y + (r.sl ? MUZZLE_Y_SLIDING : MUZZLE_Y_STANDING), g.z) : null;
  }

  dispose(): void {
    for (const id of [...this.all.keys()]) this.remove(id);
  }
}
